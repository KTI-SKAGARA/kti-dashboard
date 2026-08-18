"use server";

import { createClient } from "@/lib/supabase/server";
import { type Kegiatan, type JenisKegiatan } from "@/types/kegiatan";

// ---------------------------------------------------------------------------
// Get all kegiatan
// ---------------------------------------------------------------------------

export async function getKegiatan(): Promise<Kegiatan[]> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("kegiatan")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Gagal mengambil kegiatan:", error);
      return [];
    }

    return (data || []) as Kegiatan[];
  } catch (error) {
    console.error("Gagal mengambil kegiatan:", error);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Add kegiatan
// ---------------------------------------------------------------------------

export async function addKegiatan(
  tanggal: string,
  judul: string,
  deskripsi: string,
  jenis: JenisKegiatan
): Promise<{ success: boolean; error?: string; data?: Kegiatan }> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("kegiatan")
      .insert({ tanggal, judul, deskripsi, jenis })
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data: data as Kegiatan };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Gagal menambah kegiatan.",
    };
  }
}

// ---------------------------------------------------------------------------
// Update kegiatan
// ---------------------------------------------------------------------------

export async function updateKegiatan(
  id: string,
  tanggal: string,
  judul: string,
  deskripsi: string,
  jenis: JenisKegiatan
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    const { error } = await supabase
      .from("kegiatan")
      .update({ tanggal, judul, deskripsi, jenis })
      .eq("id", id);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Gagal mengubah kegiatan.",
    };
  }
}

// ---------------------------------------------------------------------------
// Delete kegiatan
// ---------------------------------------------------------------------------

export async function deleteKegiatan(
  id: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    const { error } = await supabase.from("kegiatan").delete().eq("id", id);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Gagal menghapus kegiatan.",
    };
  }
}
