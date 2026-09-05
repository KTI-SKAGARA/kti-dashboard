"use client";

import { X, User, BookOpen, Coins, TrendingUp } from "lucide-react";
import { formatRupiah } from "@/lib/utils";
import type { TaggedRecord, StatusAbsen } from "@/types/attendance";
import { calculateStudentKas } from "@/lib/kas-allocation";

interface StudentDetailModalProps {
  nama: string;
  records: TaggedRecord[];
  onClose: () => void;
}

export default function StudentDetailModal({
  nama,
  records,
  onClose,
}: StudentDetailModalProps) {
  const studentRecords = records
    .filter((r) => r.nama === nama)
    .sort((a, b) => {
      const [ad, am, ay] = a.tanggal.split("/").map(Number);
      const [bd, bm, by] = b.tanggal.split("/").map(Number);
      return by !== ay ? by - ay : bm !== am ? bm - am : bd - ad;
    });

  const kasSummary = calculateStudentKas(studentRecords);
  const first = studentRecords[0];
  const total = studentRecords.length;
  const hadir = studentRecords.filter((r) => r.statusAbsen === "Hadir").length;
  const sakit = studentRecords.filter((r) => r.statusAbsen === "Sakit").length;
  const izin = studentRecords.filter((r) => r.statusAbsen === "Izin").length;
  const alfa = studentRecords.filter((r) => r.statusAbsen === "Alfa").length;
  const kas = studentRecords.reduce((sum, r) => sum + r.nominalKas, 0);
  const rate = total > 0 ? Math.round((hadir / total) * 1000) / 10 : 0;

  const badge = (s: StatusAbsen) =>
    s === "Hadir"
      ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300"
      : s === "Sakit"
      ? "bg-amber-500/15 text-amber-600 dark:text-amber-300"
      : s === "Izin"
      ? "bg-accent/15 text-accent dark:text-accent"
      : "bg-danger/15 text-danger";

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4 backdrop-blur-md animate-fade-in">
      <div className="card flex max-h-[92vh] sm:max-h-[85vh] w-full max-w-lg flex-col rounded-t-3xl sm:rounded-2xl p-5 sm:p-6 shadow-2xl pb-8 sm:pb-6 overflow-hidden">
        {/* Mobile Drag Indicator Pill */}
        <div className="mx-auto mb-2 h-1.5 w-12 rounded-full bg-border sm:hidden" />

        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-accent/40 bg-accent/15">
              <User className="h-5 w-5 text-accent" />
            </div>
            <div>
              <h3 className="font-display text-lg font-extrabold uppercase tracking-tight text-foreground">
                {nama}
              </h3>
              <p className="mt-0.5 text-xs font-medium text-muted">
                Gen {first._gen} • {first.kelas}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="btn btn-ghost min-h-[44px] min-w-[44px] p-2"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Stats */}
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div className="rounded-lg border-2 border-border bg-surface-2 p-2.5">
            <div className="flex items-center gap-1.5">
              <BookOpen className="h-3.5 w-3.5 text-muted" />
              <p className="text-[10px] font-bold uppercase tracking-wide text-muted">
                Pertemuan
              </p>
            </div>
            <p className="mt-1 text-sm font-extrabold text-foreground tabular-nums">
              {total}
            </p>
          </div>

          <div className="rounded-lg border-2 border-border bg-surface-2 p-2.5">
            <div className="flex items-center gap-1.5">
              <TrendingUp className="h-3.5 w-3.5 text-muted" />
              <p className="text-[10px] font-bold uppercase tracking-wide text-muted">
                Kehadiran
              </p>
            </div>
            <p className="mt-1 text-sm font-extrabold text-foreground tabular-nums">
              {rate}%
            </p>
          </div>

          <div className="rounded-lg border-2 border-border bg-surface-2 p-2.5">
            <div className="flex items-center gap-1.5">
              <Coins className="h-3.5 w-3.5 text-muted" />
              <p className="text-[10px] font-bold uppercase tracking-wide text-muted">
                Kas & Status
              </p>
            </div>
            <div className="mt-1 flex flex-col items-start gap-1">
              <span className="text-sm font-extrabold text-foreground tabular-nums">
                {formatRupiah(kas)}
              </span>
              <span className={`badge border text-[9px] font-bold px-1.5 py-0.5 ${kasSummary.statusBadge}`}>
                {kasSummary.statusText}
              </span>
            </div>
          </div>

          <div className="rounded-lg border-2 border-border bg-surface-2 p-2.5">
            <p className="text-[10px] font-bold uppercase tracking-wide text-muted">
              Status Absen
            </p>
            <div className="mt-1.5 flex flex-wrap gap-1">
              {[
                { s: "Hadir" as StatusAbsen, n: hadir },
                { s: "Sakit" as StatusAbsen, n: sakit },
                { s: "Izin" as StatusAbsen, n: izin },
                { s: "Alfa" as StatusAbsen, n: alfa },
              ]
                .filter((x) => x.n > 0)
                .map((x) => (
                  <span
                    key={x.s}
                    className={`badge text-[10px] ${badge(x.s)}`}
                  >
                    {x.s} {x.n}
                  </span>
                ))}
            </div>
          </div>
        </div>

        {/* History */}
        <div className="mt-4 flex-1 overflow-y-auto">
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">
            Riwayat Pertemuan & Kas
          </p>
          <table className="data-table">
            <thead>
              <tr>
                <th>Tanggal</th>
                <th>Kelas</th>
                <th>Kehadiran</th>
                <th className="text-right">Kas Masuk</th>
                <th>Status Kas</th>
              </tr>
            </thead>
            <tbody>
              {studentRecords.map((r, i) => {
                const meetingDetail = kasSummary.meetings.find((m) => m.tanggal === r.tanggal);

                return (
                  <tr key={i}>
                    <td className="whitespace-nowrap text-muted font-mono">{r.tanggal}</td>
                    <td className="text-muted">{r.kelas}</td>
                    <td>
                      <span className={`badge ${badge(r.statusAbsen)}`}>
                        {r.statusAbsen}
                      </span>
                    </td>
                    <td className="text-right tabular-nums font-mono font-semibold">
                      {r.nominalKas > 0 ? formatRupiah(r.nominalKas) : "—"}
                    </td>
                    <td>
                      {meetingDetail ? (
                        <span
                          className={`badge border text-[9px] font-bold ${meetingDetail.badgeClass}`}
                          title={meetingDetail.explanation}
                        >
                          {meetingDetail.statusLabel}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {studentRecords.length === 0 && (
            <p className="py-6 text-center text-xs text-muted">
              Tidak ada data untuk siswa ini.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
