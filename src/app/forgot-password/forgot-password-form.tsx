"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Mail } from "lucide-react";
import { toast } from "sonner";

import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    startTransition(async () => {
      const supabase = createClient();
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/confirm?next=${encodeURIComponent("/reset-password")}`,
      });

      if (error) {
        toast.error(error.message);
        return;
      }

      // Supabase answers the same whether or not the address has an
      // account, so this screen doesn't reveal which emails are registered.
      setSent(true);
    });
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle className="font-heading text-xl">
          Reset your password
        </CardTitle>
        <CardDescription>
          {sent
            ? "If that email has an account, a reset link is on its way."
            : "Enter your email and we'll send you a link to set a new password."}
        </CardDescription>
      </CardHeader>
      {sent ? (
        <>
          <CardContent className="space-y-2">
            <div className="text-muted-foreground flex items-center gap-2 text-sm">
              <Mail className="size-4" />
              Sent to {email}
            </div>
            <p className="text-muted-foreground text-sm">
              Open the link in the same browser you requested it from.
            </p>
          </CardContent>
          <CardFooter>
            <Link
              href="/login"
              className="text-foreground text-sm underline underline-offset-4"
            >
              Back to sign in
            </Link>
          </CardFooter>
        </>
      ) : (
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
            <Button type="submit" className="w-full" disabled={isPending}>
              {isPending ? "Sending…" : "Send reset link"}
            </Button>
            <Link
              href="/login"
              className="text-muted-foreground text-center text-sm underline underline-offset-4"
            >
              Back to sign in
            </Link>
          </CardFooter>
        </form>
      )}
    </Card>
  );
}
