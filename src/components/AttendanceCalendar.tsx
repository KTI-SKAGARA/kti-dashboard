"use client";

import { useState, useMemo } from "react";
import {
  type AttendanceRecord,
  type Gen,
} from "@/types/attendance";
import {
  formatRupiah,
  formatTanggalIndo,
  formatBulanTahun,
  getTodayFormatted,
  getGenBadgeColor,
} from "@/lib/utils";
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  ArrowRight,
} from "lucide-react";

type TaggedRecord = AttendanceRecord & { _gen: Gen; _rawIdx: number };

interface AttendanceCalendarProps {
  records: TaggedRecord[];
  selectedDate: string; // DD/MM/YYYY
  onSelectDate: (tanggal: string) => void;
  onOpenTableMode?: () => void;
}

const DAYS_OF_WEEK = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];

export default function AttendanceCalendar({
  records,
  selectedDate,
  onSelectDate,
  onOpenTableMode,
}: AttendanceCalendarProps) {
  // Calendar month state (default to current date or selected date's month)
  const [currentYear, setCurrentYear] = useState(() => {
    if (selectedDate) {
      const parts = selectedDate.split("/");
      if (parts.length === 3) return parseInt(parts[2], 10);
    }
    return new Date().getFullYear();
  });

  const [currentMonth, setCurrentMonth] = useState(() => {
    if (selectedDate) {
      const parts = selectedDate.split("/");
      if (parts.length === 3) return parseInt(parts[1], 10) - 1; // 0-indexed
    }
    return new Date().getMonth();
  });

  // Map of date string "DD/MM/YYYY" -> list of records on that date
  const dateMap = useMemo(() => {
    const map = new Map<string, TaggedRecord[]>();
    for (const r of records) {
      if (!r.tanggal) continue;
      const list = map.get(r.tanggal) || [];
      list.push(r);
      map.set(r.tanggal, list);
    }
    return map;
  }, [records]);

  // Meeting stats per date in the current month
  const monthMeetings = useMemo(() => {
    const mm = String(currentMonth + 1).padStart(2, "0");
    const yyyy = String(currentYear);
    const prefix = `-${mm}-${yyyy}`;

    const list: {
      tanggal: string;
      total: number;
      hadir: number;
      sakit: number;
      izin: number;
      alfa: number;
      kas: number;
      gens: Set<Gen>;
    }[] = [];

    for (const [tanggal, dayRecs] of dateMap.entries()) {
      if (tanggal.endsWith(prefix) || tanggal.includes(`/${mm}/${yyyy}`)) {
        const hadir = dayRecs.filter((r) => r.statusAbsen === "Hadir").length;
        const sakit = dayRecs.filter((r) => r.statusAbsen === "Sakit").length;
        const izin = dayRecs.filter((r) => r.statusAbsen === "Izin").length;
        const alfa = dayRecs.filter((r) => r.statusAbsen === "Alfa").length;
        const kas = dayRecs.reduce((sum, r) => sum + r.nominalKas, 0);
        const gens = new Set<Gen>(dayRecs.map((r) => r._gen));

        list.push({
          tanggal,
          total: dayRecs.length,
          hadir,
          sakit,
          izin,
          alfa,
          kas,
          gens,
        });
      }
    }

    return list.sort((a, b) => {
      const [ad] = a.tanggal.split("/").map(Number);
      const [bd] = b.tanggal.split("/").map(Number);
      return ad - bd;
    });
  }, [dateMap, currentMonth, currentYear]);

  // Days matrix for the calendar grid
  const calendarGrid = useMemo(() => {
    const firstDayIndex = new Date(currentYear, currentMonth, 1).getDay();
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const daysInPrevMonth = new Date(currentYear, currentMonth, 0).getDate();

    const cells: {
      dayNumber: number;
      isCurrentMonth: boolean;
      dateKey: string;
    }[] = [];

    // Leading days from previous month
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const day = daysInPrevMonth - i;
      const prevMonthNum = currentMonth === 0 ? 12 : currentMonth;
      const prevYearNum = currentMonth === 0 ? currentYear - 1 : currentYear;
      const dateKey = `${String(day).padStart(2, "0")}/${String(prevMonthNum).padStart(2, "0")}/${prevYearNum}`;
      cells.push({ dayNumber: day, isCurrentMonth: false, dateKey });
    }

    // Days in current month
    for (let day = 1; day <= daysInMonth; day++) {
      const dateKey = `${String(day).padStart(2, "0")}/${String(currentMonth + 1).padStart(2, "0")}/${currentYear}`;
      cells.push({ dayNumber: day, isCurrentMonth: true, dateKey });
    }

    // Trailing days from next month to fill grid (42 cells total for 6 rows)
    const remaining = 42 - cells.length;
    for (let day = 1; day <= remaining; day++) {
      const nextMonthNum = currentMonth === 11 ? 1 : currentMonth + 2;
      const nextYearNum = currentMonth === 11 ? currentYear + 1 : currentYear;
      const dateKey = `${String(day).padStart(2, "0")}/${String(nextMonthNum).padStart(2, "0")}/${nextYearNum}`;
      cells.push({ dayNumber: day, isCurrentMonth: false, dateKey });
    }

    return cells;
  }, [currentYear, currentMonth]);

  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  };

  const jumpToToday = () => {
    const now = new Date();
    setCurrentYear(now.getFullYear());
    setCurrentMonth(now.getMonth());
    onSelectDate(getTodayFormatted());
  };

  // Selected date's records and summary
  const selectedRecords = useMemo(() => {
    if (!selectedDate) return [];
    return dateMap.get(selectedDate) || [];
  }, [dateMap, selectedDate]);

  const selectedSummary = useMemo(() => {
    if (!selectedRecords.length) return null;
    const total = selectedRecords.length;
    const hadir = selectedRecords.filter((r) => r.statusAbsen === "Hadir").length;
    const sakit = selectedRecords.filter((r) => r.statusAbsen === "Sakit").length;
    const izin = selectedRecords.filter((r) => r.statusAbsen === "Izin").length;
    const alfa = selectedRecords.filter((r) => r.statusAbsen === "Alfa").length;
    const kas = selectedRecords.reduce((sum, r) => sum + r.nominalKas, 0);
    const gens = Array.from(new Set(selectedRecords.map((r) => r._gen)));
    const classes = Array.from(new Set(selectedRecords.map((r) => r.kelas))).sort();

    return { total, hadir, sakit, izin, alfa, kas, gens, classes };
  }, [selectedRecords]);

  const monthLabel = formatBulanTahun(
    `${String(currentMonth + 1).padStart(2, "0")}-${currentYear}`
  );

  const todayFormatted = getTodayFormatted();

  return (
    <div className="space-y-4">
      {/* Calendar Header & Controls */}
      <div className="card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-border pb-4">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border-2 border-accent/40 bg-accent/15 text-accent">
              <CalendarIcon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-accent">
                Kalender Pertemuan &amp; Presensi
              </p>
              <h2 className="font-display text-xl font-extrabold uppercase tracking-tight text-foreground">
                {monthLabel}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={jumpToToday}
              className="btn btn-ghost min-h-[38px] px-3 py-1.5 text-xs font-bold text-accent"
              title="Lompat ke hari ini"
            >
              Hari Ini
            </button>
            <button
              type="button"
              onClick={handlePrevMonth}
              className="btn btn-secondary min-h-[38px] min-w-[38px] p-2"
              aria-label="Bulan sebelumnya"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={handleNextMonth}
              className="btn btn-secondary min-h-[38px] min-w-[38px] p-2"
              aria-label="Bulan berikutnya"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Days of week header */}
        <div className="mt-4 grid grid-cols-7 gap-1 text-center text-xs font-bold uppercase tracking-wider text-muted">
          {DAYS_OF_WEEK.map((d, i) => (
            <div
              key={d}
              className={`py-1.5 ${i === 0 ? "text-danger" : i === 6 ? "text-accent" : ""}`}
            >
              {d}
            </div>
          ))}
        </div>

        {/* Calendar Grid */}
        <div className="mt-1 grid grid-cols-7 gap-1.5">
          {calendarGrid.map((cell, idx) => {
            const dayRecords = dateMap.get(cell.dateKey) || [];
            const hasMeeting = dayRecords.length > 0;
            const isSelected = selectedDate === cell.dateKey;
            const isToday = cell.dateKey === todayFormatted;
            const hadirCount = dayRecords.filter((r) => r.statusAbsen === "Hadir").length;

            return (
              <button
                key={`${cell.dateKey}-${idx}`}
                type="button"
                onClick={() => onSelectDate(cell.dateKey)}
                className={`relative flex min-h-[68px] flex-col justify-between rounded-xl border-2 p-1.5 text-left transition-all sm:min-h-[76px] sm:p-2 ${
                  isSelected
                    ? "border-accent bg-accent/20 ring-2 ring-accent text-foreground font-extrabold"
                    : hasMeeting
                    ? "border-accent/40 bg-surface hover:border-accent hover:bg-accent/5"
                    : cell.isCurrentMonth
                    ? "border-border/60 bg-surface/60 text-foreground hover:border-border hover:bg-surface"
                    : "border-transparent bg-transparent text-muted/40 opacity-40 hover:opacity-70"
                }`}
              >
                {/* Day header */}
                <div className="flex items-center justify-between">
                  <span
                    className={`text-xs font-display tabular-nums ${
                      isToday
                        ? "flex h-5 w-5 items-center justify-center rounded-full bg-accent font-bold text-white"
                        : isSelected
                        ? "font-extrabold text-accent"
                        : hasMeeting
                        ? "font-bold text-foreground"
                        : "text-muted"
                    }`}
                  >
                    {cell.dayNumber}
                  </span>

                  {hasMeeting && (
                    <span className="flex h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-surface" />
                  )}
                </div>

                {/* Meeting content badge */}
                {hasMeeting ? (
                  <div className="mt-1">
                    <span className="inline-block truncate rounded-md bg-emerald-500/15 px-1 py-0.5 text-[9px] font-bold text-emerald-700 dark:text-emerald-300 sm:text-[10px]">
                      {hadirCount} Hadir
                    </span>
                  </div>
                ) : (
                  <div className="h-4" />
                )}
              </button>
            );
          })}
        </div>

        {/* Legend */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t-2 border-border pt-3 text-xs text-muted">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5 font-medium">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
              Ada Pertemuan / Presensi
            </span>
            <span className="flex items-center gap-1.5 font-medium">
              <span className="h-2.5 w-2.5 rounded-full border-2 border-accent bg-accent/20" />
              Tanggal Terpilih
            </span>
          </div>

          <p className="text-[11px] font-semibold text-muted">
            Total {monthMeetings.length} pertemuan pada {monthLabel}
          </p>
        </div>
      </div>

      {/* Selected Date Inspector Card */}
      {selectedDate && (
        <div className="card p-5">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-border pb-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-accent">
                Detail Presensi Tanggal Terpilih
              </p>
              <h3 className="font-display text-lg font-extrabold uppercase text-foreground">
                {formatTanggalIndo(selectedDate)} ({selectedDate})
              </h3>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onSelectDate("")}
                className="btn btn-ghost min-h-[38px] px-3 py-1.5 text-xs font-bold"
              >
                Tutup Pilihan
              </button>
              {onOpenTableMode && (
                <button
                  type="button"
                  onClick={onOpenTableMode}
                  className="btn btn-primary min-h-[38px] px-3 py-1.5 text-xs font-bold"
                >
                  <ArrowRight className="h-3.5 w-3.5" />
                  Buka di Mode Tabel
                </button>
              )}
            </div>
          </div>

          {selectedSummary ? (
            <div className="mt-4 space-y-4">
              {/* Stat badges */}
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-5">
                <div className="rounded-xl border-2 border-border bg-surface-2 p-3 text-center">
                  <p className="text-[10px] font-bold uppercase text-muted">Total Siswa</p>
                  <p className="font-display text-lg font-extrabold text-foreground tabular-nums">
                    {selectedSummary.total}
                  </p>
                </div>
                <div className="rounded-xl border-2 border-emerald-500/30 bg-emerald-500/10 p-3 text-center">
                  <p className="text-[10px] font-bold uppercase text-emerald-700 dark:text-emerald-300">
                    Hadir
                  </p>
                  <p className="font-display text-lg font-extrabold text-emerald-600 dark:text-emerald-300 tabular-nums">
                    {selectedSummary.hadir}
                  </p>
                </div>
                <div className="rounded-xl border-2 border-amber-500/30 bg-amber-500/10 p-3 text-center">
                  <p className="text-[10px] font-bold uppercase text-amber-700 dark:text-amber-300">
                    Sakit
                  </p>
                  <p className="font-display text-lg font-extrabold text-amber-600 dark:text-amber-300 tabular-nums">
                    {selectedSummary.sakit}
                  </p>
                </div>
                <div className="rounded-xl border-2 border-accent/30 bg-accent/10 p-3 text-center">
                  <p className="text-[10px] font-bold uppercase text-accent">Izin</p>
                  <p className="font-display text-lg font-extrabold text-accent tabular-nums">
                    {selectedSummary.izin}
                  </p>
                </div>
                <div className="rounded-xl border-2 border-danger/30 bg-danger/10 p-3 text-center">
                  <p className="text-[10px] font-bold uppercase text-danger">Alfa</p>
                  <p className="font-display text-lg font-extrabold text-danger tabular-nums">
                    {selectedSummary.alfa}
                  </p>
                </div>
              </div>

              {/* Cash & Gen banner */}
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border-2 border-border bg-surface-2 p-3 text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-foreground">Total Kas Masuk:</span>
                  <span className="font-display text-base font-extrabold text-accent">
                    {formatRupiah(selectedSummary.kas)}
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-muted">Generasi:</span>
                  {selectedSummary.gens.map((g) => (
                    <span
                      key={g}
                      className={`badge font-bold ${getGenBadgeColor(g)} px-2 py-0.5`}
                    >
                      GEN {g}
                    </span>
                  ))}
                </div>
              </div>

              {/* Student list preview */}
              <div className="overflow-x-auto rounded-xl border-2 border-border">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th className="w-10">No</th>
                      <th>Nama Siswa</th>
                      <th>Kelas</th>
                      <th>Status</th>
                      <th className="text-right">Kas (Rp)</th>
                      <th>Gen</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedRecords.map((r, i) => (
                      <tr key={`${r._gen}-${r.nama}-${r._rawIdx}`}>
                        <td className="text-muted tabular-nums">{i + 1}</td>
                        <td className="font-medium uppercase text-foreground">
                          {r.nama}
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
                        <td className="text-right tabular-nums font-medium text-foreground">
                          {r.nominalKas > 0 ? formatRupiah(r.nominalKas) : "—"}
                        </td>
                        <td>
                          <span className={`badge font-bold ${getGenBadgeColor(r._gen)}`}>
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
            <div className="py-8 text-center text-xs text-muted">
              <CalendarIcon className="mx-auto h-7 w-7 text-muted" />
              <p className="mt-2 font-medium">
                Tidak ada data pertemuan / presensi pada tanggal{" "}
                <strong className="text-foreground">{selectedDate}</strong>.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
