"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import {
  type Gen,
  type AttendanceRecord,
  type GenConfig,
} from "@/types/attendance";
import {
  type Kegiatan,
  getMeetingDates,
  loadKegiatan,
} from "@/types/kegiatan";
import { getAttendanceRecords, getGenList } from "@/app/actions/attendance";
import { formatRupiah, getGenBadgeColor } from "@/lib/utils";
import { Loader2, User, Search } from "lucide-react";
import StudentDetailModal from "@/components/StudentDetailModal";

type TaggedRecord = AttendanceRecord & { _gen: Gen; _rawIdx: number };

interface StudentSummary {
  nama: string;
  kelas: string;
  gen: Gen;
  total: number;
  hadir: number;
  absen: number;
  sakit: number;
  izin: number;
  alfa: number;
  kas: number;
  rate: number;
}

export default function IndividualStatsPage() {
  const [genList, setGenList] = useState<GenConfig[]>([]);
  const [selectedGen, setSelectedGen] = useState<Gen>("semua");
  const [selectedKelas, setSelectedKelas] = useState("");
  const [selectedBulan, setSelectedBulan] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sortBy, setSortBy] = useState<"rate" | "absen" | "hadir" | "total">("rate");
  const [search, setSearch] = useState("");
  const [allRecords, setAllRecords] = useState<TaggedRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [studentDetail, setStudentDetail] = useState<string | null>(null);
  const [kegiatanList, setKegiatanList] = useState<Kegiatan[]>([]);

  // Load kegiatan from localStorage
  useEffect(() => {
    setKegiatanList(loadKegiatan());
  }, []);

  const meetingDates = useMemo(() => getMeetingDates(kegiatanList), [kegiatanList]);

  const allGens = useMemo(
    () => genList.filter((g) => g.status === "aktif").map((g) => g.gen),
    [genList]
  );

  const loadGenList = useCallback(async () => {
    try {
      const res = await getGenList();
      if (res.success && res.data) setGenList(res.data);
    } catch {}
  }, []);

  const loadRecords = useCallback(async () => {
    setLoading(true);
    try {
      const gensToLoad = selectedGen === "semua" ? allGens : [selectedGen];
      const results = await Promise.all(gensToLoad.map((g) => getAttendanceRecords(g)));
      const tagged: TaggedRecord[] = [];
      for (const res of results) {
        if (res.success && res.data) {
          const gen = gensToLoad[results.indexOf(res)];
          res.data.forEach((r, i) =>
            tagged.push({ ...r, _gen: gen, _rawIdx: i })
          );
        }
      }
      setAllRecords(tagged);
    } catch {}
    setLoading(false);
  }, [selectedGen, allGens]);

  useEffect(() => { loadGenList(); }, [loadGenList]);
  useEffect(() => { if (allGens.length > 0) loadRecords(); }, [loadRecords, allGens]);

  const kelasList = useMemo(() => {
    const set = new Set(allRecords.map((r) => r.kelas));
    return Array.from(set).sort((a, b) => a.localeCompare(b, "id"));
  }, [allRecords]);

  const bulanList = useMemo(() => {
    const set = new Set(allRecords.map((r) => r.bulanTahun));
    return Array.from(set).sort().reverse();
  }, [allRecords]);

  const filteredRecords = useMemo(() => {
    let result = allRecords;
    if (selectedKelas) result = result.filter((r) => r.kelas === selectedKelas);
    if (selectedBulan) result = result.filter((r) => r.bulanTahun === selectedBulan);
    if (dateFrom) {
      const [fd, fm, fy] = dateFrom.split("/").map(Number);
      const fromTs = new Date(fy, fm - 1, fd).getTime();
      result = result.filter((r) => {
        const [d, m, y] = r.tanggal.split("/").map(Number);
        return new Date(y, m - 1, d).getTime() >= fromTs;
      });
    }
    if (dateTo) {
      const [td, tm, ty] = dateTo.split("/").map(Number);
      const toTs = new Date(ty, tm - 1, td).getTime();
      result = result.filter((r) => {
        const [d, m, y] = r.tanggal.split("/").map(Number);
        return new Date(y, m - 1, d).getTime() <= toTs;
      });
    }
    if (search) {
      const q = search.toUpperCase();
      result = result.filter((r) => r.nama.includes(q));
    }
    return result;
  }, [allRecords, selectedKelas, selectedBulan, dateFrom, dateTo, search]);

  const studentSummaries = useMemo(() => {
    const map = new Map<string, StudentSummary>();
    for (const r of filteredRecords) {
      const key = `${r._gen}|${r.nama}`;
      const cur = map.get(key) || {
        nama: r.nama,
        kelas: r.kelas,
        gen: r._gen,
        total: 0,
        hadir: 0,
        absen: 0,
        sakit: 0,
        izin: 0,
        alfa: 0,
        kas: 0,
        rate: 0,
      };
      if (r.statusAbsen === "Hadir") cur.hadir += 1;
      else if (r.statusAbsen === "Sakit") cur.sakit += 1;
      else if (r.statusAbsen === "Izin") cur.izin += 1;
      else if (r.statusAbsen === "Alfa") cur.alfa += 1;
      cur.kas += r.nominalKas;
      map.set(key, cur);
    }

    // Compute absen per student based on meeting dates
    const meetingCount = meetingDates.size;
    for (const [key, student] of map) {
      const [gen, nama] = key.split("|");
      // Get dates this student attended
      const attendedDates = new Set(
        filteredRecords
          .filter((r) => r._gen === gen && r.nama === nama)
          .map((r) => r.tanggal)
      );
      // Absen = meeting dates not covered
      for (const md of meetingDates) {
        if (!attendedDates.has(md)) student.absen++;
      }
      student.total = student.hadir + student.sakit + student.izin + student.absen;
      student.rate = student.total > 0 ? Math.round((student.hadir / student.total) * 1000) / 10 : 0;
    }

    const arr = Array.from(map.values());
    // Sort
    switch (sortBy) {
      case "rate":
        arr.sort((a, b) => b.rate - a.rate || b.total - a.total || a.nama.localeCompare(b.nama, "id"));
        break;
      case "absen":
        arr.sort((a, b) => b.absen - a.absen || a.rate - b.rate || a.nama.localeCompare(b.nama, "id"));
        break;
      case "hadir":
        arr.sort((a, b) => b.hadir - a.hadir || b.rate - a.rate || a.nama.localeCompare(b.nama, "id"));
        break;
      case "total":
        arr.sort((a, b) => b.total - a.total || b.rate - a.rate || a.nama.localeCompare(b.nama, "id"));
        break;
    }
    return arr;
  }, [filteredRecords, sortBy, meetingDates]);

  // Quick summary
  const summary = useMemo(() => {
    const total = studentSummaries.length;
    const avgRate = total > 0
      ? Math.round((studentSummaries.reduce((s, x) => s + x.rate, 0) / total) * 10) / 10
      : 0;
    const perfectCount = studentSummaries.filter((s) => s.rate === 100).length;
    const riskCount = studentSummaries.filter((s) => s.rate < 50 && s.total > 0).length;
    return { total, avgRate, perfectCount, riskCount };
  }, [studentSummaries]);

  return (
    <div className="animate-page space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-extrabold uppercase tracking-tight text-foreground">
            Rekap Kehadiran per Siswa
          </h1>
          <p className="text-xs text-muted">
            Ranking dan rincian kehadiran setiap siswa
          </p>
        </div>
        {meetingDates.size > 0 && (
          <span className="badge border-accent/40 bg-accent/15 text-accent font-bold">
            {meetingDates.size} Hari Pertemuan
          </span>
        )}
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="label">Angkatan</label>
            <select
              value={selectedGen}
              onChange={(e) => {
                setSelectedGen(e.target.value as Gen | "semua");
                setSelectedKelas("");
              }}
              className="select min-w-[140px]"
            >
              <option value="semua">Semua Angkatan</option>
              {allGens.map((g) => (
                <option key={g} value={g}>Gen {g}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Kelas</label>
            <select
              value={selectedKelas}
              onChange={(e) => setSelectedKelas(e.target.value)}
              className="select min-w-[160px]"
            >
              <option value="">Semua Kelas</option>
              {kelasList.map((k) => (
                <option key={k} value={k}>{k}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Bulan</label>
            <select
              value={selectedBulan}
              onChange={(e) => setSelectedBulan(e.target.value)}
              className="select min-w-[140px]"
            >
              <option value="">Semua Bulan</option>
              {bulanList.map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Dari Tanggal</label>
            <input
              type="date"
              value={dateFrom ? `${dateFrom.split("/")[2]}-${dateFrom.split("/")[1]}-${dateFrom.split("/")[0]}` : ""}
              onChange={(e) => {
                const v = e.target.value;
                if (v) {
                  const [y, m, d] = v.split("-");
                  setDateFrom(`${d}/${m}/${y}`);
                } else {
                  setDateFrom("");
                }
              }}
              className="input min-w-[150px]"
            />
          </div>
          <div>
            <label className="label">Sampai Tanggal</label>
            <input
              type="date"
              value={dateTo ? `${dateTo.split("/")[2]}-${dateTo.split("/")[1]}-${dateTo.split("/")[0]}` : ""}
              onChange={(e) => {
                const v = e.target.value;
                if (v) {
                  const [y, m, d] = v.split("-");
                  setDateTo(`${d}/${m}/${y}`);
                } else {
                  setDateTo("");
                }
              }}
              className="input min-w-[150px]"
            />
          </div>
          <div>
            <label className="label">Urutkan</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              className="select min-w-[160px]"
            >
              <option value="rate">Tingkat Hadir (Tertinggi)</option>
              <option value="absen">Absen (Terbanyak)</option>
              <option value="hadir">Hadir (Terbanyak)</option>
              <option value="total">Total Pertemuan</option>
            </select>
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="label">Cari Nama</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Ketik nama siswa..."
                className="input pl-9"
              />
            </div>
          </div>
          {(selectedBulan || dateFrom || dateTo) && (
            <button
              onClick={() => { setSelectedBulan(""); setDateFrom(""); setDateTo(""); }}
              className="btn btn-ghost min-h-[40px] px-2 py-1.5 text-xs font-bold text-danger"
            >
              Reset Filter
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-accent" />
          <span className="ml-2 text-sm text-muted">Memuat data...</span>
        </div>
      ) : studentSummaries.length === 0 ? (
        <div className="card p-10 text-center">
          <p className="text-sm text-muted">Belum ada data untuk ditampilkan.</p>
        </div>
      ) : (
        <>
          {/* Quick summary cards */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl border-2 border-border bg-surface p-3.5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted">Total Siswa</p>
              <p className="mt-1 font-display text-lg font-extrabold tracking-tight text-foreground tabular-nums">
                {summary.total}
              </p>
            </div>
            <div className="rounded-xl border-2 border-border bg-surface p-3.5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted">Rata-rata Kehadiran</p>
              <p className="mt-1 font-display text-lg font-extrabold tracking-tight text-foreground tabular-nums">
                {summary.avgRate}%
              </p>
            </div>
            <div className="rounded-xl border-2 border-emerald-500/30 bg-emerald-500/5 p-3.5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-400">100% Hadir</p>
              <p className="mt-1 font-display text-lg font-extrabold tracking-tight text-emerald-600 dark:text-emerald-300 tabular-nums">
                {summary.perfectCount} Siswa
              </p>
            </div>
            <div className="rounded-xl border-2 border-danger/30 bg-danger/5 p-3.5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-danger">Risk (&lt;50%)</p>
              <p className="mt-1 font-display text-lg font-extrabold tracking-tight text-danger tabular-nums">
                {summary.riskCount} Siswa
              </p>
            </div>
          </div>

          {/* Student table */}
          <div className="card p-5">
            <div className="flex items-center justify-between border-b-2 border-border pb-3">
              <div>
                <h2 className="font-display text-sm font-bold uppercase tracking-wide text-foreground">
                  Ranking Siswa
                </h2>
                <p className="text-xs text-muted">
                  Klik nama untuk melihat rincian lengkap
                </p>
              </div>
              <span className="badge border-accent/40 bg-accent/15 text-accent font-bold">
                {studentSummaries.length} Siswa
              </span>
            </div>

            <div className="mt-3 overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th className="w-10">No</th>
                    <th>Nama Siswa</th>
                    <th>Kelas</th>
                    <th>Gen</th>
                    <th className="text-center">Hadir</th>
                    <th className="text-center">Sakit</th>
                    <th className="text-center">Izin</th>
                    <th className="text-center">Absen</th>
                    <th className="text-center">Tingkat Hadir</th>
                    <th className="text-right">Total Kas</th>
                  </tr>
                </thead>
                <tbody>
                  {studentSummaries.map((s, i) => (
                    <tr key={`${s.gen}-${s.nama}`}>
                      <td className="text-muted tabular-nums">{i + 1}</td>
                      <td>
                        <button
                          onClick={() => setStudentDetail(s.nama)}
                          className="flex items-center gap-2 font-medium uppercase text-foreground hover:text-accent hover:underline"
                        >
                          <User className="h-3.5 w-3.5 text-muted" />
                          {s.nama}
                        </button>
                      </td>
                      <td className="text-muted">{s.kelas}</td>
                      <td>
                        <span className={`badge font-bold text-[10px] ${getGenBadgeColor(s.gen)}`}>
                          Gen {s.gen}
                        </span>
                      </td>
                      <td className="text-center text-emerald-600 dark:text-emerald-300 font-semibold tabular-nums">{s.hadir}</td>
                      <td className="text-center text-amber-600 dark:text-amber-300 tabular-nums">{s.sakit}</td>
                      <td className="text-center text-accent tabular-nums">{s.izin}</td>
                      <td className="text-center text-danger tabular-nums">{s.absen}</td>
                      <td className="text-center">
                        <div className="flex items-center justify-center gap-2">
                          <div className="h-2 w-16 rounded-full bg-border">
                            <div
                              className={`h-full rounded-full ${
                                s.rate >= 80 ? "bg-emerald-500"
                                : s.rate >= 60 ? "bg-amber-400"
                                : "bg-danger"
                              }`}
                              style={{ width: `${s.rate}%` }}
                            />
                          </div>
                          <span className={`text-xs font-bold tabular-nums ${
                            s.rate >= 80 ? "text-emerald-600 dark:text-emerald-300"
                            : s.rate >= 60 ? "text-amber-600 dark:text-amber-300"
                            : "text-danger"
                          }`}>
                            {s.rate}%
                          </span>
                        </div>
                      </td>
                      <td className="text-right font-medium text-foreground tabular-nums">
                        {s.kas > 0 ? formatRupiah(s.kas) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Student detail modal */}
      {studentDetail && (
        <StudentDetailModal
          nama={studentDetail}
          records={allRecords}
          onClose={() => setStudentDetail(null)}
        />
      )}
    </div>
  );
}
