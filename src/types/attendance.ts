// TypeScript types for KTI SKAGARA Attendance & Cash Management

// ---- Gen (generation = intake batch) ----

export type Gen = string; // e.g. "10", "11", "12", "13", ...
export type FilterGen = Gen | "semua";

export interface GenConfig {
  gen: Gen;
  status: "aktif" | "lulus";
}

// ---- Attendance ----

export type StatusAbsen = "Hadir" | "Sakit" | "Izin" | "Alfa";

export const STATUS_ABSEN_OPTIONS: StatusAbsen[] = [
  "Hadir",
  "Sakit",
  "Izin",
  "Alfa",
];

// ---- Classes (with Roman numeral prefixes, 39 official SKAGARA classes) ----

export const SKAGARA_CLASSES = [
  // Kelas X (Angkatan 10)
  "X AKL 1",
  "X AKL 2",
  "X AKL 3",
  "X AKL 4",
  "X MPLB 1",
  "X MPLB 2",
  "X PM 1",
  "X PM 2",
  "X DKV 1",
  "X DKV 2",
  "X TJKT 1",
  "X TJKT 2",
  "X BROADFIL",
  // Kelas XI (Angkatan 11)
  "XI AK 1",
  "XI AK 2",
  "XI AK 3",
  "XI AK 4",
  "XI MP 1",
  "XI MP 2",
  "XI PM 1",
  "XI PM 2",
  "XI DKV 1",
  "XI DKV 2",
  "XI TKJ 1",
  "XI TKJ 2",
  "XI PSPT",
  // Kelas XII (Angkatan 12)
  "XII AK 1",
  "XII AK 2",
  "XII AK 3",
  "XII AK 4",
  "XII MP 1",
  "XII MP 2",
  "XII PM 1",
  "XII PM 2",
  "XII DKV 1",
  "XII DKV 2",
  "XII TKJ 1",
  "XII TKJ 2",
  "XII PSPT",
] as const;

// ---- Constants ----

export const KAS_RUTIN_DEFAULT = 2000;

export const MOCK_GENS: Gen[] = ["10", "11", "12"];

// ---- Sheet helpers ----

export const CONFIG_TAB = "CONFIG";

export function getGenTabName(gen: Gen): string {
  return `GEN ${gen}`;
}

// ---- Interfaces ----

export interface AttendanceRecord {
  tanggal: string; // DD/MM/YYYY
  nama: string;
  kelas: string; // e.g. "X AKL 1", "XI TKJ 2"
  statusAbsen: StatusAbsen;
  nominalKas: number;
  bulanTahun: string; // MM-YYYY
  rowId?: string; // stable ID (kolom Row_ID di sheet), dipakai untuk semua operasi edit/delete
}

/** Record + konteks gen asal + ID stabil. Dipakai semua halaman & komponen (pengganti pola `_rawIdx` lokal). */
export interface TaggedRecord extends AttendanceRecord {
  _gen: Gen;
  _rowId: string;
}

export interface StudentOption {
  nama: string;
  kelas: string;
}

export interface FilterState {
  gen: FilterGen;
  kelas: string; // "" means all
  bulan: string; // "" means all (format: MM-YYYY)
  tanggal: string; // "" means all (format: DD/MM/YYYY)
  status: StatusAbsen | ""; // "" means all
  search: string;
}

export interface FilterOptions {
  kelasList: string[];
  bulanList: string[];
  tanggalList: string[];
}

export interface ClassSummary {
  kelas: string;
  totalKas: number;
  totalRecords: number;
  hadirCount: number;
}

export interface DashboardStats {
  totalRecords: number;
  totalKas: number;
  hadirCount: number;
  sakitCount: number;
  izinCount: number;
  alfaCount: number;
  attendanceRate: number; // 0 - 100%
  avgKasPerStudent: number;
  classSummaries: ClassSummary[];
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}
