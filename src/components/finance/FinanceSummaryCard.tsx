"use client";

import { TrendingUp, TrendingDown, Wallet, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { formatRupiah } from "@/lib/utils";

interface Props {
  totalIncome: number;
  totalExpenses: number;
  balance: number;
}

export default function FinanceSummaryCard({ totalIncome, totalExpenses, balance }: Props) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {/* Cash In (Pemasukan) */}
      <div className="rounded-2xl border-2 border-emerald-500/30 bg-emerald-500/5 p-4 shadow-2xs transition-all hover:border-emerald-500/50">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
            Cash In (Pemasukan)
          </span>
          <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
            <ArrowUpRight className="h-4 w-4" />
          </span>
        </div>
        <p className="mt-2 font-display text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 font-mono tracking-tight">
          {formatRupiah(totalIncome)}
        </p>
        <p className="mt-1 text-[11px] text-muted flex items-center gap-1 font-medium">
          <TrendingUp className="h-3 w-3 text-emerald-500 shrink-0" />
          <span>Total uang kas masuk dari iuran siswa</span>
        </p>
      </div>

      {/* Cash Out (Pengeluaran) */}
      <div className="rounded-2xl border-2 border-red-500/30 bg-red-500/5 p-4 shadow-2xs transition-all hover:border-red-500/50">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-red-600 dark:text-red-400">
            Cash Out (Pengeluaran)
          </span>
          <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-red-500/15 text-red-600 dark:text-red-400">
            <ArrowDownRight className="h-4 w-4" />
          </span>
        </div>
        <p className="mt-2 font-display text-2xl font-extrabold text-red-600 dark:text-red-400 font-mono tracking-tight">
          {formatRupiah(totalExpenses)}
        </p>
        <p className="mt-1 text-[11px] text-muted flex items-center gap-1 font-medium">
          <TrendingDown className="h-3 w-3 text-red-500 shrink-0" />
          <span>Total belanja kebutuhan & operasional KTI</span>
        </p>
      </div>

      {/* Sisa Saldo Bersih */}
      <div className={`rounded-2xl border-2 p-4 shadow-2xs transition-all ${
        balance >= 0
          ? "border-accent/30 bg-accent/5 hover:border-accent/50"
          : "border-danger/30 bg-danger/5 hover:border-danger/50"
      }`}>
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-accent">
            Saldo Kas Bersih
          </span>
          <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-accent/15 text-accent">
            <Wallet className="h-4 w-4" />
          </span>
        </div>
        <p className={`mt-2 font-display text-2xl font-extrabold font-mono tracking-tight ${
          balance >= 0 ? "text-accent" : "text-danger"
        }`}>
          {formatRupiah(balance)}
        </p>
        <p className="mt-1 text-[11px] text-muted flex items-center gap-1 font-medium">
          <span>{balance >= 0 ? "Sisa dana riil yang dipegang bendahara" : "⚠️ Kas mengalami defisit pengeluaran"}</span>
        </p>
      </div>
    </div>
  );
}
