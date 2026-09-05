"use client";

import { useState, useEffect, useCallback } from "react";
import {
  listUsers,
  addUser,
  toggleUserActive,
  changeUserRole,
  deleteUser,
} from "@/app/actions/auth";
import { TOAST_DURATION } from "@/lib/constants";
import {
  Loader2,
  Users,
  Shield,
  ShieldOff,
  Trash2,
  UserPlus,
  Eye,
  EyeOff,
} from "lucide-react";

interface UserEntry {
  id: string;
  email: string;
  role: string;
  is_active: boolean;
  created_at: string;
}

interface UserManagementProps {
  showToast: (type: "success" | "error", message: string) => void;
}

export default function UserManagement({ showToast }: UserManagementProps) {
  const [users, setUsers] = useState<UserEntry[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [addingUser, setAddingUser] = useState(false);

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
    loadUsers();
  }, [loadUsers]);

  const handleAddUser = async () => {
    if (!newEmail.trim() || !newPassword.trim()) {
      showToast("error", "Email dan password wajib diisi.");
      return;
    }

    setAddingUser(true);
    const res = await addUser(newEmail, newPassword);
    setAddingUser(false);

    if (res.success) {
      showToast("success", `User ${newEmail} berhasil ditambahkan!`);
      setNewEmail("");
      setNewPassword("");
      loadUsers();
    } else {
      showToast("error", res.error ?? "Gagal menambah user.");
    }
  };

  const handleToggleActive = async (userId: string, currentActive: boolean) => {
    const res = await toggleUserActive(userId, !currentActive);
    if (res.success) {
      showToast("success", `User ${currentActive ? "dinonaktifkan" : "diaktifkan"}.`);
      loadUsers();
    } else {
      showToast("error", res.error ?? "Gagal mengubah status.");
    }
  };

  const handleChangeRole = async (userId: string, newRole: "admin" | "viewer") => {
    const res = await changeUserRole(userId, newRole);
    if (res.success) {
      showToast("success", `Role diubah ke ${newRole}.`);
      loadUsers();
    } else {
      showToast("error", res.error ?? "Gagal mengubah role.");
    }
  };

  const handleDeleteUser = async (userId: string, email: string) => {
    if (!confirm(`Hapus user "${email}"? Tindakan ini tidak dapat dibatalkan.`)) return;
    const res = await deleteUser(userId);
    if (res.success) {
      showToast("success", `User ${email} berhasil dihapus.`);
      loadUsers();
    } else {
      showToast("error", res.error ?? "Gagal menghapus user.");
    }
  };

  return (
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
  );
}
