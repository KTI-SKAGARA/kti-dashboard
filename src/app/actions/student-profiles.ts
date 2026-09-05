"use server";

import { createClient } from "@/lib/supabase/server";
import { requireAdmin, requireOwner } from "@/lib/supabase/auth-helpers";
import {
  fetchRecords,
  renameStudentRecordInSheet,
  moveStudentRecordsInSheet,
} from "@/lib/google-sheets";
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

/**
 * Rename a student across Google Sheets, student_profiles, and kas_payments.
 * Useful for correcting typo in student names.
 */
export async function renameStudentAction(
  oldName: string,
  newName: string,
  gen?: string,
  updateSheets = true
): Promise<ApiResponse<{ sheetsUpdated: number; profilesUpdated: number; kasUpdated: number }>> {
  const auth = await requireAdmin();
  if (!auth.ok) return { success: false, error: auth.error };

  const normOld = oldName.toUpperCase().trim();
  const normNew = newName.toUpperCase().trim();

  if (!normOld || !normNew) {
    return { success: false, error: "Nama lama dan nama baru harus diisi." };
  }
  if (normOld === normNew) {
    return { success: false, error: "Nama baru tidak boleh sama dengan nama lama." };
  }

  const supabase = await createClient();

  // 1. Check conflict: Apakah nama baru sudah ada di gen yang sama?
  let checkQuery = supabase.from("student_profiles").select("nama, gen").eq("nama", normNew);
  if (gen) {
    checkQuery = checkQuery.eq("gen", gen);
  }
  const { data: existingTarget } = await checkQuery;
  if (existingTarget && existingTarget.length > 0) {
    const conflictGen = existingTarget.map((e) => `GEN ${e.gen}`).join(", ");
    return {
      success: false,
      error: `Nama "${normNew}" sudah terdaftar di ${conflictGen}. Harap periksa kembali.`,
    };
  }

  // Update profil siswa di Supabase
  let profileQuery = supabase
    .from("student_profiles")
    .update({ nama: normNew, updated_at: new Date().toISOString() })
    .eq("nama", normOld);
  if (gen) {
    profileQuery = profileQuery.eq("gen", gen);
  }
  const { data: updatedProfiles, error: profileError } = await profileQuery.select();
  if (profileError) {
    return { success: false, error: `Gagal memperbarui profil siswa: ${profileError.message}` };
  }
  const profilesUpdated = (updatedProfiles || []).length;

  // 2. Update kas_payments di Supabase
  let kasQuery = supabase
    .from("kas_payments")
    .update({ nama: normNew })
    .eq("nama", normOld);
  if (gen) {
    kasQuery = kasQuery.eq("gen", gen);
  }
  const { data: updatedKas, error: kasError } = await kasQuery.select();
  const kasUpdated = updatedKas ? updatedKas.length : 0;
  if (kasError) {
    console.warn("Error updating kas_payments on rename:", kasError.message);
  }

  // 3. Update Google Sheets
  let sheetsUpdated = 0;
  if (updateSheets) {
    try {
      sheetsUpdated = await renameStudentRecordInSheet(normOld, normNew, gen as Gen | undefined);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.warn("Error updating sheets on rename:", errMsg);
    }
  }

  return {
    success: true,
    data: { sheetsUpdated, profilesUpdated, kasUpdated },
  };
}

/**
 * Move a student to another Gen.
 * Updates student_profiles, kas_payments, and moves Google Sheets attendance records.
 */
export async function moveStudentGenAction(
  nama: string,
  fromGen: string,
  targetGen: string,
  moveAttendanceRecords = true
): Promise<ApiResponse<{ recordsMoved: number; profileMoved: boolean; kasUpdated: number }>> {
  const auth = await requireAdmin();
  if (!auth.ok) return { success: false, error: auth.error };

  const normName = nama.toUpperCase().trim();
  if (!normName) return { success: false, error: "Nama siswa harus diisi." };
  if (!fromGen || !targetGen) return { success: false, error: "Angkatan asal dan tujuan harus dipilih." };
  if (fromGen === targetGen) return { success: false, error: "Angkatan asal dan tujuan tidak boleh sama." };

  const supabase = await createClient();

  // 1. Periksa apakah siswa sudah ada di targetGen di student_profiles
  const { data: existingInTarget } = await supabase
    .from("student_profiles")
    .select("nama")
    .eq("nama", normName)
    .eq("gen", targetGen)
    .maybeSingle();

  // Ambil profil lama untuk mendapatkan kelasnya
  const { data: oldProfile } = await supabase
    .from("student_profiles")
    .select("*")
    .eq("nama", normName)
    .eq("gen", fromGen)
    .maybeSingle();

  let profileMoved = false;
  if (oldProfile) {
    // Hapus profil di gen lama
    await supabase
      .from("student_profiles")
      .delete()
      .eq("nama", normName)
      .eq("gen", fromGen);

    // Upsert ke targetGen jika belum ada
    if (!existingInTarget) {
      await supabase.from("student_profiles").insert({
        nama: normName,
        gen: targetGen,
        kelas: oldProfile.kelas || "",
        updated_at: new Date().toISOString(),
      });
    }
    profileMoved = true;
  } else if (!existingInTarget) {
    // Profil tidak ada di gen lama, tapi kita buatkan di target gen jika belum ada
    await supabase.from("student_profiles").insert({
      nama: normName,
      gen: targetGen,
      kelas: "",
      updated_at: new Date().toISOString(),
    });
    profileMoved = true;
  }

  // 2. Update Supabase kas_payments
  const { data: updatedKas, error: kasError } = await supabase
    .from("kas_payments")
    .update({ gen: targetGen })
    .eq("nama", normName)
    .eq("gen", fromGen)
    .select();

  const kasUpdated = updatedKas ? updatedKas.length : 0;
  if (kasError) {
    console.warn("Error updating kas_payments on gen move:", kasError.message);
  }

  // 3. Move Google Sheets attendance records
  let recordsMoved = 0;
  if (moveAttendanceRecords) {
    try {
      recordsMoved = await moveStudentRecordsInSheet(
        normName,
        fromGen as Gen,
        targetGen as Gen
      );
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.warn("Error moving sheets records on gen move:", errMsg);
    }
  }

  return {
    success: true,
    data: { recordsMoved, profileMoved, kasUpdated },
  };
}

