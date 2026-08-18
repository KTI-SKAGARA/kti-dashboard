export type JenisKegiatan =
  | "perkenalan"
  | "materi"
  | "praktek"
  | "ujian"
  | "libur"
  | "lainnya";

export const JENIS_KEGIATAN_OPTIONS: {
  value: JenisKegiatan;
  label: string;
  idle: string;
  active: string;
  dot: string;
}[] = [
  {
    value: "perkenalan",
    label: "Perkenalan",
    idle: "border-sky-400/30 bg-sky-500/5 text-sky-600 dark:text-sky-300",
    active: "border-sky-500 bg-sky-500 text-white",
    dot: "bg-sky-500",
  },
  {
    value: "materi",
    label: "Materi",
    idle: "border-blue-400/30 bg-blue-500/5 text-blue-600 dark:text-blue-300",
    active: "border-blue-500 bg-blue-500 text-white",
    dot: "bg-blue-500",
  },
  {
    value: "praktek",
    label: "Praktek",
    idle: "border-emerald-400/30 bg-emerald-500/5 text-emerald-600 dark:text-emerald-300",
    active: "border-emerald-500 bg-emerald-500 text-white",
    dot: "bg-emerald-500",
  },
  {
    value: "ujian",
    label: "Ujian",
    idle: "border-amber-400/30 bg-amber-500/5 text-amber-600 dark:text-amber-300",
    active: "border-amber-500 bg-amber-500 text-white",
    dot: "bg-amber-500",
  },
  {
    value: "libur",
    label: "Libur",
    idle: "border-zinc-400/30 bg-zinc-500/5 text-zinc-600 dark:text-zinc-300",
    active: "border-zinc-500 bg-zinc-500 text-white",
    dot: "bg-zinc-500",
  },
  {
    value: "lainnya",
    label: "Lainnya",
    idle: "border-purple-400/30 bg-purple-500/5 text-purple-600 dark:text-purple-300",
    active: "border-purple-500 bg-purple-500 text-white",
    dot: "bg-purple-500",
  },
];

export interface Kegiatan {
  id: string;
  tanggal: string; // DD/MM/YYYY
  judul: string;
  deskripsi: string;
  jenis: JenisKegiatan;
}

/**
 * Get REQUIRED meeting dates from kegiatan data.
 * Only Saturday non-libur dates count as required meetings.
 * Non-Saturday kegiatan are optional (attendance recorded but absence not penalized).
 * Returns a Set of DD/MM/YYYY strings.
 */
export function getMeetingDates(kegiatanList: Kegiatan[]): Set<string> {
  const dates = new Set<string>();
  for (const k of kegiatanList) {
    if (k.jenis === "libur") continue;
    // Parse DD/MM/YYYY to check day of week
    const [d, m, y] = k.tanggal.split("/").map(Number);
    const dayOfWeek = new Date(y, m - 1, d).getDay(); // 0=Min, 6=Sab
    if (dayOfWeek === 6) {
      dates.add(k.tanggal);
    }
  }
  return dates;
}

/**
 * Get ALL non-libur kegiatan dates (for display, not for absence calculation).
 * Includes both Saturday (required) and non-Saturday (optional) kegiatan.
 */
export function getAllKegiatanDates(kegiatanList: Kegiatan[]): Set<string> {
  const dates = new Set<string>();
  for (const k of kegiatanList) {
    if (k.jenis !== "libur") {
      dates.add(k.tanggal);
    }
  }
  return dates;
}

/**
 * Get libur (holiday) dates from kegiatan data.
 * Returns a Set of DD/MM/YYYY strings.
 */
export function getLiburDates(kegiatanList: Kegiatan[]): Set<string> {
  const dates = new Set<string>();
  for (const k of kegiatanList) {
    if (k.jenis === "libur") {
      dates.add(k.tanggal);
    }
  }
  return dates;
}
