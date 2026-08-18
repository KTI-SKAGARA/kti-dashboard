"use client";

import { useState } from "react";
import { Pencil, Trash2, Loader2 } from "lucide-react";
import type { Expense } from "@/types/finance";
import { formatRupiah } from "@/lib/utils";

interface Props {
  expenses: Expense[];
  loading: boolean;
  onEdit: (expense: Expense) => void;
  onDelete: (id: string) => void;
}

export default function ExpenseTable({ expenses, loading, onEdit, onDelete }: Props) {
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (id: string) => {
    if (!confirm("Hapus pengeluaran ini?")) return;
    setDeletingId(id);
    await onDelete(id);
    setDeletingId(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="h-5 w-5 animate-spin text-accent" />
      </div>
    );
  }

  if (expenses.length === 0) {
    return (
      <p className="py-6 text-center text-xs text-muted">Belum ada pengeluaran.</p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="data-table">
        <thead>
          <tr>
            <th>Tanggal</th>
            <th>Kategori</th>
            <th>Deskripsi</th>
            <th className="text-right">Nominal</th>
            <th>Status</th>
            <th className="w-20">Aksi</th>
          </tr>
        </thead>
        <tbody>
          {expenses.map((e) => (
            <tr key={e.id}>
              <td className="text-xs">{e.tanggal}</td>
              <td>
                <span className="badge bg-surface-2 text-foreground text-[10px]">
                  {e.category_nama || "-"}
                </span>
              </td>
              <td className="max-w-[200px] truncate text-xs">{e.deskripsi}</td>
              <td className="text-right font-mono text-xs font-semibold text-red-600">
                {formatRupiah(e.nominal)}
              </td>
              <td>
                <span className={`badge text-[10px] ${
                  e.status === "disetujui"
                    ? "bg-emerald-100 text-emerald-700"
                    : e.status === "ditolak"
                    ? "bg-red-100 text-red-700"
                    : "bg-amber-100 text-amber-700"
                }`}>
                  {e.status}
                </span>
              </td>
              <td>
                <div className="flex gap-1">
                  <button
                    onClick={() => onEdit(e)}
                    className="rounded p-1 hover:bg-surface-2"
                    title="Edit"
                  >
                    <Pencil className="h-3.5 w-3.5 text-muted" />
                  </button>
                  <button
                    onClick={() => handleDelete(e.id)}
                    disabled={deletingId === e.id}
                    className="rounded p-1 hover:bg-red-50"
                    title="Hapus"
                  >
                    {deletingId === e.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-red-500" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5 text-red-500" />
                    )}
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
