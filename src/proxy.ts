import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

// Next.js 16 renamed Middleware to Proxy (same mechanism, new file name).
// See node_modules/next/dist/docs/01-app/01-getting-started/16-proxy.md.
export function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Run on every route except static assets and Next internals, so the
     * session cookie stays fresh everywhere and signed-out users are
     * redirected to /login before any Server Component renders.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
