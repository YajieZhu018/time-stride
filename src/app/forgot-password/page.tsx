import { Suspense } from "react";
import { ForgotPasswordForm } from "./forgot-password-form";

export default function ForgotPasswordPage() {
  return (
    <div className="flex min-h-svh items-center justify-center px-4">
      <Suspense>
        <ForgotPasswordForm />
      </Suspense>
    </div>
  );
}
