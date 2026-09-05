"use client";

import { useState } from "react";
import {
  X,
  User,
  Coins,
  ArrowRight,
  Copy,
  Check,
  Calendar,
  AlertTriangle,
  Sparkles,
  Edit2,
  MessageCircle,
  Loader2,
} from "lucide-react";
import type { StudentKasSummary, MeetingKasDetail } from "@/lib/kas-allocation";
import { generateWhatsAppReminderMessage } from "@/lib/kas-allocation";
import { formatRupiah, getGenBadgeColor } from "@/lib/utils";

interface Props {
  student: StudentKasSummary | null;
  onClose: () => void;
  onEditMeeting?: (meeting: MeetingKasDetail) => void;
  onAddPayment?: (student: StudentKasSummary) => void;
  onQuickPay?: (student: StudentKasSummary, nominal: number) => Promise<void>;
}

export default function StudentKasModal({
  student,
  onClose,
  onEditMeeting,
  onAddPayment,
  onQuickPay,
}: Props) {
  const [copied, setCopied] = useState(false);
  const [quickPaying, setQuickPaying] = useState(false);

  if (!student) return null;

  const handleCopyWhatsApp = () => {
    const text = generateWhatsAppReminderMessage(student);
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleOpenWhatsApp = () => {
    const text = generateWhatsAppReminderMessage(student);
    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, "_blank");
  };

  const handleQuickPay = async (nominal: number) => {
    if (!student || !onQuickPay || quickPaying) return;
    setQuickPaying(true);
    try {
      if (typeof navigator !== "undefined" && navigator.vibrate) {
        navigator.vibrate([15, 30, 15]);
      }
      await onQuickPay(student, nominal);
    } finally {
      setQuickPaying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4 backdrop-blur-md animate-fade-in">
      <div className="relative flex max-h-[92vh] sm:max-h-[90vh] w-full max-w-2xl flex-col rounded-t-3xl sm:rounded-3xl border border-border/80 bg-surface shadow-2xl p-5 sm:p-6 overflow-hidden pb-8 sm:pb-6">
        {/* Mobile Drag Indicator Pill */}
        <div className="mx-auto mb-2 h-1.5 w-12 rounded-full bg-border sm:hidden" />

        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-border/70 pb-3 sm:pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-2xl border border-accent/30 bg-accent/10 shadow-xs">
              <User className="h-5 w-5 sm:h-6 sm:w-6 text-accent" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                <h3 className="font-display text-base sm:text-lg font-black uppercase tracking-tight text-foreground">
                  {student.nama}
                </h3>
                <span className={`badge text-[9px] sm:text-[10px] font-bold ${getGenBadgeColor(student.gen)}`}>
                  Gen {student.gen}
                </span>
                <span className="badge bg-surface-alt/80 text-foreground text-[9px] sm:text-[10px] font-semibold border border-border/60">
                  {student.kelas}
                </span>
              </div>
              <p className="mt-0.5 text-[11px] sm:text-xs font-medium text-muted">
                Buku Kas Siswa &amp; Riwayat Alihan Saldo Otomatis
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-xl text-muted transition-colors hover:bg-surface-alt/80 hover:text-foreground active:scale-95"
            aria-label="Tutup modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Status Card Banner — Double-Bezel Architecture */}
        <div className="mt-3.5 rounded-2xl border border-border/80 bg-surface-alt/40 p-1.5 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/60 bg-surface p-3 sm:p-3.5">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted">
                Status Saldo Kas:
              </span>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <span className={`badge border px-2.5 py-0.5 text-xs font-bold ${student.statusBadge}`}>
                  {student.statusText}
                </span>
                {student.currentSurplus > 0 && student.coveredWeeksCount > 0 && (
                  <span className="text-xs text-muted font-medium">
                    • Cukup untuk <strong>{student.coveredWeeksCount} mgg</strong> ke depan
                  </span>
                )}
                {student.currentDebt > 0 && (
                  <span className="text-xs text-danger font-medium">
                    • Menunggak {student.unpaidMeetingsCount} pertemuan
                  </span>
                )}
              </div>
            </div>

            {/* Action buttons (WA & Kustom) */}
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
              <button
                onClick={handleOpenWhatsApp}
                className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white shadow-xs transition-all duration-200 hover:bg-emerald-700 active:scale-[0.97]"
                title="Buka aplikasi WhatsApp langsung dengan format tagihan siap kirim"
              >
                <MessageCircle className="h-3.5 w-3.5" />
                <span>Buka WA</span>
              </button>
              <button
                onClick={handleCopyWhatsApp}
                className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl border border-border/80 bg-surface-alt/60 px-3 py-1.5 text-xs font-bold text-foreground transition-all duration-200 hover:bg-surface-2 active:scale-[0.97]"
                title="Salin pesan tagihan siap kirim ke WhatsApp"
              >
                {copied ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-500" />
                    <span className="text-emerald-600 dark:text-emerald-400">Tersalin!</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5 text-muted" />
                    <span>Salin</span>
                  </>
                )}
              </button>
              {onAddPayment && (
                <button
                  onClick={() => onAddPayment(student)}
                  className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl bg-accent px-3 py-1.5 text-xs font-bold text-accent-foreground shadow-xs transition-all duration-200 hover:brightness-105 active:scale-[0.97]"
                >
                  <Coins className="h-3.5 w-3.5" />
                  <span>Kustom</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* 1-Tap Quick Pay Presets Bar (Ideal for Mobile Bendahara) */}
        {onQuickPay && (
          <div className="mt-2.5 rounded-2xl border border-accent/20 bg-accent/5 p-2 sm:p-2.5">
            <div className="flex items-center justify-between gap-2 pb-1.5 px-1">
              <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-accent flex items-center gap-1.5">
                <Coins className="h-3.5 w-3.5" />
                1-Tap Bayar Cepat:
              </span>
              <span className="text-[10px] text-muted">Langsung catat &amp; alihkan</span>
            </div>
            <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
              <button
                disabled={quickPaying}
                onClick={() => handleQuickPay(2000)}
                className="inline-flex min-h-[44px] flex-col items-center justify-center rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-xs font-bold text-emerald-700 dark:text-emerald-300 transition-all hover:bg-emerald-500/20 active:scale-[0.96] disabled:opacity-50"
              >
                {quickPaying ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <span>+ Rp 2.000</span>
                    <span className="text-[9px] font-normal opacity-80">1 Mgg (Pas)</span>
                  </>
                )}
              </button>
              <button
                disabled={quickPaying}
                onClick={() => handleQuickPay(4000)}
                className="inline-flex min-h-[44px] flex-col items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-xs font-bold text-amber-700 dark:text-amber-300 transition-all hover:bg-amber-500/20 active:scale-[0.96] disabled:opacity-50"
              >
                {quickPaying ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <span>+ Rp 4.000</span>
                    <span className="text-[9px] font-normal opacity-80">2 Mgg (+Alih)</span>
                  </>
                )}
              </button>
              <button
                disabled={quickPaying}
                onClick={() => handleQuickPay(10000)}
                className="inline-flex min-h-[44px] flex-col items-center justify-center rounded-xl border border-sky-500/30 bg-sky-500/10 px-2 py-1 text-xs font-bold text-sky-700 dark:text-sky-300 transition-all hover:bg-sky-500/20 active:scale-[0.96] disabled:opacity-50"
              >
                {quickPaying ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <span>+ Rp 10.000</span>
                    <span className="text-[9px] font-normal opacity-80">5 Mgg (+Alih)</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Quick KPI stats row */}
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div className="rounded-xl border border-border/70 bg-surface-alt/30 p-3">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted">Hadir / Total</span>
            <p className="mt-1 text-base font-extrabold text-foreground">
              {student.totalHadir} <span className="text-xs font-normal text-muted">/ {student.totalMeetings} mgg</span>
            </p>
          </div>
          <div className="rounded-xl border border-border/70 bg-surface-alt/30 p-3">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted">Total Dibayar</span>
            <p className="mt-1 text-base font-extrabold text-accent font-mono">
              {formatRupiah(student.totalPaid)}
            </p>
          </div>
          <div className="rounded-xl border border-border/70 bg-surface-alt/30 p-3">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted">Total Kewajiban</span>
            <p className="mt-1 text-base font-extrabold text-foreground font-mono">
              {formatRupiah(student.totalRequired)}
            </p>
          </div>
          <div className="rounded-xl border border-border/70 bg-surface-alt/30 p-3">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted">Saldo Lebih Aktif</span>
            <p className={`mt-1 text-base font-extrabold font-mono ${
              student.currentSurplus > 0 ? "text-amber-500" : "text-muted"
            }`}>
              {formatRupiah(student.currentSurplus)}
            </p>
          </div>
        </div>

        {/* Timeline & Meeting History list */}
        <div className="mt-4 flex-1 overflow-y-auto pr-1 space-y-2.5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-wide text-muted">
              Alur Alihan Kas per Pertemuan (Kronologis)
            </p>
            <span className="text-[10px] text-muted">
              {student.meetings.length} pertemuan tercatat
            </span>
          </div>

          {student.meetings.length === 0 ? (
            <p className="py-8 text-center text-xs text-muted">
              Belum ada data pertemuan untuk siswa ini.
            </p>
          ) : (
            student.meetings.map((m, idx) => (
              <div
                key={m.tanggal + idx}
                className="relative rounded-xl border border-border bg-surface p-3.5 transition-colors hover:border-accent/40"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/50 pb-2">
                  <div className="flex items-center gap-2 font-mono text-xs font-bold text-foreground">
                    <Calendar className="h-3.5 w-3.5 text-muted" />
                    <span>{m.tanggal}</span>
                    <span className="text-[11px] font-normal text-muted font-sans">
                      ({m.kelas})
                    </span>
                    <span className="badge bg-surface-2 text-[10px] font-semibold text-muted font-sans">
                      {m.statusAbsen}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className={`badge border text-[10px] font-bold ${m.badgeClass}`}>
                      {m.statusLabel}
                    </span>
                    {onEditMeeting && (
                      <button
                        onClick={() => onEditMeeting(m)}
                        className="btn btn-ghost min-h-[28px] px-2 py-1 text-[11px] font-semibold text-muted hover:text-foreground"
                        title="Sesuaikan nominal kas di tanggal ini"
                      >
                        <Edit2 className="h-3 w-3" />
                        <span>Edit</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Explanation text & Visual flow */}
                <div className="mt-2.5 space-y-1.5 text-xs">
                  <p className="text-foreground font-medium flex items-center gap-1.5">
                    {m.status === "BAYAR_LEBIH" && (
                      <Sparkles className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                    )}
                    {m.status === "LUNAS_ALIHAN" && (
                      <ArrowRight className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                    )}
                    {m.status === "MENUNGGAK" && (
                      <AlertTriangle className="h-3.5 w-3.5 text-danger shrink-0" />
                    )}
                    <span>{m.explanation}</span>
                  </p>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted pt-1 border-t border-border/30">
                    <span>
                      Dibayar langsung:{" "}
                      <strong className="text-foreground font-mono">
                        {formatRupiah(m.paid)}
                      </strong>
                    </span>
                    {m.carriedFromPrevious > 0 && (
                      <span>
                        Alihan masuk dari mgg lalu:{" "}
                        <strong className="text-blue-500 font-mono">
                          +{formatRupiah(m.carriedFromPrevious)}
                        </strong>
                      </span>
                    )}
                    <span>
                      Digunakan hari ini:{" "}
                      <strong className="text-foreground font-mono">
                        {formatRupiah(m.usedThisMeeting)}
                      </strong>
                    </span>
                    {m.carriedToNext > 0 && (
                      <span>
                        Dialihkan ke mgg selanjutnya:{" "}
                        <strong className="text-amber-500 font-mono font-bold">
                          +{formatRupiah(m.carriedToNext)}
                        </strong>
                      </span>
                    )}
                    {m.shortage > 0 && (
                      <span>
                        Kekurangan:{" "}
                        <strong className="text-danger font-mono font-bold">
                          {formatRupiah(m.shortage)}
                        </strong>
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
