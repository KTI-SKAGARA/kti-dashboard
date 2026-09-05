"use client";

import { useState } from "react";
import type { GenConfig, StudentProfile } from "@/types/attendance";
import { getStudentProfiles, promoteGen } from "@/app/actions/student-profiles";
import { Loader2, GraduationCap } from "lucide-react";
import { getGenBadgeColor } from "@/lib/utils";

interface ClassPromotionProps {
  gens: GenConfig[];
  showToast: (type: "success" | "error", message: string) => void;
  onSwitchToSiswa: (gen: string) => void;
}

export default function ClassPromotion({ gens, showToast, onSwitchToSiswa }: ClassPromotionProps) {
  const [promosiGen, setPromosiGen] = useState("");
  const [promosiProfiles, setPromosiProfiles] = useState<StudentProfile[]>([]);
  const [promosiMapping, setPromosiMapping] = useState<Record<string, string>>({});
  const [promosiLoading, setPromosiLoading] = useState(false);
  const [promosiSubmitting, setPromosiSubmitting] = useState(false);

  const loadPromosiProfiles = async (gen: string) => {
    if (!gen) {
      setPromosiProfiles([]);
      setPromosiMapping({});
      return;
    }
    setPromosiLoading(true);
    try {
      const res = await getStudentProfiles(gen);
      if (res.success && res.data) {
        setPromosiProfiles(res.data);
        const mapping: Record<string, string> = {};
        for (const p of res.data) {
          mapping[p.nama] = p.kelas;
        }
        setPromosiMapping(mapping);
      }
    } catch {
      // silent
    } finally {
      setPromosiLoading(false);
    }
  };

  const handlePromosi = async () => {
    if (!promosiGen || promosiProfiles.length === 0) return;

    const mapping = promosiProfiles
      .filter((p) => promosiMapping[p.nama] !== p.kelas)
      .map((p) => ({ nama: p.nama, kelasBaru: promosiMapping[p.nama] }));

    if (mapping.length === 0) {
      showToast("error", "Tidak ada perubahan kelas.");
      return;
    }

    if (!confirm(`Promosi ${mapping.length} siswa Gen ${promosiGen}?`)) return;

    setPromosiSubmitting(true);
    const res = await promoteGen(promosiGen, mapping);
    setPromosiSubmitting(false);

    if (res.success) {
      showToast("success", `${res.data?.updated ?? 0} siswa berhasil dipromosikan.`);
      loadPromosiProfiles(promosiGen);
    } else {
      showToast("error", res.error ?? "Gagal mempromosikan.");
    }
  };

  const changedCount = promosiProfiles.filter((p) => promosiMapping[p.nama] !== p.kelas).length;

  return (
    <div className="card mt-5 p-6 sm:p-8">
      <div className="flex items-center gap-2">
        <GraduationCap className="h-4 w-4 text-accent" />
        <h2 className="font-display text-sm font-bold uppercase tracking-wide text-foreground">Promosi Kelas</h2>
      </div>
      <p className="mt-1 text-xs font-medium text-muted">
        Naikkan kelas seluruh siswa dalam satu angkatan. Hanya owner yang dapat mengakses fitur ini.
      </p>

      {/* Select Gen */}
      <div className="mt-4 flex items-end gap-3">
        <div>
          <label className="label">Pilih Gen</label>
          <select
            value={promosiGen}
            onChange={(e) => {
              setPromosiGen(e.target.value);
              loadPromosiProfiles(e.target.value);
            }}
            className="select min-w-[140px]"
          >
            <option value="">Pilih Gen</option>
            {gens.filter((g) => g.status === "aktif").map((g) => (
              <option key={g.gen} value={g.gen}>Gen {g.gen}</option>
            ))}
          </select>
        </div>
      </div>

      {promosiLoading ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-accent" />
        </div>
      ) : promosiProfiles.length === 0 ? (
        <div className="py-6 text-center">
          <p className="text-xs font-medium text-muted">
            {promosiGen ? "Tidak ada siswa untuk gen ini." : "Pilih gen terlebih dahulu."}
          </p>
          {promosiGen && (
            <button
              onClick={() => onSwitchToSiswa(promosiGen)}
              className="mt-2 text-xs font-semibold text-accent hover:underline"
            >
              Import dulu dari tab Siswa →
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="mt-4 overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>No</th>
                  <th>Nama</th>
                  <th>Gen</th>
                  <th>Kelas Saat Ini</th>
                  <th>Kelas Baru</th>
                </tr>
              </thead>
              <tbody>
                {promosiProfiles.map((p, i) => (
                  <tr key={`${p.gen}-${p.nama}`}>
                    <td className="text-muted tabular-nums">{i + 1}</td>
                    <td title={p.nama} className="max-w-[200px] truncate font-medium uppercase text-foreground">{p.nama}</td>
                    <td>
                      <span className={`badge font-bold text-[10px] ${getGenBadgeColor(p.gen)}`}>
                        {p.gen}
                      </span>
                    </td>
                    <td className="text-muted">{p.kelas}</td>
                    <td>
                      <input
                        type="text"
                        className="input min-w-[120px]"
                        value={promosiMapping[p.nama] || ""}
                        onChange={(e) =>
                          setPromosiMapping((prev) => ({
                            ...prev,
                            [p.nama]: e.target.value,
                          }))
                        }
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex items-center justify-between">
            <p className="text-xs text-muted">
              {changedCount} siswa akan dipromosikan
            </p>
            <button
              onClick={handlePromosi}
              disabled={promosiSubmitting || changedCount === 0}
              className="btn btn-primary min-h-[44px] px-4 py-2 text-sm"
            >
              {promosiSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <GraduationCap className="h-4 w-4" />
              )}
              Promosi {changedCount} Siswa
            </button>
          </div>
        </>
      )}
    </div>
  );
}
