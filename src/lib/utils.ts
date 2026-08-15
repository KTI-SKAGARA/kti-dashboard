import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format a number as Indonesian Rupiah currency.
 * e.g. 5000 -> "Rp 5.000"
 */
export function formatRupiah(amount: number): string {
  return `Rp ${amount.toLocaleString("id-ID")}`;
}

/**
 * Get today's date formatted as DD/MM/YYYY.
 */
export function getTodayFormatted(): string {
  const now = new Date();
  const day = String(now.getDate()).padStart(2, "0");
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const year = now.getFullYear();
  return `${day}/${month}/${year}`;
}

/**
 * Get today's date as ISO string YYYY-MM-DD (for <input type="date">).
 */
export function getTodayISO(): string {
  const now = new Date();
  const day = String(now.getDate()).padStart(2, "0");
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const year = now.getFullYear();
  return `${year}-${month}-${day}`;
}

/**
 * Convert ISO date YYYY-MM-DD to DD/MM/YYYY.
 */
export function parseISOTanggal(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

/**
 * Derive bulanTahun (MM-YYYY) from a DD/MM/YYYY date string.
 */
export function getBulanTahunFromDate(tanggal: string): string {
  const parts = tanggal.split("/");
  if (parts.length === 3) {
    return `${parts[1]}-${parts[2]}`;
  }
  return getCurrentBulanTahun();
}

/**
 * Get current month-year formatted as MM-YYYY.
 */
export function getCurrentBulanTahun(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const year = now.getFullYear();
  return `${month}-${year}`;
}

/**
 * Normalize a student name: trim whitespace and convert to uppercase.
 */
export function normalizeName(nama: string): string {
  return nama.trim().toUpperCase();
}

/**
 * Mask a full name for display on public-facing pages (privacy).
 * e.g. "MUHAMMAD RIZKY PRATAMA" -> "MUHAMMAD P." / "AHMAD" -> "A***"
 */
export function maskNama(nama: string): string {
  const parts = normalizeName(nama).split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "—";
  if (parts.length === 1) {
    return parts[0].length > 2 ? `${parts[0][0]}***` : parts[0];
  }
  const first = parts[0];
  const lastInitial = parts[parts.length - 1][0];
  return `${first} ${lastInitial}.`;
}

/**
 * Convert MM-YYYY to a human-readable month name in Indonesian.
 * e.g. "07-2026" -> "Juli 2026"
 */
export function formatBulanTahun(bulanTahun: string): string {
  const months = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember",
  ];
  const [month, year] = bulanTahun.split("-");
  const monthIndex = parseInt(month, 10) - 1;
  if (monthIndex >= 0 && monthIndex < 12) {
    return `${months[monthIndex]} ${year}`;
  }
  return bulanTahun;
}

/**
 * Format DD/MM/YYYY to Indonesian readable date.
 * e.g. "15/08/2026" -> "15 Agustus 2026"
 */
export function formatTanggalIndo(tanggal: string, short = false): string {
  const parts = tanggal.split("/");
  if (parts.length !== 3) return tanggal;
  const [d, m, y] = parts;
  const monthNames = short
    ? ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"]
    : [
        "Januari", "Februari", "Maret", "April", "Mei", "Juni",
        "Juli", "Agustus", "September", "Oktober", "November", "Desember",
      ];
  const mIdx = parseInt(m, 10) - 1;
  if (mIdx >= 0 && mIdx < 12) {
    return `${parseInt(d, 10)} ${monthNames[mIdx]} ${y}`;
  }
  return tanggal;
}

/**
 * Convert DD/MM/YYYY to ISO date YYYY-MM-DD (for <input type="date">).
 */
export function formatTanggalToISO(tanggal: string): string {
  const parts = tanggal.split("/");
  if (parts.length !== 3) return "";
  const [d, m, y] = parts;
  return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

/**
 * Distinct badge color theme per Generation/Angkatan.
 */
const GEN_COLOR_PALETTES = [
  {
    gen: "10",
    badge: "border-sky-500/40 bg-sky-500/15 text-sky-700 dark:text-sky-300",
    cardSelected: "border-sky-500 bg-sky-500/10 text-sky-700 dark:text-sky-300 ring-2 ring-sky-500/20",
    dot: "bg-sky-500",
  },
  {
    gen: "11",
    badge: "border-purple-500/40 bg-purple-500/15 text-purple-700 dark:text-purple-300",
    cardSelected: "border-purple-500 bg-purple-500/10 text-purple-700 dark:text-purple-300 ring-2 ring-purple-500/20",
    dot: "bg-purple-500",
  },
  {
    gen: "12",
    badge: "border-emerald-500/40 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
    cardSelected: "border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 ring-2 ring-emerald-500/20",
    dot: "bg-emerald-500",
  },
  {
    gen: "13",
    badge: "border-amber-500/40 bg-amber-500/15 text-amber-700 dark:text-amber-300",
    cardSelected: "border-amber-500 bg-amber-500/10 text-amber-700 dark:text-amber-300 ring-2 ring-amber-500/20",
    dot: "bg-amber-500",
  },
  {
    gen: "14",
    badge: "border-rose-500/40 bg-rose-500/15 text-rose-700 dark:text-rose-300",
    cardSelected: "border-rose-500 bg-rose-500/10 text-rose-700 dark:text-rose-300 ring-2 ring-rose-500/20",
    dot: "bg-rose-500",
  },
  {
    gen: "15",
    badge: "border-teal-500/40 bg-teal-500/15 text-teal-700 dark:text-teal-300",
    cardSelected: "border-teal-500 bg-teal-500/10 text-teal-700 dark:text-teal-300 ring-2 ring-teal-500/20",
    dot: "bg-teal-500",
  },
  {
    gen: "16",
    badge: "border-indigo-500/40 bg-indigo-500/15 text-indigo-700 dark:text-indigo-300",
    cardSelected: "border-indigo-500 bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 ring-2 ring-indigo-500/20",
    dot: "bg-indigo-500",
  },
];

export function getGenBadgeColor(gen: string): string {
  const match = GEN_COLOR_PALETTES.find((p) => p.gen === gen);
  if (match) return match.badge;
  const num = parseInt(gen, 10);
  if (!isNaN(num)) {
    const idx = Math.abs(num) % GEN_COLOR_PALETTES.length;
    return GEN_COLOR_PALETTES[idx].badge;
  }
  return "border-accent/40 bg-accent/15 text-accent";
}

export function getGenCardSelectedStyle(gen: string): string {
  const match = GEN_COLOR_PALETTES.find((p) => p.gen === gen);
  if (match) return match.cardSelected;
  const num = parseInt(gen, 10);
  if (!isNaN(num)) {
    const idx = Math.abs(num) % GEN_COLOR_PALETTES.length;
    return GEN_COLOR_PALETTES[idx].cardSelected;
  }
  return "border-accent bg-accent/10 text-accent font-extrabold ring-2 ring-accent/20";
}
