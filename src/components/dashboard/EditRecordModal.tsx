"use client";

import { memo } from "react";
import { Loader2 } from "lucide-react";
import { type Gen, type StatusAbsen, type TaggedRecord, SKAGARA_CLASSES } from "@/types/attendance";
import { getGenCardSelectedStyle } from "@/lib/utils";

interface EditRecordModalProps {
  record: TaggedRecord;
  activeGens: Gen[];
  editGen: Gen;
  editTanggal: string;
  editNama: string;
  editKelas: string;
  editStatus: StatusAbsen;
  editKas: number;
  saving: boolean;
  onGenChange: (gen: Gen) => void;
  onTanggalChange: (v: string) => void;
  onNamaChange: (v: string) => void;
  onKelasChange: (v: string) => void;
  onStatusChange: (v: StatusAbsen) => void;
  onKasChange: (v: number) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

export default memo(function EditRecordModal({
  record,
  activeGens,
  editGen,
  editTanggal,
  editNama,
  editKelas,
  editStatus,
  editKas,
  saving,
  onGenChange,
  onTanggalChange,
  onNamaChange,
  onKelasChange,
  onStatusChange,
  onKasChange,
  onConfirm,
  onCancel,
}: EditRecordModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4 backdrop-blur-md animate-fade-in">
      <div className="card w-full max-w-md rounded-t-3xl sm:rounded-2xl p-5 sm:p-6 shadow-2xl pb-8 sm:pb-6 overflow-hidden">
        {/* Mobile Drag Indicator Pill */}
        <div className="mx-auto mb-2 h-1.5 w-12 rounded-full bg-border sm:hidden" />

        <h3 className="font-display text-lg font-extrabold uppercase tracking-tight text-foreground">
          Edit Data Absensi
        </h3>
        <p className="mt-0.5 text-xs font-semibold uppercase tracking-wide text-muted">
          {record.nama} — Semula di Gen {record._gen}
        </p>

        <div className="mt-4 space-y-3.5">
          {/* Gen Switcher */}
          <div>
            <label className="label !mb-1.5 flex items-center justify-between">
              <span>Generasi (Gen)</span>
              {editGen !== record._gen && (
                <span className="text-[10px] font-bold text-accent">
                  Akan dipindahkan ke Gen {editGen}
                </span>
              )}
            </label>
            <div className="grid grid-cols-3 gap-2">
              {activeGens.map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => onGenChange(g)}
                  className={`flex flex-col items-center justify-center rounded-xl border-2 p-2 transition-all text-center ${
                    editGen === g
                      ? getGenCardSelectedStyle(g)
                      : "border-border bg-surface-2 text-foreground font-semibold hover:bg-surface"
                  }`}
                >
                  <span className="text-xs font-display">Gen {g}</span>
                  <span className="text-[10px] text-muted">Angkatan {g}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Tanggal */}
          <div>
            <label className="label">Tanggal</label>
            <input
              type="date"
              className="input"
              value={editTanggal}
              onChange={(e) => onTanggalChange(e.target.value)}
            />
          </div>

          {/* Nama */}
          <div>
            <label className="label">Nama Siswa</label>
            <input
              type="text"
              className="input font-medium uppercase"
              value={editNama}
              onChange={(e) => onNamaChange(e.target.value.toUpperCase())}
            />
          </div>

          {/* Kelas */}
          <div>
            <label className="label">Kelas</label>
            <select
              className="select"
              value={editKelas}
              onChange={(e) => onKelasChange(e.target.value)}
            >
              <optgroup label="Kelas X (Sepuluh)">
                {SKAGARA_CLASSES.filter((k) => k.startsWith("X ")).map((k) => (
                  <option key={k} value={k}>{k}</option>
                ))}
              </optgroup>
              <optgroup label="Kelas XI (Sebelas)">
                {SKAGARA_CLASSES.filter((k) => k.startsWith("XI ")).map((k) => (
                  <option key={k} value={k}>{k}</option>
                ))}
              </optgroup>
              <optgroup label="Kelas XII (Dua Belas)">
                {SKAGARA_CLASSES.filter((k) => k.startsWith("XII ")).map((k) => (
                  <option key={k} value={k}>{k}</option>
                ))}
              </optgroup>
            </select>
          </div>

          {/* Status */}
          <div>
            <label className="label">Status Absen</label>
            <select
              className="select"
              value={editStatus}
              onChange={(e) => onStatusChange(e.target.value as StatusAbsen)}
            >
              {(["Hadir", "Sakit", "Izin", "Alfa"] as StatusAbsen[]).map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          {/* Kas */}
          <div>
            <label className="label">Nominal Kas (Rp)</label>
            <input
              type="number"
              min="0"
              step="500"
              className="input tabular-nums"
              value={editKas}
              onChange={(e) => onKasChange(Number(e.target.value) || 0)}
            />
          </div>
        </div>

        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            onClick={onCancel}
            disabled={saving}
            className="btn btn-secondary min-h-[44px] px-4 py-2 text-sm"
          >
            Batal
          </button>
          <button
            onClick={onConfirm}
            disabled={saving}
            className="btn btn-primary min-h-[44px] px-4 py-2 text-sm"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {saving ? "Menyimpan..." : "Simpan Perubahan"}
          </button>
        </div>
      </div>
    </div>
  );
});
