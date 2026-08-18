"use server";

import { createClient } from "@/lib/supabase/server";
import { requireAdmin, requireOwner } from "@/lib/supabase/auth-helpers";
import { fetchRecords } from "@/lib/google-sheets";
import type { ApiResponse, Gen, StudentProfile } from "@/types/attendance";

/**
 * Fetch all student profiles, optionally filtered by gen.
 */
export async function getStudentProfiles(gen?: string): Promise<ApiResponse<StudentProfile[]>> {
  const auth = await requireAdmin();
  if (!auth.ok) return { success: false, error: auth.error };

  const supabase = await createClient();
  let query = supabase
    .from("student_profiles")
    .select("*")
    .order("gen", { ascending: true })
    .order("kelas", { ascending: true })
    .order("nama", { ascending: true });

  if (gen) {
    query = query.eq("gen", gen);
  }

  const { data, error } = await query;

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, data: (data || []) as StudentProfile[] };
}

/**
 * Create or update a student profile (upsert on nama+gen).
 */
export async function upsertStudentProfile(
  nama: string,
  gen: string,
  kelas: string
): Promise<ApiResponse<StudentProfile>> {
  const auth = await requireAdmin();
  if (!auth.ok) return { success: false, error: auth.error };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("student_profiles")
    .upsert(
      { nama: nama.toUpperCase().trim(), gen, kelas: kelas.toUpperCase().trim() },
      { onConflict: "nama,gen" }
    )
    .select()
    .single();

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, data: data as StudentProfile };
}

/**
 * Bulk import student profiles from existing attendance records.
 * Creates profiles for students who don't have one yet (latest kelas per student).
 */
export async function bulkImportFromRecords(gen: string): Promise<ApiResponse<{ imported: number; skipped: number }>> {
  const auth = await requireAdmin();
  if (!auth.ok) return { success: false, error: auth.error };

  const supabase = await createClient();

  // Existing profiles untuk gen ini
  const { data: existingProfiles, error: existingError } = await supabase
    .from("student_profiles")
    .select("nama")
    .eq("gen", gen);

  if (existingError) {
    return { success: false, error: existingError.message };
  }

  const existingNames = new Set((existingProfiles || []).map((p) => p.nama));

  // Ambil records dari Google Sheets untuk gen ini
  const records = await fetchRecords(gen as Gen);
  if (records.length === 0) {
    return { success: true, data: { imported: 0, skipped: existingNames.size } };
  }

  // Kelas terbaru per siswa (berdasarkan tanggal terakhir presensi)
  const latestKelas = new Map<string, { kelas: string; date: string }>();
  for (const r of records) {
    const nama = r.nama?.toUpperCase().trim();
    if (!nama) continue;
    const cur = latestKelas.get(nama);
    if (!cur || (r.tanggal || "").localeCompare(cur.date) > 0) {
      latestKelas.set(nama, { kelas: r.kelas || "", date: r.tanggal || "" });
    }
  }

  const toInsert: Array<{ nama: string; gen: string; kelas: string }> = [];
  for (const [nama, { kelas }] of latestKelas) {
    if (!kelas || existingNames.has(nama)) continue;
    toInsert.push({ nama, gen, kelas });
  }

  if (toInsert.length === 0) {
    return { success: true, data: { imported: 0, skipped: existingNames.size } };
  }

  const { error: insertError } = await supabase
    .from("student_profiles")
    .upsert(toInsert, { onConflict: "nama,gen" });

  if (insertError) {
    return { success: false, error: insertError.message };
  }

  return {
    success: true,
    data: { imported: toInsert.length, skipped: existingNames.size },
  };
}

/**
 * Update a student's class.
 */
export async function updateStudentClass(
  nama: string,
  gen: string,
  kelasBaru: string
): Promise<ApiResponse<StudentProfile>> {
  const auth = await requireAdmin();
  if (!auth.ok) return { success: false, error: auth.error };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("student_profiles")
    .update({ kelas: kelasBaru.toUpperCase().trim(), updated_at: new Date().toISOString() })
    .eq("nama", nama.toUpperCase().trim())
    .eq("gen", gen)
    .select()
    .single();

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, data: data as StudentProfile };
}

/**
 * Delete a student profile.
 */
export async function deleteStudentProfile(
  nama: string,
  gen: string
): Promise<ApiResponse<void>> {
  const auth = await requireAdmin();
  if (!auth.ok) return { success: false, error: auth.error };

  const supabase = await createClient();
  const { error } = await supabase
    .from("student_profiles")
    .delete()
    .eq("nama", nama.toUpperCase().trim())
    .eq("gen", gen);

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * Promote all students in a gen to new classes (bulk update).
 * Owner only.
 */
export async function promoteGen(
  gen: string,
  mapping: Array<{ nama: string; kelasBaru: string }>
): Promise<ApiResponse<{ updated: number }>> {
  const auth = await requireOwner();
  if (!auth.ok) return { success: false, error: auth.error };

  const supabase = await createClient();
  let updated = 0;

  for (const item of mapping) {
    const { error } = await supabase
      .from("student_profiles")
      .update({ kelas: item.kelasBaru.toUpperCase().trim(), updated_at: new Date().toISOString() })
      .eq("nama", item.nama.toUpperCase().trim())
      .eq("gen", gen);

    if (!error) updated++;
  }

  return { success: true, data: { updated } };
}
