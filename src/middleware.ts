import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request: { headers: request.headers } });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options as Parameters<typeof response.cookies.set>[2])
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  const isLoginPage = pathname === "/login";
  const isRootPath = pathname === "/";
  const isDashboardRoute = pathname.startsWith("/dashboard");

  // Email whitelist — only allowed emails can access the app
  const allowedEmails = (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  if (user && allowedEmails.length > 0) {
    const userEmail = user.email?.toLowerCase() || "";
    // Allow if email is in whitelist OR if it's a local admin account
    if (!allowedEmails.includes(userEmail) && !userEmail.endsWith("@cotigrafic.local")) {
      // Unauthorized: sign out and redirect to login
      await supabase.auth.signOut();
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("error", "unauthorized");
      return NextResponse.redirect(url);
    }
  }

  // If there's an OAuth code at root, redirect to callback
  if (isRootPath) {
    const code = request.nextUrl.searchParams.get("code");
    if (code) {
      const url = request.nextUrl.clone();
      url.pathname = "/auth/callback";
      return NextResponse.redirect(url);
    }
  }

  // Not authenticated → trying to access protected routes or root → login
  if (!user && (isDashboardRoute || isRootPath)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Authenticated → at login or root → go to dashboard
  if (user && (isLoginPage || isRootPath)) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ["/", "/login", "/dashboard/:path*"],
};
