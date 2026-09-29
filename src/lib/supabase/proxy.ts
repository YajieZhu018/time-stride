import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Refreshes the Supabase session cookie on every request and redirects
 * signed-out visitors to /login. Called from proxy.ts at the project root
 * (Next.js 16 renamed Middleware to Proxy; this file holds the logic so
 * proxy.ts itself stays a thin, discoverable entry point).
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // IMPORTANT: do not remove this. It refreshes the auth token by calling
  // getUser(), which revalidates the session against Supabase (getSession()
  // alone trusts the cookie as-is and can serve an already-revoked session).
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isSignedOutOnlyRoute =
    request.nextUrl.pathname === "/login" ||
    request.nextUrl.pathname === "/signup";
  const isAuthRoute =
    isSignedOutOnlyRoute || request.nextUrl.pathname.startsWith("/auth");

  if (!user && !isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  if (user && isSignedOutOnlyRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/calendar";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}
