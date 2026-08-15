"use client";

import { useMemo, useState } from "react";
import type { AttendanceRecord } from "@/types/attendance";
import { formatBulanTahun, formatTanggalIndo, formatRupiah } from "@/lib/utils";
import { Calendar, TrendingUp, BarChart2 } from "lucide-react";

interface AttendanceTrendChartProps {
  records: AttendanceRecord[];
  initialMonth?: string;
}

interface TrendItem {
  id: string; // Bulan (MM-YYYY) or Tanggal (DD/MM/YYYY)
  label: string; // Short label for X axis
  fullLabel: string; // Full label for tooltip
  total: number;
  hadir: number;
  sakit: number;
  izin: number;
  alfa: number;
  kas: number;
  rate: number;
}

export default function AttendanceTrendChart({
  records,
  initialMonth,
}: AttendanceTrendChartProps) {
  const [chartPeriod, setChartPeriod] = useState<"monthly" | "weekly">("weekly");
  const [selectedMonth, setSelectedMonth] = useState<string>("");
  const [hoveredItem, setHoveredItem] = useState<TrendItem | null>(null);

  // Available months from records
  const availableMonths = useMemo(() => {
    const set = new Set<string>();
    for (const r of records) {
      if (r.bulanTahun) set.add(r.bulanTahun);
    }
    return Array.from(set).sort((a, b) => {
      const [am, ay] = a.split("-").map(Number);
      const [bm, by] = b.split("-").map(Number);
      return ay !== by ? ay - by : am - bm;
    });
  }, [records]);

  // Derive active month purely without cascading useEffect
  const activeMonth = useMemo(() => {
    if (selectedMonth && availableMonths.includes(selectedMonth)) {
      return selectedMonth;
    }
    if (initialMonth && availableMonths.includes(initialMonth)) {
      return initialMonth;
    }
    return availableMonths[availableMonths.length - 1] || "";
  }, [selectedMonth, initialMonth, availableMonths]);

  // Monthly aggregated data (All time)
  const monthlyData = useMemo<TrendItem[]>(() => {
    const map = new Map<
      string,
      { total: number; hadir: number; sakit: number; izin: number; alfa: number; kas: number }
    >();

    for (const r of records) {
      if (!r.bulanTahun) continue;
      const cur = map.get(r.bulanTahun) || {
        total: 0,
        hadir: 0,
        sakit: 0,
        izin: 0,
        alfa: 0,
        kas: 0,
      };
      cur.total += 1;
      if (r.statusAbsen === "Hadir") cur.hadir += 1;
      else if (r.statusAbsen === "Sakit") cur.sakit += 1;
      else if (r.statusAbsen === "Izin") cur.izin += 1;
      else if (r.statusAbsen === "Alfa") cur.alfa += 1;
      cur.kas += r.nominalKas;
      map.set(r.bulanTahun, cur);
    }

    return Array.from(map.entries())
      .map(([bulan, s]) => {
        const [m] = bulan.split("-");
        const monthNames = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
        const shortMonth = monthNames[parseInt(m, 10) - 1] || bulan;
        return {
          id: bulan,
          label: shortMonth,
          fullLabel: formatBulanTahun(bulan),
          ...s,
          rate: s.total > 0 ? Math.round((s.hadir / s.total) * 1000) / 10 : 0,
        };
      })
      .sort((a, b) => {
        const [am, ay] = a.id.split("-").map(Number);
        const [bm, by] = b.id.split("-").map(Number);
        return ay !== by ? ay - by : am - bm;
      });
  }, [records]);

  // Weekly / Per-Meeting aggregated data for the active month
  const weeklyData = useMemo<TrendItem[]>(() => {
    if (!activeMonth) return [];

    const monthRecords = records.filter((r) => r.bulanTahun === activeMonth);
    const map = new Map<
      string,
      { total: number; hadir: number; sakit: number; izin: number; alfa: number; kas: number }
    >();

    for (const r of monthRecords) {
      if (!r.tanggal) continue;
      const cur = map.get(r.tanggal) || {
        total: 0,
        hadir: 0,
        sakit: 0,
        izin: 0,
        alfa: 0,
        kas: 0,
      };
      cur.total += 1;
      if (r.statusAbsen === "Hadir") cur.hadir += 1;
      else if (r.statusAbsen === "Sakit") cur.sakit += 1;
      else if (r.statusAbsen === "Izin") cur.izin += 1;
      else if (r.statusAbsen === "Alfa") cur.alfa += 1;
      cur.kas += r.nominalKas;
      map.set(r.tanggal, cur);
    }

    return Array.from(map.entries())
      .map(([tanggal, s], idx) => {
        const [d, m] = tanggal.split("/");
        return {
          id: tanggal,
          label: `${d}/${m}`,
          fullLabel: `Pertemuan ${idx + 1} (${formatTanggalIndo(tanggal)})`,
          ...s,
          rate: s.total > 0 ? Math.round((s.hadir / s.total) * 1000) / 10 : 0,
        };
      })
      .sort((a, b) => {
        const [ad, am, ay] = a.id.split("/").map(Number);
        const [bd, bm, by] = b.id.split("/").map(Number);
        if (ay !== by) return ay - by;
        if (am !== bm) return am - bm;
        return ad - bd;
      });
  }, [records, activeMonth]);

  const activeData = chartPeriod === "weekly" ? weeklyData : monthlyData;

  if (records.length === 0 || (chartPeriod === "weekly" && weeklyData.length === 0 && availableMonths.length === 0)) {
    return (
      <div className="rounded-xl border-2 border-dashed border-border py-8 text-center">
        <BarChart2 className="mx-auto h-8 w-8 text-muted" />
        <p className="mt-2 text-xs font-medium text-muted">Belum ada data riwayat kehadiran.</p>
      </div>
    );
  }

  // Chart dimensions & scaling
  const maxTotal = Math.max(...activeData.map((d) => d.total), 1);
  const chartW = Math.max(480, activeData.length * 70);
  const chartH = 200;
  const padL = 40;
  const padR = 24;
  const padT = 24;
  const padB = 40;
  const innerW = chartW - padL - padR;
  const innerH = chartH - padT - padB;
  const gap = activeData.length > 0 ? innerW / activeData.length : innerW;
  const barW = Math.min(32, Math.max(16, gap * 0.45));

  const barH = (val: number) => (val / maxTotal) * innerH;

  const linePoints = activeData
    .map((d, i) => {
      const x = padL + gap * i + gap / 2;
      const y = padT + innerH - (d.rate / 100) * innerH;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <div className="space-y-4">
      {/* Period & Month Controls */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-border pb-3">
        <div className="inline-flex items-center gap-1 rounded-xl border-2 border-border bg-surface-2 p-1">
          <button
            type="button"
            onClick={() => setChartPeriod("weekly")}
            className={`chip min-h-[36px] text-xs font-bold ${
              chartPeriod === "weekly" ? "chip-on" : ""
            }`}
          >
            <Calendar className="h-3.5 w-3.5" />
            Mingguan (Per Pertemuan)
          </button>
          <button
            type="button"
            onClick={() => setChartPeriod("monthly")}
            className={`chip min-h-[36px] text-xs font-bold ${
              chartPeriod === "monthly" ? "chip-on" : ""
            }`}
          >
            <TrendingUp className="h-3.5 w-3.5" />
            Semua Bulan
          </button>
        </div>

        {chartPeriod === "weekly" && availableMonths.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-muted">Bulan:</span>
            <select
              className="select min-h-[38px] py-1 text-xs font-bold"
              value={activeMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
            >
              {availableMonths.map((m) => (
                <option key={m} value={m}>
                  {formatBulanTahun(m)}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Chart SVG */}
      {activeData.length === 0 ? (
        <div className="py-8 text-center text-xs text-muted">
          Tidak ada data pertemuan untuk bulan {formatBulanTahun(activeMonth)}.
        </div>
      ) : (
        <div className="relative overflow-x-auto rounded-xl border border-border bg-surface/50 p-2">
          <svg
            viewBox={`0 0 ${chartW} ${chartH}`}
            className="w-full"
            style={{ minWidth: activeData.length > 5 ? 420 : 300 }}
          >
            {/* Grid lines & Y-axis labels */}
            {[0, 25, 50, 75, 100].map((pct) => {
              const y = padT + innerH - (pct / 100) * innerH;
              return (
                <g key={pct}>
                  <line
                    x1={padL}
                    y1={y}
                    x2={chartW - padR}
                    y2={y}
                    className="stroke-border"
                    strokeWidth={0.8}
                    strokeDasharray={pct === 0 ? undefined : "3,3"}
                  />
                  <text
                    x={padL - 6}
                    y={y + 3}
                    textAnchor="end"
                    className="fill-muted"
                    fontSize={9}
                    fontWeight={600}
                  >
                    {pct}%
                  </text>
                </g>
              );
            })}

            {/* Bars: Total Siswa */}
            {activeData.map((d, i) => {
              const x = padL + gap * i + gap / 2 - barW / 2;
              const h = barH(d.total);
              const isHovered = hoveredItem?.id === d.id;
              return (
                <g
                  key={d.id}
                  className="cursor-pointer transition-all"
                  onMouseEnter={() => setHoveredItem(d)}
                  onMouseLeave={() => setHoveredItem(null)}
                  onClick={() => setHoveredItem(d)}
                >
                  <rect
                    x={x}
                    y={padT + innerH - h}
                    width={barW}
                    height={Math.max(h, 4)}
                    rx={4}
                    className={`transition-colors ${
                      isHovered
                        ? "fill-accent opacity-80"
                        : "fill-accent opacity-25 hover:opacity-50"
                    }`}
                  />
                  {/* Bar Value (Total Records) */}
                  <text
                    x={x + barW / 2}
                    y={padT + innerH - h - 5}
                    textAnchor="middle"
                    className="fill-muted text-[9px] font-bold tabular-nums"
                  >
                    {d.total}
                  </text>
                </g>
              );
            })}

            {/* Line: % Kehadiran */}
            {activeData.length > 1 && (
              <polyline
                points={linePoints}
                fill="none"
                className="stroke-accent"
                strokeWidth={3}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}

            {/* Dots on line */}
            {activeData.map((d, i) => {
              const x = padL + gap * i + gap / 2;
              const y = padT + innerH - (d.rate / 100) * innerH;
              const isHovered = hoveredItem?.id === d.id;
              return (
                <g
                  key={`dot-${d.id}`}
                  className="cursor-pointer"
                  onMouseEnter={() => setHoveredItem(d)}
                  onMouseLeave={() => setHoveredItem(null)}
                  onClick={() => setHoveredItem(d)}
                >
                  <circle
                    cx={x}
                    cy={y}
                    r={isHovered ? 6 : 4}
                    className={`stroke-surface transition-all ${
                      isHovered ? "fill-emerald-400 stroke-2" : "fill-accent stroke-2"
                    }`}
                  />
                  {/* Percentage label above dot */}
                  <text
                    x={x}
                    y={y - 8}
                    textAnchor="middle"
                    className="fill-foreground text-[10px] font-extrabold tabular-nums"
                  >
                    {d.rate}%
                  </text>
                </g>
              );
            })}

            {/* X-axis labels */}
            {activeData.map((d, i) => {
              const x = padL + gap * i + gap / 2;
              return (
                <text
                  key={`lbl-${d.id}`}
                  x={x}
                  y={chartH - 12}
                  textAnchor="middle"
                  className="fill-foreground text-[10px] font-bold"
                >
                  {d.label}
                </text>
              );
            })}
          </svg>
        </div>
      )}

      {/* Selected/Hovered Breakdown Card */}
      {hoveredItem ? (
        <div className="rounded-xl border-2 border-accent/40 bg-accent/5 p-3.5 transition-all">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-2">
            <span className="text-xs font-extrabold uppercase tracking-wide text-foreground">
              📍 {hoveredItem.fullLabel}
            </span>
            <span className="badge bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 font-extrabold text-xs">
              Kehadiran: {hoveredItem.rate}%
            </span>
          </div>
          <div className="mt-2.5 grid grid-cols-3 gap-2 text-center sm:grid-cols-6 text-xs">
            <div className="rounded-lg bg-surface p-2 border border-border">
              <p className="text-[10px] text-muted">Total</p>
              <p className="font-bold text-foreground tabular-nums">{hoveredItem.total}</p>
            </div>
            <div className="rounded-lg bg-surface p-2 border border-border">
              <p className="text-[10px] text-emerald-600 dark:text-emerald-300">Hadir</p>
              <p className="font-bold text-emerald-600 dark:text-emerald-300 tabular-nums">{hoveredItem.hadir}</p>
            </div>
            <div className="rounded-lg bg-surface p-2 border border-border">
              <p className="text-[10px] text-amber-600 dark:text-amber-300">Sakit</p>
              <p className="font-bold text-amber-600 dark:text-amber-300 tabular-nums">{hoveredItem.sakit}</p>
            </div>
            <div className="rounded-lg bg-surface p-2 border border-border">
              <p className="text-[10px] text-accent">Izin</p>
              <p className="font-bold text-accent tabular-nums">{hoveredItem.izin}</p>
            </div>
            <div className="rounded-lg bg-surface p-2 border border-border">
              <p className="text-[10px] text-danger">Alfa</p>
              <p className="font-bold text-danger tabular-nums">{hoveredItem.alfa}</p>
            </div>
            <div className="rounded-lg bg-surface p-2 border border-border">
              <p className="text-[10px] text-accent">Kas</p>
              <p className="font-bold text-foreground tabular-nums">{formatRupiah(hoveredItem.kas)}</p>
            </div>
          </div>
        </div>
      ) : (
        <p className="text-center text-[11px] text-muted">
          💡 Arahkan kursor atau klik pada bar/titik diagram di atas untuk melihat detail lengkap per pertemuan.
        </p>
      )}
    </div>
  );
}
