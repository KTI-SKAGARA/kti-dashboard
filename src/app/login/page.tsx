"use client";

import { useEffect, useState } from "react";
import { loginAdmin } from "@/app/actions/auth";
import {
  Mail,
  KeyRound,
  Eye,
  EyeOff,
  Loader2,
  AlertCircle,
} from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("err") === "config") {
      setError(
        "Konfigurasi server belum lengkap (Supabase belum di-set). Hubungi admin."
      );
    } else if (params.get("err") === "inactive") {
      setError("Akun tidak aktif. Hubungi admin untuk mengaktifkan akun Anda.");
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setError("Masukkan email terlebih dahulu.");
      return;
    }
    if (!password) {
      setError("Masukkan password terlebih dahulu.");
      return;
    }

    setSubmitting(true);
    setError("");

    const res = await loginAdmin(email, password);

    setSubmitting(false);

    if (res.success) {
      window.location.href = "/";
    } else {
      setError(res.error || "Login gagal!");
    }
  };

  return (
    <div className="flex min-h-dvh items-center justify-center py-12 px-4">
      <div className="w-full max-w-sm animate-page">
        <div className="mb-6 text-center">
          <img
            src="/logo-kti.jpg"
            alt="Logo KTI SKAGARA"
            className="mx-auto h-14 w-14 rounded-2xl border-2 border-foreground/20 shadow-[3px_3px_0_0_var(--color-shadow)]"
          />
          <h1 className="mt-3 font-display text-2xl font-extrabold uppercase tracking-tight text-foreground">
            Login Admin
          </h1>
          <p className="mt-1 text-xs font-semibold uppercase tracking-widest text-muted">
            KTI SKAGARA — SMK Negeri 3 Jepara
          </p>
        </div>

        <form onSubmit={handleLogin} className="card p-6 shadow-lg space-y-4">
          {/* Email */}
          <div>
            <label htmlFor="email" className="label">
              Email
            </label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <input
                id="email"
                type="email"
                autoComplete="email"
                className={`input pl-9 ${
                  error ? "!border-danger focus:!ring-danger/20" : ""
                }`}
                placeholder="admin@skagara.sch.id"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (error) setError("");
                }}
                autoFocus
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <label htmlFor="password" className="label">
              Password
            </label>
            <div className="relative">
              <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                className={`input pl-9 pr-10 ${
                  error ? "!border-danger focus:!ring-danger/20" : ""
                }`}
                placeholder="Masukkan password..."
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (error) setError("");
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-muted hover:text-accent"
                aria-label="Tampilkan password"
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          {error && (
            <p className="flex items-center gap-1.5 text-xs font-bold text-danger">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="btn btn-primary w-full min-h-[48px] py-3 text-sm"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {submitting ? "Memverifikasi..." : "Masuk"}
          </button>
        </form>
      </div>
    </div>
  );
}
