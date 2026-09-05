"use client";

import { memo } from "react";
import { type FilterState, type Gen, type DashboardStats, type TaggedRecord } from "@/types/attendance";
import {
  formatTanggalIndo,
  formatTanggalToISO,
  parseISOTanggal,
  getStatusBadgeClass,
} from "@/lib/utils";
import {
  Table as TableIcon,
  Eye,
  Coins,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import StatCard from "@/components/StatCard";
import ProgressBarRow from "@/components/ProgressBarRow";

interface DailySummary {
  tanggal: string;
  bulanTahun: string;
  total: number;
  hadir: number;
  sakit: number;
  izin: number;
  alfa: number;
  kas: number;
  gens: Set<Gen>;
}

interface GenSummary {
  gen: Gen;
  total: number;
  hadir: number;
  kas: number;
  isLulus: boolean;
}

interface StatsViewProps {
  stats: DashboardStats;
  records: TaggedRecord[]; // records ter-filter (untuk daftar per tanggal)
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
  dailySummaries: DailySummary[];
  genSummaries: GenSummary[];
  onOpenTableMode: () => void;
  onOpenKasMode?: () => void;
  onStudentDetail: (nama: string) => void;
  getGenBadgeColor: (gen: Gen) => string;
}

export default memo(function StatsView({
  stats,
  records,
  filters,
  onFiltersChange,
  dailySummaries,
  genSummaries,
  onOpenTableMode,
  onOpenKasMode,
  onStudentDetail,
  getGenBadgeColor,
}: StatsViewProps) {
  const setFilters = (updater: (prev: FilterState) => FilterState) => {
    onFiltersChange(updater(filters));
  };

  const isSingleDate =
    Boolean(filters.tanggalFrom) && filters.tanggalFrom === filters.tanggalTo;
  const hasDateFilter = Boolean(filters.tanggalFrom || filters.tanggalTo);

  const dateRangeLabel = hasDateFilter
    ? filters.tanggalFrom === filters.tanggalTo
      ? `${formatTanggalIndo(parseISOTanggal(filters.tanggalFrom))} (${parseISOTanggal(filters.tanggalFrom)})`
      : `${filters.tanggalFrom ? formatTanggalIndo(parseISOTanggal(filters.tanggalFrom)) : "Awal"} s/d ${filters.tanggalTo ? formatTanggalIndo(parseISOTanggal(filters.tanggalTo)) : "Sekarang"}`
    : "";

  const totalTidakHadir = stats.sakitCount + stats.izinCount + stats.alfaCount;
  const alfaRate =
    stats.totalRecords > 0
      ? Math.round((stats.alfaCount / stats.totalRecords) * 1000) / 10
      : 0;
  const izinSakitRate =
    stats.totalRecords > 0
      ? Math.round(((stats.sakitCount + stats.izinCount) / stats.totalRecords) * 1000) / 10
      : 0;

  return (
    <div className="mt-5 space-y-5">
      {/* Header detail if date filtered */}
      {hasDateFilter && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border-2 border-accent bg-accent/10 p-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-accent">
              {isSingleDate ? "Statistik Presensi Harian" : "Statistik Presensi Rentang Tanggal"}
            </p>
            <h2 className="text-base font-extrabold text-foreground">
              Tanggal: {dateRangeLabel}
            </h2>
          </div>
          <button
            onClick={() =>
              setFilters((f) => ({ ...f, tanggalFrom: "", tanggalTo: "" }))
            }
            className="btn btn-secondary min-h-[44px] px-3 py-1.5 text-xs font-bold"
          >
            Lihat Semua Tanggal
          </button>
        </div>
      )}

      {/* Quick Summary Cards — 100% Statistik Kehadiran */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          label="Total Catatan"
          value={stats.totalRecords}
          subtext="Catatan presensi"
        />
        <StatCard
          label="Siswa Hadir"
          value={stats.hadirCount}
          subtext={`${stats.attendanceRate}% dari total`}
        />
        <StatCard
          label="Tingkat Hadir"
          value={`${stats.attendanceRate}%`}
          subtext={
            stats.attendanceRate >= 85
              ? "Sangat Baik"
              : stats.attendanceRate >= 70
              ? "Cukup Baik"
              : "Perlu Perhatian"
          }
        />
        <StatCard
          label="Tidak Hadir"
          value={totalTidakHadir}
          subtext={`S: ${stats.sakitCount} • I: ${stats.izinCount} • A: ${stats.alfaCount}`}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Distribusi Kehadiran */}
        <div className="card p-5">
          <h2 className="font-display text-sm font-bold uppercase tracking-wide text-foreground">
            Distribusi Kehadiran {hasDateFilter ? `(${dateRangeLabel})` : ""}
          </h2>
          {stats.totalRecords === 0 ? (
            <p className="py-6 text-center text-xs text-muted">Belum ada data.</p>
          ) : (
            <div className="mt-4 space-y-3">
              <ProgressBarRow
                label="Hadir"
                count={stats.hadirCount}
                total={stats.totalRecords}
                fillClass="bg-emerald-500"
              />
              <ProgressBarRow
                label="Sakit"
                count={stats.sakitCount}
                total={stats.totalRecords}
                fillClass="bg-amber-400"
              />
              <ProgressBarRow
                label="Izin"
                count={stats.izinCount}
                total={stats.totalRecords}
                fillClass="bg-accent"
              />
              <ProgressBarRow
                label="Alfa"
                count={stats.alfaCount}
                total={stats.totalRecords}
                fillClass="bg-danger"
              />
            </div>
          )}
        </div>

        {/* Ringkasan Kedisiplinan & Callout Kas */}
        <div className="card p-5 flex flex-col justify-between">
          <div>
            <h2 className="font-display text-sm font-bold uppercase tracking-wide text-foreground">
              Evaluasi Kedisiplinan Presensi
            </h2>
            <div className="mt-4 rounded-xl border border-border/80 bg-surface-alt/50 p-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold uppercase tracking-wide text-foreground flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                  Persentase Kehadiran Efektif
                </p>
                <span className="text-base font-extrabold text-foreground tabular-nums">
                  {stats.attendanceRate}%
                </span>
              </div>
              <div className="mt-2.5 h-2.5 w-full rounded-full bg-border overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-accent to-accent-2 transition-all duration-500"
                  style={{ width: `${stats.attendanceRate}%` }}
                />
              </div>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-border/70 bg-surface-alt/40 p-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-danger flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  Alfa (Tanpa Ket.)
                </p>
                <p className="mt-1 font-mono text-lg font-bold text-foreground">
                  {stats.alfaCount} <span className="text-xs font-normal text-muted">({alfaRate}%)</span>
                </p>
              </div>
              <div className="rounded-xl border border-border/70 bg-surface-alt/40 p-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                  Izin &amp; Sakit
                </p>
                <p className="mt-1 font-mono text-lg font-bold text-foreground">
                  {stats.sakitCount + stats.izinCount} <span className="text-xs font-normal text-muted">({izinSakitRate}%)</span>
                </p>
              </div>
            </div>
          </div>

          {/* Callout to Kas Siswa */}
          <div className="mt-4 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3.5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
                  <Coins className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-xs font-bold text-foreground">
                    Statistik &amp; Manajemen Kas Dipisahkan
                  </p>
                  <p className="text-[11px] text-muted">
                    Total kas terkumpul, tunggakan, dan saldo alihan ada di tab terpisah.
                  </p>
                </div>
              </div>
              {onOpenKasMode && (
                <button
                  onClick={onOpenKasMode}
                  className="btn btn-secondary min-h-[36px] px-3 py-1.5 text-xs font-bold text-foreground hover:text-accent"
                >
                  Buka Tab Kas Siswa →
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* If single date is filtered, show direct list of students on that date */}
      {isSingleDate ? (
        <div className="card p-5">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-border pb-3">
            <div>
              <h2 className="font-display text-sm font-bold uppercase tracking-wide text-foreground">
                Daftar Siswa pada {formatTanggalIndo(parseISOTanggal(filters.tanggalFrom))}
              </h2>
              <p className="text-xs text-muted">
                Total {records.length} siswa tercatat pada tanggal ini
              </p>
            </div>
            <button
              onClick={onOpenTableMode}
              className="btn btn-secondary min-h-[44px] px-3 py-1.5 text-xs font-bold"
            >
              <TableIcon className="h-3.5 w-3.5" />
              Buka di Mode Tabel
            </button>
          </div>

          <div className="mt-3 overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th className="w-10">No</th>
                  <th>Nama Siswa</th>
                  <th>Kelas</th>
                  <th>Status Absen</th>
                  <th>Gen</th>
                </tr>
              </thead>
              <tbody>
                {records.map((r, i) => (
                  <tr key={`${r._gen}-${r.nama}-${r._rowId}`}>
                    <td className="text-muted tabular-nums">{i + 1}</td>
                    <td className="font-medium uppercase text-foreground">
                      <button
                        onClick={() => onStudentDetail(r.nama)}
                        className="hover:text-accent hover:underline"
                      >
                        {r.nama}
                      </button>
                    </td>
                    <td className="text-muted">{r.kelas}</td>
                    <td>
                      <span className={`badge ${getStatusBadgeClass(r.statusAbsen)}`}>
                        {r.statusAbsen}
                      </span>
                    </td>
                    <td>
                      <span
                        className={`badge font-bold ${getGenBadgeColor(
                          r._gen
                        )}`}
                      >
                        GEN {r._gen}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Daily meeting dates breakdown table */
        <div className="card p-5">
          <div className="flex items-center justify-between border-b-2 border-border pb-3">
            <div>
              <h2 className="font-display text-sm font-bold uppercase tracking-wide text-foreground">
                Rekap Presensi Harian (Riwayat Pertemuan)
              </h2>
              <p className="text-xs text-muted">
                Klik tombol &quot;Lihat Data&quot; untuk memfilter data presensi siswa pada tanggal tertentu
              </p>
            </div>
          </div>

          {dailySummaries.length === 0 ? (
            <p className="py-6 text-center text-xs text-muted">
              Belum ada riwayat pertemuan.
            </p>
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Tanggal Pertemuan</th>
                    <th>Gen</th>
                    <th>Total Siswa</th>
                    <th>Hadir</th>
                    <th>Sakit</th>
                    <th>Izin</th>
                    <th>Alfa</th>
                    <th className="text-right">Tingkat Hadir</th>
                    <th className="w-24 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {dailySummaries.map((ds) => {
                    const rate = ds.total > 0 ? Math.round((ds.hadir / ds.total) * 1000) / 10 : 0;
                    return (
                      <tr key={ds.tanggal}>
                        <td className="font-bold text-foreground">
                          {formatTanggalIndo(ds.tanggal)} ({ds.tanggal})
                        </td>
                        <td>
                          <div className="flex flex-wrap gap-1">
                            {Array.from(ds.gens).map((g) => (
                              <span
                                key={g}
                                className={`badge font-bold ${getGenBadgeColor(
                                  g
                                )}`}
                              >
                                GEN {g}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="text-foreground font-semibold tabular-nums">
                          {ds.total}
                        </td>
                        <td className="text-emerald-600 dark:text-emerald-300 font-semibold tabular-nums">
                          {ds.hadir}
                        </td>
                        <td className="text-amber-600 dark:text-amber-300 tabular-nums">
                          {ds.sakit}
                        </td>
                        <td className="text-accent tabular-nums">{ds.izin}</td>
                        <td className="text-danger tabular-nums">{ds.alfa}</td>
                        <td className="text-right font-bold tabular-nums">
                          <span className={rate >= 80 ? "text-emerald-600 dark:text-emerald-400" : rate >= 65 ? "text-amber-600 dark:text-amber-400" : "text-danger"}>
                            {rate}%
                          </span>
                        </td>
                        <td className="text-center">
                          <button
                            onClick={() => {
                              const iso = formatTanggalToISO(ds.tanggal);
                              setFilters((f) => ({
                                ...f,
                                tanggalFrom: iso || "",
                                tanggalTo: iso || "",
                              }));
                            }}
                            className="btn btn-secondary min-h-[44px] px-2.5 py-1 text-xs font-bold"
                            title={`Filter data presensi tanggal ${ds.tanggal}`}
                          >
                            <Eye className="h-3.5 w-3.5" />
                            Lihat Data
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Class summaries */}
      <div className="card p-5">
        <h2 className="font-display text-sm font-bold uppercase tracking-wide text-foreground">
          Rekap Kehadiran per Kelas
        </h2>
        {stats.classSummaries.length === 0 ? (
          <p className="py-6 text-center text-xs text-muted">Belum ada rekap per kelas.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Nama Kelas</th>
                  <th>Jumlah Catatan</th>
                  <th>Jumlah Hadir</th>
                  <th>Tingkat Hadir (%)</th>
                </tr>
              </thead>
              <tbody>
                {stats.classSummaries.map((cs) => {
                  const rate = cs.totalRecords > 0
                    ? Math.round((cs.hadirCount / cs.totalRecords) * 1000) / 10
                    : 0;
                  return (
                    <tr key={cs.kelas}>
                      <td className="font-medium text-foreground">{cs.kelas}</td>
                      <td className="text-muted tabular-nums">{cs.totalRecords}</td>
                      <td className="text-muted tabular-nums">{cs.hadirCount}</td>
                      <td className="font-bold tabular-nums">
                        <span className={rate >= 80 ? "text-emerald-600 dark:text-emerald-400" : rate >= 65 ? "text-amber-600 dark:text-amber-400" : "text-danger"}>
                          {rate}%
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {filters.gen === "semua" && genSummaries.length > 0 && (
        <div className="card p-5">
          <h2 className="font-display text-sm font-bold uppercase tracking-wide text-foreground">
            Rekap Kehadiran per Gen
          </h2>
          <div className="mt-3 overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Gen</th>
                  <th>Status</th>
                  <th>Total Catatan</th>
                  <th>Jumlah Hadir</th>
                  <th>Tingkat Hadir (%)</th>
                </tr>
              </thead>
              <tbody>
                {genSummaries.map((gs) => {
                  const rate = gs.total > 0
                    ? Math.round((gs.hadir / gs.total) * 1000) / 10
                    : 0;
                  return (
                    <tr key={gs.gen} className={gs.isLulus ? "opacity-60" : ""}>
                      <td className="font-medium text-foreground">
                        <span className="font-display font-extrabold">Gen {gs.gen}</span>
                      </td>
                      <td>
                        {gs.isLulus ? (
                          <span className="badge border-amber-400/40 bg-amber-400/15 text-amber-600 dark:text-amber-300">
                            Lulus
                          </span>
                        ) : (
                          <span className="badge border-emerald-500/40 bg-emerald-500/15 text-emerald-600 dark:text-emerald-300">
                            Aktif
                          </span>
                        )}
                      </td>
                      <td className="text-muted tabular-nums">{gs.total}</td>
                      <td className="text-muted tabular-nums">{gs.hadir}</td>
                      <td className="font-bold tabular-nums">
                        <span className={rate >= 80 ? "text-emerald-600 dark:text-emerald-400" : rate >= 65 ? "text-amber-600 dark:text-amber-400" : "text-danger"}>
                          {rate}%
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
});