"use client";

import { memo } from "react";
import { type Gen, type TaggedRecord } from "@/types/attendance";
import { formatRupiah, getStatusBadgeClass } from "@/lib/utils";
import { PAGE_SIZE } from "@/lib/constants";
import {
  Loader2,
  Users,
  CheckSquare,
  Square,
  Pencil,
  Trash2,
  ArrowRightLeft,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

interface AttendanceTableProps {
  records: TaggedRecord[]; // records halaman aktif (dari server)
  total: number; // total records setelah filter (dari server)
  loading: boolean;
  page: number;
  onPageChange: (page: number) => void;
  hasActiveFilter: boolean;
  selectedKeys: Set<string>;
  allSelected: boolean;
  onToggleSelectAll: () => void;
  onToggleSelect: (key: string) => void;
  onClearSelection: () => void;
  onBulkDelete: () => void;
  onBulkMove: () => void;
  onEdit: (record: TaggedRecord) => void;
  onDelete: (record: TaggedRecord) => void;
  onStudentDetail: (nama: string) => void;
  onFilterTanggal: (tanggal: string) => void;
  getGenBadgeColor: (gen: Gen) => string;
}

export default memo(function AttendanceTable({
  records,
  total,
  loading,
  page,
  onPageChange,
  hasActiveFilter,
  selectedKeys,
  allSelected,
  onToggleSelectAll,
  onToggleSelect,
  onClearSelection,
  onBulkDelete,
  onBulkMove,
  onEdit,
  onDelete,
  onStudentDetail,
  onFilterTanggal,
  getGenBadgeColor,
}: AttendanceTableProps) {
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="card mt-4 overflow-hidden">
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-5 w-5 animate-spin text-accent" />
          <span className="ml-2 text-sm font-medium text-muted">Memuat data...</span>
        </div>
      ) : records.length === 0 ? (
        <div className="py-16 text-center">
          <Users className="mx-auto h-8 w-8 text-muted" />
          <p className="mt-2 text-sm font-medium text-muted">
            {hasActiveFilter
              ? "Tidak ada data yang cocok dengan filter yang dipilih."
              : "Belum ada data."}
          </p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th className="w-10">
                    <button
                      onClick={onToggleSelectAll}
                      className="btn btn-ghost min-h-[44px] min-w-[44px] p-2"
                      title={allSelected ? "Batalkan semua" : "Pilih semua"}
                    >
                      {allSelected ? (
                        <CheckSquare className="h-4 w-4 text-accent" />
                      ) : (
                        <Square className="h-4 w-4" />
                      )}
                    </button>
                  </th>
                  <th className="w-10">No</th>
                  <th>Tanggal</th>
                  <th>Nama</th>
                  <th>Kelas</th>
                  <th>Status</th>
                  <th className="text-right">Kas</th>
                  <th>Gen</th>
                  <th className="w-24"></th>
                </tr>
              </thead>
              <tbody>
                {records.map((r, i) => (
                  <tr key={`${r._gen}-${r.tanggal}-${r.nama}-${r._rowId}`}>
                    <td>
                      <button
                        onClick={() => onToggleSelect(`${r._gen}|${r._rowId}`)}
                        className="btn btn-ghost min-h-[44px] min-w-[44px] p-2"
                        title="Pilih"
                      >
                        {selectedKeys.has(`${r._gen}|${r._rowId}`) ? (
                          <CheckSquare className="h-4 w-4 text-accent" />
                        ) : (
                          <Square className="h-4 w-4" />
                        )}
                      </button>
                    </td>
                    <td className="text-muted tabular-nums">
                      {(page - 1) * PAGE_SIZE + i + 1}
                    </td>
                    <td className="whitespace-nowrap font-medium text-foreground">
                      <button
                        onClick={() => onFilterTanggal(r.tanggal)}
                        className="hover:text-accent hover:underline"
                        title={`Filter hanya tanggal ${r.tanggal}`}
                      >
                        {r.tanggal}
                      </button>
                    </td>
                    <td>
                      <button
                        onClick={() => onStudentDetail(r.nama)}
                        className="font-medium uppercase text-foreground underline decoration-accent/40 decoration-dashed underline-offset-2 hover:text-accent hover:decoration-accent"
                      >
                        {r.nama}
                      </button>
                    </td>
                    <td className="text-muted">{r.kelas}</td>
                    <td>
                      <span className={`badge ${getStatusBadgeClass(r.statusAbsen)}`}>
                        {r.statusAbsen}
                      </span>
                    </td>
                    <td className="text-right tabular-nums">
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
                    <td className="whitespace-nowrap text-right">
                      <div className="inline-flex items-center gap-0.5">
                        <button
                          onClick={() => onEdit(r)}
                          className="btn btn-ghost min-h-[44px] min-w-[44px] p-2 text-muted hover:!text-accent"
                          title="Edit data & ubah Gen"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => onDelete(r)}
                          className="btn btn-ghost min-h-[44px] min-w-[44px] p-2 text-muted hover:!text-danger"
                          title="Hapus"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Bulk action bar */}
          {selectedKeys.size > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t-2 border-border bg-accent/5 px-4 py-3">
              <p className="text-xs font-bold uppercase tracking-wide text-foreground">
                {selectedKeys.size} catatan dipilih
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={onClearSelection}
                  className="btn btn-ghost min-h-[44px] px-3 py-2 text-sm"
                >
                  Batal
                </button>
                <button
                  onClick={onBulkMove}
                  className="btn btn-secondary min-h-[44px] px-3 py-2 text-sm font-bold"
                  title="Pindahkan semua catatan yang dipilih ke Gen lain"
                >
                  <ArrowRightLeft className="h-4 w-4 text-accent" />
                  Pindah Gen ({selectedKeys.size})
                </button>
                <button
                  onClick={onBulkDelete}
                  className="btn btn-danger min-h-[44px] px-3 py-2 text-sm"
                >
                  <Trash2 className="h-4 w-4" />
                  Hapus Terpilih
                </button>
              </div>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <>
              <div className="flex items-center justify-between gap-2 border-t-2 border-border px-4 py-3">
                <p className="text-xs font-medium text-muted">
                  Menampilkan{" "}
                  <span className="font-bold text-foreground tabular-nums">
                    {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)}
                  </span>{" "}
                  dari{" "}
                  <span className="font-bold text-foreground tabular-nums">{total}</span>{" "}
                  data
                </p>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => onPageChange(Math.max(1, page - 1))}
                    disabled={page <= 1}
                    className="btn btn-ghost min-h-[44px] min-w-[44px] p-2"
                    aria-label="Halaman sebelumnya"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <span className="px-2 text-sm font-bold text-foreground tabular-nums">
                    {page} / {totalPages}
                  </span>
                  <button
                    onClick={() => onPageChange(Math.min(totalPages, page + 1))}
                    disabled={page >= totalPages}
                    className="btn btn-ghost min-h-[44px] min-w-[44px] p-2"
                    aria-label="Halaman berikutnya"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
});
