"use client";

import { useState } from "react";
import { renameStudentAction } from "@/app/actions/student-profiles";
import type { GenConfig } from "@/types/attendance";
import { Pencil, Loader2, X, AlertCircle } from "lucide-react";

interface RenameStudentModalProps {
  onClose: () => void;
  initialOldName?: string;
  initialGen?: string;
  gens: GenConfig[];
  existingNames: string[];
  onSuccess: (result: { sheetsUpdated: number; profilesUpdated: number; kasUpdated: number }) => void;
}

export default function RenameStudentModal({
  onClose,
  initialOldName = "",
  initialGen = "",
  gens,
  existingNames,
  onSuccess,
}: RenameStudentModalProps) {
  const [oldName, setOldName] = useState(initialOldName);
  const [newName, setNewName] = useState(initialOldName);
  const [gen, setGen] = useState(initialGen);
  const [updateSheets, setUpdateSheets] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const normOld = oldName.trim().toUpperCase();
    const normNew = newName.trim().toUpperCase();

    if (!normOld || !normNew) {
      setError("Nama lama dan nama baru wajib diisi.");
      return;
    }

    if (normOld === normNew) {
      setError("Nama baru tidak boleh sama dengan nama lama.");
      return;
    }

    setSubmitting(true);
    const res = await renameStudentAction(
      normOld,
      normNew,
      gen || undefined,
      updateSheets
    );
    setSubmitting(false);

    if (res.success && res.data) {
      onSuccess(res.data);
      onClose();
    } else {
      setError(res.error || "Gagal mengubah nama siswa.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/50 p-4">
      <div className="card w-full max-w-md p-6 shadow-xl animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-accent/40 bg-accent/15">
              <Pencil className="h-4.5 w-4.5 text-accent" />
            </div>
            <div>
              <h3 className="font-display text-base font-extrabold uppercase tracking-tight text-foreground">
                Koreksi Typo Nama
              </h3>
              <p className="mt-0.5 text-xs font-medium text-muted">
                Perbaiki ejaan nama siswa secara menyeluruh.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="btn btn-ghost min-h-[44px] min-w-[44px] p-2"
            aria-label="Tutup"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label className="label">Nama Lama (yang typo)</label>
            <input
              type="text"
              list="rename-existing-names"
              className="input uppercase"
              placeholder="NAMA LAMA..."
              value={oldName}
              onChange={(e) => setOldName(e.target.value.toUpperCase())}
              required
            />
            <datalist id="rename-existing-names">
              {existingNames.map((n) => (
                <option key={n} value={n} />
              ))}
            </datalist>
          </div>

          <div>
            <label className="label">Nama Baru (yang benar)</label>
            <input
              type="text"
              className="input uppercase"
              placeholder="NAMA BARU..."
              value={newName}
              onChange={(e) => setNewName(e.target.value.toUpperCase())}
              autoFocus
              required
            />
          </div>

          <div>
            <label className="label">Filter Angkatan (Opsional)</label>
            <select
              value={gen}
              onChange={(e) => setGen(e.target.value)}
              className="select"
            >
              <option value="">Semua Angkatan (Semua Tab Sheet)</option>
              {gens.map((g) => (
                <option key={g.gen} value={g.gen}>
                  Gen {g.gen}
                </option>
              ))}
            </select>
          </div>

          <div className="rounded-lg border border-border bg-surface-2 p-3 space-y-2">
            <label className="flex items-start gap-2.5 cursor-pointer text-xs font-medium text-foreground">
              <input
                type="checkbox"
                checked={updateSheets}
                onChange={(e) => setUpdateSheets(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-border text-accent focus:ring-accent"
              />
              <span>
                Perbarui seluruh riwayat presensi di <strong>Google Sheets</strong>
              </span>
            </label>
            <p className="text-[11px] text-muted pl-6.5">
              Data masa lalu pada sheet presensi akan diperbarui ke nama baru sehingga akumulasi kas dan kehadiran tetap utuh.
            </p>
          </div>

          {error && (
            <p className="flex items-center gap-1.5 text-xs font-bold text-danger">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              {error}
            </p>
          )}

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="btn btn-secondary min-h-[44px] px-4 py-2 text-sm"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={submitting || !oldName.trim() || !newName.trim()}
              className="btn btn-primary min-h-[44px] px-4 py-2 text-sm font-bold"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {submitting ? "Menyimpan..." : "Simpan Perubahan"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
