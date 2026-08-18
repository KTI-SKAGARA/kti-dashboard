"use client";

import { memo } from "react";
import { ArrowRightLeft, Loader2 } from "lucide-react";
import { type Gen } from "@/types/attendance";
import { getGenCardSelectedStyle } from "@/lib/utils";

interface BulkMoveModalProps {
  count: number;
  activeGens: Gen[];
  targetGen: Gen;
  moving: boolean;
  onTargetChange: (gen: Gen) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

export default memo(function BulkMoveModal({
  count,
  activeGens,
  targetGen,
  moving,
  onTargetChange,
  onConfirm,
  onCancel,
}: BulkMoveModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/50 p-4">
      <div className="card w-full max-w-md p-6 shadow-lg">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-accent/40 bg-accent/15">
            <ArrowRightLeft className="h-4.5 w-4.5 text-accent" />
          </div>
          <div>
            <h3 className="font-display text-base font-extrabold uppercase tracking-tight text-foreground">
              Pindah Gen ({count} Catatan)
            </h3>
            <p className="mt-0.5 text-xs font-medium text-muted">
              Pindahkan seluruh data yang dipilih ke Generasi / Angkatan lain.
            </p>
          </div>
        </div>

        <div className="mt-4 space-y-3">
          <div>
            <label className="label">Pilih Gen Tujuan</label>
            <div className="grid grid-cols-3 gap-2">
              {activeGens.map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => onTargetChange(g)}
                  className={`flex flex-col items-center justify-center rounded-xl border-2 p-2.5 transition-all text-center ${
                    targetGen === g
                      ? getGenCardSelectedStyle(g)
                      : "border-border bg-surface-2 text-foreground font-semibold hover:bg-surface"
                  }`}
                >
                  <span className="text-sm font-display">Gen {g}</span>
                  <span className="text-[10px] text-muted">
                    Angkatan {g}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <p className="text-[11px] text-muted bg-surface-2 rounded-lg p-2.5 border border-border">
            💡 Seluruh baris yang dipilih akan dipindahkan dari tab asal Google Sheets ke tab <strong>GEN {targetGen}</strong>.
          </p>
        </div>

        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            onClick={onCancel}
            disabled={moving}
            className="btn btn-secondary min-h-[44px] px-4 py-2 text-sm"
          >
            Batal
          </button>
          <button
            onClick={onConfirm}
            disabled={moving || !targetGen}
            className="btn btn-primary min-h-[44px] px-4 py-2 text-sm font-bold"
          >
            {moving && <Loader2 className="h-4 w-4 animate-spin" />}
            {moving ? "Memindahkan..." : `Pindahkan ke Gen ${targetGen}`}
          </button>
        </div>
      </div>
    </div>
  );
});
