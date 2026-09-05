"use client";

import { useState } from "react";
import { X, Loader2 } from "lucide-react";
import type { Expense, ExpenseCategory } from "@/types/finance";
import { getTodayFormatted, getBulanTahunFromDate } from "@/lib/utils";

interface Props {
  open: boolean;
  expense?: Expense | null;
  categories: ExpenseCategory[];
  loading: boolean;
  onSubmit: (data: {
    deskripsi: string;
    nominal: number;
    category_id: string;
    tanggal: string;
    bulan_tahun: string;
  }) => Promise<void>;
  onClose: () => void;
}

interface InnerProps {
  expense?: Expense | null;
  categories: ExpenseCategory[];
  loading: boolean;
  onSubmit: Props["onSubmit"];
  onClose: () => void;
}

function ExpenseFormInner({
  expense,
  categories,
  loading,
  onSubmit,
  onClose,
}: InnerProps) {
  const [deskripsi, setDeskripsi] = useState(expense?.deskripsi || "");
  const [nominal, setNominal] = useState(expense?.nominal ? String(expense.nominal) : "");
  const [categoryId, setCategoryId] = useState(
    expense?.category_id || categories[0]?.id || ""
  );
  const [tanggal, setTanggal] = useState(expense?.tanggal || getTodayFormatted());
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deskripsi.trim() || !nominal || !categoryId || !tanggal) return;
    setSubmitting(true);
    await onSubmit({
      deskripsi: deskripsi.trim(),
      nominal: Number(nominal),
      category_id: categoryId,
      tanggal,
      bulan_tahun: getBulanTahunFromDate(tanggal),
    });
    setSubmitting(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="card w-full max-w-md p-6">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-sm font-bold uppercase text-foreground">
            {expense ? "Edit Pengeluaran" : "Tambah Pengeluaran"}
          </h3>
          <button onClick={onClose} className="rounded p-1 hover:bg-surface-2">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          <div>
            <label className="label">Tanggal</label>
            <input
              type="date"
              className="input"
              value={tanggal ? tanggal.split("/").reverse().join("-") : ""}
              onChange={(e) => {
                const d = new Date(e.target.value);
                if (!isNaN(d.getTime())) {
                  const dd = String(d.getDate()).padStart(2, "0");
                  const mm = String(d.getMonth() + 1).padStart(2, "0");
                  const yyyy = d.getFullYear();
                  setTanggal(`${dd}/${mm}/${yyyy}`);
                }
              }}
            />
          </div>

          <div>
            <label className="label">Kategori</label>
            <select
              className="select"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
            >
              <option value="">Pilih kategori</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nama}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label">Deskripsi</label>
            <input
              className="input"
              placeholder="Contoh: Beli printernya"
              value={deskripsi}
              onChange={(e) => setDeskripsi(e.target.value)}
            />
          </div>

          <div>
            <label className="label">Nominal (Rp)</label>
            <input
              type="number"
              className="input"
              placeholder="0"
              min={1}
              step={500}
              value={nominal}
              onChange={(e) => setNominal(e.target.value)}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="btn btn-outline min-h-[44px]"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={submitting || loading || !deskripsi.trim() || !nominal || !categoryId}
              className="btn btn-primary min-h-[44px]"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {expense ? "Simpan" : "Tambah"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function ExpenseFormModal({
  open,
  expense,
  categories,
  loading,
  onSubmit,
  onClose,
}: Props) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <ExpenseFormInner
        key={expense?.id || "new"}
        expense={expense}
        categories={categories}
        loading={loading}
        onSubmit={onSubmit}
        onClose={onClose}
      />
    </div>
  );
}
