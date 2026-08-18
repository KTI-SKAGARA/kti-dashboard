"use client";

import { memo } from "react";
import { Calendar } from "lucide-react";
import { formatRupiah, getTodayISO, getStatusBadgeClass } from "@/lib/utils";
import type { FilterState } from "@/types/attendance";

interface TodayBannerProps {
  dateLabel: string;
  total: number;
  hadir: number;
  sakit: number;
  izin: number;
  alfa: number;
  kas: number;
  filters: FilterState;
  onFilterToday: () => void;
}

const badges = [
  { label: "Total", key: "total" as const, cls: "bg-surface-2 text-foreground" },
  { label: "Hadir", key: "hadir" as const, cls: getStatusBadgeClass("Hadir") },
  { label: "Sakit", key: "sakit" as const, cls: getStatusBadgeClass("Sakit") },
  { label: "Izin", key: "izin" as const, cls: getStatusBadgeClass("Izin") },
  { label: "Alfa", key: "alfa" as const, cls: getStatusBadgeClass("Alfa") },
];

export default memo(function TodayBanner({
  dateLabel,
  total,
  hadir,
  sakit,
  izin,
  alfa,
  kas,
  filters,
  onFilterToday,
}: TodayBannerProps) {
  const alreadyFiltered =
    filters.tanggalFrom === getTodayISO() && filters.tanggalTo === getTodayISO();

  return (
    <div className="card mt-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-bold uppercase tracking-wide text-muted">
          Hari ini — {dateLabel}
        </p>
        {total > 0 && !alreadyFiltered && (
          <button
            onClick={onFilterToday}
            className="inline-flex items-center gap-1 text-[11px] font-bold text-accent hover:underline"
          >
            <Calendar className="h-3 w-3" />
            Filter Catatan Hari Ini
          </button>
        )}
      </div>
      {total === 0 ? (
        <p className="mt-2 text-xs text-muted">Belum ada catatan hari ini.</p>
      ) : (
        <div className="mt-2.5 flex flex-wrap gap-2">
          {badges.map((b) => (
            <span key={b.label} className={`badge ${b.cls} min-w-[48px] justify-center`}>
              {b.label} {b.key === "total" ? total : b.key === "hadir" ? hadir : b.key === "sakit" ? sakit : b.key === "izin" ? izin : alfa}
            </span>
          ))}
          {kas > 0 && (
            <span className="badge bg-accent/10 text-accent min-w-[48px] justify-center">
              Kas {formatRupiah(kas)}
            </span>
          )}
        </div>
      )}
    </div>
  );
});
