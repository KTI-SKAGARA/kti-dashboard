"use client";

import { useState } from "react";
import { Plus, Trash2, Loader2 } from "lucide-react";
import type { Budget, ExpenseCategory } from "@/types/finance";
import { formatRupiah } from "@/lib/utils";

interface Props {
  budgets: Budget[];
  categories: ExpenseCategory[];
  bulanTahun?: string;
  expensesByCategory: { category: string; total: number }[];
  loading: boolean;
  onAdd: (categoryId: string, target: number) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

export default function BudgetView({
  budgets,
  categories,
  expensesByCategory,
  loading,
  onAdd,
  onDelete,
}: Props) {
  const [addCatId, setAddCatId] = useState("");
  const [addTarget, setAddTarget] = useState("");
  const [adding, setAdding] = useState(false);

  const selectedCatId = addCatId || (categories.length > 0 ? categories[0].id : "");

  const handleAdd = async () => {
    if (!selectedCatId || !addTarget) return;
    setAdding(true);
    await onAdd(selectedCatId, Number(addTarget));
    setAddTarget("");
    setAdding(false);
  };

  const expenseMap = new Map(expensesByCategory.map((e) => [e.category, e.total]));

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="h-5 w-5 animate-spin text-accent" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Add budget */}
      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-surface-2 p-4">
        <div className="flex-1 min-w-[150px]">
          <label className="label">Kategori</label>
          <select
            className="select"
            value={selectedCatId}
            onChange={(e) => setAddCatId(e.target.value)}
          >
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.nama}</option>
            ))}
          </select>
        </div>
        <div className="min-w-[140px]">
          <label className="label">Target (Rp)</label>
          <input
            type="number"
            className="input"
            placeholder="0"
            min={0}
            step={10000}
            value={addTarget}
            onChange={(e) => setAddTarget(e.target.value)}
          />
        </div>
        <button
          onClick={handleAdd}
          disabled={adding || !addCatId || !addTarget}
          className="btn btn-primary min-h-[44px]"
        >
          {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          <span>Set Budget</span>
        </button>
      </div>

      {/* Budget list */}
      {budgets.length === 0 ? (
        <p className="py-6 text-center text-xs text-muted">
          Belum ada budget untuk bulan ini.
        </p>
      ) : (
        <div className="space-y-2">
          {budgets.map((b) => {
            const spent = expenseMap.get(b.category_nama || "") || 0;
            const pct = b.target_nominal > 0 ? Math.min((spent / b.target_nominal) * 100, 100) : 0;
            const over = spent > b.target_nominal;

            return (
              <div key={b.id} className="card p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="badge bg-surface-2 text-foreground text-[10px]">
                      {b.category_nama}
                    </span>
                    {b.catatan && (
                      <span className="ml-2 text-[10px] text-muted">{b.catatan}</span>
                    )}
                  </div>
                  <button
                    onClick={() => onDelete(b.id)}
                    className="rounded p-1 hover:bg-red-50"
                    title="Hapus"
                  >
                    <Trash2 className="h-3.5 w-3.5 text-red-500" />
                  </button>
                </div>

                <div className="mt-2 flex items-baseline gap-2 text-xs">
                  <span className={over ? "font-bold text-red-600" : "text-foreground"}>
                    {formatRupiah(spent)}
                  </span>
                  <span className="text-muted">/</span>
                  <span className="text-muted">{formatRupiah(b.target_nominal)}</span>
                </div>

                <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-surface-2">
                  <div
                    className={`h-full rounded-full transition-all ${
                      over ? "bg-red-500" : pct > 80 ? "bg-amber-500" : "bg-accent"
                    }`}
                    style={{ width: `${pct}%` }}
                  />
                </div>

                <p className="mt-1 text-right text-[10px] text-muted">
                  {pct.toFixed(0)}% terpakai
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
