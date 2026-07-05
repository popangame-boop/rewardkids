import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createServerClient<any>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // Auth routes — redirect logged-in users
  const isAuthRoute = pathname.startsWith("/login") || pathname.startsWith("/register");
  // Protected routes
  const isParentRoute = pathname.startsWith("/parent");
  const isChildRoute = pathname.startsWith("/child");

  // No user — redirect to login
  if (!user && (isParentRoute || isChildRoute)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // User logged in — redirect from auth routes to appropriate dashboard
  if (user) {
    // Get profile role
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("auth_user_id", user.id)
      .single();

    if (!profile) {
      // User has session but no profile (e.g. deleted profile). Sign out to clear cookies/session.
      await supabase.auth.signOut();
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      const redirectResponse = NextResponse.redirect(url);
      
      // Copy cookies from supabaseResponse (which contains the cleared session cookies from signOut)
      supabaseResponse.cookies.getAll().forEach((cookie) => {
        redirectResponse.cookies.set(cookie.name, cookie.value, cookie);
      });
      return redirectResponse;
    }

    if (isAuthRoute) {
      const url = request.nextUrl.clone();
      url.pathname = profile.role === "parent" ? "/parent/dashboard" : "/child/dashboard";
      return NextResponse.redirect(url);
    }

    // Role-based route protection
    if (isParentRoute || isChildRoute) {
      if (profile.role === "child" && isParentRoute) {
        const url = request.nextUrl.clone();
        url.pathname = "/child/dashboard";
        return NextResponse.redirect(url);
      }

      if (profile.role === "parent" && isChildRoute) {
        const url = request.nextUrl.clone();
        url.pathname = "/parent/dashboard";
        return NextResponse.redirect(url);
      }
    }
  }

  return supabaseResponse;
}
