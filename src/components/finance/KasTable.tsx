"use client";

import { Loader2 } from "lucide-react";
import type { KasPayment } from "@/types/finance";
import { formatRupiah } from "@/lib/utils";

interface Props {
  payments: KasPayment[];
  loading: boolean;
}

export default function KasTable({ payments, loading }: Props) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="h-5 w-5 animate-spin text-accent" />
      </div>
    );
  }

  if (payments.length === 0) {
    return (
      <p className="py-6 text-center text-xs text-muted">
        Belum ada pembayaran kas.
      </p>
    );
  }

  // Group by bulan_tahun
  const grouped = new Map<string, KasPayment[]>();
  for (const p of payments) {
    const bt = p.bulan_tahun || "-";
    const arr = grouped.get(bt) || [];
    arr.push(p);
    grouped.set(bt, arr);
  }

  const sortedMonths = Array.from(grouped.keys()).sort((a, b) => b.localeCompare(a));

  return (
    <div className="space-y-4">
      {sortedMonths.map((bt) => {
        const items = grouped.get(bt)!;
        const total = items.reduce((sum, p) => sum + p.nominal, 0);

        return (
          <div key={bt} className="card overflow-hidden">
            <div className="flex items-center justify-between border-b border-border bg-surface-2 px-4 py-2">
              <span className="text-xs font-bold uppercase tracking-wide text-foreground">
                {bt}
              </span>
              <span className="font-mono text-xs font-bold text-accent">
                {formatRupiah(total)}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Tanggal</th>
                    <th>Nama</th>
                    <th>Gen</th>
                    <th>Kelas</th>
                    <th className="text-right">Nominal</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((p) => (
                    <tr key={p.id}>
                      <td className="text-xs">{p.tanggal}</td>
                      <td title={p.nama} className="max-w-[200px] truncate text-xs font-medium uppercase">{p.nama}</td>
                      <td>
                        <span className="badge bg-surface-2 text-foreground text-[10px]">
                          Gen {p.gen}
                        </span>
                      </td>
                      <td className="text-xs">{p.kelas}</td>
                      <td className="text-right font-mono text-xs font-semibold text-accent">
                        {formatRupiah(p.nominal)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </div>
  );
}
