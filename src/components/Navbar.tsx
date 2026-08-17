"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { logoutAdmin } from "@/app/actions/auth";
import { getAppConfig } from "@/app/actions/attendance";
import { APP_NAME, SCHOOL_NAME } from "@/lib/constants";
import {
  LogOut,
  PlusCircle,
  LayoutDashboard,
  Settings,
  Sun,
  Moon,
  Monitor,
  Menu,
  X,
  BarChart3,
  Users,
  CalendarDays,
  FlaskConical,
} from "lucide-react";

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [mockMode, setMockMode] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    let cancelled = false;
    getAppConfig().then((res) => {
      if (!cancelled && res.success && res.data) {
        setMockMode(res.data.mockMode);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleLogout = () => {
    setLoggingOut(true);
    window.location.href = "/api/auth/logout";
  };

  const cycleTheme = () => {
    if (theme === "light") setTheme("dark");
    else if (theme === "dark") setTheme("system");
    else setTheme("light");
  };

  const ThemeIcon = mounted
    ? theme === "light"
      ? Sun
      : theme === "dark"
        ? Moon
        : Monitor
    : Monitor;

  const isLoginPage = pathname === "/login";

  const navLinks = [
    { href: "/", label: "Dashboard", icon: LayoutDashboard },
    { href: "/input", label: "Input Data", icon: PlusCircle },
    { href: "/kalender", label: "Kalender", icon: CalendarDays },
    { href: "/stats", label: "Statistik", icon: BarChart3 },
    { href: "/stats/individual", label: "Rekap Siswa", icon: Users },
    { href: "/admin", label: "Admin", icon: Settings },
  ];

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-glass-bg backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Brand */}
        <Link
          href={isLoginPage ? "/login" : "/"}
          className="flex items-center gap-2.5 transition-transform active:scale-95"
        >
          <img
            src="/logo-kti.jpg"
            alt={APP_NAME}
            className="h-8 w-8 rounded-lg border-2 border-foreground/20 object-cover"
          />
          <span className="font-display text-sm font-extrabold uppercase tracking-tight text-foreground">
            KTI SKAGARA
          </span>
          <span className="hidden text-[10px] font-semibold uppercase tracking-widest text-muted sm:inline">
            {SCHOOL_NAME}
          </span>
        </Link>

        {!isLoginPage && (
          <>
            {/* Desktop nav */}
            <nav className="hidden items-center gap-1.5 md:flex">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`relative min-h-[44px] rounded-lg px-3 py-2 text-sm font-semibold uppercase tracking-wide transition-colors ${
                    isActive(link.href)
                      ? "text-accent bg-accent/8"
                      : "text-muted hover:text-foreground"
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    <link.icon className="h-4 w-4" />
                    {link.label}
                  </span>
                </Link>
              ))}

              {/* Mode Simulasi badge */}
              {mockMode && (
                <span
                  className="badge border-amber-400/40 bg-amber-400/15 text-amber-600 dark:text-amber-300 font-bold"
                  title="Google Sheets belum dikonfigurasi — data hanya tersimpan sementara di memori server dan hilang saat restart."
                >
                  <FlaskConical className="h-3 w-3" />
                  Mode Simulasi
                </span>
              )}

              {/* Theme toggle */}
              <button
                onClick={cycleTheme}
                className="btn btn-ghost min-h-[44px] min-w-[44px] px-2.5 py-2"
                title="Ganti tema (Light / Dark / System)"
              >
                <ThemeIcon className="h-4 w-4" />
              </button>

              {/* Logout Button */}
              <button
                onClick={handleLogout}
                disabled={loggingOut}
                className="btn btn-ghost min-h-[44px] px-3 py-2 text-xs font-bold uppercase tracking-wider text-muted transition-colors hover:border-danger/30 hover:bg-danger/10 hover:!text-danger"
                title="Keluar dari sesi Admin"
              >
                <LogOut className="h-4 w-4" />
                {loggingOut ? "Keluar..." : "Logout"}
              </button>
            </nav>

            {/* Mobile Actions */}
            <div className="flex items-center gap-1 md:hidden">
              <button
                onClick={cycleTheme}
                className="btn btn-ghost min-h-[44px] min-w-[44px] px-2 py-2"
                title="Ganti tema"
              >
                <ThemeIcon className="h-4 w-4" />
              </button>
              <button
                onClick={() => setMobileOpen(!mobileOpen)}
                className="btn btn-ghost min-h-[44px] min-w-[44px] px-2 py-2"
                aria-label="Menu"
              >
                {mobileOpen ? (
                  <X className="h-5 w-5" />
                ) : (
                  <Menu className="h-5 w-5" />
                )}
              </button>
            </div>
          </>
        )}
      </div>

      {/* Mobile dropdown */}
      {mobileOpen && !isLoginPage && (
        <div className="border-t-2 border-border bg-surface md:hidden">
          <nav className="flex flex-col p-2 space-y-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className={`flex min-h-[48px] items-center gap-2.5 rounded-lg px-4 py-3 text-sm font-semibold uppercase tracking-wide ${
                  isActive(link.href)
                    ? "bg-accent/10 text-accent"
                    : "text-muted hover:text-foreground"
                }`}
              >
                <link.icon className="h-4 w-4" />
                {link.label}
              </Link>
            ))}

            <button
              onClick={() => {
                setMobileOpen(false);
                handleLogout();
              }}
              disabled={loggingOut}
              className="flex min-h-[48px] w-full items-center gap-2.5 rounded-lg px-4 py-3 text-sm font-semibold uppercase tracking-wide text-danger hover:bg-danger/10"
            >
              <LogOut className="h-4 w-4" />
              {loggingOut ? "Keluar..." : "Logout"}
            </button>
          </nav>
        </div>
      )}
    </header>
  );
}