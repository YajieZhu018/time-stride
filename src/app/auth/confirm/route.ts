import { type EmailOtpType } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";

/**
 * Landing point for the sign-up confirmation email.
 *
 * Handles two link shapes, because which one we get depends on Supabase
 * project config rather than anything in this app:
 *
 * - `code` (PKCE): what Supabase's *default* email templates send — the
 *   "Confirm signup" template can't be customised without configuring
 *   custom SMTP (see Authentication > Emails in the dashboard), and its
 *   built-in `{{ .ConfirmationURL }}` redirects here with `?code=...` after
 *   verifying server-side. Exchanged via exchangeCodeForSession. Note this
 *   requires the PKCE code_verifier cookie set in the browser that called
 *   signUp — clicking the link in a *different* browser/device fails.
 * - `token_hash` + `type`: what a *customised* template produces if one is
 *   pointed at this route directly (see the confirm-signup template body in
 *   the project's dashboard notes). Exchanged via verifyOtp, which has no
 *   same-browser requirement.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const next = searchParams.get("next") ?? "/calendar";
  const code = searchParams.get("code");
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  const supabase = await createClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      redirect(next);
    }
  } else if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash });
    if (!error) {
      redirect(next);
    }
  }

  redirect("/login?error=link-invalid");
}
