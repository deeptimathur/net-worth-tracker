import { googleEnabled } from "@/lib/auth/google";
import { signup } from "../actions/auth";
import { AuthForm } from "../auth-form";

export default function SignupPage() {
  return <AuthForm mode="signup" action={signup} google={googleEnabled()} />;
}
