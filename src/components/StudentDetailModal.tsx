"use client";

import { X, User, BookOpen, Coins, TrendingUp } from "lucide-react";
import { formatRupiah } from "@/lib/utils";
import type { TaggedRecord, StatusAbsen } from "@/types/attendance";

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/50 p-4">
      <div className="card flex max-h-[85vh] w-full max-w-lg flex-col p-6 shadow-lg">
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
          {[
            { icon: BookOpen, label: "Pertemuan", value: String(total) },
            { icon: TrendingUp, label: "Kehadiran", value: `${rate}%` },
            { icon: Coins, label: "Total Kas", value: formatRupiah(kas) },
          ].map((s) => (
            <div
              key={s.label}
              className="rounded-lg border-2 border-border bg-surface-2 p-2.5"
            >
              <div className="flex items-center gap-1.5">
                <s.icon className="h-3.5 w-3.5 text-muted" />
                <p className="text-[10px] font-bold uppercase tracking-wide text-muted">
                  {s.label}
                </p>
              </div>
              <p className="mt-1 text-sm font-extrabold text-foreground tabular-nums">
                {s.value}
              </p>
            </div>
          ))}
          <div className="rounded-lg border-2 border-border bg-surface-2 p-2.5">
            <p className="text-[10px] font-bold uppercase tracking-wide text-muted">
              Status
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
            Riwayat Pertemuan
          </p>
          <table className="data-table">
            <thead>
              <tr>
                <th>Tanggal</th>
                <th>Kelas</th>
                <th>Status</th>
                <th className="text-right">Kas</th>
              </tr>
            </thead>
            <tbody>
              {studentRecords.map((r, i) => (
                <tr key={i}>
                  <td className="whitespace-nowrap text-muted">{r.tanggal}</td>
                  <td className="text-muted">{r.kelas}</td>
                  <td>
                    <span className={`badge ${badge(r.statusAbsen)}`}>
                      {r.statusAbsen}
                    </span>
                  </td>
                  <td className="text-right tabular-nums">
                    {r.nominalKas > 0 ? formatRupiah(r.nominalKas) : "—"}
                  </td>
                </tr>
              ))}
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
