import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public routes
  if (
    pathname.startsWith("/login") ||
    pathname.startsWith("/api/auth/logout") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon.ico") ||
    pathname.startsWith("/logo-kti") ||
    pathname.startsWith("/manifest") ||
    pathname.startsWith("/sw.js") ||
    pathname.startsWith("/file.svg") ||
    pathname.startsWith("/globe.svg")
  ) {
    const { supabaseResponse, user } = await updateSession(request);
    // If already authenticated and trying to access /login, redirect to dashboard
    if (pathname === "/login" && user) {
      const url = request.nextUrl.clone();
      url.pathname = "/";
      return Response.redirect(url);
    }
    return supabaseResponse;
  }

  // Check Supabase session — refresh kalau expired
  const { supabaseResponse, user } = await updateSession(request);

  // If not authenticated, redirect to /login
  if (!user) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    return Response.redirect(loginUrl);
  }

  return supabaseResponse;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
