"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
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

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/calendar";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (searchParams.get("error") === "link-invalid") {
      toast.error(
        "That link expired or was already used. Request a new one.",
      );
    }
  }, [searchParams]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    startTransition(async () => {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        toast.error(
          error.message === "Email not confirmed"
            ? "Confirm your email first — check the link we sent you when you signed up."
            : error.message,
        );
        return;
      }

      router.push(next);
      router.refresh();
    });
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle className="font-heading text-xl">
          Sign in to TimeTrack
        </CardTitle>
        <CardDescription>Enter your email and password.</CardDescription>
      </CardHeader>
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
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-4">
          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? "Signing in…" : "Sign in"}
          </Button>
          <p className="text-muted-foreground text-center text-sm">
            Don&apos;t have an account?{" "}
            <Link
              href={`/signup?next=${encodeURIComponent(next)}`}
              className="text-foreground underline underline-offset-4"
            >
              Sign up
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}
