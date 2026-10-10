import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import { getConfig, type AuthConfig } from "@/config/env";
import { getRepositories } from "@/data";
import type { UserDirectory } from "@/data/ports";

/** Sessions last one working day. */
export const SESSION_MAX_AGE_SECONDS = 8 * 60 * 60;
/** How often an active session re-checks the user's role and `active` flag. */
export const ROLE_RECHECK_MS = 5 * 60 * 1000;

/**
 * Sign-in is limited to users who are `active` in `raven_users`. Google accounts must have a
 * verified email. The role is stored in the JWT and re-checked every ROLE_RECHECK_MS, so
 * deactivating a user takes effect within minutes.
 */
export function buildAuthOptions(
  config: AuthConfig,
  users: UserDirectory,
  now: () => number = Date.now,
): NextAuthOptions {
  const providers: NextAuthOptions["providers"] = [];
  if (config.google) {
    providers.push(
      GoogleProvider({
        clientId: config.google.clientId,
        clientSecret: config.google.clientSecret,
        authorization: { params: { prompt: "select_account" } },
      }),
    );
  }
  if (config.devSignIn) {
    providers.push(
      CredentialsProvider({
        id: "dev",
        name: "Local dev sign-in",
        credentials: { email: { label: "Email", type: "email" } },
        async authorize(credentials) {
          const user = await users.findUser(credentials?.email ?? "");
          return user?.active ? { id: user.email, email: user.email, name: user.display_name } : null;
        },
      }),
    );
  }

  return {
    providers,
    secret: config.secret,
    session: { strategy: "jwt", maxAge: SESSION_MAX_AGE_SECONDS },
    pages: { signIn: "/signin", error: "/signin" },
    callbacks: {
      async signIn({ user, account, profile }) {
        if (account?.provider === "google" && (profile as { email_verified?: boolean } | undefined)?.email_verified !== true) {
          return false;
        }
        const registered = user.email ? await users.findUser(user.email) : null;
        return registered?.active === true;
      },
      async jwt({ token, user }) {
        const stale = token.roleCheckedAt === undefined || now() - token.roleCheckedAt > ROLE_RECHECK_MS;
        if ((user || stale) && token.email) {
          try {
            const registered = await users.findUser(token.email);
            token.role = registered?.active ? registered.role : null;
            if (registered) token.name = registered.display_name;
            token.roleCheckedAt = now();
          } catch (error) {
            // Directory unavailable: keep the last known role and retry on the next request.
            console.error("[raven] role re-check failed:", error);
          }
        }
        return token;
      },
      async session({ session, token }) {
        session.user = { email: token.email ?? "", name: token.name ?? token.email ?? "", role: token.role ?? null };
        return session;
      },
    },
  };
}

let cached: NextAuthOptions | undefined;

export function getAuthOptions(): NextAuthOptions {
  cached ??= buildAuthOptions(getConfig().auth, getRepositories().users);
  return cached;
}
