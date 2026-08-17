"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
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
import {
  formatRupiah,
  getGenBadgeColor,
} from "@/lib/utils";
import { Loader2, ChevronDown, ChevronRight } from "lucide-react";
import StatCard from "@/components/StatCard";
import ProgressBarRow from "@/components/ProgressBarRow";
import AttendanceTrendChart from "@/components/AttendanceTrendChart";

type TaggedRecord = AttendanceRecord & { _gen: Gen; _rawIdx: number };

export default function StatsPage() {
  const [genList, setGenList] = useState<GenConfig[]>([]);
  const [selectedGen, setSelectedGen] = useState<Gen>("semua");
  const [selectedKelas, setSelectedKelas] = useState("");
  const [selectedBulan, setSelectedBulan] = useState(""); // MM-YYYY
  const [dateFrom, setDateFrom] = useState(""); // DD/MM/YYYY
  const [dateTo, setDateTo] = useState(""); // DD/MM/YYYY
  const [allRecords, setAllRecords] = useState<TaggedRecord[]>([]);
  const [lulusRecords, setLulusRecords] = useState<TaggedRecord[]>([]);
  const [showLulus, setShowLulus] = useState(false);
  const [loading, setLoading] = useState(true);
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

  const loadLulusRecords = useCallback(async () => {
    const lulusGens = genList.filter((g) => g.status === "lulus").map((g) => g.gen);
    if (lulusGens.length === 0) { setLulusRecords([]); return; }
    const results = await Promise.all(lulusGens.map((g) => getAttendanceRecords(g)));
    const tagged: TaggedRecord[] = [];
    for (const res of results) {
      if (res.success && res.data) {
        const gen = lulusGens[results.indexOf(res)];
        res.data.forEach((r, i) => tagged.push({ ...r, _gen: gen, _rawIdx: i }));
      }
    }
    setLulusRecords(tagged);
  }, [genList]);

  useEffect(() => { loadGenList(); }, [loadGenList]);
  useEffect(() => { if (allGens.length > 0) loadRecords(); }, [loadRecords, allGens]);
  useEffect(() => { if (genList.length > 0) loadLulusRecords(); }, [genList, loadLulusRecords]);

  const kelasList = useMemo(() => {
    const set = new Set(allRecords.map((r) => r.kelas));
    return Array.from(set).sort((a, b) => a.localeCompare(b, "id"));
  }, [allRecords]);

  const bulanList = useMemo(() => {
    const set = new Set(allRecords.map((r) => r.bulanTahun));
    return Array.from(set).sort().reverse(); // newest first
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
    return result;
  }, [allRecords, selectedKelas, selectedBulan, dateFrom, dateTo]);

  // Quick stats with auto-absen computation
  const quickStats = useMemo(() => {
    // Group records by student (name + gen)
    const studentRecords = new Map<string, { records: TaggedRecord[]; kelas: string }>();
    const uniqueStudents = new Set<string>();
    for (const r of filteredRecords) {
      const key = `${r._gen}|${r.nama}`;
      uniqueStudents.add(key);
      const cur = studentRecords.get(key) || { records: [], kelas: r.kelas };
      cur.records.push(r);
      studentRecords.set(key, cur);
    }

    const meetingCount = meetingDates.size;
    let totalHadir = 0;
    let totalSakit = 0;
    let totalIzin = 0;
    let totalAlfa = 0;
    let totalAbsen = 0;
    let totalKas = 0;

    for (const [, { records: studentRecs }] of studentRecords) {
      // Dates this student has records for
      const attendedDates = new Set(studentRecs.map((r) => r.tanggal));

      for (const r of studentRecs) {
        if (r.statusAbsen === "Hadir") totalHadir++;
        else if (r.statusAbsen === "Sakit") totalSakit++;
        else if (r.statusAbsen === "Izin") totalIzin++;
        else if (r.statusAbsen === "Alfa") totalAlfa++;
        totalKas += r.nominalKas;
      }

      // Absen = meeting dates not covered by any record
      for (const md of meetingDates) {
        if (!attendedDates.has(md)) {
          totalAbsen++;
        }
      }
    }

    const total = totalHadir + totalSakit + totalIzin + totalAbsen;
    const rate = total > 0 ? Math.round((totalHadir / total) * 1000) / 10 : 0;
    return { siswa: uniqueStudents.size, total, hadir: totalHadir, sakit: totalSakit, izin: totalIzin, alfa: totalAlfa, absen: totalAbsen, kas: totalKas, rate };
  }, [filteredRecords, meetingDates]);

  // Per-class summaries with auto-absen
  const classSummaries = useMemo(() => {
    const meetingCount = meetingDates.size;
    const classData = new Map<string, {
      hadir: number; sakit: number; izin: number; alfa: number; absen: number; kas: number;
      students: Map<string, Set<string>>; // student key -> set of attended dates
      uniqueStudents: Set<string>;
    }>();

    for (const r of filteredRecords) {
      const cur = classData.get(r.kelas) || {
        hadir: 0, sakit: 0, izin: 0, alfa: 0, absen: 0, kas: 0,
        students: new Map(), uniqueStudents: new Set(),
      };
      if (r.statusAbsen === "Hadir") cur.hadir++;
      else if (r.statusAbsen === "Sakit") cur.sakit++;
      else if (r.statusAbsen === "Izin") cur.izin++;
      else if (r.statusAbsen === "Alfa") cur.alfa++;
      cur.kas += r.nominalKas;
      const studentKey = `${r._gen}|${r.nama}`;
      cur.uniqueStudents.add(studentKey);
      const studentDates = cur.students.get(studentKey) || new Set();
      studentDates.add(r.tanggal);
      cur.students.set(studentKey, studentDates);
      classData.set(r.kelas, cur);
    }

    // Compute absen per class
    for (const [, data] of classData) {
      for (const [, attendedDates] of data.students) {
        for (const md of meetingDates) {
          if (!attendedDates.has(md)) data.absen++;
        }
      }
      data.students.clear(); // free memory
    }

    return Array.from(classData.entries())
      .map(([kelas, s]) => {
        const totalAbsensi = s.hadir + s.sakit + s.izin + s.absen;
        const siswaCount = s.uniqueStudents.size;
        const expectedTotal = siswaCount * meetingCount;
        return {
          kelas,
          siswa: siswaCount,
          pertemuan: meetingCount,
          hadir: s.hadir,
          sakit: s.sakit,
          izin: s.izin,
          alfa: s.alfa,
          absen: s.absen,
          kas: s.kas,
          total: totalAbsensi,
          rate: expectedTotal > 0
            ? Math.round(((s.hadir + s.sakit + s.izin) / expectedTotal) * 1000) / 10
            : 0,
        };
      })
      .sort((a, b) => a.kelas.localeCompare(b.kelas, "id"));
  }, [filteredRecords, meetingDates]);

  // Per-gen summaries
  const genSummaries = useMemo(() => {
    if (selectedGen !== "semua") return [];
    const map = new Map<Gen, { total: number; hadir: number; sakit: number; izin: number; alfa: number; absen: number; kas: number; students: Set<string> }>();
    for (const r of filteredRecords) {
      const cur = map.get(r._gen) || { total: 0, hadir: 0, sakit: 0, izin: 0, alfa: 0, absen: 0, kas: 0, students: new Set() };
      cur.total += 1;
      cur.students.add(`${r._gen}|${r.nama}`);
      if (r.statusAbsen === "Hadir") cur.hadir += 1;
      else if (r.statusAbsen === "Sakit") cur.sakit += 1;
      else if (r.statusAbsen === "Izin") cur.izin += 1;
      else if (r.statusAbsen === "Alfa") cur.alfa += 1;
      cur.kas += r.nominalKas;
      map.set(r._gen, cur);
    }
    const meetingCount = meetingDates.size;
    return Array.from(map.entries())
      .map(([gen, s]) => {
        const siswaCount = s.students.size;
        const expectedTotal = siswaCount * meetingCount;
        return {
          gen,
          siswa: siswaCount,
          hadir: s.hadir,
          sakit: s.sakit,
          izin: s.izin,
          alfa: s.alfa,
          absen: s.absen,
          kas: s.kas,
          total: s.total,
          rate: expectedTotal > 0
            ? Math.round(((s.hadir + s.sakit + s.izin) / expectedTotal) * 1000) / 10
            : 0,
          isLulus: genList.find((g) => g.gen === gen)?.status === "lulus",
        };
      })
      .sort((a, b) => Number(a.gen) - Number(b.gen));
  }, [filteredRecords, selectedGen, genList, meetingDates]);

  const activityLevel = (rate: number) => {
    if (rate >= 90) return { label: "Sangat Aktif", color: "bg-emerald-500" };
    if (rate >= 75) return { label: "Aktif", color: "bg-emerald-400" };
    if (rate >= 50) return { label: "Kurang Aktif", color: "bg-amber-400" };
    return { label: "Tidak Aktif", color: "bg-danger" };
  };

  // Lulus gens financial summary
  const lulusFinSummary = useMemo(() => {
    const map = new Map<Gen, { kas: number; count: number; kelas: Set<string> }>();
    for (const r of lulusRecords) {
      const cur = map.get(r._gen) || { kas: 0, count: 0, kelas: new Set() };
      cur.kas += r.nominalKas;
      cur.count++;
      cur.kelas.add(r.kelas);
      map.set(r._gen, cur);
    }
    return Array.from(map.entries())
      .map(([gen, s]) => ({
        gen,
        kas: s.kas,
        count: s.count,
        kelasCount: s.kelas.size,
      }))
      .sort((a, b) => Number(a.gen) - Number(b.gen));
  }, [lulusRecords]);

  const lulusTotalKas = useMemo(() => lulusFinSummary.reduce((sum, s) => sum + s.kas, 0), [lulusFinSummary]);

  return (
    <div className="animate-page space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-extrabold uppercase tracking-tight text-foreground">
            Statistik Kelompok
          </h1>
          <p className="text-xs text-muted">
            Rekap kehadiran per kelas, per angkatan, dan trend mingguan/bulanan
          </p>
        </div>
        <div className="flex items-center gap-2">
          {meetingDates.size > 0 && (
            <span className="badge border-accent/40 bg-accent/15 text-accent font-bold">
              {meetingDates.size} Hari Pertemuan
            </span>
          )}
        </div>
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
      ) : filteredRecords.length === 0 ? (
        <div className="card p-10 text-center">
          <p className="text-sm text-muted">Belum ada data untuk ditampilkan.</p>
        </div>
      ) : (
        <>
          {/* Quick summary */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <StatCard label="Siswa" value={quickStats.siswa} />
            <StatCard label="Total Catatan" value={quickStats.total} />
            <StatCard label="Total Hadir" value={quickStats.hadir} />
            <StatCard label="Tingkat Hadir" value={`${quickStats.rate}%`} />
            <StatCard label="Total Kas" value={formatRupiah(quickStats.kas)} />
          </div>

          {/* Distribution + Activity */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="card p-5">
              <h2 className="font-display text-sm font-bold uppercase tracking-wide text-foreground">
                Distribusi Kehadiran
              </h2>
              <div className="mt-4 space-y-3">
                <ProgressBarRow label="Hadir" count={quickStats.hadir} total={quickStats.total} fillClass="bg-emerald-500" />
                <ProgressBarRow label="Absen" count={quickStats.absen} total={quickStats.total} fillClass="bg-danger" />
                <ProgressBarRow label="Sakit" count={quickStats.sakit} total={quickStats.total} fillClass="bg-amber-400" />
                <ProgressBarRow label="Izin" count={quickStats.izin} total={quickStats.total} fillClass="bg-accent" />
              </div>
            </div>

            <div className="card p-5">
              <h2 className="font-display text-sm font-bold uppercase tracking-wide text-foreground">
                Tingkat Keaktifan
              </h2>
              <div className="mt-4 space-y-3">
                {classSummaries.length === 0 ? (
                  <p className="py-4 text-center text-xs text-muted">Belum ada data kelas.</p>
                ) : (
                  classSummaries.map((cs) => {
                    const al = activityLevel(cs.rate);
                    return (
                      <div key={cs.kelas} className="flex items-center gap-3">
                        <span className="w-24 truncate text-xs font-bold text-foreground">{cs.kelas}</span>
                        <div className="h-2.5 flex-1 rounded-full bg-border">
                          <div className={`h-full rounded-full ${al.color}`} style={{ width: `${cs.rate}%` }} />
                        </div>
                        <span className="w-20 text-right text-xs font-bold tabular-nums text-foreground">{cs.rate}%</span>
                        <span className="hidden w-24 text-right text-[10px] font-bold uppercase text-muted sm:inline">{al.label}</span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* Per-class table */}
          <div className="card p-5">
            <h2 className="font-display text-sm font-bold uppercase tracking-wide text-foreground">
              Rekap per Kelas
            </h2>
            <p className="mt-1 text-[11px] text-muted">
              Tingkat kehadiran dihitung dari total hadir+sakit+izin dibanding jumlah siswa × hari pertemuan
            </p>
            <div className="mt-3 overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Kelas</th>
                    <th className="text-center">Siswa</th>
                    <th className="text-center">Hadir</th>
                    <th className="text-center">Absen</th>
                    <th className="text-center">Sakit</th>
                    <th className="text-center">Izin</th>
                    <th className="text-center">Tingkat Hadir</th>
                    <th className="text-right">Total Kas</th>
                  </tr>
                </thead>
                <tbody>
                  {classSummaries.map((cs) => (
                    <tr key={cs.kelas}>
                      <td className="font-medium text-foreground">{cs.kelas}</td>
                      <td className="text-center tabular-nums">{cs.siswa}</td>
                      <td className="text-center font-semibold text-emerald-600 dark:text-emerald-300 tabular-nums">{cs.hadir}</td>
                      <td className="text-center text-danger tabular-nums">{cs.absen}</td>
                      <td className="text-center text-amber-600 dark:text-amber-300 tabular-nums">{cs.sakit}</td>
                      <td className="text-center text-accent tabular-nums">{cs.izin}</td>
                      <td className="text-center">
                        <span className={`badge text-[10px] ${
                          cs.rate >= 80 ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300"
                          : cs.rate >= 60 ? "bg-amber-500/15 text-amber-600 dark:text-amber-300"
                          : "bg-danger/15 text-danger"
                        }`}>
                          {cs.rate}%
                        </span>
                      </td>
                      <td className="text-right font-medium text-foreground tabular-nums">{formatRupiah(cs.kas)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Per-gen table */}
          {genSummaries.length > 0 && (
            <div className="card p-5">
              <h2 className="font-display text-sm font-bold uppercase tracking-wide text-foreground">
                Rekap per Angkatan
              </h2>
              <div className="mt-3 overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Angkatan</th>
                      <th>Status</th>
                      <th className="text-center">Siswa</th>
                      <th className="text-center">Hadir</th>
                      <th className="text-center">Absen</th>
                      <th className="text-center">Sakit</th>
                      <th className="text-center">Izin</th>
                      <th className="text-center">Tingkat Hadir</th>
                      <th className="text-right">Total Kas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {genSummaries.map((gs) => (
                      <tr key={gs.gen} className={gs.isLulus ? "opacity-60" : ""}>
                        <td className="font-medium text-foreground">
                          <span className={`badge font-bold ${getGenBadgeColor(gs.gen)}`}>
                            Gen {gs.gen}
                          </span>
                        </td>
                        <td>
                          {gs.isLulus ? (
                            <span className="badge border-amber-400/40 bg-amber-400/15 text-amber-600 dark:text-amber-300">Lulus</span>
                          ) : (
                            <span className="badge border-emerald-500/40 bg-emerald-500/15 text-emerald-600 dark:text-emerald-300">Aktif</span>
                          )}
                        </td>
                        <td className="text-center tabular-nums">{gs.siswa}</td>
                        <td className="text-center font-semibold text-emerald-600 dark:text-emerald-300 tabular-nums">{gs.hadir}</td>
                        <td className="text-center text-danger tabular-nums">{gs.absen}</td>
                        <td className="text-center text-amber-600 dark:text-amber-300 tabular-nums">{gs.sakit}</td>
                        <td className="text-center text-accent tabular-nums">{gs.izin}</td>
                        <td className="text-center">
                          <span className={`badge text-[10px] ${
                            gs.rate >= 80 ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300"
                            : gs.rate >= 60 ? "bg-amber-500/15 text-amber-600 dark:text-amber-300"
                            : "bg-danger/15 text-danger"
                          }`}>
                            {gs.rate}%
                          </span>
                        </td>
                        <td className="text-right font-medium text-foreground tabular-nums">{formatRupiah(gs.kas)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Trend chart */}
          <div className="card p-5">
            <h2 className="font-display text-sm font-bold uppercase tracking-wide text-foreground">
              Trend Kehadiran per Bulan
            </h2>
            <div className="mt-4">
              <AttendanceTrendChart records={allRecords} />
            </div>
          </div>

          {/* Lulus gens financial data */}
          {lulusFinSummary.length > 0 && (
            <div className="card border-amber-400/30 bg-amber-400/5 p-5">
              <button
                onClick={() => setShowLulus(!showLulus)}
                className="flex w-full items-center gap-2 text-left"
              >
                {showLulus ? (
                  <ChevronDown className="h-4 w-4 text-amber-600" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-amber-600" />
                )}
                <h2 className="font-display text-sm font-bold uppercase tracking-wide text-amber-700 dark:text-amber-300">
                  Data Keuangan Angkatan Lulus
                </h2>
                <span className="ml-auto badge border-amber-400/40 bg-amber-400/15 text-amber-600 dark:text-amber-300 text-[10px] font-bold">
                  {formatRupiah(lulusTotalKas)}
                </span>
              </button>
              <p className="mt-1.5 pl-6 text-[11px] text-amber-600/70 dark:text-amber-300/60 italic">
                Data keuangan dari angkatan yang sudah lulus. Hadir/Sakit/Izin dihitung berdasarkan kalender kegiatan saat masih aktif.
              </p>
              {showLulus && (
                <div className="mt-3 overflow-x-auto">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Angkatan</th>
                        <th className="text-center">Kelas</th>
                        <th className="text-center">Total Catatan</th>
                        <th className="text-right">Total Kas</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lulusFinSummary.map((s) => (
                        <tr key={s.gen} className="opacity-70">
                          <td className="font-medium text-foreground">
                            <span className={`badge font-bold ${getGenBadgeColor(s.gen)}`}>
                              Gen {s.gen}
                            </span>
                          </td>
                          <td className="text-center tabular-nums">{s.kelasCount}</td>
                          <td className="text-center tabular-nums">{s.count}</td>
                          <td className="text-right font-medium text-foreground tabular-nums">{formatRupiah(s.kas)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="font-bold border-t-2 border-border">
                        <td colSpan={3} className="text-right text-foreground">Total</td>
                        <td className="text-right text-foreground tabular-nums">{formatRupiah(lulusTotalKas)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
