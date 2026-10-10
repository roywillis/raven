"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";

interface SignInPanelProps {
  google: boolean;
  devUsers: { email: string; label: string }[];
  callbackUrl: string;
  error: string | null;
}

const ERROR_MESSAGES: Record<string, string> = {
  AccessDenied: "This account is not registered for Raven, or it has been deactivated. Contact your supervisor.",
  CredentialsSignin: "This account is not registered for Raven, or it has been deactivated.",
  Configuration: "Sign-in is not configured correctly. Contact the administrator.",
};

export function SignInPanel({ google, devUsers, callbackUrl, error }: SignInPanelProps) {
  const [devEmail, setDevEmail] = useState(devUsers[0]?.email ?? "");
  const message = error ? (ERROR_MESSAGES[error] ?? "Sign-in failed. Please try again.") : null;

  return (
    <main className="signin">
      <div className="card signin-card">
        <h1>Raven Reviewer Portal</h1>
        <p className="muted">Sign in with your registered account to review borderline applications.</p>
        {message && (
          <p className="banner banner-error" role="alert">
            {message}
          </p>
        )}
        {google && (
          <button type="button" className="btn btn-primary btn-block" onClick={() => signIn("google", { callbackUrl })}>
            Sign in with Google
          </button>
        )}
        {devUsers.length > 0 && (
          <form
            className="dev-signin"
            onSubmit={(event) => {
              event.preventDefault();
              void signIn("dev", { email: devEmail, callbackUrl });
            }}
          >
            <p className="small muted">Local development only (sample users):</p>
            <select value={devEmail} onChange={(event) => setDevEmail(event.target.value)} aria-label="Sample user">
              {devUsers.map((user) => (
                <option key={user.email} value={user.email}>
                  {user.label}
                </option>
              ))}
            </select>
            <button type="submit" className="btn btn-block">
              Dev sign-in
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
