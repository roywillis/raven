import { getServerSession } from "next-auth";
import type { UserRole } from "@/domain/types";
import { getAuthOptions } from "./options";

export class AuthError extends Error {
  constructor(
    readonly status: 401 | 403,
    message: string,
  ) {
    super(message);
    this.name = "AuthError";
  }
}

export interface SessionUser {
  email: string;
  name: string;
  role: UserRole;
}

/** The signed-in, active user, or null. */
export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await getServerSession(getAuthOptions());
  const user = session?.user;
  if (!user?.email || !user.role) return null;
  return { email: user.email, name: user.name, role: user.role };
}

/** Throws AuthError unless an active user (with `role`, if given) is signed in. */
export async function requireUser(role?: UserRole): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new AuthError(401, "Sign in required.");
  if (role && user.role !== role) throw new AuthError(403, `This action requires the ${role} role.`);
  return user;
}

/**
 * Rejects state-changing requests sent from another origin (defence in depth on top of
 * next-auth's SameSite=Lax session cookie).
 */
export function assertSameOrigin(request: Request): void {
  const origin = request.headers.get("origin");
  if (!origin) return;
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    throw new AuthError(403, "Invalid Origin header.");
  }
  if (originHost !== host) throw new AuthError(403, "Cross-origin request rejected.");
}
