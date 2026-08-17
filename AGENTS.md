# AGENTS.md

KTI SKAGARA — Next.js 16 (App Router) + TypeScript + Tailwind CSS v4 attendance & cash system for a student organization. No database; Google Sheets is the persistence layer.

## Commands

- `npm run dev` — dev server (Turbopack, port 3000)
- `npm run build` — production build (also typechecks)
- `npm run lint` — ESLint (Next core-web-vitals + TS configs)
- No test suite and no standalone typecheck script exist. To typecheck only: `npx tsc --noEmit`
- No CI, no pre-commit hooks, no task runner. `npm run build` + `npm run lint` are the full verification loop.

## Architecture

- Path alias: `@/*` → `src/*`.
- `src/lib/google-sheets.ts` is the single data-access module (fetch/append/delete/move + `autoSetupGoogleSheet`). All reads/writes happen through it with an in-memory TTL cache (`cachedDoc`, `recordsCache`); server actions in `src/app/actions/` call it.
- **Pagination (PRD P2-6)**: Google Sheets punya no query language, jadi paging dilakukan di data layer atas dataset yang sudah di-cache server-side (`recordsCache`, TTL 15s). `queryRecords(gens, query, page, pageSize)` di google-sheets.ts memfilter + sort + slice; hanya satu halaman yang dikirim ke client via server action `getAttendanceRecordsPage`. Dashboard table pakai ini; `/stats` & `/stats/individual` tetap full-fetch karena agregasi butuh seluruh data (dokumentasikan sebagai tradeoff yang disengaja).
- `src/app/actions/` — server actions returning the `ApiResponse<T> = { success, data?, error? }` shape (types in `src/types/attendance.ts`). Keep new actions in this convention.
- `src/middleware.ts` protects every route except `/login`, `/api/auth/logout`, `/_next`, favicon: compares cookie `admin_session` against a hardcoded secret string. `ADMIN_PASSWORD` env overrides or acts alongside the default login password `ktiskagara2026`.
- Dedicated HTTP Route Handler: `src/app/api/auth/logout/route.ts` handles clean cookie destruction across all browsers (including Brave/Chromium shields).
- Angkatan is a dynamic string (e.g. `"9" | "10" | "11" | "12"`). Sheet tabs per angkatan: `GEN 10`, `GEN 11`, `GEN 12`, etc. Tab `CONFIG` stores gen status (`aktif` vs `lulus`).
- Tailwind v4, CSS-based config: theme tokens are defined via `@theme` in `src/app/globals.css`. There is NO `tailwind.config.*` file — don't create one.

## Google Sheets gotchas

- Sheet header row 1 must be: `Tanggal | Nama | Kelas | Status_Absen | Nominal_Kas | Bulan_Tahun | Row_ID`. Tab naming is `GEN <number>` (e.g., `GEN 10`, `GEN 11`, `GEN 12`), with fallbacks in `getSheet()`.
- Credentials resolution order: `service-account.json` in project root (gitignored, present locally) → env vars `GOOGLE_SERVICE_ACCOUNT_EMAIL` + `GOOGLE_PRIVATE_KEY` + `GOOGLE_SPREADSHEET_ID`. `GOOGLE_PRIVATE_KEY` arrives quote-wrapped from Vercel; quotes are stripped and `\n` unescaped in `getFormattedPrivateKey()`.
- **In-memory Caching**: `cachedDoc` TTL is 60s, `recordsCache` TTL is 15s. Any write operation (`appendRecords`, `deleteRecord`, `batchDelete`, `batchMove`, `updateRecord`) calls `invalidateCache()` to ensure fresh data.
- **Mock mode**: if no credentials are configured, the app silently uses an in-memory store (`mockAppended`). Dev works with zero setup, but data lives only in the server process — don't assume Google Sheets failure if creds are absent; it's intended behavior. Navbar shows a "Mode Simulasi" badge (via `getAppConfig`) so the state is visible.

## Conventions

- All UI text, error messages, and code comments are in Indonesian. Keep it that way.
- Student names are always UPPERCASE — converted on write (server action) and on read (`fetchRecords`). Don't skip this for new code paths.
- `Tanggal` (DD/MM/YYYY) and `Bulan_Tahun` (MM-YYYY) are generated server-side in `src/lib/utils.ts`; never accept them as client input.
- Status values: `Hadir | Sakit | Izin | Alfa` (`STATUS_ABSEN_OPTIONS`). Class names use official SKAGARA labels (`AKL 1`, `TKJ 2`, …) from `SKAGARA_CLASSES`.
- `cn()` in `src/lib/utils.ts` (clsx + tailwind-merge) for conditional classes; `formatRupiah`/`formatBulanTahun` for display formatting.
- `getGenBadgeColor(gen)` and `getGenCardSelectedStyle(gen)` in `src/lib/utils.ts` provide consistent per-Gen visual identities.
- Sorting uses `localeCompare(..., "id")` on cloned array copies (`[...array].sort(...)`) to avoid mutating React states in-place.

## TaggedRecord & Row_ID

`TaggedRecord = AttendanceRecord & { _gen: Gen; _rowId: string }` is a **shared type** in `src/types/attendance.ts` (no longer defined per-file). `_rowId` is the stable `Row_ID` (UUID) column persisted in the sheet — **always use `_rowId` for edit/delete/bulk operations**, never array indexes (the old `_rawIdx` bug caused wrong records to be modified when filters were active). Old rows without Row_ID get backfilled automatically by `fetchRecords` (`backfillRowIds`).

## Client data layer (PRD P1-4)

`src/hooks/useAttendanceData.tsx` provides `AttendanceDataProvider` (mounted in `src/app/layout.tsx`), `useAttendanceData()` and `useTaggedRecords(gens)`. Records are fetched once per Gen and cached client-side (TTL 30s) so navigating between `/`, `/stats`, `/stats/individual` doesn't refetch. After any write, call `invalidate(gen?)` + `refresh({ force: true })` (the `reloadAll` pattern in page.tsx) so all routes see fresh data. `/kalender` is localStorage-only (kegiatan), no server fetch.

## Dashboard structure (PRD P2-5/P2-7)

`src/app/page.tsx` is the orchestrator (~1100 lines); the heavy UI lives in `src/components/dashboard/`:
- `FilterBar.tsx` — gen/status/tanggal/bulan/kelas chips + search + export/reload.
- `AttendanceTable.tsx` — server-paged table + bulk actions + pagination.
- `StatsView.tsx` — stats view (no trend chart; chart lives only in `/stats` per P2-7).
Kalender view was removed from dashboard (P2-7); `/kalender` and `/stats` are the detail destinations.

## Environment

- Deploy target: Vercel. Remote `ktiskagara` → `https://github.com/KTI-SKAGARA/kti-attendance-system.git`. Remote `origin` → legacy (`naidrahiqa`).
- `.env.local` exists locally and is gitignored, as is `service-account.json` — never commit or log credentials.
- Skills live in `.agents/skills/` (gitignored, local only) — use them rather than guessing.

## Branching workflow

Work on `dev` branch. Push to fork (`origin`) first, then open PR to upstream (`ktiskagara/KTI-SKAGARA`):

```bash
git push origin dev        # push to fork
gh pr create --repo KTI-SKAGARA/kti-attendance-system --title "..." --body "..."
```

Never push directly to `ktiskagara`. Always PR.
