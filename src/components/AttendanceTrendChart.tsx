"use client";

import { useMemo, useState } from "react";
import type { AttendanceRecord } from "@/types/attendance";
import { formatBulanTahun, formatTanggalIndo, formatRupiah } from "@/lib/utils";
import { BarChart2 } from "lucide-react";

interface AttendanceTrendChartProps {
  records: AttendanceRecord[];
  initialMonth?: string;
}

interface TrendItem {
  id: string;
  label: string;
  fullLabel: string;
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

  const activeMonth = useMemo(() => {
    if (selectedMonth && availableMonths.includes(selectedMonth)) {
      return selectedMonth;
    }
    if (initialMonth && availableMonths.includes(initialMonth)) {
      return initialMonth;
    }
    return availableMonths[availableMonths.length - 1] || "";
  }, [selectedMonth, initialMonth, availableMonths]);

  // Per-date aggregated data for the active month
  const chartData = useMemo<TrendItem[]>(() => {
    if (!activeMonth) return [];

    const monthRecords = records.filter((r) => r.bulanTahun === activeMonth);
    const map = new Map<
      string,
      { total: number; hadir: number; sakit: number; izin: number; alfa: number; kas: number }
    >();

    for (const r of monthRecords) {
      if (!r.tanggal) continue;
      const cur = map.get(r.tanggal) || {
        total: 0, hadir: 0, sakit: 0, izin: 0, alfa: 0, kas: 0,
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

  if (records.length === 0 || (activeMonth && chartData.length === 0)) {
    return (
      <div className="rounded-xl border-2 border-dashed border-border py-8 text-center">
        <BarChart2 className="mx-auto h-8 w-8 text-muted" />
        <p className="mt-2 text-xs font-medium text-muted">Belum ada data riwayat kehadiran.</p>
      </div>
    );
  }

  // Chart dimensions
  const chartW = Math.max(420, chartData.length * 80);
  const chartH = 220;
  const padL = 44;
  const padR = 20;
  const padT = 30;
  const padB = 40;
  const innerW = chartW - padL - padR;
  const innerH = chartH - padT - padB;
  const gap = chartData.length > 0 ? innerW / chartData.length : innerW;
  const barW = Math.min(36, Math.max(20, gap * 0.5));

  const barH = (pct: number) => (pct / 100) * innerH;

  const linePoints = chartData
    .map((d, i) => {
      const x = padL + gap * i + gap / 2;
      const y = padT + innerH - (d.rate / 100) * innerH;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <div className="space-y-4">
      {/* Month selector */}
      {availableMonths.length > 0 && (
        <div className="flex items-center gap-2 border-b border-border pb-3">
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
          <span className="ml-auto text-[10px] font-bold text-muted">
            {chartData.length} Hari Pertemuan
          </span>
        </div>
      )}

      {/* Chart */}
      {chartData.length === 0 ? (
        <div className="py-8 text-center text-xs text-muted">
          Tidak ada data pertemuan untuk bulan {formatBulanTahun(activeMonth)}.
        </div>
      ) : (
        <div className="relative overflow-x-auto rounded-xl border border-border bg-surface/50 p-3">
          <svg
            viewBox={`0 0 ${chartW} ${chartH}`}
            className="w-full"
            style={{ minWidth: chartData.length > 5 ? 420 : 300 }}
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
                    x={padL - 8}
                    y={y + 3.5}
                    textAnchor="end"
                    className="fill-muted"
                    fontSize={10}
                    fontWeight={600}
                  >
                    {pct}%
                  </text>
                </g>
              );
            })}

            {/* Bars: % Hadir per pertemuan */}
            {chartData.map((d, i) => {
              const x = padL + gap * i + gap / 2 - barW / 2;
              const h = barH(d.rate);
              const isHovered = hoveredItem?.id === d.id;

              // Color based on rate
              let barColor = "fill-emerald-500";
              if (d.rate < 60) barColor = "fill-danger";
              else if (d.rate < 80) barColor = "fill-amber-400";

              return (
                <g
                  key={d.id}
                  className="cursor-pointer"
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
                    className={`${barColor} transition-opacity ${isHovered ? "opacity-100" : "opacity-60 hover:opacity-80"}`}
                  />
                  {/* Rate label above bar */}
                  <text
                    x={x + barW / 2}
                    y={padT + innerH - h - 6}
                    textAnchor="middle"
                    className="fill-foreground text-[10px] font-extrabold tabular-nums"
                  >
                    {d.rate}%
                  </text>
                </g>
              );
            })}

            {/* Trend line */}
            {chartData.length > 1 && (
              <polyline
                points={linePoints}
                fill="none"
                className="stroke-accent"
                strokeWidth={2.5}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}

            {/* Dots on trend line */}
            {chartData.map((d, i) => {
              const x = padL + gap * i + gap / 2;
              const y = padT + innerH - (d.rate / 100) * innerH;
              const isHovered = hoveredItem?.id === d.id;
              return (
                <circle
                  key={`dot-${d.id}`}
                  cx={x}
                  cy={y}
                  r={isHovered ? 5 : 3.5}
                  className={`fill-surface stroke-2 transition-all ${
                    isHovered ? "stroke-accent" : "stroke-accent/60"
                  }`}
                />
              );
            })}

            {/* X-axis labels */}
            {chartData.map((d, i) => {
              const x = padL + gap * i + gap / 2;
              return (
                <text
                  key={`lbl-${d.id}`}
                  x={x}
                  y={chartH - 14}
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

      {/* Legend */}
      <div className="flex items-center justify-center gap-4 text-[10px] font-bold uppercase tracking-wide text-muted">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-4 rounded-sm bg-emerald-500 opacity-60" />
          Hadir
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-4 rounded-sm bg-amber-400 opacity-60" />
          Kurang (60-79%)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-4 rounded-sm bg-danger opacity-60" />
          Rendah (&lt;60%)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-4 rounded bg-accent" />
          Trend
        </span>
      </div>

      {/* Tooltip card */}
      {hoveredItem ? (
        <div className="rounded-xl border-2 border-accent/40 bg-accent/5 p-3.5 transition-all">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-2">
            <span className="text-xs font-extrabold uppercase tracking-wide text-foreground">
              {hoveredItem.fullLabel}
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
          Arahkan kursor atau klik pada bar diagram di atas untuk melihat detail per pertemuan.
        </p>
      )}
    </div>
  );
}
