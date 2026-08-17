"use server";

import {
  type Gen,
  type GenConfig,
  type AttendanceRecord,
  type TaggedRecord,
  type StatusAbsen,
  type FilterOptions,
  type DashboardStats,
  type StudentOption,
  type ApiResponse,
  STATUS_ABSEN_OPTIONS,
} from "@/types/attendance";
import {
  fetchRecords,
  queryRecords,
  appendRecord,
  appendRecords,
  deleteRecord,
  deleteRecordsBatch,
  updateRecord,
  moveRecordsBatch,
  getGenConfig,
  ensureGenTab,
  markGenLulus,
  isGoogleSheetsConfigured,
} from "@/lib/google-sheets";
import { getBulanTahunFromDate, normalizeKelas, normalizeName } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Read: status konfigurasi aplikasi (mock mode indicator, PRD §4.7)
// ---------------------------------------------------------------------------

export async function getAppConfig(): Promise<
  ApiResponse<{ mockMode: boolean }>
> {
  try {
    return { success: true, data: { mockMode: !isGoogleSheetsConfigured() } };
  } catch {
    return { success: true, data: { mockMode: true } };
  }
}

// ---------------------------------------------------------------------------
// Read: get gen list
// ---------------------------------------------------------------------------

export async function getGenList(): Promise<ApiResponse<GenConfig[]>> {
  try {
    const config = await getGenConfig();
    return { success: true, data: config };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Gagal mengambil daftar gen.",
    };
  }
}

// ---------------------------------------------------------------------------
// Read: get all records for a gen
// ---------------------------------------------------------------------------

export async function getAttendanceRecords(
  gen: Gen
): Promise<ApiResponse<AttendanceRecord[]>> {
  try {
    const records = await fetchRecords(gen);
    return { success: true, data: records };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Gagal mengambil data.",
    };
  }
}

// ---------------------------------------------------------------------------
// Read: query + pagination lintas gen (PRD P2-6)
// Hanya satu halaman yang dikirim ke client; filter/sort di data layer.
// ---------------------------------------------------------------------------

export async function getAttendanceRecordsPage(
  gen: Gen | "semua",
  page: number,
  pageSize: number,
  query?: {
    kelas?: string;
    bulan?: string;
    tanggal?: string;
    status?: StatusAbsen;
    search?: string;
  }
): Promise<ApiResponse<{ records: TaggedRecord[]; total: number }>> {
  try {
    let gens: Gen[];
    if (gen === "semua") {
      const config = await getGenConfig();
      gens = config.filter((g) => g.status === "aktif").map((g) => g.gen);
    } else {
      gens = [gen];
    }

    if (gens.length === 0) {
      return { success: true, data: { records: [], total: 0 } };
    }

    const safePage = Math.max(1, Math.floor(page) || 1);
    const safePageSize = Math.max(1, Math.min(500, Math.floor(pageSize) || 20));

    const { records, total } = await queryRecords(gens, query || {}, safePage, safePageSize);

    const tagged: TaggedRecord[] = records.map((r) => ({
      ...r,
      _gen: r._gen,
      _rowId: r.rowId || `tmp-${r._gen}-${r.tanggal}-${r.nama}`,
    }));

    return { success: true, data: { records: tagged, total } };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Gagal mengambil data.",
    };
  }
}

// ---------------------------------------------------------------------------
// Read: get unique student list (in UPPERCASE)
// ---------------------------------------------------------------------------

export async function getExistingStudents(
  gen: Gen
): Promise<ApiResponse<StudentOption[]>> {
  try {
    const records = await fetchRecords(gen);
    const studentMap = new Map<string, string>(); // nama -> kelas

    for (const r of records) {
      const upperName = normalizeName(r.nama || "");
      if (upperName && !studentMap.has(upperName)) {
        studentMap.set(upperName, r.kelas);
      }
    }

    const students: StudentOption[] = Array.from(studentMap.entries())
      .map(([nama, kelas]) => ({ nama, kelas }))
      .sort((a, b) => a.nama.localeCompare(b.nama, "id"));

    return { success: true, data: students };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Gagal mengambil daftar siswa.",
    };
  }
}

// ---------------------------------------------------------------------------
// Read: get available filter options (classes & months)
// ---------------------------------------------------------------------------

export async function getFilterOptions(
  gen: Gen
): Promise<ApiResponse<FilterOptions>> {
  try {
    const records = await fetchRecords(gen);

    const kelasSet = new Set<string>();
    const bulanSet = new Set<string>();
    const tanggalSet = new Set<string>();

    for (const r of records) {
      if (r.kelas) kelasSet.add(r.kelas);
      if (r.bulanTahun) bulanSet.add(r.bulanTahun);
      if (r.tanggal) tanggalSet.add(r.tanggal);
    }

    const kelasList = Array.from(kelasSet).sort((a, b) =>
      a.localeCompare(b, "id")
    );

    const bulanList = Array.from(bulanSet).sort((a, b) => {
      const [am, ay] = a.split("-").map(Number);
      const [bm, by] = b.split("-").map(Number);
      return ay !== by ? ay - by : am - bm;
    });

    const tanggalList = Array.from(tanggalSet).sort((a, b) => {
      const [ad, am, ay] = a.split("/").map(Number);
      const [bd, bm, by] = b.split("/").map(Number);
      if (ay !== by) return ay - by;
      if (am !== bm) return am - bm;
      return ad - bd;
    });

    return { success: true, data: { kelasList, bulanList, tanggalList } };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Gagal mengambil opsi filter.",
    };
  }
}

// ---------------------------------------------------------------------------
// Read: get classes available for a specific gen from sheet data
// ---------------------------------------------------------------------------

export async function getGenClasses(
  gen: Gen
): Promise<ApiResponse<string[]>> {
  try {
    const records = await fetchRecords(gen);
    const classSet = new Set<string>();

    for (const r of records) {
      if (r.kelas) classSet.add(r.kelas);
    }

    return {
      success: true,
      data: Array.from(classSet).sort((a, b) => a.localeCompare(b, "id")),
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Gagal mengambil data kelas.",
    };
  }
}

// ---------------------------------------------------------------------------
// Read: compute rich dashboard statistics & class summaries
// ---------------------------------------------------------------------------

export async function getDashboardStats(
  records: AttendanceRecord[]
): Promise<DashboardStats> {
  const stats: DashboardStats = {
    totalRecords: records.length,
    totalKas: 0,
    hadirCount: 0,
    sakitCount: 0,
    izinCount: 0,
    alfaCount: 0,
    attendanceRate: 0,
    avgKasPerStudent: 0,
    classSummaries: [],
  };

  const classMap = new Map<string, { totalKas: number; totalRecords: number; hadirCount: number }>();

  for (const r of records) {
    stats.totalKas += r.nominalKas;
    switch (r.statusAbsen) {
      case "Hadir":
        stats.hadirCount++;
        break;
      case "Sakit":
        stats.sakitCount++;
        break;
      case "Izin":
        stats.izinCount++;
        break;
      case "Alfa":
        stats.alfaCount++;
        break;
    }

    if (r.kelas) {
      const current = classMap.get(r.kelas) || { totalKas: 0, totalRecords: 0, hadirCount: 0 };
      current.totalKas += r.nominalKas;
      current.totalRecords += 1;
      if (r.statusAbsen === "Hadir") current.hadirCount += 1;
      classMap.set(r.kelas, current);
    }
  }

  if (stats.totalRecords > 0) {
    stats.attendanceRate = Math.round((stats.hadirCount / stats.totalRecords) * 1000) / 10;
    stats.avgKasPerStudent = Math.round(stats.totalKas / stats.totalRecords);
  }

  stats.classSummaries = Array.from(classMap.entries())
    .map(([kelas, summary]) => ({
      kelas,
      totalKas: summary.totalKas,
      totalRecords: summary.totalRecords,
      hadirCount: summary.hadirCount,
    }))
    .sort((a, b) => a.kelas.localeCompare(b.kelas, "id"));

  return stats;
}

// ---------------------------------------------------------------------------
// Write: submit a new attendance record
// ---------------------------------------------------------------------------

export async function submitAttendanceRecord(formData: {
  gen: Gen;
  kelas: string;
  nama: string;
  tanggal: string; // DD/MM/YYYY
  statusAbsen: StatusAbsen;
  nominalKas: number;
}): Promise<ApiResponse> {
  try {
    const formattedNama = formData.nama ? normalizeName(formData.nama) : "";

    if (!formattedNama) {
      return { success: false, error: "Nama siswa wajib diisi." };
    }
    if (!formData.kelas || formData.kelas.trim().length === 0) {
      return { success: false, error: "Kelas wajib diisi." };
    }
    if (!formData.tanggal || !/^\d{2}\/\d{2}\/\d{4}$/.test(formData.tanggal)) {
      return { success: false, error: "Format tanggal tidak valid (DD/MM/YYYY)." };
    }
    if (!STATUS_ABSEN_OPTIONS.includes(formData.statusAbsen)) {
      return { success: false, error: "Status absen tidak valid." };
    }
    if (
      formData.nominalKas < 0 ||
      isNaN(formData.nominalKas) ||
      !Number.isFinite(formData.nominalKas)
    ) {
      return {
        success: false,
        error: "Nominal kas harus berupa angka positif atau 0.",
      };
    }

    const record: AttendanceRecord = {
      tanggal: formData.tanggal,
      nama: formattedNama,
      kelas: normalizeKelas(formData.kelas),
      statusAbsen: formData.statusAbsen,
      nominalKas: formData.nominalKas,
      bulanTahun: getBulanTahunFromDate(formData.tanggal),
    };

    await appendRecord(formData.gen, record);

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Gagal menyimpan data.",
    };
  }
}

// ---------------------------------------------------------------------------
// Write: bulk submit attendance records (Mode Cepat)
// ---------------------------------------------------------------------------

export async function submitBulkAttendance(
  gen: Gen,
  kelas: string,
  tanggal: string, // DD/MM/YYYY
  entries: { nama: string; statusAbsen: StatusAbsen; nominalKas: number }[]
): Promise<ApiResponse<{ saved: number }>> {
  try {
    if (!kelas || kelas.trim().length === 0) {
      return { success: false, error: "Kelas wajib diisi." };
    }
    if (!tanggal || !/^\d{2}\/\d{2}\/\d{4}$/.test(tanggal)) {
      return { success: false, error: "Format tanggal tidak valid (DD/MM/YYYY)." };
    }
    if (!entries || entries.length === 0) {
      return { success: false, error: "Tidak ada data yang dipilih." };
    }

    const bulanTahun = getBulanTahunFromDate(tanggal);
    const records: AttendanceRecord[] = entries.map((e) => ({
      tanggal,
      nama: normalizeName(e.nama),
      kelas: normalizeKelas(kelas),
      statusAbsen: e.statusAbsen,
      nominalKas: e.nominalKas,
      bulanTahun,
    }));

    await appendRecords(gen, records);

    return { success: true, data: { saved: records.length } };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Gagal menyimpan data.",
    };
  }
}

// ---------------------------------------------------------------------------
// Delete: delete an attendance record by stable row ID
// ---------------------------------------------------------------------------

export async function deleteAttendanceRecord(
  gen: Gen,
  rowId: string
): Promise<ApiResponse> {
  try {
    if (!rowId) {
      return { success: false, error: "ID data tidak valid." };
    }
    await deleteRecord(gen, rowId);
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Gagal menghapus data.",
    };
  }
}

// ---------------------------------------------------------------------------
// Delete: batch delete attendance records by stable row IDs
// ---------------------------------------------------------------------------

export async function deleteBatchAttendanceRecords(
  gen: Gen,
  rowIds: string[]
): Promise<ApiResponse> {
  try {
    if (!rowIds || rowIds.length === 0) {
      return { success: false, error: "Tidak ada data yang dipilih." };
    }
    await deleteRecordsBatch(gen, rowIds);
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Gagal menghapus data.",
    };
  }
}

// ---------------------------------------------------------------------------
// Update: update an attendance record by stable row ID (supports moving Gen & changing date)
// ---------------------------------------------------------------------------

export async function updateAttendanceRecord(
  gen: Gen,
  rowId: string,
  data: {
    nama?: string;
    kelas?: string;
    statusAbsen?: StatusAbsen;
    nominalKas?: number;
    tanggal?: string;
    targetGen?: Gen;
  }
): Promise<ApiResponse> {
  try {
    if (!rowId) {
      return { success: false, error: "ID data tidak valid." };
    }
    if (data.nama !== undefined && !data.nama.trim()) {
      return { success: false, error: "Nama siswa tidak boleh kosong." };
    }
    if (data.kelas !== undefined && !data.kelas.trim()) {
      return { success: false, error: "Kelas tidak boleh kosong." };
    }
    if (data.tanggal !== undefined && !/^\d{2}\/\d{2}\/\d{4}$/.test(data.tanggal)) {
      return { success: false, error: "Format tanggal tidak valid (DD/MM/YYYY)." };
    }
    if (data.statusAbsen !== undefined && !STATUS_ABSEN_OPTIONS.includes(data.statusAbsen)) {
      return { success: false, error: "Status absen tidak valid." };
    }
    if (
      data.nominalKas !== undefined &&
      (data.nominalKas < 0 || isNaN(data.nominalKas) || !Number.isFinite(data.nominalKas))
    ) {
      return { success: false, error: "Nominal kas harus berupa angka ≥ 0." };
    }

    const cleanData = { ...data };
    if (cleanData.kelas !== undefined) cleanData.kelas = normalizeKelas(cleanData.kelas);
    if (cleanData.nama !== undefined) cleanData.nama = normalizeName(cleanData.nama);

    await updateRecord(gen, rowId, cleanData);
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Gagal mengupdate data.",
    };
  }
}

// ---------------------------------------------------------------------------
// Move: batch move attendance records to another Gen (by stable row IDs)
// ---------------------------------------------------------------------------

export async function moveBatchAttendanceRecords(
  fromGen: Gen,
  rowIds: string[],
  targetGen: Gen
): Promise<ApiResponse<{ moved: number }>> {
  try {
    if (!targetGen) {
      return { success: false, error: "Target Gen harus dipilih." };
    }
    if (fromGen === targetGen) {
      return { success: false, error: "Target Gen harus berbeda dari Gen asal." };
    }
    if (!rowIds || rowIds.length === 0) {
      return { success: false, error: "Tidak ada catatan yang dipilih untuk dipindahkan." };
    }

    await moveRecordsBatch(fromGen, rowIds, targetGen);
    return { success: true, data: { moved: rowIds.length } };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Gagal memindahkan data ke Gen baru.",
    };
  }
}

// ---------------------------------------------------------------------------
// Admin: create new gen
// ---------------------------------------------------------------------------

export async function createGen(gen: string): Promise<ApiResponse> {
  try {
    if (!/^\d{1,2}$/.test(gen)) {
      return { success: false, error: "Format gen tidak valid. Masukkan angka 1-99." };
    }

    const config = await getGenConfig();
    if (config.find((c) => c.gen === gen)) {
      return { success: false, error: `Gen ${gen} sudah ada.` };
    }

    await ensureGenTab(gen);

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Gagal membuat gen baru.",
    };
  }
}

// ---------------------------------------------------------------------------
// Admin: toggle gen status (lulus/aktif)
// ---------------------------------------------------------------------------

export async function toggleGenStatus(
  gen: Gen,
  lulus: boolean
): Promise<ApiResponse> {
  try {
    await markGenLulus(gen, lulus);
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Gagal mengubah status gen.",
    };
  }
}
