import { createClient } from "@/lib/supabase/server";

export interface AuthResult {
  ok: boolean;
  error?: string;
  userId?: string;
  role?: string;
}

/**
 * Check if current user is authenticated and has admin or owner role.
 */
export async function requireAdmin(): Promise<AuthResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Tidak ada session aktif." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || (profile.role !== "admin" && profile.role !== "owner")) {
    return { ok: false, error: "Akses ditolak. Hanya admin." };
  }
  return { ok: true, userId: user.id, role: profile.role };
}

/**
 * Check if current user is authenticated and has owner role.
 */
export async function requireOwner(): Promise<AuthResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Tidak ada session aktif." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "owner") {
    return { ok: false, error: "Akses ditolak. Hanya owner." };
  }
  return { ok: true, userId: user.id, role: profile.role };
}

/**
 * Get current user's profile (id, email, role, is_active).
 */
export async function getProfile(): Promise<AuthResult & { email?: string; isActive?: boolean }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Tidak ada session aktif." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, is_active, email")
    .eq("id", user.id)
    .single();

  if (!profile) return { ok: false, error: "Profile tidak ditemukan." };
  return {
    ok: true,
    userId: user.id,
    role: profile.role,
    email: profile.email,
    isActive: profile.is_active,
  };
}
