"use client";

import { TrendingUp, TrendingDown, Wallet } from "lucide-react";
import { formatRupiah } from "@/lib/utils";

interface Props {
  totalIncome: number;
  totalExpenses: number;
  balance: number;
}

export default function FinanceSummaryCard({ totalIncome, totalExpenses, balance }: Props) {
  return (
    <div className="grid grid-cols-3 gap-3">
      <div className="card p-4 text-center">
        <TrendingUp className="mx-auto mb-1 h-4 w-4 text-emerald-500" />
        <p className="text-[10px] font-bold uppercase tracking-wider text-muted">Pemasukan</p>
        <p className="mt-0.5 font-display text-sm font-bold text-emerald-600">
          {formatRupiah(totalIncome)}
        </p>
      </div>
      <div className="card p-4 text-center">
        <TrendingDown className="mx-auto mb-1 h-4 w-4 text-red-500" />
        <p className="text-[10px] font-bold uppercase tracking-wider text-muted">Pengeluaran</p>
        <p className="mt-0.5 font-display text-sm font-bold text-red-600">
          {formatRupiah(totalExpenses)}
        </p>
      </div>
      <div className="card p-4 text-center">
        <Wallet className="mx-auto mb-1 h-4 w-4 text-accent" />
        <p className="text-[10px] font-bold uppercase tracking-wider text-muted">Saldo</p>
        <p className={`mt-0.5 font-display text-sm font-bold ${balance >= 0 ? "text-accent" : "text-red-600"}`}>
          {formatRupiah(balance)}
        </p>
      </div>
    </div>
  );
}
