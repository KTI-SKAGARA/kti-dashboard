"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// ---------------------------------------------------------------------------
// Login: email + password via Supabase Auth
// ---------------------------------------------------------------------------

export async function loginAdmin(
  email: string,
  password: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) {
      return {
        success: false,
        error:
          error.message === "Invalid login credentials"
            ? "Email atau password salah."
            : error.message,
      };
    }

    // Cek apakah user aktif di profiles
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("is_active")
      .eq("id", data.user.id)
      .single();

    if (profileError || !profile?.is_active) {
      // Logout paksa kalau tidak aktif
      await supabase.auth.signOut();
      return {
        success: false,
        error: "Akun tidak aktif. Hubungi admin.",
      };
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Gagal login.",
    };
  }
}

// ---------------------------------------------------------------------------
// Logout
// ---------------------------------------------------------------------------

export async function logoutAdmin(): Promise<{ success: boolean }> {
  try {
    const supabase = await createClient();
    await supabase.auth.signOut();
    return { success: true };
  } catch {
    return { success: true };
  }
}

// ---------------------------------------------------------------------------
// Check auth status
// ---------------------------------------------------------------------------

export async function checkAuth(): Promise<boolean> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return !!user;
}

// ---------------------------------------------------------------------------
// Get current user profile
// ---------------------------------------------------------------------------

export async function getCurrentUser(): Promise<{
  email: string;
  role: string;
} | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("email, role")
    .eq("id", user.id)
    .single();

  return profile || null;
}

// ---------------------------------------------------------------------------
// Admin: list all users
// ---------------------------------------------------------------------------

export async function listUsers(): Promise<
  {
    id: string;
    email: string;
    role: string;
    is_active: boolean;
    created_at: string;
  }[]
> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Gagal mengambil daftar user:", error);
    return [];
  }

  return data || [];
}

// ---------------------------------------------------------------------------
// Admin: add user (create auth + profile)
// ---------------------------------------------------------------------------

export async function addUser(
  email: string,
  password: string,
  role: "admin" | "viewer" = "admin"
): Promise<{ success: boolean; error?: string }> {
  try {
    const admin = createAdminClient();

    // 1. Cek apakah email sudah ada
    const { data: existing } = await admin
      .from("profiles")
      .select("id")
      .eq("email", email.trim())
      .single();

    if (existing) {
      return { success: false, error: "Email sudah terdaftar." };
    }

    // 2. Buat user di Supabase Auth
    const { data: authData, error: authError } =
      await admin.auth.admin.createUser({
        email: email.trim(),
        password,
        email_confirm: true, // langsung aktif, tidak perlu verifikasi
      });

    if (authError) {
      return {
        success: false,
        error: authError.message || "Gagal membuat user.",
      };
    }

    // 3. Update profile dengan role
    if (authData.user) {
      await admin
        .from("profiles")
        .update({ role, is_active: true })
        .eq("id", authData.user.id);
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Gagal menambah user.",
    };
  }
}

// ---------------------------------------------------------------------------
// Admin: toggle user active status
// ---------------------------------------------------------------------------

export async function toggleUserActive(
  userId: string,
  isActive: boolean
): Promise<{ success: boolean; error?: string }> {
  try {
    const admin = createAdminClient();
    const { error } = await admin
      .from("profiles")
      .update({ is_active: isActive })
      .eq("id", userId);

    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Gagal mengubah status user.",
    };
  }
}

// ---------------------------------------------------------------------------
// Admin: change user role
// ---------------------------------------------------------------------------

export async function changeUserRole(
  userId: string,
  role: "admin" | "viewer"
): Promise<{ success: boolean; error?: string }> {
  try {
    const admin = createAdminClient();
    const { error } = await admin
      .from("profiles")
      .update({ role })
      .eq("id", userId);

    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Gagal mengubah role user.",
    };
  }
}

// ---------------------------------------------------------------------------
// User: change own password
// ---------------------------------------------------------------------------

export async function changePassword(
  currentPassword: string,
  newPassword: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();

    // Verifikasi password lama dulu
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user?.email) {
      return { success: false, error: "Tidak ada session aktif." };
    }

    const { error: verifyError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: currentPassword,
    });

    if (verifyError) {
      return { success: false, error: "Password lama salah." };
    }

    // Update password baru
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Gagal mengubah password.",
    };
  }
}

// ---------------------------------------------------------------------------
// Admin: delete user
// ---------------------------------------------------------------------------

export async function deleteUser(
  userId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const admin = createAdminClient();

    // Hapus dari Supabase Auth (otomatis cascade ke profiles via FK)
    const { error } = await admin.auth.admin.deleteUser(userId);

    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Gagal menghapus user.",
    };
  }
}
