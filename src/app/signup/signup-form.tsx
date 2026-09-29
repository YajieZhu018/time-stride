"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
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

export function SignupForm() {
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/calendar";

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [sent, setSent] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    startTransition(async () => {
      const supabase = createClient();
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: name },
          emailRedirectTo: `${window.location.origin}/auth/confirm?next=${encodeURIComponent(next)}`,
        },
      });

      if (error) {
        toast.error(error.message);
        return;
      }

      setSent(true);
    });
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle className="font-heading text-xl">
          Create your account
        </CardTitle>
        <CardDescription>
          {sent
            ? "Check your inbox to confirm your email."
            : "We'll email you a link to confirm before you can sign in."}
        </CardDescription>
      </CardHeader>
      {sent ? (
        <CardContent>
          <div className="text-muted-foreground flex items-center gap-2 text-sm">
            <Mail className="size-4" />
            Sent to {email}
          </div>
        </CardContent>
      ) : (
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                type="text"
                autoComplete="name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Jane Doe"
              />
            </div>
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
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
              />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
            <Button type="submit" className="w-full" disabled={isPending}>
              {isPending ? "Creating account…" : "Sign up"}
            </Button>
            <p className="text-muted-foreground text-center text-sm">
              Already have an account?{" "}
              <Link
                href={`/login?next=${encodeURIComponent(next)}`}
                className="text-foreground underline underline-offset-4"
              >
                Sign in
              </Link>
            </p>
          </CardFooter>
        </form>
      )}
    </Card>
  );
}
