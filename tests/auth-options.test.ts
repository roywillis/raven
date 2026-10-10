import type { Account, Profile, User } from "next-auth";
import type { JWT } from "next-auth/jwt";
import { describe, expect, it } from "vitest";
import { buildAuthOptions, ROLE_RECHECK_MS } from "@/auth/options";
import { FixtureRepository } from "@/data/fixture/fixture-repository";
import { SECRET } from "./helpers";

const users = new FixtureRepository(
  [],
  [
    { email: "analyst@raven.id", display_name: "Ana", role: "analyst", active: true },
    { email: "former@raven.id", display_name: "Old", role: "analyst", active: false },
  ],
);

function options(now = () => 0) {
  return buildAuthOptions({ secret: SECRET, google: { clientId: "id", clientSecret: "s" }, devSignIn: false }, users, now);
}

const signIn = (email: string, provider: string, emailVerified = true) =>
  options().callbacks!.signIn!({
    user: { id: email, email } as User,
    account: { provider, type: "oauth", providerAccountId: email } as Account,
    profile: { email, email_verified: emailVerified } as Profile,
  });

describe("sign-in allowlist", () => {
  it("allows only active, registered users with a verified Google email", async () => {
    expect(await signIn("Analyst@Raven.id", "google")).toBe(true);
    expect(await signIn("analyst@raven.id", "google", false)).toBe(false);
    expect(await signIn("former@raven.id", "google")).toBe(false);
    expect(await signIn("stranger@gmail.com", "google")).toBe(false);
  });

  it("only offers dev sign-in when enabled", () => {
    // next-auth merges a provider's `options.id` over its default id at runtime.
    const ids = (opts: ReturnType<typeof options>) =>
      opts.providers.map((provider) => (provider as { options?: { id?: string } }).options?.id ?? provider.id);
    expect(ids(options())).toEqual(["google"]);
    expect(ids(buildAuthOptions({ secret: SECRET, devSignIn: true }, users))).toEqual(["dev"]);
  });
});

describe("session role", () => {
  it("stores the role at sign-in and drops it once the user is deactivated", async () => {
    let now = 0;
    const jwt = options(() => now).callbacks!.jwt!;
    let token = (await jwt({ token: { email: "analyst@raven.id" } as JWT, user: { id: "x" } as User } as never)) as JWT;
    expect(token.role).toBe("analyst");

    users.findUser = async (email) => ({ email, display_name: "Ana", role: "analyst", active: false });
    now = ROLE_RECHECK_MS - 1;
    token = (await jwt({ token } as never)) as JWT;
    expect(token.role).toBe("analyst");

    now = ROLE_RECHECK_MS + 1;
    token = (await jwt({ token } as never)) as JWT;
    expect(token.role).toBeNull();
  });
});
