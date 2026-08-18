"use client";

import { memo } from "react";
import { Trash2, Loader2 } from "lucide-react";

interface BulkDeleteModalProps {
  count: number;
  deleting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default memo(function BulkDeleteModal({
  count,
  deleting,
  onConfirm,
  onCancel,
}: BulkDeleteModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/50 p-4">
      <div className="card w-full max-w-sm p-6 shadow-lg">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-danger/40 bg-danger/15">
            <Trash2 className="h-4.5 w-4.5 text-danger" />
          </div>
          <div>
            <h3 className="font-display text-base font-extrabold uppercase tracking-tight text-foreground">
              Hapus {count} catatan?
            </h3>
            <p className="mt-0.5 text-xs font-medium text-muted">
              Tindakan ini tidak dapat dibatalkan.
            </p>
          </div>
        </div>
        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            onClick={onCancel}
            disabled={deleting}
            className="btn btn-secondary min-h-[44px] px-4 py-2 text-sm"
          >
            Batal
          </button>
          <button
            onClick={onConfirm}
            disabled={deleting}
            className="btn btn-danger min-h-[44px] px-4 py-2 text-sm"
          >
            {deleting && <Loader2 className="h-4 w-4 animate-spin" />}
            {deleting ? "Menghapus..." : "Hapus Semua"}
          </button>
        </div>
      </div>
    </div>
  );
});
