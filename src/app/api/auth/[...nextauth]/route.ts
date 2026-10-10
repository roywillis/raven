import NextAuth from "next-auth";
import { getAuthOptions } from "@/auth/options";

type Context = { params: Promise<{ nextauth: string[] }> };

// Options are built on first request so configuration is read at runtime, not at build time.
function handler(request: Request, context: Context) {
  return NextAuth(getAuthOptions())(request, context);
}

export { handler as GET, handler as POST };
