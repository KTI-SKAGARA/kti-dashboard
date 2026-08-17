"use client";

import { type FilterOptions, type FilterState, type Gen } from "@/types/attendance";
import {
  formatBulanTahun,
  formatTanggalIndo,
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

export default function FilterBar({
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

          {/* Filter Tanggal Dropdown */}
          <div className="relative">
            <select
              className={`select min-h-[44px] w-auto py-2 text-sm font-medium ${
                filters.tanggal ? "!border-accent !bg-accent/10 !text-accent font-bold" : ""
              }`}
              value={filters.tanggal}
              onChange={(e) => setFilters((f) => ({ ...f, tanggal: e.target.value }))}
            >
              <option value="">📅 Semua Tanggal</option>
              {filterOptions.tanggalList.map((t) => (
                <option key={t} value={t}>
                  {formatTanggalIndo(t, true)} ({t})
                </option>
              ))}
            </select>
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
            {Array.from(new Set([...SKAGARA_CLASSES, ...filterOptions.kelasList]))
              .sort((a, b) => a.localeCompare(b, "id"))
              .map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input
              type="text"
              placeholder="Cari nama..."
              className="input min-h-[44px] w-44 pl-9 pr-3 text-sm sm:w-auto"
              value={filters.search}
              onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
            />
          </div>
          {hasActiveFilter && (
            <button
              onClick={() =>
                onFiltersChange({
                  gen: filters.gen,
                  kelas: "",
                  bulan: "",
                  tanggal: "",
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
      {filters.tanggal && (
        <div className="mt-3 flex items-center gap-2 rounded-lg border border-accent/30 bg-accent/5 px-3 py-2 text-xs">
          <Calendar className="h-4 w-4 text-accent" />
          <span className="font-semibold text-foreground">
            Menampilkan data tanggal: <strong>{formatTanggalIndo(filters.tanggal)}</strong> ({filters.tanggal})
          </span>
          <button
            onClick={() => setFilters((f) => ({ ...f, tanggal: "" }))}
            className="ml-auto text-xs font-bold text-accent hover:underline"
          >
            Reset Tanggal
          </button>
        </div>
      )}
    </div>
  );
}
