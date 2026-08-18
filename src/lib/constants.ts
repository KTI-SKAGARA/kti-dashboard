export const APP_NAME = "KTI OPS";
export const SCHOOL_NAME = "SMK Negeri 3 Jepara";
export const ORG_NAME = "KTI SKAGARA";
export const APP_SUBTITLE = `${ORG_NAME} — ${SCHOOL_NAME}`;

// Cookie legacy dari sistem auth lama (single password). Dipertahankan untuk
// membersihkan sesi lama; auth aktif kini via Supabase (sb-<ref>-auth-token).
export const COOKIE_NAME = "admin_session";

export const TOAST_DURATION = 4000;

export const PAGE_SIZE = 15;
