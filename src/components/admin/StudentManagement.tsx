"use client";

import { useState, useEffect, useCallback } from "react";
import type { GenConfig, StudentProfile } from "@/types/attendance";
import {
  getStudentProfiles,
  upsertStudentProfile,
  updateStudentClass,
  deleteStudentProfile,
  bulkImportFromRecords,
} from "@/app/actions/student-profiles";
import {
  Loader2,
  Plus,
  RotateCcw,
  Users,
  Trash2,
  Pencil,
  ArrowRightLeft,
  Search,
} from "lucide-react";
import RenameStudentModal from "@/components/admin/RenameStudentModal";
import MoveStudentGenModal from "@/components/admin/MoveStudentGenModal";
import { getGenBadgeColor } from "@/lib/utils";

interface StudentManagementProps {
  gens: GenConfig[];
  showToast: (type: "success" | "error", message: string) => void;
}

export default function StudentManagement({ gens, showToast }: StudentManagementProps) {
  const [studentProfiles, setStudentProfiles] = useState<StudentProfile[]>([]);
  const [profilesLoading, setProfilesLoading] = useState(true);
  const [selectedGenFilter, setSelectedGenFilter] = useState("");
  const [newStudentNama, setNewStudentNama] = useState("");
  const [newStudentGen, setNewStudentGen] = useState("");
  const [newStudentKelas, setNewStudentKelas] = useState("");
  const [editingProfile, setEditingProfile] = useState<StudentProfile | null>(null);
  const [editKelas, setEditKelas] = useState("");
  const [studentSearch, setStudentSearch] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [renameModalData, setRenameModalData] = useState<{
    open: boolean;
    oldName?: string;
    gen?: string;
  }>({ open: false });
  const [moveGenModalData, setMoveGenModalData] = useState<{
    open: boolean;
    nama?: string;
    fromGen?: string;
  }>({ open: false });

  const loadProfiles = useCallback(async (gen?: string) => {
    setProfilesLoading(true);
    try {
      const res = await getStudentProfiles(gen || undefined);
      if (res.success && res.data) {
        setStudentProfiles(res.data);
      }
    } catch {
      // silent
    } finally {
      setProfilesLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProfiles();
  }, [loadProfiles]);

  useEffect(() => {
    loadProfiles(selectedGenFilter || undefined);
  }, [selectedGenFilter, loadProfiles]);

  const handleAddStudent = async () => {
    if (!newStudentNama.trim() || !newStudentGen.trim() || !newStudentKelas.trim()) {
      showToast("error", "Nama, Gen, dan Kelas wajib diisi.");
      return;
    }
    setSubmitting(true);
    const res = await upsertStudentProfile(newStudentNama, newStudentGen, newStudentKelas);
    setSubmitting(false);

    if (res.success) {
      showToast("success", `Siswa ${newStudentNama.toUpperCase()} berhasil disimpan.`);
      setNewStudentNama("");
      setNewStudentGen("");
      setNewStudentKelas("");
      loadProfiles(selectedGenFilter || undefined);
    } else {
      showToast("error", res.error ?? "Gagal menyimpan siswa.");
    }
  };

  const handleUpdateKelas = async () => {
    if (!editingProfile || !editKelas.trim()) return;
    setSubmitting(true);
    const res = await updateStudentClass(editingProfile.nama, editingProfile.gen, editKelas);
    setSubmitting(false);

    if (res.success) {
      showToast("success", `Kelas ${editingProfile.nama} berhasil diupdate.`);
      setEditingProfile(null);
      setEditKelas("");
      loadProfiles(selectedGenFilter || undefined);
    } else {
      showToast("error", res.error ?? "Gagal update kelas.");
    }
  };

  const handleDeleteStudent = async (nama: string, gen: string) => {
    if (!confirm(`Hapus profil siswa ${nama} (Gen ${gen})?`)) return;
    setSubmitting(true);
    const res = await deleteStudentProfile(nama, gen);
    setSubmitting(false);

    if (res.success) {
      showToast("success", `Profil ${nama} berhasil dihapus.`);
      loadProfiles(selectedGenFilter || undefined);
    } else {
      showToast("error", res.error ?? "Gagal menghapus profil.");
    }
  };

  const handleImportFromRecords = async () => {
    if (!selectedGenFilter) {
      showToast("error", "Pilih Gen dulu untuk import.");
      return;
    }
    setSubmitting(true);
    const res = await bulkImportFromRecords(selectedGenFilter);
    setSubmitting(false);

    if (res.success && res.data) {
      const { imported, skipped } = res.data;
      showToast(
        "success",
        imported > 0
          ? `Berhasil import ${imported} siswa dari data absensi${skipped > 0 ? ` (${skipped} sudah ada)` : ""}.`
          : `Tidak ada siswa baru (${skipped} profil sudah ada).`
      );
      loadProfiles(selectedGenFilter || undefined);
    } else {
      showToast("error", res.error ?? "Gagal import siswa.");
    }
  };

  const handleRenameSuccess = (result: { sheetsUpdated: number; profilesUpdated: number; kasUpdated: number }) => {
    showToast(
      "success",
      `Nama berhasil diubah! (${result.profilesUpdated} profil, ${result.sheetsUpdated} baris absensi, ${result.kasUpdated} kas diperbarui).`
    );
    loadProfiles(selectedGenFilter || undefined);
  };

  const handleMoveGenSuccess = (result: { recordsMoved: number; profileMoved: boolean; kasUpdated: number }) => {
    showToast(
      "success",
      `Siswa berhasil dipindahkan! (${result.recordsMoved} baris absensi dipindah, ${result.kasUpdated} kas diperbarui).`
    );
    loadProfiles(selectedGenFilter || undefined);
  };

  const filteredProfiles = studentProfiles.filter((p) => {
    if (!studentSearch.trim()) return true;
    const q = studentSearch.toLowerCase().trim();
    return (
      p.nama.toLowerCase().includes(q) ||
      p.kelas.toLowerCase().includes(q) ||
      p.gen.includes(q)
    );
  });

  return (
    <>
    <div className="card mt-5 p-6 sm:p-8">
      <div className="flex items-center gap-2">
        <Users className="h-4 w-4 text-accent" />
        <h2 className="font-display text-sm font-bold uppercase tracking-wide text-foreground">Kelola Siswa</h2>
      </div>
      <p className="mt-1 text-xs font-medium text-muted">
        Kelola profil siswa per angkatan. Data ini digunakan untuk promosi kelas.
      </p>

      {/* Filter, Search & Quick Actions */}
      <div className="mt-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="label">Filter Gen</label>
          <select
            value={selectedGenFilter}
            onChange={(e) => setSelectedGenFilter(e.target.value)}
            className="select min-w-[120px]"
          >
            <option value="">Semua Gen</option>
            {gens.map((g) => (
              <option key={g.gen} value={g.gen}>Gen {g.gen}</option>
            ))}
          </select>
        </div>

        <div className="flex-1 min-w-[180px]">
          <label className="label">Cari Siswa</label>
          <div className="relative">
            <input
              type="text"
              className="input pl-9"
              placeholder="Cari nama atau kelas..."
              value={studentSearch}
              onChange={(e) => setStudentSearch(e.target.value)}
            />
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setRenameModalData({ open: true, gen: selectedGenFilter })}
            className="btn btn-secondary min-h-[44px]"
            title="Koreksi Typo Nama Siswa"
          >
            <Pencil className="h-4 w-4 text-accent" />
            <span>Koreksi Typo</span>
          </button>

          <button
            onClick={() => setMoveGenModalData({ open: true, fromGen: selectedGenFilter })}
            className="btn btn-secondary min-h-[44px]"
            title="Pindah Angkatan Siswa"
          >
            <ArrowRightLeft className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            <span>Pindah Gen</span>
          </button>

          <button
            onClick={handleImportFromRecords}
            disabled={submitting || !selectedGenFilter}
            className="btn btn-primary min-h-[44px]"
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RotateCcw className="h-4 w-4" />
            )}
            <span>Import dari Absensi</span>
          </button>
        </div>
      </div>

      {/* Add new student */}
      <div className="mt-4 flex flex-wrap items-end gap-3 rounded-lg border border-border bg-surface-2 p-4">
        <div className="flex-1 min-w-[150px]">
          <label className="label">Nama Siswa</label>
          <input
            type="text"
            className="input uppercase"
            placeholder="NAMA SISWA"
            value={newStudentNama}
            onChange={(e) => setNewStudentNama(e.target.value.toUpperCase())}
          />
        </div>
        <div className="min-w-[100px]">
          <label className="label">Gen</label>
          <select
            value={newStudentGen}
            onChange={(e) => setNewStudentGen(e.target.value)}
            className="select"
          >
            <option value="">Pilih</option>
            {gens.map((g) => (
              <option key={g.gen} value={g.gen}>{g.gen}</option>
            ))}
          </select>
        </div>
        <div className="min-w-[140px]">
          <label className="label">Kelas</label>
          <input
            type="text"
            className="input uppercase"
            placeholder="X TKJ 1"
            value={newStudentKelas}
            onChange={(e) => setNewStudentKelas(e.target.value.toUpperCase())}
          />
        </div>
        <button
          onClick={handleAddStudent}
          disabled={submitting || !newStudentNama.trim() || !newStudentGen.trim() || !newStudentKelas.trim()}
          className="btn btn-primary min-h-[44px] px-4 py-2 text-sm"
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Tambah
        </button>
      </div>

      {/* Student list */}
      {profilesLoading ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-accent" />
        </div>
      ) : studentProfiles.length === 0 ? (
        <p className="py-6 text-center text-xs font-medium text-muted">Belum ada profil siswa.</p>
      ) : filteredProfiles.length === 0 ? (
        <p className="py-6 text-center text-xs font-medium text-muted">
          Tidak ada siswa yang cocok dengan pencarian &quot;{studentSearch}&quot;.
        </p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>No</th>
                <th>Nama</th>
                <th>Gen</th>
                <th>Kelas</th>
                <th className="text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filteredProfiles.map((p, i) => (
                <tr key={`${p.gen}-${p.nama}`}>
                  <td className="text-muted tabular-nums">{i + 1}</td>
                  <td title={p.nama} className="max-w-[200px] truncate font-medium uppercase text-foreground">{p.nama}</td>
                  <td>
                    <span className={`badge font-bold text-[10px] ${getGenBadgeColor(p.gen)}`}>
                      {p.gen}
                    </span>
                  </td>
                  <td>
                    {editingProfile?.nama === p.nama && editingProfile?.gen === p.gen ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          className="input min-w-[120px]"
                          value={editKelas}
                          onChange={(e) => setEditKelas(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && handleUpdateKelas()}
                          autoFocus
                        />
                        <button
                          onClick={handleUpdateKelas}
                          disabled={submitting}
                          className="btn btn-ghost min-h-[44px] px-2 py-1 text-xs text-emerald-600"
                        >
                          Simpan
                        </button>
                        <button
                          onClick={() => { setEditingProfile(null); setEditKelas(""); }}
                          className="btn btn-ghost min-h-[44px] px-2 py-1 text-xs text-muted"
                        >
                          Batal
                        </button>
                      </div>
                    ) : (
                      <span
                        className="cursor-pointer hover:text-accent hover:underline"
                        onClick={() => { setEditingProfile(p); setEditKelas(p.kelas); }}
                      >
                        {p.kelas}
                      </span>
                    )}
                  </td>
                  <td className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => setRenameModalData({ open: true, oldName: p.nama, gen: p.gen })}
                        disabled={submitting}
                        className="btn btn-ghost min-h-[38px] min-w-[38px] p-2 text-muted hover:!text-accent"
                        title={`Koreksi Typo: ${p.nama}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setMoveGenModalData({ open: true, nama: p.nama, fromGen: p.gen })}
                        disabled={submitting}
                        className="btn btn-ghost min-h-[38px] min-w-[38px] p-2 text-muted hover:!text-emerald-600 dark:hover:!text-emerald-400"
                        title={`Pindah Gen: ${p.nama}`}
                      >
                        <ArrowRightLeft className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteStudent(p.nama, p.gen)}
                        disabled={submitting}
                        className="btn btn-ghost min-h-[38px] min-w-[38px] p-2 text-muted hover:!text-danger"
                        title={`Hapus: ${p.nama}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>

    {/* Koreksi Typo Nama modal */}
    {renameModalData.open && (
      <RenameStudentModal
        onClose={() => setRenameModalData({ open: false })}
        initialOldName={renameModalData.oldName}
        initialGen={renameModalData.gen}
        gens={gens}
        existingNames={studentProfiles.map((p) => p.nama)}
        onSuccess={handleRenameSuccess}
      />
    )}

    {/* Pindah Angkatan (Gen) modal */}
    {moveGenModalData.open && (
      <MoveStudentGenModal
        onClose={() => setMoveGenModalData({ open: false })}
        initialNama={moveGenModalData.nama}
        initialFromGen={moveGenModalData.fromGen}
        gens={gens}
        studentProfiles={studentProfiles}
        onSuccess={handleMoveGenSuccess}
      />
    )}
    </>
  );
}
