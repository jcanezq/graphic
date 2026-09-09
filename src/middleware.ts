import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isAdminEmail } from "@/lib/auth/admin";

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
  const isDashboardRoute = pathname.startsWith("/dashboard");
  const isCustomerPortal = pathname.startsWith("/mis-cotizaciones");

  // Privilegio de administrador: única fuente de verdad, fail-closed.
  // Sin ADMIN_EMAILS configurada, NADIE es admin (ver src/lib/auth/admin.ts).
  // Los atajos por sufijo de dominio y por correo hardcodeado se eliminaron:
  // derivaban el privilegio de una cadena que el propio usuario elige al registrarse.
  const isAdmin = Boolean(user) && isAdminEmail(user?.email);

  // If there's an OAuth code at root or cotizar, redirect to callback
  const code = request.nextUrl.searchParams.get("code");
  if (code && (pathname === "/" || pathname === "/cotizar")) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/callback";
    return NextResponse.redirect(url);
  }

  // 1. Protected Admin Routes (/dashboard/*)
  if (isDashboardRoute) {
    if (!user) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("redirect", pathname);
      return NextResponse.redirect(url);
    }

    // Authenticated but not admin -> redirect to customer portal
    if (!isAdmin) {
      const url = request.nextUrl.clone();
      url.pathname = "/mis-cotizaciones";
      return NextResponse.redirect(url);
    }
  }

  // 2. Protected Customer Portal Routes (/mis-cotizaciones/*)
  if (isCustomerPortal && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirect", "/mis-cotizaciones");
    return NextResponse.redirect(url);
  }

  // 3. Login Page (/login)
  if (isLoginPage && user) {
    const redirectParam = request.nextUrl.searchParams.get("redirect");
    const url = request.nextUrl.clone();

    if (redirectParam) {
      url.pathname = redirectParam;
      url.searchParams.delete("redirect");
      return NextResponse.redirect(url);
    }

    if (isAdmin) {
      url.pathname = "/dashboard";
    } else {
      url.pathname = "/mis-cotizaciones";
    }
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ["/", "/login", "/dashboard/:path*", "/mis-cotizaciones/:path*", "/cotizar"],
};
