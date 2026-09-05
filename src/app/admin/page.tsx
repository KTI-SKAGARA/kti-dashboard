"use client";

import { useState, useEffect, useCallback } from "react";
import type { GenConfig } from "@/types/attendance";
import { getGenList } from "@/app/actions/attendance";
import { APP_NAME, TOAST_DURATION } from "@/lib/constants";
import {
  ArrowLeft,
  Users,
  GraduationCap,
  KeyRound,
} from "lucide-react";
import Link from "next/link";
import Toast from "@/components/Toast";
import ChangePasswordModal from "@/components/ChangePasswordModal";
import UserManagement from "@/components/admin/UserManagement";
import GenManagement from "@/components/admin/GenManagement";
import StudentManagement from "@/components/admin/StudentManagement";
import ClassPromotion from "@/components/admin/ClassPromotion";

export default function AdminPage() {
  const [activeSection, setActiveSection] = useState<"user" | "gen" | "siswa" | "promosi">("user");
  const [gens, setGens] = useState<GenConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [changePwOpen, setChangePwOpen] = useState(false);

  const loadGens = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getGenList();
      if (res.success && res.data) {
        setGens(res.data);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadGens();
  }, [loadGens]);

  const showToast = useCallback((type: "success" | "error", message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), TOAST_DURATION);
  }, []);

  return (
    <div className="mx-auto max-w-2xl animate-page">
      {/* Header */}
      <div className="flex items-center justify-between border-b-2 border-border pb-5">
        <div className="flex items-center gap-3">
          <Link href="/" className="btn btn-secondary min-h-[44px] min-w-[44px] p-2" aria-label="Kembali ke dashboard">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-accent">{APP_NAME}</p>
            <h1 className="mt-0.5 font-display text-2xl font-extrabold uppercase tracking-tight text-foreground">
              Admin <span className="text-accent">Panel</span>
            </h1>
          </div>
        </div>
      </div>

      {/* Section tabs */}
      <div className="mt-5 flex items-center gap-1 rounded-xl border-2 border-border bg-surface p-1">
        {[
          { key: "user" as const, label: "User", icon: Users },
          { key: "gen" as const, label: "Gen", icon: GraduationCap },
          { key: "siswa" as const, label: "Siswa", icon: Users },
          { key: "promosi" as const, label: "Promosi", icon: GraduationCap },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveSection(tab.key)}
            className={`chip min-h-[44px] flex-1 text-xs ${activeSection === tab.key ? "chip-on" : ""}`}
          >
            <tab.icon className="h-3.5 w-3.5" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Ganti Password */}
      <div className="card mt-5 p-6 sm:p-8">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-accent" />
            <div>
              <h2 className="font-display text-sm font-bold uppercase tracking-wide text-foreground">
                Ganti Password
              </h2>
              <p className="mt-0.5 text-xs font-medium text-muted">
                Ubah password akun yang sedang login.
              </p>
            </div>
          </div>
          <button
            onClick={() => setChangePwOpen(true)}
            className="btn btn-secondary min-h-[44px] px-4 py-2 text-sm"
          >
            <KeyRound className="h-4 w-4" />
            Ganti Password
          </button>
        </div>
      </div>

      {/* Section Content */}
      {activeSection === "user" && (
        <UserManagement showToast={showToast} />
      )}

      {activeSection === "gen" && (
        <GenManagement
          gens={gens}
          loading={loading}
          onGensChanged={loadGens}
          showToast={showToast}
        />
      )}

      {activeSection === "siswa" && (
        <StudentManagement gens={gens} showToast={showToast} />
      )}

      {activeSection === "promosi" && (
        <ClassPromotion
          gens={gens}
          showToast={showToast}
          onSwitchToSiswa={(gen) => {
            setActiveSection("siswa");
          }}
        />
      )}

      {/* Toast */}
      {toast && <Toast type={toast.type} message={toast.message} />}

      {/* Ganti password modal */}
      {changePwOpen && <ChangePasswordModal onClose={() => setChangePwOpen(false)} />}
    </div>
  );
}
