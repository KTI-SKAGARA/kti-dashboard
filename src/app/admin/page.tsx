"use client";

import { useState, useEffect, useCallback } from "react";
import type { GenConfig } from "@/types/attendance";
import {
  getGenList,
  createGen,
  toggleGenStatus,
} from "@/app/actions/attendance";
import { APP_NAME, TOAST_DURATION } from "@/lib/constants";
import {
  ArrowLeft,
  Loader2,
  Plus,
  GraduationCap,
  RotateCcw,
} from "lucide-react";
import Link from "next/link";
import Toast from "@/components/Toast";
import { getGenBadgeColor } from "@/lib/utils";

export default function AdminPage() {
  const [gens, setGens] = useState<GenConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [newGen, setNewGen] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

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
    loadGens(); // eslint-disable-line react-hooks/set-state-in-effect
  }, [loadGens]);

  const handleCreate = async () => {
    if (!newGen.trim()) return;
    setSubmitting(true);
    setToast(null);

    const res = await createGen(newGen.trim());
    setSubmitting(false);

    if (res.success) {
      setToast({ type: "success", message: `Gen ${newGen.trim()} berhasil dibuat!` });
      setNewGen("");
      loadGens();
    } else {
      setToast({ type: "error", message: res.error ?? "Gagal membuat gen." });
    }

    setTimeout(() => setToast(null), TOAST_DURATION);
  };

  const handleToggleLulus = async (gen: string, currentStatus: string) => {
    const newLulus = currentStatus === "aktif";
    setSubmitting(true);

    const res = await toggleGenStatus(gen, newLulus);
    setSubmitting(false);

    if (res.success) {
      setToast({
        type: "success",
        message: `Gen ${gen} ditandai ${newLulus ? "lulus" : "aktif"}.`,
      });
      loadGens();
    } else {
      setToast({ type: "error", message: res.error ?? "Gagal mengubah status." });
    }

    setTimeout(() => setToast(null), TOAST_DURATION);
  };

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
              Admin <span className="marker">Panel</span>
            </h1>
          </div>
        </div>
      </div>

      {/* Tambah Gen */}
      <div className="card mt-5 p-6 sm:p-8">
        <h2 className="font-display text-sm font-bold uppercase tracking-wide text-foreground">Tambah Gen Baru</h2>
        <p className="mt-1 text-xs font-medium text-muted">
          Masukkan nomor gen (misal: 13). Tab sheet &quot;GEN 13&quot; akan dibuat otomatis.
        </p>
        <div className="mt-4 flex items-end gap-3">
          <div className="flex-1">
            <label htmlFor="new-gen" className="label">
              Nomor Gen
            </label>
            <input
              id="new-gen"
              type="text"
              inputMode="numeric"
              className="input"
              placeholder="13"
              value={newGen}
              onChange={(e) => setNewGen(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreate();
              }}
            />
          </div>
          <button
            onClick={handleCreate}
            disabled={submitting || !newGen.trim()}
            className="btn btn-primary min-h-[48px] px-4 py-3 text-sm"
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            Tambah
          </button>
        </div>
      </div>

      {/* Daftar Gen */}
      <div className="card mt-4 p-6 sm:p-8">
        <h2 className="font-display text-sm font-bold uppercase tracking-wide text-foreground">Daftar Gen</h2>
        <p className="mt-1 text-xs font-medium text-muted">
          Gen aktif tampil di filter &quot;Semua Gen&quot;. Gen lulus tersembunyi dari filter utama tapi data tetap tersimpan.
        </p>

        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-accent" />
          </div>
        ) : gens.length === 0 ? (
          <p className="py-6 text-center text-xs font-medium text-muted">Belum ada gen.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Gen</th>
                  <th>Status</th>
                  <th className="text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {gens.map((g) => (
                  <tr key={g.gen}>
                    <td>
                      <span className={`badge font-display font-extrabold text-sm ${getGenBadgeColor(g.gen)}`}>
                        Gen {g.gen}
                      </span>
                    </td>
                    <td>
                      {g.status === "aktif" ? (
                        <span className="badge border-emerald-500/40 bg-emerald-500/15 text-emerald-600 dark:text-emerald-300">Aktif</span>
                      ) : (
                        <span className="badge border-amber-400/40 bg-amber-400/15 text-amber-600 dark:text-amber-300">Lulus</span>
                      )}
                    </td>
                    <td className="text-right">
                      <button
                        onClick={() => handleToggleLulus(g.gen, g.status)}
                        disabled={submitting}
                        className={`btn btn-ghost min-h-[44px] px-3 py-2 text-sm ${
                          g.status === "aktif" ? "hover:!text-gold" : "hover:!text-emerald-500"
                        }`}
                      >
                        {g.status === "aktif" ? (
                          <>
                            <GraduationCap className="h-4 w-4" /> Tandai Lulus
                          </>
                        ) : (
                          <>
                            <RotateCcw className="h-4 w-4" /> Aktifkan
                          </>
                        )}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Toast */}
      {toast && <Toast type={toast.type} message={toast.message} />}
    </div>
  );
}
