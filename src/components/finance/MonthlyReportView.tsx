"use client";

import { Printer, TrendingUp, TrendingDown, Wallet, Users } from "lucide-react";
import type { MonthlyReport } from "@/types/finance";
import { formatRupiah } from "@/lib/utils";

interface Props {
  report: MonthlyReport | null;
  loading: boolean;
}

export default function MonthlyReportView({ report, loading }: Props) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-10">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-accent border-t-transparent" />
      </div>
    );
  }

  if (!report) {
    return (
      <p className="py-6 text-center text-xs text-muted">Pilih bulan untuk melihat laporan.</p>
    );
  }

  const handlePrint = () => {
    const content = document.getElementById("printable-report");
    if (!content) return;
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`
      <html><head><title>Laporan Keuangan ${report.bulan_tahun}</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 20px; font-size: 12px; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        th, td { border: 1px solid #ddd; padding: 6px 8px; text-align: left; }
        th { background: #f5f5f5; }
        .text-right { text-align: right; }
        .font-bold { font-weight: bold; }
        h1 { font-size: 16px; }
        h2 { font-size: 14px; margin-top: 20px; }
      </style></head><body>
        <h1>KTI Dashboard — Laporan Keuangan</h1>
        <p>Bulan: ${report.bulan_tahun}</p>
        <table>
          <tr><td>Total Pemasukan</td><td class="text-right font-bold">${formatRupiah(report.income)}</td></tr>
          <tr><td>Total Pengeluaran</td><td class="text-right font-bold">${formatRupiah(report.expenses)}</td></tr>
          <tr><td>Saldo</td><td class="text-right font-bold">${formatRupiah(report.balance)}</td></tr>
          <tr><td>Jumlah Presensi</td><td class="text-right">${report.attendanceCount}记录</td></tr>
        </table>
        ${report.expenseBreakdown.length > 0 ? `
          <h2>Breakdown Pengeluaran</h2>
          <table>
            <tr><th>Kategori</th><th class="text-right">Nominal</th></tr>
            ${report.expenseBreakdown.map((e) => `
              <tr><td>${e.category}</td><td class="text-right">${formatRupiah(e.nominal)}</td></tr>
            `).join("")}
          </table>
        ` : ""}
      </body></html>
    `);
    win.document.close();
    win.print();
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={handlePrint} className="btn btn-outline min-h-[44px]">
          <Printer className="h-4 w-4" />
          <span>Cetak / Export PDF</span>
        </button>
      </div>

      <div id="printable-report" className="space-y-4">
        {/* Summary cards */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="card p-4 text-center">
            <TrendingUp className="mx-auto mb-1 h-4 w-4 text-emerald-500" />
            <p className="text-[10px] font-bold uppercase text-muted">Pemasukan</p>
            <p className="mt-0.5 font-display text-sm font-bold text-emerald-600">
              {formatRupiah(report.income)}
            </p>
          </div>
          <div className="card p-4 text-center">
            <TrendingDown className="mx-auto mb-1 h-4 w-4 text-red-500" />
            <p className="text-[10px] font-bold uppercase text-muted">Pengeluaran</p>
            <p className="mt-0.5 font-display text-sm font-bold text-red-600">
              {formatRupiah(report.expenses)}
            </p>
          </div>
          <div className="card p-4 text-center">
            <Wallet className="mx-auto mb-1 h-4 w-4 text-accent" />
            <p className="text-[10px] font-bold uppercase text-muted">Saldo</p>
            <p className={`mt-0.5 font-display text-sm font-bold ${report.balance >= 0 ? "text-accent" : "text-red-600"}`}>
              {formatRupiah(report.balance)}
            </p>
          </div>
          <div className="card p-4 text-center">
            <Users className="mx-auto mb-1 h-4 w-4 text-blue-500" />
            <p className="text-[10px] font-bold uppercase text-muted">Presensi</p>
            <p className="mt-0.5 font-display text-sm font-bold text-foreground">
              {report.attendanceCount}
            </p>
          </div>
        </div>

        {/* Expense breakdown */}
        {report.expenseBreakdown.length > 0 && (
          <div className="card p-5">
            <h3 className="font-display text-xs font-bold uppercase tracking-wide text-foreground">
              Breakdown Pengeluaran
            </h3>
            <div className="mt-3 space-y-2">
              {report.expenseBreakdown.map((e) => {
                const pct = report.expenses > 0 ? (e.nominal / report.expenses) * 100 : 0;
                return (
                  <div key={e.category}>
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-foreground">{e.category}</span>
                      <span className="font-mono text-muted">{formatRupiah(e.nominal)}</span>
                    </div>
                    <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
                      <div
                        className="h-full rounded-full bg-accent"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
