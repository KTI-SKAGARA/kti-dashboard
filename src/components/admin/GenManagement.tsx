"use client";

import { useState, useEffect, useCallback } from "react";
import type { GenConfig } from "@/types/attendance";
import {
  getGenList,
  createGen,
  toggleGenStatus,
  deleteGenAction,
} from "@/app/actions/attendance";
import { Loader2, Plus, GraduationCap, RotateCcw, Trash2 } from "lucide-react";
import { getGenBadgeColor } from "@/lib/utils";

interface GenManagementProps {
  gens: GenConfig[];
  loading: boolean;
  onGensChanged: () => void;
  showToast: (type: "success" | "error", message: string) => void;
}

export default function GenManagement({ gens, loading, onGensChanged, showToast }: GenManagementProps) {
  const [newGen, setNewGen] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleCreate = async () => {
    if (!newGen.trim()) return;
    setSubmitting(true);

    const res = await createGen(newGen.trim());
    setSubmitting(false);

    if (res.success) {
      showToast("success", `Gen ${newGen.trim()} berhasil dibuat!`);
      setNewGen("");
      onGensChanged();
    } else {
      showToast("error", res.error ?? "Gagal membuat gen.");
    }
  };

  const handleToggleLulus = async (gen: string, currentStatus: string) => {
    const newLulus = currentStatus === "aktif";
    setSubmitting(true);

    const res = await toggleGenStatus(gen, newLulus);
    setSubmitting(false);

    if (res.success) {
      showToast("success", `Gen ${gen} ditandai ${newLulus ? "lulus" : "aktif"}.`);
      onGensChanged();
    } else {
      showToast("error", res.error ?? "Gagal mengubah status.");
    }
  };

  const handleDeleteGen = async (gen: string) => {
    if (!confirm(`Hapus Gen ${gen}? Tab sheet dan config akan dihapus permanen.`)) return;
    setSubmitting(true);

    const res = await deleteGenAction(gen);
    setSubmitting(false);

    if (res.success) {
      showToast("success", `Gen ${gen} berhasil dihapus.`);
      onGensChanged();
    } else {
      showToast("error", res.error ?? "Gagal menghapus gen.");
    }
  };

  return (
    <>
    <div className="card mt-5 p-6 sm:p-8">
      <div className="flex items-center gap-2">
        <GraduationCap className="h-4 w-4 text-accent" />
        <h2 className="font-display text-sm font-bold uppercase tracking-wide text-foreground">Kelola Gen</h2>
      </div>
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
                    <div className="inline-flex items-center gap-1">
                      <button
                        onClick={() => handleToggleLulus(g.gen, g.status)}
                        disabled={submitting}
                        className={`btn btn-ghost min-h-[44px] px-3 py-2 text-sm ${
                          g.status === "aktif" ? "hover:!text-gold" : "hover:!text-emerald-500"
                        }`}
                      >
                        {g.status === "aktif" ? (
                          <>
                            <GraduationCap className="h-4 w-4" /> Lulus
                          </>
                        ) : (
                          <>
                            <RotateCcw className="h-4 w-4" /> Aktif
                          </>
                        )}
                      </button>
                      <button
                        onClick={() => handleDeleteGen(g.gen)}
                        disabled={submitting}
                        className="btn btn-ghost min-h-[44px] min-w-[44px] p-2 text-muted hover:!text-danger"
                        title={`Hapus Gen ${g.gen}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
    </>
  );
}
