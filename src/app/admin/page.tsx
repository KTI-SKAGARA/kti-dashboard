"use client";

import { useState, useEffect, useCallback } from "react";
import type { GenConfig, StudentProfile } from "@/types/attendance";
import {
  getGenList,
  createGen,
  toggleGenStatus,
  deleteGenAction,
} from "@/app/actions/attendance";
import {
  listUsers,
  addUser,
  toggleUserActive,
  changeUserRole,
  deleteUser,
} from "@/app/actions/auth";
import {
  getStudentProfiles,
  upsertStudentProfile,
  updateStudentClass,
  deleteStudentProfile,
  promoteGen,
  bulkImportFromRecords,
} from "@/app/actions/student-profiles";
import { APP_NAME, TOAST_DURATION } from "@/lib/constants";
import {
  ArrowLeft,
  Loader2,
  Plus,
  GraduationCap,
  RotateCcw,
  Users,
  Shield,
  ShieldOff,
  Trash2,
  UserPlus,
  Eye,
  EyeOff,
  KeyRound,
} from "lucide-react";
import Link from "next/link";
import Toast from "@/components/Toast";
import ChangePasswordModal from "@/components/ChangePasswordModal";
import { getGenBadgeColor } from "@/lib/utils";

interface UserEntry {
  id: string;
  email: string;
  role: string;
  is_active: boolean;
  created_at: string;
}

export default function AdminPage() {
  const [activeSection, setActiveSection] = useState<"user" | "gen" | "siswa" | "promosi">("user");
  const [gens, setGens] = useState<GenConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [newGen, setNewGen] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // User management
  const [users, setUsers] = useState<UserEntry[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [addingUser, setAddingUser] = useState(false);
  const [changePwOpen, setChangePwOpen] = useState(false);

  // Student profiles management
  const [studentProfiles, setStudentProfiles] = useState<StudentProfile[]>([]);
  const [profilesLoading, setProfilesLoading] = useState(true);
  const [selectedGenFilter, setSelectedGenFilter] = useState("");
  const [newStudentNama, setNewStudentNama] = useState("");
  const [newStudentGen, setNewStudentGen] = useState("");
  const [newStudentKelas, setNewStudentKelas] = useState("");
  const [editingProfile, setEditingProfile] = useState<StudentProfile | null>(null);
  const [editKelas, setEditKelas] = useState("");

  // Promosi state
  const [promosiGen, setPromosiGen] = useState("");
  const [promosiProfiles, setPromosiProfiles] = useState<StudentProfile[]>([]);
  const [promosiMapping, setPromosiMapping] = useState<Record<string, string>>({});
  const [promosiLoading, setPromosiLoading] = useState(false);
  const [promosiSubmitting, setPromosiSubmitting] = useState(false);

  const loadGens = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getGenList();
      if (res.success && res.data) {
        setGens(res.data);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  const loadUsers = useCallback(async () => {
    setUsersLoading(true);
    try {
      const data = await listUsers();
      setUsers(data);
    } catch {
      // silent
    } finally {
      setUsersLoading(false);
    }
  }, []);

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
    loadGens(); // eslint-disable-line react-hooks/set-state-in-effect
    loadUsers();
    loadProfiles();
  }, [loadGens, loadUsers, loadProfiles]);

  useEffect(() => {
    loadProfiles(selectedGenFilter || undefined); // eslint-disable-line react-hooks/set-state-in-effect
  }, [selectedGenFilter, loadProfiles]);

  // --- Student Profile Management ---

  const handleAddStudent = async () => {
    if (!newStudentNama.trim() || !newStudentGen.trim() || !newStudentKelas.trim()) {
      setToast({ type: "error", message: "Nama, Gen, dan Kelas wajib diisi." });
      setTimeout(() => setToast(null), TOAST_DURATION);
      return;
    }
    setSubmitting(true);
    const res = await upsertStudentProfile(newStudentNama, newStudentGen, newStudentKelas);
    setSubmitting(false);

    if (res.success) {
      setToast({ type: "success", message: `Siswa ${newStudentNama.toUpperCase()} berhasil disimpan.` });
      setNewStudentNama("");
      setNewStudentGen("");
      setNewStudentKelas("");
      loadProfiles(selectedGenFilter || undefined);
    } else {
      setToast({ type: "error", message: res.error ?? "Gagal menyimpan siswa." });
    }
    setTimeout(() => setToast(null), TOAST_DURATION);
  };

  const handleUpdateKelas = async () => {
    if (!editingProfile || !editKelas.trim()) return;
    setSubmitting(true);
    const res = await updateStudentClass(editingProfile.nama, editingProfile.gen, editKelas);
    setSubmitting(false);

    if (res.success) {
      setToast({ type: "success", message: `Kelas ${editingProfile.nama} berhasil diupdate.` });
      setEditingProfile(null);
      setEditKelas("");
      loadProfiles(selectedGenFilter || undefined);
    } else {
      setToast({ type: "error", message: res.error ?? "Gagal update kelas." });
    }
    setTimeout(() => setToast(null), TOAST_DURATION);
  };

  const handleDeleteStudent = async (nama: string, gen: string) => {
    if (!confirm(`Hapus profil siswa ${nama} (Gen ${gen})?`)) return;
    setSubmitting(true);
    const res = await deleteStudentProfile(nama, gen);
    setSubmitting(false);

    if (res.success) {
      setToast({ type: "success", message: `Profil ${nama} berhasil dihapus.` });
      loadProfiles(selectedGenFilter || undefined);
    } else {
      setToast({ type: "error", message: res.error ?? "Gagal menghapus profil." });
    }
    setTimeout(() => setToast(null), TOAST_DURATION);
  };

  const handleImportFromRecords = async () => {
    if (!selectedGenFilter) {
      setToast({ type: "error", message: "Pilih Gen dulu untuk import." });
      setTimeout(() => setToast(null), TOAST_DURATION);
      return;
    }
    setSubmitting(true);
    const res = await bulkImportFromRecords(selectedGenFilter);
    setSubmitting(false);

    if (res.success && res.data) {
      const { imported, skipped } = res.data;
      setToast({
        type: "success",
        message: imported > 0
          ? `Berhasil import ${imported} siswa dari data absensi${skipped > 0 ? ` (${skipped} sudah ada)` : ""}.`
          : `Tidak ada siswa baru (${skipped} profil sudah ada).`,
      });
      loadProfiles(selectedGenFilter || undefined);
    } else {
      setToast({ type: "error", message: res.error ?? "Gagal import siswa." });
    }
    setTimeout(() => setToast(null), TOAST_DURATION);
  };

  // --- Promosi Kelas ---

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
        // Initialize mapping with current classes
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

    // Build mapping: only include students whose class changed
    const mapping = promosiProfiles
      .filter((p) => promosiMapping[p.nama] !== p.kelas)
      .map((p) => ({ nama: p.nama, kelasBaru: promosiMapping[p.nama] }));

    if (mapping.length === 0) {
      setToast({ type: "error", message: "Tidak ada perubahan kelas." });
      setTimeout(() => setToast(null), TOAST_DURATION);
      return;
    }

    if (!confirm(`Promosi ${mapping.length} siswa Gen ${promosiGen}?`)) return;

    setPromosiSubmitting(true);
    const res = await promoteGen(promosiGen, mapping);
    setPromosiSubmitting(false);

    if (res.success) {
      setToast({ type: "success", message: `${res.data?.updated ?? 0} siswa berhasil dipromosikan.` });
      loadPromosiProfiles(promosiGen);
      loadProfiles(promosiGen);
    } else {
      setToast({ type: "error", message: res.error ?? "Gagal mempromosikan." });
    }
    setTimeout(() => setToast(null), TOAST_DURATION);
  };

  // --- Gen Management ---

  const handleCreate = async () => {
    if (!newGen.trim()) return;
    setSubmitting(true);
    setToast(null);

    const res = await createGen(newGen.trim());
    setSubmitting(false);

    if (res.success) {
      setToast({ type: "success", message: `Gen ${newGen.trim()} berhasil dibuat!` });
      setNewGen("");
      loadGens();
    } else {
      setToast({ type: "error", message: res.error ?? "Gagal membuat gen." });
    }

    setTimeout(() => setToast(null), TOAST_DURATION);
  };

  const handleToggleLulus = async (gen: string, currentStatus: string) => {
    const newLulus = currentStatus === "aktif";
    setSubmitting(true);

    const res = await toggleGenStatus(gen, newLulus);
    setSubmitting(false);

    if (res.success) {
      setToast({
        type: "success",
        message: `Gen ${gen} ditandai ${newLulus ? "lulus" : "aktif"}.`,
      });
      loadGens();
    } else {
      setToast({ type: "error", message: res.error ?? "Gagal mengubah status." });
    }

    setTimeout(() => setToast(null), TOAST_DURATION);
  };

  const handleDeleteGen = async (gen: string) => {
    if (!confirm(`Hapus Gen ${gen}? Tab sheet dan config akan dihapus permanen.`)) return;
    setSubmitting(true);

    const res = await deleteGenAction(gen);
    setSubmitting(false);

    if (res.success) {
      setToast({ type: "success", message: `Gen ${gen} berhasil dihapus.` });
      loadGens();
    } else {
      setToast({ type: "error", message: res.error ?? "Gagal menghapus gen." });
    }

    setTimeout(() => setToast(null), TOAST_DURATION);
  };

  // --- User Management ---

  const handleAddUser = async () => {
    if (!newEmail.trim() || !newPassword.trim()) {
      setToast({ type: "error", message: "Email dan password wajib diisi." });
      setTimeout(() => setToast(null), TOAST_DURATION);
      return;
    }

    setAddingUser(true);
    setToast(null);

    const res = await addUser(newEmail, newPassword);
    setAddingUser(false);

    if (res.success) {
      setToast({ type: "success", message: `User ${newEmail} berhasil ditambahkan!` });
      setNewEmail("");
      setNewPassword("");
      loadUsers();
    } else {
      setToast({ type: "error", message: res.error ?? "Gagal menambah user." });
    }

    setTimeout(() => setToast(null), TOAST_DURATION);
  };

  const handleToggleActive = async (userId: string, currentActive: boolean) => {
    const res = await toggleUserActive(userId, !currentActive);
    if (res.success) {
      setToast({
        type: "success",
        message: `User ${currentActive ? "dinonaktifkan" : "diaktifkan"}.`,
      });
      loadUsers();
    } else {
      setToast({ type: "error", message: res.error ?? "Gagal mengubah status." });
    }
    setTimeout(() => setToast(null), TOAST_DURATION);
  };

  const handleChangeRole = async (userId: string, newRole: "admin" | "viewer") => {
    const res = await changeUserRole(userId, newRole);
    if (res.success) {
      setToast({ type: "success", message: `Role diubah ke ${newRole}.` });
      loadUsers();
    } else {
      setToast({ type: "error", message: res.error ?? "Gagal mengubah role." });
    }
    setTimeout(() => setToast(null), TOAST_DURATION);
  };

  const handleDeleteUser = async (userId: string, email: string) => {
    if (!confirm(`Hapus user "${email}"? Tindakan ini tidak dapat dibatalkan.`)) return;

    const res = await deleteUser(userId);
    if (res.success) {
      setToast({ type: "success", message: `User ${email} berhasil dihapus.` });
      loadUsers();
    } else {
      setToast({ type: "error", message: res.error ?? "Gagal menghapus user." });
    }
    setTimeout(() => setToast(null), TOAST_DURATION);
  };

  return (
    <div className="mx-auto max-w-2xl animate-page">
      {/* Header */}
      <div className="flex items-center justify-between border-b-2 border-border pb-5">
        <div className="flex items-center gap-3">
          <Link href="/" className="btn btn-secondary min-h-[44px] min-w-[44px] p-2" aria-label="Kembali ke dashboard">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-accent">{APP_NAME}</p>
            <h1 className="mt-0.5 font-display text-2xl font-extrabold uppercase tracking-tight text-foreground">
              Admin <span className="text-accent">Panel</span>
            </h1>
          </div>
        </div>
      </div>

      {/* Section tabs */}
      <div className="mt-5 flex items-center gap-1 rounded-xl border-2 border-border bg-surface p-1">
        {[
          { key: "user" as const, label: "User", icon: Users },
          { key: "gen" as const, label: "Gen", icon: GraduationCap },
          { key: "siswa" as const, label: "Siswa", icon: Users },
          { key: "promosi" as const, label: "Promosi", icon: GraduationCap },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveSection(tab.key)}
            className={`chip min-h-[44px] flex-1 text-xs ${activeSection === tab.key ? "chip-on" : ""}`}
          >
            <tab.icon className="h-3.5 w-3.5" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Ganti Password */}
      <div className="card mt-5 p-6 sm:p-8">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-accent" />
            <div>
              <h2 className="font-display text-sm font-bold uppercase tracking-wide text-foreground">
                Ganti Password
              </h2>
              <p className="mt-0.5 text-xs font-medium text-muted">
                Ubah password akun yang sedang login.
              </p>
            </div>
          </div>
          <button
            onClick={() => setChangePwOpen(true)}
            className="btn btn-secondary min-h-[44px] px-4 py-2 text-sm"
          >
            <KeyRound className="h-4 w-4" />
            Ganti Password
          </button>
        </div>
      </div>

      {/* Kelola User */}
      {activeSection === "user" && (
      <div className="card mt-5 p-6 sm:p-8">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-accent" />
          <h2 className="font-display text-sm font-bold uppercase tracking-wide text-foreground">
            Kelola User
          </h2>
        </div>
        <p className="mt-1 text-xs font-medium text-muted">
          Tambah, nonaktifkan, atau ubah role user yang bisa login ke sistem.
        </p>

        {/* Form tambah user */}
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_auto]">
          <input
            type="email"
            className="input"
            placeholder="email@skagara.sch.id"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
          />
          <div className="relative">
            <input
              type={showNewPassword ? "text" : "password"}
              className="input pr-10"
              placeholder="Password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAddUser();
              }}
            />
            <button
              type="button"
              onClick={() => setShowNewPassword(!showNewPassword)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-muted hover:text-accent"
            >
              {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <button
            onClick={handleAddUser}
            disabled={addingUser || !newEmail.trim() || !newPassword.trim()}
            className="btn btn-primary min-h-[44px] px-4 py-2 text-sm"
          >
            {addingUser ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <UserPlus className="h-4 w-4" />
            )}
            Tambah
          </button>
        </div>

        {/* Daftar user */}
        {usersLoading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-accent" />
          </div>
        ) : users.length === 0 ? (
          <p className="py-6 text-center text-xs font-medium text-muted">
            Belum ada user. Tambah user pertama di atas.
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th className="text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td className="font-medium text-foreground">{u.email}</td>
                    <td>
                      <button
                        onClick={() =>
                          handleChangeRole(u.id, u.role === "admin" ? "viewer" : "admin")
                        }
                        className={`badge cursor-pointer ${
                          u.role === "admin"
                            ? "border-accent/40 bg-accent/15 text-accent"
                            : "border-border bg-surface-2 text-muted"
                        }`}
                        title={`Klik untuk ubah ke ${u.role === "admin" ? "viewer" : "admin"}`}
                      >
                        {u.role === "admin" ? (
                          <Shield className="inline h-3 w-3 mr-1" />
                        ) : (
                          <Eye className="inline h-3 w-3 mr-1" />
                        )}
                        {u.role}
                      </button>
                    </td>
                    <td>
                      {u.is_active ? (
                        <span className="badge border-emerald-500/40 bg-emerald-500/15 text-emerald-600 dark:text-emerald-300">
                          Aktif
                        </span>
                      ) : (
                        <span className="badge border-danger/40 bg-danger/15 text-danger">
                          Nonaktif
                        </span>
                      )}
                    </td>
                    <td className="whitespace-nowrap text-right">
                      <div className="inline-flex items-center gap-1">
                        <button
                          onClick={() => handleToggleActive(u.id, u.is_active)}
                          className="btn btn-ghost min-h-[44px] min-w-[44px] p-2 text-muted hover:!text-accent"
                          title={u.is_active ? "Nonaktifkan" : "Aktifkan"}
                        >
                          {u.is_active ? (
                            <ShieldOff className="h-4 w-4" />
                          ) : (
                            <Shield className="h-4 w-4" />
                          )}
                        </button>
                        <button
                          onClick={() => handleDeleteUser(u.id, u.email)}
                          className="btn btn-ghost min-h-[44px] min-w-[44px] p-2 text-muted hover:!text-danger"
                          title="Hapus user"
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
      )}

      {/* Kelola Gen */}
      {activeSection === "gen" && (
      <>
      <div className="card mt-5 p-6 sm:p-8">
        <div className="flex items-center gap-2">
          <GraduationCap className="h-4 w-4 text-accent" />
          <h2 className="font-display text-sm font-bold uppercase tracking-wide text-foreground">Kelola Gen</h2>
        </div>
        <p className="mt-1 text-xs font-medium text-muted">
          Masukkan nomor gen (misal: 13). Tab sheet &quot;GEN 13&quot; akan dibuat otomatis.
        </p>
        <div className="mt-4 flex items-end gap-3">
          <div className="flex-1">
            <label htmlFor="new-gen" className="label">
              Nomor Gen
            </label>
            <input
              id="new-gen"
              type="text"
              inputMode="numeric"
              className="input"
              placeholder="13"
              value={newGen}
              onChange={(e) => setNewGen(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreate();
              }}
            />
          </div>
          <button
            onClick={handleCreate}
            disabled={submitting || !newGen.trim()}
            className="btn btn-primary min-h-[48px] px-4 py-3 text-sm"
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            Tambah
          </button>
        </div>
      </div>

      {/* Daftar Gen */}
      <div className="card mt-4 p-6 sm:p-8">
        <h2 className="font-display text-sm font-bold uppercase tracking-wide text-foreground">Daftar Gen</h2>
        <p className="mt-1 text-xs font-medium text-muted">
          Gen aktif tampil di filter &quot;Semua Gen&quot;. Gen lulus tersembunyi dari filter utama tapi data tetap tersimpan.
        </p>

        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-accent" />
          </div>
        ) : gens.length === 0 ? (
          <p className="py-6 text-center text-xs font-medium text-muted">Belum ada gen.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Gen</th>
                  <th>Status</th>
                  <th className="text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {gens.map((g) => (
                  <tr key={g.gen}>
                    <td>
                      <span className={`badge font-display font-extrabold text-sm ${getGenBadgeColor(g.gen)}`}>
                        Gen {g.gen}
                      </span>
                    </td>
                    <td>
                      {g.status === "aktif" ? (
                        <span className="badge border-emerald-500/40 bg-emerald-500/15 text-emerald-600 dark:text-emerald-300">Aktif</span>
                      ) : (
                        <span className="badge border-amber-400/40 bg-amber-400/15 text-amber-600 dark:text-amber-300">Lulus</span>
                      )}
                    </td>
                    <td className="text-right">
                      <div className="inline-flex items-center gap-1">
                        <button
                          onClick={() => handleToggleLulus(g.gen, g.status)}
                          disabled={submitting}
                          className={`btn btn-ghost min-h-[44px] px-3 py-2 text-sm ${
                            g.status === "aktif" ? "hover:!text-gold" : "hover:!text-emerald-500"
                          }`}
                        >
                          {g.status === "aktif" ? (
                            <>
                              <GraduationCap className="h-4 w-4" /> Lulus
                            </>
                          ) : (
                            <>
                              <RotateCcw className="h-4 w-4" /> Aktif
                            </>
                          )}
                        </button>
                        <button
                          onClick={() => handleDeleteGen(g.gen)}
                          disabled={submitting}
                          className="btn btn-ghost min-h-[44px] min-w-[44px] p-2 text-muted hover:!text-danger"
                          title={`Hapus Gen ${g.gen}`}
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
      </>
      )}

      {/* Kelola Siswa */}
      {activeSection === "siswa" && (
      <div className="card mt-5 p-6 sm:p-8">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-accent" />
          <h2 className="font-display text-sm font-bold uppercase tracking-wide text-foreground">Kelola Siswa</h2>
        </div>
        <p className="mt-1 text-xs font-medium text-muted">
          Kelola profil siswa per angkatan. Data ini digunakan untuk promosi kelas.
        </p>

        {/* Filter by Gen */}
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

        {/* Add new student */}
        <div className="mt-4 flex flex-wrap items-end gap-3 rounded-lg border border-border bg-surface-2 p-4">
          <div className="flex-1 min-w-[150px]">
            <label className="label">Nama Siswa</label>
            <input
              type="text"
              className="input"
              placeholder="NAMA SISWA"
              value={newStudentNama}
              onChange={(e) => setNewStudentNama(e.target.value)}
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
              className="input"
              placeholder="X TKJ 1"
              value={newStudentKelas}
              onChange={(e) => setNewStudentKelas(e.target.value)}
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
                {studentProfiles.map((p, i) => (
                  <tr key={`${p.gen}-${p.nama}`}>
                    <td className="text-muted tabular-nums">{i + 1}</td>
                    <td className="font-medium uppercase text-foreground">{p.nama}</td>
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
                      <button
                        onClick={() => handleDeleteStudent(p.nama, p.gen)}
                        disabled={submitting}
                        className="btn btn-ghost min-h-[44px] min-w-[44px] p-2 text-muted hover:!text-danger"
                        title="Hapus"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      )}

      {/* Promosi Kelas */}
      {activeSection === "promosi" && (
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
                onClick={() => {
                  setActiveSection("siswa");
                  setSelectedGenFilter(promosiGen);
                }}
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
                      <td className="font-medium uppercase text-foreground">{p.nama}</td>
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
                {promosiProfiles.filter((p) => promosiMapping[p.nama] !== p.kelas).length} siswa akan dipromosikan
              </p>
              <button
                onClick={handlePromosi}
                disabled={promosiSubmitting || promosiProfiles.filter((p) => promosiMapping[p.nama] !== p.kelas).length === 0}
                className="btn btn-primary min-h-[44px] px-4 py-2 text-sm"
              >
                {promosiSubmitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <GraduationCap className="h-4 w-4" />
                )}
                Promosi {promosiProfiles.filter((p) => promosiMapping[p.nama] !== p.kelas).length} Siswa
              </button>
            </div>
          </>
        )}
      </div>
      )}

      {/* Toast */}
      {toast && <Toast type={toast.type} message={toast.message} />}

      {/* Ganti password modal */}
      {changePwOpen && <ChangePasswordModal onClose={() => setChangePwOpen(false)} />}
    </div>
  );
}
