"use client";

import { useState, useMemo } from "react";
import {
  X,
  Copy,
  Check,
  Share2,
  MessageSquare,
  Sparkles,
} from "lucide-react";
import type { Gen } from "@/types/attendance";
import type { StudentKasSummary } from "@/lib/kas-allocation";
import { formatRupiah, getTodayFormatted, formatTanggalIndo } from "@/lib/utils";
import { ORG_NAME, SCHOOL_NAME } from "@/lib/constants";

interface Props {
  open: boolean;
  onClose: () => void;
  students: StudentKasSummary[];
  meetingDates: string[];
  gens: Gen[];
  initialGen?: string;
  initialKelas?: string;
  nominalRutin: number;
}

type MessageMode = "tunggakan" | "lengkap" | "ringkasan";

export default function WhatsAppRekapModal({
  open,
  onClose,
  students,
  meetingDates,
  gens,
  initialGen = "semua",
  initialKelas = "",
  nominalRutin,
}: Props) {
  const [selectedGen, setSelectedGen] = useState<string>(initialGen);
  const [selectedKelas, setSelectedKelas] = useState<string>(initialKelas);
  const [mode, setMode] = useState<MessageMode>("tunggakan");
  const [paymentNote, setPaymentNote] = useState<string>(
    "Pembayaran dapat diserahkan tunai ke Bendahara atau transfer DANA/Gopay."
  );
  const [includeDeadline, setIncludeDeadline] = useState<boolean>(true);
  const [deadlineText, setDeadlineText] = useState<string>("Pertemuan berikutnya");
  const [copied, setCopied] = useState<boolean>(false);

  // Extract unique classes for filter
  const availableClasses = useMemo(() => {
    const set = new Set<string>();
    for (const s of students) {
      if (s.kelas) set.add(s.kelas);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, "id"));
  }, [students]);

  // Filter students based on modal selections
  const filteredStudents = useMemo(() => {
    return students.filter((s) => {
      if (selectedGen !== "semua" && s.gen !== selectedGen) return false;
      if (selectedKelas && s.kelas !== selectedKelas) return false;
      return true;
    });
  }, [students, selectedGen, selectedKelas]);

  // Calculations for the selected cohort
  const cohortStats = useMemo(() => {
    let totalPaid = 0;
    let totalRequired = 0;
    let totalDebt = 0;
    let lunasCount = 0;
    let nunggakCount = 0;
    let lebihCount = 0;

    const debtors: StudentKasSummary[] = [];

    for (const s of filteredStudents) {
      totalPaid += s.totalPaid;
      totalRequired += s.totalRequired;
      if (s.status === "MENUNGGAK") {
        totalDebt += s.currentDebt;
        nunggakCount++;
        debtors.push(s);
      } else if (s.status === "LUNAS") {
        lunasCount++;
      } else if (s.status === "LEBIH") {
        lebihCount++;
      }
    }

    // Sort debtors by largest debt first
    debtors.sort((a, b) => b.currentDebt - a.currentDebt || a.nama.localeCompare(b.nama, "id"));

    return {
      totalStudents: filteredStudents.length,
      totalPaid,
      totalRequired,
      totalDebt,
      lunasCount,
      nunggakCount,
      lebihCount,
      debtors,
    };
  }, [filteredStudents]);

  // Build the WhatsApp formatted message
  const generatedMessage = useMemo(() => {
    const today = formatTanggalIndo(getTodayFormatted());
    const genLabel = selectedGen === "semua" ? "Semua Angkatan" : `GEN ${selectedGen}`;
    const kelasLabel = selectedKelas ? `Kelas ${selectedKelas}` : "Semua Kelas";
    const lastDate = meetingDates[meetingDates.length - 1]
      ? formatTanggalIndo(meetingDates[meetingDates.length - 1])
      : today;

    const lines: string[] = [];

    // Header
    lines.push(`*📢 REKAP IURAN KAS ${ORG_NAME}*`);
    lines.push(`_${SCHOOL_NAME}_`);
    lines.push(`━━━━━━━━━━━━━━━━━━━━`);
    lines.push(`📅 *Per Tanggal:* ${today}`);
    lines.push(`🏷️ *Angkatan / Kelas:* ${genLabel} (${kelasLabel})`);
    if (meetingDates.length > 0) {
      lines.push(`📌 *Total Pertemuan Terlaksana:* ${meetingDates.length} Kali (Terakhir: ${lastDate})`);
      lines.push(`💵 *Kewajiban Kas / Pertemuan:* ${formatRupiah(nominalRutin)}`);
    }
    lines.push(`━━━━━━━━━━━━━━━━━━━━`);

    // Section 1: Financial Summary
    lines.push(``);
    lines.push(`💰 *RINGKASAN KAS:*`);
    lines.push(`• Total Kas Masuk : *${formatRupiah(cohortStats.totalPaid)}*`);
    lines.push(`• Total Tunggakan  : *${formatRupiah(cohortStats.totalDebt)}*`);
    lines.push(
      `• Kepatuhan Siswa : *${cohortStats.lunasCount + cohortStats.lebihCount}* Lunas / Lebih | *${cohortStats.nunggakCount}* Menunggak`
    );

    // Section 2: Student List based on mode
    lines.push(``);
    if (mode === "tunggakan") {
      lines.push(`⚠️ *DAFTAR TUNGGAKAN KAS:*`);
      if (cohortStats.debtors.length === 0) {
        lines.push(`🎉 *Luar biasa! Tidak ada tunggakan kas pada kategori ini. Semua anggota Lunas.*`);
      } else {
        cohortStats.debtors.forEach((s, idx) => {
          const missedMeetings = Math.ceil(s.currentDebt / nominalRutin);
          lines.push(
            `${idx + 1}. *${s.nama}* (${s.kelas || "—"}) : *${formatRupiah(s.currentDebt)}* (~${missedMeetings}x kas)`
          );
        });
      }
    } else if (mode === "lengkap") {
      lines.push(`📋 *DAFTAR RINCIAN SISWA:*`);
      if (filteredStudents.length === 0) {
        lines.push(`_Tidak ada siswa tercatat pada filter ini._`);
      } else {
        filteredStudents.forEach((s, idx) => {
          let badge = "✅ Lunas";
          if (s.status === "MENUNGGAK") {
            badge = `⚠️ Nunggak ${formatRupiah(s.currentDebt)}`;
          } else if (s.status === "KURANG") {
            badge = `🟠 Kurang ${formatRupiah(s.currentDebt)}`;
          } else if (s.status === "LEBIH") {
            badge = `🌟 Lebih ${formatRupiah(s.currentSurplus)}`;
          }
          lines.push(`${idx + 1}. ${s.nama} (${s.kelas || "—"}) — ${badge}`);
        });
      }
    } else {
      // Ringkasan mode - just a polite encouragement
      lines.push(`ℹ️ *CATATAN:*`);
      lines.push(`Diharapkan kas ini digunakan untuk kelancaran kegiatan, perlengkapan project, dan konsumsi ekskul KTI.`);
    }

    // Section 3: Payment instructions & outro
    lines.push(``);
    lines.push(`━━━━━━━━━━━━━━━━━━━━`);
    if (paymentNote.trim()) {
      lines.push(`💳 *Info Pembayaran:*`);
      lines.push(paymentNote.trim());
    }
    if (includeDeadline && deadlineText.trim()) {
      lines.push(`⏰ *Batas Pelunasan:* ${deadlineText.trim()}`);
    }
    lines.push(``);
    lines.push(`Terima kasih atas kerja sama dan kontribusi teman-teman semua! 🙏✨`);
    lines.push(`_Sistem Absensi & Kas Otomatis KTI SKAGARA_`);

    return lines.join("\n");
  }, [
    selectedGen,
    selectedKelas,
    meetingDates,
    nominalRutin,
    cohortStats,
    mode,
    filteredStudents,
    paymentNote,
    includeDeadline,
    deadlineText,
  ]);

  // Copy to clipboard handler
  const handleCopy = async () => {
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(generatedMessage);
      } else {
        // Fallback
        const textArea = document.createElement("textarea");
        textArea.value = generatedMessage;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand("copy");
        document.body.removeChild(textArea);
      }
      setCopied(true);
      if (navigator.vibrate) navigator.vibrate(30);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      alert("Gagal menyalin teks. Silakan salin manual dari kotak preview.");
    }
  };

  // Open WhatsApp Web or Mobile app directly
  const handleOpenWhatsApp = () => {
    const encoded = encodeURIComponent(generatedMessage);
    const url = `https://api.whatsapp.com/send?text=${encoded}`;
    window.open(url, "_blank");
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/60 p-3 sm:p-4 backdrop-blur-xs animate-fade-in">
      <div
        className="relative w-full max-w-3xl overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-border bg-surface-alt/40 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
              <MessageSquare className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-display text-base font-extrabold uppercase tracking-tight text-foreground flex items-center gap-2">
                <span>Broadcast Rekap Kas</span>
                <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                  WhatsApp
                </span>
              </h2>
              <p className="text-xs text-muted">
                Format pesan siap kirim ke grup WhatsApp atau kontak anggota KTI
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-surface-2 hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* Controls: Target Filters & Mode */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {/* Angkatan Filter */}
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-muted mb-1 block">
                Pilih Angkatan
              </label>
              <select
                value={selectedGen}
                onChange={(e) => setSelectedGen(e.target.value)}
                className="select !h-9 text-xs w-full"
              >
                <option value="semua">Semua Angkatan</option>
                {gens.map((g) => (
                  <option key={g} value={g}>
                    Gen {g}
                  </option>
                ))}
              </select>
            </div>

            {/* Kelas Filter */}
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-muted mb-1 block">
                Pilih Kelas
              </label>
              <select
                value={selectedKelas}
                onChange={(e) => setSelectedKelas(e.target.value)}
                className="select !h-9 text-xs w-full"
              >
                <option value="">Semua Kelas</option>
                {availableClasses.map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </select>
            </div>

            {/* Mode Message */}
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-muted mb-1 block">
                Mode Pesan
              </label>
              <select
                value={mode}
                onChange={(e) => setMode(e.target.value as MessageMode)}
                className="select !h-9 text-xs w-full font-bold text-accent"
              >
                <option value="tunggakan">⚠️ Hanya Yang Nunggak (Tagihan)</option>
                <option value="lengkap">📋 Rekap Lengkap (Semua Siswa)</option>
                <option value="ringkasan">📊 Ringkasan Global (Tanpa Nama)</option>
              </select>
            </div>
          </div>

          {/* Quick Metrics Bar for Selected Target */}
          <div className="grid grid-cols-3 gap-2 rounded-xl border border-border/80 bg-surface-alt/40 p-3 text-center">
            <div>
              <p className="text-[10px] font-bold uppercase text-muted">Siswa Sasaran</p>
              <p className="font-mono text-sm font-black text-foreground">{cohortStats.totalStudents}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase text-muted">Total Tunggakan</p>
              <p className="font-mono text-sm font-black text-red-600 dark:text-red-400">
                {formatRupiah(cohortStats.totalDebt)}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase text-muted">Perlu Ditagih</p>
              <p className="font-mono text-sm font-black text-amber-600 dark:text-amber-400">
                {cohortStats.nunggakCount} Siswa
              </p>
            </div>
          </div>

          {/* Optional Notes */}
          <div className="space-y-2 rounded-xl border border-border/60 bg-surface-2/40 p-3">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-muted block mb-1">
                  Catatan Pembayaran (Rekening/E-wallet/Tunai)
                </label>
                <input
                  type="text"
                  value={paymentNote}
                  onChange={(e) => setPaymentNote(e.target.value)}
                  placeholder="Contoh: Transfer DANA 08123456789 (a.n. Bendahara)"
                  className="input !h-8 text-xs w-full"
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-muted">
                    Batas Waktu Pelunasan
                  </label>
                  <label className="flex items-center gap-1 text-[10px] text-muted cursor-pointer">
                    <input
                      type="checkbox"
                      checked={includeDeadline}
                      onChange={(e) => setIncludeDeadline(e.target.checked)}
                      className="rounded"
                    />
                    <span>Aktifkan</span>
                  </label>
                </div>
                <input
                  type="text"
                  disabled={!includeDeadline}
                  value={deadlineText}
                  onChange={(e) => setDeadlineText(e.target.value)}
                  placeholder="Contoh: Jumat, 15 Agustus 2026 jam 14.00"
                  className="input !h-8 text-xs w-full disabled:opacity-50"
                />
              </div>
            </div>
          </div>

          {/* WhatsApp Live Preview Box */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-accent" />
                <span>Pratinjau Pesan WhatsApp</span>
              </span>
              <span className="text-[10px] text-muted font-mono">
                {generatedMessage.length} karakter
              </span>
            </div>
            <div className="relative rounded-2xl border-2 border-emerald-500/30 bg-emerald-950/20 p-4 font-mono text-xs text-foreground/90 whitespace-pre-wrap leading-relaxed shadow-inner max-h-[300px] overflow-y-auto">
              {generatedMessage}
            </div>
          </div>
        </div>

        {/* Modal Footer / Actions */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border bg-surface-alt/40 px-5 py-3.5">
          <button
            type="button"
            onClick={onClose}
            className="btn btn-secondary min-h-[42px] px-4 text-xs font-semibold"
          >
            Tutup
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopy}
              className={`btn min-h-[42px] px-4 text-xs font-bold transition-all ${
                copied
                  ? "bg-emerald-600 text-white border-emerald-600"
                  : "btn-outline border-border hover:bg-surface-2"
              }`}
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4" />
                  <span>Tersalin ke Clipboard!</span>
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" />
                  <span>Salin Pesan (1-Klik)</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleOpenWhatsApp}
              className="btn min-h-[42px] px-4 text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-500 border-0 shadow-sm flex items-center gap-2"
            >
              <Share2 className="h-4 w-4" />
              <span>Buka di WhatsApp</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
