"use client";

import { useMemo, useState, useEffect } from "react";
import { type Gen, type TaggedRecord, type StudentProfile } from "@/types/attendance";
import { getLiburDates } from "@/types/kegiatan";
import { getStudentProfiles } from "@/app/actions/student-profiles";
import { User } from "lucide-react";

interface Props {
  allRecords: TaggedRecord[];
  getGenBadgeColor: (gen: Gen) => string;
  onStudentDetail: (nama: string) => void;
}

interface StudentRow {
  nama: string;
  kelas: string;
  gen: Gen;
  hadir: number;
  absen: number;
  rate: number;
  dateStatus: Map<string, string>;
}

export default function IndividualStatsInline({
  allRecords,
  getGenBadgeColor,
  onStudentDetail,
}: Props) {
  const [sortBy, setSortBy] = useState<"nama" | "rate" | "absen">("nama");
  const [showCurrentClass, setShowCurrentClass] = useState(false);
  const [profiles, setProfiles] = useState<StudentProfile[]>([]);

  // Fetch student profiles for "kelas sekarang" toggle
  useEffect(() => {
    let cancelled = false;
    getStudentProfiles().then((res) => {
      if (!cancelled && res.success && res.data) {
        setProfiles(res.data);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Map: gen|nama -> kelas (current from profiles)
  const profileClassMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of profiles) {
      map.set(`${p.gen}|${p.nama}`, p.kelas);
    }
    return map;
  }, [profiles]);

  // Filter records (reuse dashboard's filtered records, exclude libur)
  const nonLiburRecords = useMemo(() => {
    const liburDates = getLiburDates([]);
    if (liburDates.size === 0) return allRecords;
    return allRecords.filter((r) => !liburDates.has(r.tanggal));
  }, [allRecords]);

  // Sorted unique dates
  const sortedDates = useMemo(() => {
    const dateSet = new Set<string>();
    for (const r of nonLiburRecords) dateSet.add(r.tanggal);
    return Array.from(dateSet).sort((a, b) => {
      const [ad, am, ay] = a.split("/").map(Number);
      const [bd, bm, by] = b.split("/").map(Number);
      if (ay !== by) return ay - by;
      if (am !== bm) return am - bm;
      return ad - bd;
    });
  }, [nonLiburRecords]);

  // Meeting dates for absen calculation
  const meetingDates = useMemo(() => {
    // Use all dates present in data as "meeting dates"
    return sortedDates;
  }, [sortedDates]);

  // Student summaries
  const studentSummaries = useMemo(() => {
    const map = new Map<string, StudentRow>();
    for (const r of nonLiburRecords) {
      const key = `${r._gen}|${r.nama}`;
      const cur = map.get(key) || {
        nama: r.nama,
        kelas: showCurrentClass
          ? profileClassMap.get(key) || r.kelas
          : r.kelas,
        gen: r._gen,
        hadir: 0,
        absen: 0,
        rate: 0,
        dateStatus: new Map<string, string>(),
      };
      cur.dateStatus.set(r.tanggal, r.statusAbsen);
      if (r.statusAbsen === "Hadir") cur.hadir += 1;
      map.set(key, cur);
    }

    // Compute absen
    for (const [, student] of map) {
      const totalDates = meetingDates.length;
      student.absen = totalDates - student.dateStatus.size;
      const total = student.hadir + student.absen;
      student.rate = total > 0 ? Math.round((student.hadir / total) * 1000) / 10 : 0;
    }

    const arr = Array.from(map.values());
    switch (sortBy) {
      case "nama":
        arr.sort((a, b) =>
          Number(a.gen) - Number(b.gen) ||
          a.kelas.localeCompare(b.kelas, "id") ||
          a.nama.localeCompare(b.nama, "id")
        );
        break;
      case "rate":
        arr.sort((a, b) => b.rate - a.rate || a.nama.localeCompare(b.nama, "id"));
        break;
      case "absen":
        arr.sort((a, b) => b.absen - a.absen || a.rate - b.rate || a.nama.localeCompare(b.nama, "id"));
        break;
    }
    return arr;
  }, [nonLiburRecords, sortBy, meetingDates, showCurrentClass, profileClassMap]);

  return (
    <div className="card p-5">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-border pb-3">
        <div>
          <h2 className="font-display text-sm font-bold uppercase tracking-wide text-foreground">
            Rekap Kehadiran per Siswa
          </h2>
          <p className="text-xs text-muted">
            {studentSummaries.length} siswa • {meetingDates.length} hari pertemuan
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted">
            {showCurrentClass ? "Kelas Sekarang" : "Kelas Saat Presensi"}
          </span>
          <button
            onClick={() => setShowCurrentClass(!showCurrentClass)}
            className={`relative h-6 w-11 rounded-full border-2 transition-colors ${
              showCurrentClass ? "border-accent bg-accent" : "border-border bg-surface-2"
            }`}
            title="Toggle kelas sekarang vs kelas saat presensi"
          >
            <span
              className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${
                showCurrentClass ? "left-[22px]" : "left-0.5"
              }`}
            />
          </button>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            className="select min-w-[140px]"
          >
            <option value="nama">Urut: Nama</option>
            <option value="rate">Urut: Hadir Tertinggi</option>
            <option value="absen">Urut: Absen Terbanyak</option>
          </select>
        </div>
      </div>

      <div className="mt-3 overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 bg-surface w-10">No</th>
              <th className="sticky left-10 z-10 bg-surface">Nama</th>
              <th className="sticky left-[120px] z-10 bg-surface">Kelas</th>
              <th className="sticky left-[200px] z-10 bg-surface">Gen</th>
              {sortedDates.map((d) => (
                <th key={d} className="text-center min-w-[70px]">
                  <span className="block text-[10px] font-bold text-muted">{d}</span>
                </th>
              ))}
              <th className="text-center">Hadir</th>
              <th className="text-center">Absen</th>
              <th className="text-center">Rate</th>
            </tr>
          </thead>
          <tbody>
            {studentSummaries.map((s, i) => (
              <tr key={`${s.gen}-${s.nama}`}>
                <td className="sticky left-0 z-10 bg-surface text-muted tabular-nums">{i + 1}</td>
                <td className="sticky left-10 z-10 bg-surface">
                  <button
                    onClick={() => onStudentDetail(s.nama)}
                    title={s.nama}
                    className="flex items-center gap-1.5 font-medium uppercase text-foreground hover:text-accent hover:underline"
                  >
                    <User className="h-3 w-3 text-muted" />
                    <span className="max-w-[100px] truncate">{s.nama}</span>
                  </button>
                </td>
                <td className="sticky left-[120px] z-10 bg-surface text-muted text-xs">{s.kelas}</td>
                <td className="sticky left-[200px] z-10 bg-surface">
                  <span className={`badge font-bold text-[10px] ${getGenBadgeColor(s.gen)}`}>
                    {s.gen}
                  </span>
                </td>
                {sortedDates.map((d) => {
                  const status = s.dateStatus.get(d);
                  const colors: Record<string, string> = {
                    Hadir: "bg-emerald-500 text-white",
                    Sakit: "bg-amber-400 text-white",
                    Izin: "bg-accent text-white",
                    Alfa: "bg-danger text-white",
                  };
                  return (
                    <td key={d} className="text-center">
                      {status ? (
                        <span className={`inline-block h-6 min-w-[28px] rounded text-[10px] font-bold leading-6 ${colors[status] || "bg-border text-muted"}`}>
                          {status === "Hadir" ? "H" : status === "Sakit" ? "S" : status === "Izin" ? "I" : "A"}
                        </span>
                      ) : (
                        <span className="inline-block h-6 min-w-[28px] rounded bg-border/30 text-[10px] leading-6 text-muted">—</span>
                      )}
                    </td>
                  );
                })}
                <td className="text-center text-emerald-600 dark:text-emerald-300 font-semibold tabular-nums">{s.hadir}</td>
                <td className="text-center text-danger tabular-nums">{s.absen}</td>
                <td className="text-center">
                  <span className={`text-xs font-bold tabular-nums ${
                    s.rate >= 80 ? "text-emerald-600 dark:text-emerald-300"
                    : s.rate >= 60 ? "text-amber-600 dark:text-amber-300"
                    : "text-danger"
                  }`}>
                    {s.rate}%
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-border pt-3">
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted">Keterangan:</span>
        <span className="flex items-center gap-1 text-xs"><span className="inline-block h-3 w-3 rounded bg-emerald-500" /> H = Hadir</span>
        <span className="flex items-center gap-1 text-xs"><span className="inline-block h-3 w-3 rounded bg-amber-400" /> S = Sakit</span>
        <span className="flex items-center gap-1 text-xs"><span className="inline-block h-3 w-3 rounded bg-accent" /> I = Izin</span>
        <span className="flex items-center gap-1 text-xs"><span className="inline-block h-3 w-3 rounded bg-danger" /> A = Alfa</span>
        <span className="flex items-center gap-1 text-xs"><span className="inline-block h-3 w-3 rounded bg-border/30" /> — = Tidak ada data</span>
      </div>
    </div>
  );
}
