"use client";

import { useState, useMemo } from "react";
import { moveStudentGenAction } from "@/app/actions/student-profiles";
import type { GenConfig, StudentProfile } from "@/types/attendance";
import { ArrowRightLeft, Loader2, X, AlertCircle } from "lucide-react";

interface MoveStudentGenModalProps {
  onClose: () => void;
  initialNama?: string;
  initialFromGen?: string;
  gens: GenConfig[];
  studentProfiles: StudentProfile[];
  onSuccess: (result: { recordsMoved: number; profileMoved: boolean; kasUpdated: number }) => void;
}

export default function MoveStudentGenModal({
  onClose,
  initialNama = "",
  initialFromGen = "",
  gens,
  studentProfiles,
  onSuccess,
}: MoveStudentGenModalProps) {
  const [nama, setNama] = useState(initialNama);
  const [fromGen, setFromGen] = useState(initialFromGen || (gens[0]?.gen ?? ""));
  const [targetGen, setTargetGen] = useState(() => {
    const other = gens.find((g) => g.gen !== (initialFromGen || (gens[0]?.gen ?? "")));
    return other?.gen ?? "";
  });
  const [moveAttendance, setMoveAttendance] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Filter students based on selected fromGen for datalist autocomplete
  const availableStudents = useMemo(() => {
    if (!fromGen) return studentProfiles.map((p) => p.nama);
    return studentProfiles.filter((p) => p.gen === fromGen).map((p) => p.nama);
  }, [studentProfiles, fromGen]);

  const handleStudentSelect = (selectedName: string) => {
    const norm = selectedName.toUpperCase();
    setNama(norm);
    const found = studentProfiles.find((p) => p.nama.toUpperCase() === norm);
    if (found && found.gen) {
      setFromGen(found.gen);
      if (targetGen === found.gen) {
        const other = gens.find((g) => g.gen !== found.gen);
        if (other) setTargetGen(other.gen);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const normNama = nama.trim().toUpperCase();
    if (!normNama) {
      setError("Nama siswa wajib diisi.");
      return;
    }

    if (!fromGen || !targetGen) {
      setError("Angkatan asal dan angkatan tujuan wajib dipilih.");
      return;
    }

    if (fromGen === targetGen) {
      setError("Angkatan asal dan tujuan tidak boleh sama.");
      return;
    }

    setSubmitting(true);
    const res = await moveStudentGenAction(
      normNama,
      fromGen,
      targetGen,
      moveAttendance
    );
    setSubmitting(false);

    if (res.success && res.data) {
      onSuccess(res.data);
      onClose();
    } else {
      setError(res.error || "Gagal memindahkan siswa ke angkatan baru.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/50 p-4">
      <div className="card w-full max-w-md p-6 shadow-xl animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-emerald-500/40 bg-emerald-500/15">
              <ArrowRightLeft className="h-4.5 w-4.5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <h3 className="font-display text-base font-extrabold uppercase tracking-tight text-foreground">
                Pindah Angkatan (Gen)
              </h3>
              <p className="mt-0.5 text-xs font-medium text-muted">
                Pindahkan siswa yang salah masuk angkatan beserta datanya.
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
            <label className="label">Nama Siswa</label>
            <input
              type="text"
              list="move-gen-students-list"
              className="input uppercase"
              placeholder="NAMA SISWA..."
              value={nama}
              onChange={(e) => handleStudentSelect(e.target.value)}
              autoFocus
              required
            />
            <datalist id="move-gen-students-list">
              {availableStudents.map((n) => (
                <option key={n} value={n} />
              ))}
            </datalist>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Angkatan Asal</label>
              <select
                value={fromGen}
                onChange={(e) => {
                  const newFrom = e.target.value;
                  setFromGen(newFrom);
                  if (targetGen === newFrom) {
                    const other = gens.find((g) => g.gen !== newFrom);
                    if (other) setTargetGen(other.gen);
                  }
                }}
                className="select w-full"
                required
              >
                {gens.map((g) => (
                  <option key={g.gen} value={g.gen}>
                    Gen {g.gen}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="label">Angkatan Tujuan</label>
              <select
                value={targetGen}
                onChange={(e) => setTargetGen(e.target.value)}
                className="select w-full"
                required
              >
                {gens.map((g) => (
                  <option
                    key={g.gen}
                    value={g.gen}
                    disabled={g.gen === fromGen}
                  >
                    Gen {g.gen} {g.gen === fromGen ? "(Asal)" : ""}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-surface-2 p-3 space-y-2">
            <label className="flex items-start gap-2.5 cursor-pointer text-xs font-medium text-foreground">
              <input
                type="checkbox"
                checked={moveAttendance}
                onChange={(e) => setMoveAttendance(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-border text-emerald-600 focus:ring-emerald-500"
              />
              <span>
                Pindahkan seluruh riwayat presensi di <strong>Google Sheets</strong>
              </span>
            </label>
            <p className="text-[11px] text-muted pl-6.5">
              Semua baris catatan kehadiran siswa di tab sheet <strong>GEN {fromGen}</strong> akan dipindahkan ke tab sheet <strong>GEN {targetGen}</strong> secara otomatis.
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
              disabled={submitting || !nama.trim() || !fromGen || !targetGen || fromGen === targetGen}
              className="btn btn-primary min-h-[44px] px-4 py-2 text-sm font-bold"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {submitting ? "Memindahkan..." : "Pindahkan Siswa"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
