import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_SECRET, COOKIE_NAME } from "@/lib/constants";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const session = request.cookies.get(COOKIE_NAME);
  const isAuthenticated = session?.value === SESSION_SECRET;

  // Konfigurasi session belum di-set: blokir semua akses kecuali /login
  // (yang akan menampilkan pesan error), supaya tidak ada akses tanpa auth
  // atau session yang bisa ditebak (PRD §4.6).
  if (!SESSION_SECRET && pathname !== "/login") {
    const loginUrl = new URL("/login?err=config", request.url);
    return NextResponse.redirect(loginUrl);
  }

  // Allow login page, logout endpoint, static files, and _next internal requests
  if (
    pathname.startsWith("/login") ||
    pathname.startsWith("/api/auth/logout") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon.ico")
  ) {
    // If already authenticated and trying to access /login, redirect to dashboard /
    if (pathname === "/login" && isAuthenticated) {
      return NextResponse.redirect(new URL("/", request.url));
    }
    return NextResponse.next();
  }

  // If not authenticated, redirect to /login
  if (!isAuthenticated) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};