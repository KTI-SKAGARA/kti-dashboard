"use client";

import { type FilterState, type Gen, type DashboardStats, type TaggedRecord } from "@/types/attendance";
import {
  formatRupiah,
  formatTanggalIndo,
} from "@/lib/utils";
import {
  Table as TableIcon,
  Eye,
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
  onStudentDetail: (nama: string) => void;
  getGenBadgeColor: (gen: Gen) => string;
}

export default function StatsView({
  stats,
  records,
  filters,
  onFiltersChange,
  dailySummaries,
  genSummaries,
  onOpenTableMode,
  onStudentDetail,
  getGenBadgeColor,
}: StatsViewProps) {
  const setFilters = (updater: (prev: FilterState) => FilterState) => {
    onFiltersChange(updater(filters));
  };

  return (
    <div className="mt-5 space-y-5">
      {/* Header detail if date filtered */}
      {filters.tanggal && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border-2 border-accent bg-accent/10 p-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-accent">
              Statistik Presensi Harian
            </p>
            <h2 className="text-base font-extrabold text-foreground">
              Tanggal: {formatTanggalIndo(filters.tanggal)} ({filters.tanggal})
            </h2>
          </div>
          <button
            onClick={() => setFilters((f) => ({ ...f, tanggal: "" }))}
            className="btn btn-secondary min-h-[40px] px-3 py-1.5 text-xs font-bold"
          >
            Lihat Semua Tanggal
          </button>
        </div>
      )}

      {/* Quick Summary Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Total Siswa" value={stats.totalRecords} />
        <StatCard label="Siswa Hadir" value={stats.hadirCount} />
        <StatCard label="Tingkat Hadir" value={`${stats.attendanceRate}%`} />
        <StatCard label="Total Kas" value={formatRupiah(stats.totalKas)} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="card p-5">
          <h2 className="font-display text-sm font-bold uppercase tracking-wide text-foreground">
            Distribusi Kehadiran {filters.tanggal ? `(${filters.tanggal})` : ""}
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

        <div className="card p-5">
          <h2 className="font-display text-sm font-bold uppercase tracking-wide text-foreground">
            Ringkasan Kas {filters.tanggal ? `(${filters.tanggal})` : ""}
          </h2>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <StatCard label="Total Kas" value={formatRupiah(stats.totalKas)} />
            <StatCard
              label="Rata-rata / Siswa"
              value={formatRupiah(stats.avgKasPerStudent)}
            />
          </div>
          <div className="mt-3 rounded-lg border-2 border-border bg-surface-2 p-3.5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-wide text-foreground">
                Persentase Kehadiran
              </p>
              <span className="text-base font-extrabold text-foreground tabular-nums">
                <span>{stats.attendanceRate}%</span>
              </span>
            </div>
            <div className="mt-2 h-2.5 w-full rounded-full bg-border">
              <div
                className="h-full rounded-full bg-gradient-to-r from-accent to-accent-2"
                style={{ width: `${stats.attendanceRate}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* If date is filtered, show direct list of students on that date */}
      {filters.tanggal ? (
        <div className="card p-5">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-border pb-3">
            <div>
              <h2 className="font-display text-sm font-bold uppercase tracking-wide text-foreground">
                Daftar Siswa pada {formatTanggalIndo(filters.tanggal)}
              </h2>
              <p className="text-xs text-muted">
                Total {records.length} siswa tercatat pada tanggal ini
              </p>
            </div>
            <button
              onClick={onOpenTableMode}
              className="btn btn-secondary min-h-[36px] px-3 py-1.5 text-xs font-bold"
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
                  <th className="text-right">Nominal Kas</th>
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
                      <span
                        className={`badge ${
                          r.statusAbsen === "Hadir"
                            ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300"
                            : r.statusAbsen === "Sakit"
                            ? "bg-amber-500/15 text-amber-600 dark:text-amber-300"
                            : r.statusAbsen === "Izin"
                            ? "bg-accent/15 text-accent"
                            : "bg-danger/15 text-danger"
                        }`}
                      >
                        {r.statusAbsen}
                      </span>
                    </td>
                    <td className="text-right font-medium text-foreground tabular-nums">
                      {r.nominalKas > 0 ? formatRupiah(r.nominalKas) : "—"}
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
                Klik tombol &quot;Lihat Data&quot; untuk memfilter data siswa pada tanggal tertentu
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
                    <th className="text-right">Total Kas</th>
                    <th className="w-24 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {dailySummaries.map((ds) => (
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
                      <td className="text-right font-medium text-foreground tabular-nums">
                        {formatRupiah(ds.kas)}
                      </td>
                      <td className="text-center">
                        <button
                          onClick={() => {
                            setFilters((f) => ({ ...f, tanggal: ds.tanggal }));
                          }}
                          className="btn btn-secondary min-h-[36px] px-2.5 py-1 text-xs font-bold"
                          title={`Filter data presensi tanggal ${ds.tanggal}`}
                        >
                          <Eye className="h-3.5 w-3.5" />
                          Lihat Data
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Class summaries */}
      <div className="card p-5">
        <h2 className="font-display text-sm font-bold uppercase tracking-wide text-foreground">
          Rekap Kas per Kelas
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
                  <th>Total Kas Terkumpul</th>
                </tr>
              </thead>
              <tbody>
                {stats.classSummaries.map((cs) => (
                  <tr key={cs.kelas}>
                    <td className="font-medium text-foreground">{cs.kelas}</td>
                    <td className="text-muted tabular-nums">{cs.totalRecords}</td>
                    <td className="text-muted tabular-nums">{cs.hadirCount}</td>
                    <td className="font-medium text-foreground tabular-nums">
                      {formatRupiah(cs.totalKas)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {filters.gen === "semua" && genSummaries.length > 0 && (
        <div className="card p-5">
          <h2 className="font-display text-sm font-bold uppercase tracking-wide text-foreground">
            Rekap per Gen
          </h2>
          <div className="mt-3 overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Gen</th>
                  <th>Status</th>
                  <th>Total Catatan</th>
                  <th>Jumlah Hadir</th>
                  <th>Total Kas Terkumpul</th>
                </tr>
              </thead>
              <tbody>
                {genSummaries.map((gs) => (
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
                    <td className="font-medium text-foreground tabular-nums">
                      {formatRupiah(gs.kas)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}