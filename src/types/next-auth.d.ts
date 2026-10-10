import type { UserRole } from "@/domain/types";

declare module "next-auth" {
  interface Session {
    user: {
      email: string;
      name: string;
      /** null when the user is no longer active in `raven_users`. */
      role: UserRole | null;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: UserRole | null;
    roleCheckedAt?: number;
  }
}
