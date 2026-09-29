import { Suspense } from "react";
import { SignupForm } from "./signup-form";

export default function SignupPage() {
  return (
    <div className="flex min-h-svh items-center justify-center px-4">
      <Suspense>
        <SignupForm />
      </Suspense>
    </div>
  );
}
