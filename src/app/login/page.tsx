import { googleEnabled } from "@/lib/auth/google";
import { login } from "../actions/auth";
import { AuthForm } from "../auth-form";

const NOTICES: Record<string, string> = {
  google_unavailable: "Google sign-in isn't set up on this server yet.",
  google_cancelled: "Google sign-in was cancelled.",
  google_failed: "Google sign-in didn't complete. Please try again.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return <AuthForm mode="login" action={login} google={googleEnabled()} notice={error ? NOTICES[error] : undefined} />;
}
