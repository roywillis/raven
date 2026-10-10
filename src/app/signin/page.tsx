import { redirect } from "next/navigation";
import { getSessionUser } from "@/auth/session";
import { SignInPanel } from "@/components/SignInPanel";
import { getConfig } from "@/config/env";
import { getRepositories } from "@/data";

export const dynamic = "force-dynamic";

interface SignInPageProps {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
}

/** Only same-site relative paths are accepted as post-login destinations. */
function safeCallback(url: string | undefined): string {
  return url && url.startsWith("/") && !url.startsWith("//") ? url : "/";
}

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const { callbackUrl, error } = await searchParams;
  if (await getSessionUser()) redirect(safeCallback(callbackUrl));

  const { auth } = getConfig();
  const devUsers = auth.devSignIn
    ? (await getRepositories().users.listUsers()).map((user) => ({
        email: user.email,
        label: `${user.display_name} (${user.role}${user.active ? "" : ", inactive"})`,
      }))
    : [];

  return (
    <SignInPanel google={Boolean(auth.google)} devUsers={devUsers} callbackUrl={safeCallback(callbackUrl)} error={error ?? null} />
  );
}
