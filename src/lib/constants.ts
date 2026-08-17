export const APP_NAME = "KTI SKAGARA";
export const SCHOOL_NAME = "SMK Negeri 3 Jepara";
export const APP_SUBTITLE = `${APP_NAME} — ${SCHOOL_NAME}`;

export const COOKIE_NAME = "admin_session";
// Wajib di-set via env SESSION_SECRET. Tanpa fallback hardcoded (PRD §4.6):
// kalau kosong, middleware & login action akan menolak akses.
export const SESSION_SECRET = process.env.SESSION_SECRET || "";

export const DEFAULT_ADMIN_PASSWORD = "ktiskagara2026";

export const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

export const TOAST_DURATION = 4000;

export const PAGE_SIZE = 15;
