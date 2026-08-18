"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { getAppConfig } from "@/app/actions/attendance";
import { getCurrentUser } from "@/app/actions/auth";
import { APP_NAME, SCHOOL_NAME } from "@/lib/constants";
import ChangePasswordModal from "@/components/ChangePasswordModal";
import {
  LogOut,
  PlusCircle,
  LayoutDashboard,
  Settings,
  Sun,
  Moon,
  Monitor,
  CalendarDays,
  FlaskConical,
  KeyRound,
} from "lucide-react";

export default function Navbar() {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [mockMode, setMockMode] = useState(false);
  const [changePwOpen, setChangePwOpen] = useState(false);
  const [userRole, setUserRole] = useState<string>("viewer");

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
    getCurrentUser().then((user) => {
      if (!cancelled && user) {
        setUserRole(user.role);
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

  const allNavLinks = [
    { href: "/", label: "Dashboard", icon: LayoutDashboard },
    { href: "/input", label: "Input", icon: PlusCircle },
    { href: "/kalender", label: "Kalender", icon: CalendarDays },
    { href: "/admin", label: "Admin", icon: Settings, adminOnly: true },
  ];

  const navLinks = allNavLinks.filter(
    (link) => !link.adminOnly || userRole === "admin" || userRole === "owner"
  );

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <>
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

                {/* Ganti Password */}
                <button
                  onClick={() => setChangePwOpen(true)}
                  className="btn btn-ghost min-h-[44px] px-2.5 py-2"
                  title="Ganti password"
                >
                  <KeyRound className="h-4 w-4" />
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

              {/* Mobile Actions (top bar compact) */}
              <div className="flex items-center gap-0.5 md:hidden">
                {mockMode && (
                  <span
                    className="badge border-amber-400/40 bg-amber-400/15 text-amber-600 dark:text-amber-300 font-bold px-2 py-1"
                    title="Mode Simulasi — data hanya sementara di memori server."
                  >
                    <FlaskConical className="h-3 w-3" />
                  </span>
                )}
                <button
                  onClick={cycleTheme}
                  className="btn btn-ghost min-h-[44px] min-w-[44px] px-2 py-2"
                  title="Ganti tema"
                >
                  <ThemeIcon className="h-4 w-4" />
                </button>
                <button
                  onClick={handleLogout}
                  disabled={loggingOut}
                  className="btn btn-ghost min-h-[44px] min-w-[44px] px-2 py-2 text-muted hover:!text-danger"
                  title="Logout"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            </>
          )}
        </div>
      </header>

      {/* Mobile bottom navigation */}
      {!isLoginPage && (
        <nav className="fixed inset-x-0 bottom-0 z-30 border-t-2 border-border bg-glass-bg backdrop-blur-md pb-[env(safe-area-inset-bottom)] md:hidden">
          <div className="grid grid-cols-4">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`flex min-h-[56px] flex-col items-center justify-center gap-0.5 text-[9px] font-bold uppercase tracking-wide transition-colors ${
                  isActive(link.href)
                    ? "text-accent bg-accent/8"
                    : "text-muted hover:text-foreground"
                }`}
              >
                <link.icon className="h-5 w-5" />
                {link.label}
              </Link>
            ))}
          </div>
        </nav>
      )}

      {/* Ganti password modal */}
      {changePwOpen && <ChangePasswordModal onClose={() => setChangePwOpen(false)} />}
    </>
  );
}