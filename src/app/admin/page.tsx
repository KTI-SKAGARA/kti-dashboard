"use client";

import { useState, useEffect, useCallback } from "react";
import type { GenConfig } from "@/types/attendance";
import {
  getGenList,
  createGen,
  toggleGenStatus,
} from "@/app/actions/attendance";
import {
  listUsers,
  addUser,
  toggleUserActive,
  changeUserRole,
  deleteUser,
} from "@/app/actions/auth";
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
} from "lucide-react";
import Link from "next/link";
import Toast from "@/components/Toast";
import { getGenBadgeColor } from "@/lib/utils";

interface UserEntry {
  id: string;
  email: string;
  role: string;
  is_active: boolean;
  created_at: string;
}

export default function AdminPage() {
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

  useEffect(() => {
    loadGens(); // eslint-disable-line react-hooks/set-state-in-effect
    loadUsers();
  }, [loadGens, loadUsers]);

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

      {/* Kelola User */}
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

      {/* Tambah Gen */}
      <div className="card mt-4 p-6 sm:p-8">
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
                      <button
                        onClick={() => handleToggleLulus(g.gen, g.status)}
                        disabled={submitting}
                        className={`btn btn-ghost min-h-[44px] px-3 py-2 text-sm ${
                          g.status === "aktif" ? "hover:!text-gold" : "hover:!text-emerald-500"
                        }`}
                      >
                        {g.status === "aktif" ? (
                          <>
                            <GraduationCap className="h-4 w-4" /> Tandai Lulus
                          </>
                        ) : (
                          <>
                            <RotateCcw className="h-4 w-4" /> Aktifkan
                          </>
                        )}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Toast */}
      {toast && <Toast type={toast.type} message={toast.message} />}
    </div>
  );
}
