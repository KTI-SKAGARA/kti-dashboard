"use client";

import { useState } from "react";
import { X, Coins, Loader2, Check, AlertCircle } from "lucide-react";
import type { Gen } from "@/types/attendance";
import { recordDirectKasPayment } from "@/app/actions/attendance";
import { formatRupiah, getTodayFormatted, normalizeName } from "@/lib/utils";
import { KAS_RUTIN_DEFAULT } from "@/types/attendance";

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  gens: Gen[];
  availableDates: string[];
  initialData?: {
    gen?: Gen;
    nama?: string;
    kelas?: string;
    tanggal?: string;
    nominalKas?: number;
    rowId?: string;
  } | null;
}

function KasPaymentForm({
  onClose,
  onSuccess,
  gens,
  availableDates,
  initialData,
}: Omit<Props, "open">) {
  const [gen, setGen] = useState<Gen>(initialData?.gen || gens[0] || ("" as Gen));
  const [nama, setNama] = useState(initialData?.nama || "");
  const [kelas, setKelas] = useState(initialData?.kelas || "");
  const [tanggal, setTanggal] = useState(
    initialData?.tanggal || availableDates[availableDates.length - 1] || getTodayFormatted()
  );
  const [nominal, setNominal] = useState<string>(
    String(initialData?.nominalKas ?? KAS_RUTIN_DEFAULT)
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const numNominal = Number(nominal) || 0;
  const standardFee = KAS_RUTIN_DEFAULT;
  const isSurplus = numNominal > standardFee;
  const surplusAmount = isSurplus ? numNominal - standardFee : 0;
  const weeksCovered = isSurplus ? Math.floor(surplusAmount / standardFee) : 0;

  const presets = [
    { label: "Rp 0 (Nunggak)", val: 0 },
    { label: "Rp 2.000 (1 Mgg)", val: 2000 },
    { label: "Rp 4.000 (2 Mgg)", val: 4000 },
    { label: "Rp 5.000 (+Alih 3k)", val: 5000 },
    { label: "Rp 10.000 (5 Mgg)", val: 10000 },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!gen) {
      setError("Pilih Gen terlebih dahulu.");
      return;
    }
    if (!nama.trim()) {
      setError("Nama siswa wajib diisi.");
      return;
    }
    if (!tanggal) {
      setError("Tanggal pertemuan wajib dipilih.");
      return;
    }
    if (numNominal < 0) {
      setError("Nominal pembayaran tidak boleh negatif.");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const res = await recordDirectKasPayment({
        gen,
        nama: normalizeName(nama),
        kelas,
        tanggal,
        nominalKas: numNominal,
        rowId: initialData?.rowId,
      });

      if (res.success) {
        onSuccess();
        onClose();
      } else {
        setError(res.error || "Gagal menyimpan pembayaran kas.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="relative flex max-h-[92vh] sm:max-h-[90vh] w-full max-w-md flex-col rounded-t-3xl sm:rounded-3xl border border-border/80 bg-surface p-5 sm:p-6 shadow-2xl overflow-y-auto pb-8 sm:pb-6">
      {/* Mobile Drag Indicator Pill */}
      <div className="mx-auto mb-2.5 h-1.5 w-12 rounded-full bg-border sm:hidden" />

      <div className="flex items-center justify-between border-b border-border/70 pb-3 sm:pb-3.5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-accent/30 bg-accent/10 text-accent shadow-xs">
            <Coins className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-display text-sm font-black uppercase tracking-wide text-foreground">
              {initialData?.rowId ? "Sesuaikan Kas Siswa" : "Catat Pembayaran Kas"}
            </h3>
            <p className="text-[11px] font-medium text-muted">
              Input kas &amp; sistem otomatis alihkan kelebihan ke minggu selanjutnya
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex h-8 w-8 items-center justify-center rounded-xl text-muted transition-colors hover:bg-surface-alt/80 hover:text-foreground active:scale-95"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {error && (
        <div className="mt-3 flex items-center gap-2 rounded-xl border border-danger/30 bg-danger/10 p-3 text-xs font-semibold text-danger">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-4 space-y-4">
        {/* Gen selector */}
        <div>
          <label className="label text-xs">Pilih Gen</label>
          <div className="flex gap-2">
            {gens.map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => setGen(g)}
                className={`inline-flex min-h-[38px] flex-1 items-center justify-center rounded-xl text-xs font-bold transition-all duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-[0.98] ${
                  gen === g
                    ? "bg-accent text-accent-foreground shadow-xs font-extrabold"
                    : "bg-surface-alt/60 text-muted hover:text-foreground hover:bg-surface-2 border border-border/60"
                }`}
              >
                Gen {g}
              </button>
            ))}
          </div>
        </div>

        {/* Nama Siswa */}
        <div>
          <label className="label text-xs">
            Nama Siswa <span className="text-danger">*</span>
          </label>
          <input
            type="text"
            className="input !h-10 text-xs uppercase font-semibold rounded-xl border-border/80 bg-surface focus:ring-2 focus:ring-accent/20"
            placeholder="Contoh: AHMAD MAULANA"
            value={nama}
            onChange={(e) => setNama(e.target.value)}
            required
          />
        </div>

        {/* Kelas */}
        <div>
          <label className="label text-xs">Kelas Siswa</label>
          <input
            type="text"
            className="input !h-10 text-xs uppercase rounded-xl border-border/80 bg-surface focus:ring-2 focus:ring-accent/20"
            placeholder="Contoh: XI TKJ 1"
            value={kelas}
            onChange={(e) => setKelas(e.target.value)}
          />
        </div>

        {/* Tanggal Pertemuan */}
        <div>
          <label className="label text-xs">
            Tanggal Pertemuan <span className="text-danger">*</span>
          </label>
          {availableDates.length > 0 ? (
            <div className="flex gap-2">
              <select
                className="select !h-10 flex-1 text-xs font-mono rounded-xl border-border/80 bg-surface"
                value={tanggal}
                onChange={(e) => setTanggal(e.target.value)}
              >
                <option value="">Pilih dari jadwal...</option>
                {availableDates.map((d) => (
                  <option key={d} value={d}>
                    Pertemuan {d}
                  </option>
                ))}
              </select>
              <input
                type="text"
                placeholder="Atau manual..."
                className="input !h-10 !w-36 text-xs font-mono rounded-xl border-border/80 bg-surface"
                value={tanggal}
                onChange={(e) => setTanggal(e.target.value)}
              />
            </div>
          ) : (
            <input
              type="text"
              placeholder="DD/MM/YYYY"
              className="input !h-10 text-xs font-mono rounded-xl border-border/80 bg-surface"
              value={tanggal}
              onChange={(e) => setTanggal(e.target.value)}
              required
            />
          )}
        </div>

        {/* Nominal Pembayaran */}
        <div>
          <label className="label text-xs">
            Nominal Kas (Rp) <span className="text-danger">*</span>
          </label>
          <div className="grid grid-cols-2 gap-1.5 mb-2">
            {presets.map((p) => (
              <button
                key={p.val}
                type="button"
                onClick={() => setNominal(String(p.val))}
                className={`inline-flex min-h-[38px] items-center justify-center rounded-xl text-xs font-mono font-bold transition-all duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-[0.98] ${
                  numNominal === p.val
                    ? "bg-accent text-accent-foreground shadow-xs"
                    : "bg-surface-alt/60 text-muted hover:text-foreground hover:bg-surface-2 border border-border/60"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <input
            type="number"
            step="500"
            min="0"
            className="input !h-11 font-mono font-black text-base tabular-nums rounded-xl border-border/80 bg-surface focus:ring-2 focus:ring-accent/20"
            value={nominal}
            onChange={(e) => setNominal(e.target.value)}
            placeholder="0"
            required
          />
        </div>

        {/* Live Rollover Preview Box — Double-Bezel Alert */}
        <div className="rounded-2xl border border-border/80 bg-surface-alt/40 p-3 text-xs">
          <p className="font-bold text-foreground flex items-center gap-1.5">
            <span>Simulasi Alihan Saldo:</span>
          </p>
          {numNominal === standardFee && (
            <p className="mt-1 text-emerald-600 dark:text-emerald-400 font-medium">
              ✅ Membayar pas Rp {formatRupiah(standardFee)} untuk pertemuan ini. Status Lunas.
            </p>
          )}
          {isSurplus && (
            <div className="mt-1 text-amber-600 dark:text-amber-300 font-medium space-y-1">
              <p>
                ⚡ Rp {formatRupiah(standardFee)} dipakai untuk pertemuan ini (Lunas).
              </p>
              <p className="font-bold">
                ⏩ Kelebihan <strong>{formatRupiah(surplusAmount)}</strong> otomatis dialihkan ke minggu selanjutnya
                {weeksCovered > 0 ? ` (cukup untuk ${weeksCovered} minggu ke depan).` : "."}
              </p>
            </div>
          )}
          {numNominal === 0 && (
            <p className="mt-1 text-danger font-medium">
              ⚠️ Nominal Rp 0 berarti siswa belum membayar kas di pertemuan ini (akan tercatat menunggak jika hadir).
            </p>
          )}
          {numNominal > 0 && numNominal < standardFee && (
            <p className="mt-1 text-amber-600 dark:text-amber-400 font-medium">
              ⚠️ Bayar sebagian: kurang {formatRupiah(standardFee - numNominal)}.
            </p>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-border/60">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="inline-flex min-h-[42px] items-center rounded-xl border border-border/80 bg-surface-alt/60 px-4 text-xs font-semibold text-foreground transition-all duration-200 hover:bg-surface-2 active:scale-[0.98]"
          >
            Batal
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex min-h-[42px] items-center gap-2 rounded-xl bg-accent px-5 text-xs font-bold text-accent-foreground shadow-xs transition-all duration-200 hover:brightness-105 active:scale-[0.98]"
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Check className="h-4 w-4" />
            )}
            <span>{submitting ? "Menyimpan..." : "Simpan Pembayaran"}</span>
          </button>
        </div>
      </form>
    </div>
  );
}

export default function KasPaymentModal(props: Props) {
  if (!props.open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4 backdrop-blur-md animate-fade-in">
      <KasPaymentForm
        key={`${props.initialData?.rowId || ""}-${props.initialData?.nama || ""}-${props.open}`}
        {...props}
      />
    </div>
  );
}
