"use client";

import { useMemo, memo } from "react";
import { type FilterOptions, type FilterState, type Gen } from "@/types/attendance";
import {
  formatBulanTahun,
  formatTanggalIndo,
  parseISOTanggal,
} from "@/lib/utils";
import { SKAGARA_CLASSES } from "@/types/attendance";
import { Search, FilterX, RefreshCw, Download, Calendar } from "lucide-react";

interface FilterBarProps {
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
  filterOptions: FilterOptions;
  activeGens: Gen[];
  hasActiveFilter: boolean;
  recordsTotal: number;
  onReload: () => void;
  onExport: () => void;
}

export default memo(function FilterBar({
  filters,
  onFiltersChange,
  filterOptions,
  activeGens,
  hasActiveFilter,
  recordsTotal,
  onReload,
  onExport,
}: FilterBarProps) {
  const setFilters = (updater: (prev: FilterState) => FilterState) => {
    onFiltersChange(updater(filters));
  };

  const mergedClasses = useMemo(
    () =>
      Array.from(new Set([...SKAGARA_CLASSES, ...filterOptions.kelasList])).sort(
        (a, b) => a.localeCompare(b, "id")
      ),
    [filterOptions.kelasList]
  );

  return (
    <div className="card mt-5 p-4 sm:p-5">
      {/* Gen filter */}
      <div className="flex flex-wrap items-center gap-1.5">
        <button
          onClick={() => setFilters((f) => ({ ...f, gen: "semua" }))}
          className={`chip min-h-[44px] ${filters.gen === "semua" ? "chip-on" : ""}`}
        >
          Semua Gen
        </button>
        {activeGens.map((g) => (
          <button
            key={g}
            onClick={() => setFilters((f) => ({ ...f, gen: g }))}
            className={`chip min-h-[44px] ${filters.gen === g ? "chip-on" : ""}`}
          >
            Gen {g}
          </button>
        ))}
      </div>

      {/* Secondary filters */}
      <div className="mt-3.5 flex flex-wrap items-center justify-between gap-2 border-t-2 border-border pt-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {([
            { id: "" as const, label: "Semua Status" },
            { id: "Hadir" as const, label: "Hadir" },
            { id: "Sakit" as const, label: "Sakit" },
            { id: "Izin" as const, label: "Izin" },
            { id: "Alfa" as const, label: "Alfa" },
          ]).map((st) => (
            <button
              key={st.id}
              onClick={() => setFilters((prev) => ({ ...prev, status: st.id }))}
              className={`chip min-h-[44px] ${filters.status === st.id ? "chip-on" : ""}`}
            >
              {st.label}
            </button>
          ))}

          {/* Filter Tanggal (Range Dari - Sampai) */}
          <div className="flex items-center gap-1.5">
            <input
              type="date"
              aria-label="Dari tanggal"
              title="Dari tanggal"
              value={filters.tanggalFrom}
              onChange={(e) =>
                setFilters((f) => ({ ...f, tanggalFrom: e.target.value }))
              }
              className="input min-h-[44px] w-auto text-sm"
            />
            <span className="text-xs font-bold text-muted">s/d</span>
            <input
              type="date"
              aria-label="Sampai tanggal"
              title="Sampai tanggal"
              value={filters.tanggalTo}
              onChange={(e) =>
                setFilters((f) => ({ ...f, tanggalTo: e.target.value }))
              }
              className="input min-h-[44px] w-auto text-sm"
            />
          </div>

          {/* Filter Bulan Dropdown */}
          <select
            className="select min-h-[44px] w-auto py-2 text-sm"
            value={filters.bulan}
            onChange={(e) => setFilters((f) => ({ ...f, bulan: e.target.value }))}
          >
            <option value="">Semua Bulan</option>
            {filterOptions.bulanList.map((b) => (
              <option key={b} value={b}>
                {formatBulanTahun(b)}
              </option>
            ))}
          </select>

          {/* Filter Kelas Dropdown */}
          <select
            className="select min-h-[44px] w-auto py-2 text-sm"
            value={filters.kelas}
            onChange={(e) => setFilters((f) => ({ ...f, kelas: e.target.value }))}
          >
            <option value="">Semua Kelas</option>
            {mergedClasses.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <div className="flex items-center gap-2 rounded-[0.375rem] border border-border bg-surface px-2.5 py-1.5 transition-colors focus-within:border-accent focus-within:shadow-[0_0_0_3px_color-mix(in_srgb,var(--color-accent)_12%,transparent)] min-h-[44px] w-44 sm:w-auto">
              <Search className="h-4 w-4 shrink-0 text-muted" />
              <input
                type="text"
                placeholder="Cari nama..."
                className="flex-1 min-w-0 bg-transparent text-sm text-foreground outline-none placeholder:text-muted"
                value={filters.search}
                onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
              />
            </div>
          </div>
          {hasActiveFilter && (
            <button
              onClick={() =>
                onFiltersChange({
                  gen: filters.gen,
                  kelas: "",
                  bulan: "",
                  tanggalFrom: "",
                  tanggalTo: "",
                  status: "",
                  search: "",
                })
              }
              className="btn btn-ghost min-h-[44px] min-w-[44px] px-2 py-2"
              title="Hapus semua filter"
            >
              <FilterX className="h-4 w-4" />
            </button>
          )}
          <button
            onClick={onReload}
            className="btn btn-ghost min-h-[44px] min-w-[44px] px-2 py-2"
            title="Muat ulang data"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
          <button
            onClick={onExport}
            disabled={recordsTotal === 0}
            className="btn btn-primary min-h-[44px] px-3 py-2 text-sm"
          >
            <Download className="h-4 w-4" />
            Export
          </button>
        </div>
      </div>

      {/* Active Filter Badges */}
      {(filters.tanggalFrom || filters.tanggalTo) && (
        <div className="mt-3 flex items-center gap-2 rounded-lg border border-accent/30 bg-accent/5 px-3 py-2 text-xs">
          <Calendar className="h-4 w-4 text-accent" />
          <span className="font-semibold text-foreground">
            Menampilkan data rentang tanggal:{" "}
            <strong>
              {filters.tanggalFrom
                ? `${formatTanggalIndo(parseISOTanggal(filters.tanggalFrom))} (${parseISOTanggal(filters.tanggalFrom)})`
                : "Awal"}
            </strong>{" "}
            s/d{" "}
            <strong>
              {filters.tanggalTo
                ? `${formatTanggalIndo(parseISOTanggal(filters.tanggalTo))} (${parseISOTanggal(filters.tanggalTo)})`
                : "Sekarang"}
            </strong>
          </span>
          <button
            onClick={() =>
              setFilters((f) => ({ ...f, tanggalFrom: "", tanggalTo: "" }))
            }
            className="ml-auto text-xs font-bold text-accent hover:underline"
          >
            Reset Tanggal
          </button>
        </div>
      )}
    </div>
  );
});
