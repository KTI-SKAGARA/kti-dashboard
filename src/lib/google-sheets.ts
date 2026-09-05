import {
  type Gen,
  type GenConfig,
  type AttendanceRecord,
  type StatusAbsen,
  MOCK_GENS,
  getGenTabName,
  CONFIG_TAB,
} from "@/types/attendance";
import { normalizeName, getBulanTahunFromDate, tanggalToNumber } from "@/lib/utils";
import fs from "fs";
import path from "path";
import type { GoogleSpreadsheet, GoogleSpreadsheetRow, GoogleSpreadsheetWorksheet } from "google-spreadsheet";

// ---------------------------------------------------------------------------
// Stable row ID (kolom Row_ID) — pengganti index-based CRUD (lihat PRD §4.4)
// ---------------------------------------------------------------------------

function generateRowId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

const ROW_ID_COLUMN = "Row_ID";

// ---------------------------------------------------------------------------
// In-Memory Performance Cache (TTL)
// ---------------------------------------------------------------------------

let cachedDoc: GoogleSpreadsheet | null = null;
let docLoadedAt = 0;
const DOC_TTL_MS = 10 * 60 * 1000; // 10 minutes

const recordsCache = new Map<
  string,
  { data: AttendanceRecord[]; timestamp: number }
>();
const RECORDS_TTL_MS = 2 * 60 * 1000; // 2 minutes

export function invalidateCache(gen?: Gen) {
  if (gen) {
    recordsCache.delete(gen);
  } else {
    recordsCache.clear();
  }
  cachedDoc = null;
  docLoadedAt = 0;
}

// ---------------------------------------------------------------------------
// Mock store (used when Google Sheets credentials are not configured)
// ---------------------------------------------------------------------------

const MOCK_GEN_CONFIG: GenConfig[] = MOCK_GENS.map((g) => ({
  gen: g,
  status: "aktif" as const,
}));

const mockAppended: Record<string, AttendanceRecord[]> = {};

// ---------------------------------------------------------------------------
// Google Sheets credentials loader
// ---------------------------------------------------------------------------

function getFormattedPrivateKey(): string {
  let key = process.env.GOOGLE_PRIVATE_KEY || "";
  if (!key) return "";
  if (
    (key.startsWith('"') && key.endsWith('"')) ||
    (key.startsWith("'") && key.endsWith("'"))
  ) {
    key = key.slice(1, -1);
  }
  return key.replace(/\\n/g, "\n");
}

let _cachedCredentials: { email: string; key: string } | null = null;

function getServiceAccountCredentials(): { email: string; key: string } {
  if (_cachedCredentials) return _cachedCredentials;

  const jsonPath = path.join(process.cwd(), "service-account.json");
  if (fs.existsSync(jsonPath)) {
    try {
      const fileContent = fs.readFileSync(jsonPath, "utf-8");
      const parsed = JSON.parse(fileContent);
      if (parsed.client_email && parsed.private_key) {
        _cachedCredentials = {
          email: parsed.client_email,
          key: parsed.private_key.replace(/\\n/g, "\n"),
        };
        return _cachedCredentials;
      }
    } catch (e) {
      console.warn("Error reading service-account.json:", e);
    }
  }

  _cachedCredentials = {
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || "",
    key: getFormattedPrivateKey(),
  };
  return _cachedCredentials;
}

export function isGoogleSheetsConfigured(): boolean {
  const creds = getServiceAccountCredentials();
  return !!(
    creds.email &&
    creds.key &&
    process.env.GOOGLE_SPREADSHEET_ID
  );
}

// ---------------------------------------------------------------------------
// Google Spreadsheet connection
// ---------------------------------------------------------------------------

async function getDoc(forceRefresh = false): Promise<GoogleSpreadsheet> {
  const now = Date.now();
  if (cachedDoc && !forceRefresh && now - docLoadedAt < DOC_TTL_MS) {
    return cachedDoc;
  }

  const { GoogleSpreadsheet: GSClass } = await import("google-spreadsheet");
  const { JWT } = await import("google-auth-library");

  const creds = getServiceAccountCredentials();
  const serviceAccountAuth = new JWT({
    email: creds.email,
    key: creds.key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  const doc = new GSClass(
    process.env.GOOGLE_SPREADSHEET_ID!,
    serviceAccountAuth
  );
  await doc.loadInfo();
  cachedDoc = doc;
  docLoadedAt = now;
  return doc;
}

async function getSheet(tabName: string, forceRefresh = false) {
  const doc = await getDoc(forceRefresh);

  let sheet = doc.sheetsByTitle[tabName];
  if (!sheet) {
    const num = tabName.replace(/\D/g, "");
    const possibleNames = [`GEN ${num}`, `GEN_${num}`, `Kelas_${num}`, `Kelas ${num}`, num];
    for (const name of possibleNames) {
      if (doc.sheetsByTitle[name]) {
        sheet = doc.sheetsByTitle[name];
        break;
      }
    }
  }

  if (!sheet) {
    // Fallback: pick first sheet
    sheet = doc.sheetsByIndex[0];
  }

  if (!sheet) {
    throw new Error(`Tab sheet "${tabName}" tidak ditemukan.`);
  }

  return sheet;
}

// ---------------------------------------------------------------------------
// Gen config management (CONFIG tab)
// ---------------------------------------------------------------------------

const HEADERS = ["Tanggal", "Nama", "Kelas", "Status_Absen", "Nominal_Kas", "Bulan_Tahun", ROW_ID_COLUMN];
const CONFIG_HEADERS = ["Gen", "Status"];

/**
 * Pastikan kolom Row_ID ada di header sheet. Idempotent — aman dipanggil berulang.
 */
async function ensureRowIdHeader(sheet: GoogleSpreadsheetWorksheet): Promise<void> {
  if (sheet.headerValues?.includes(ROW_ID_COLUMN)) return;

  await sheet.loadCells("A1:G1");
  const cell = sheet.getCell(0, 6);
  cell.value = ROW_ID_COLUMN;
  await sheet.saveUpdatedCells();
}

/**
 * Backfill Row_ID untuk baris lama yang belum punya ID (migrasi sekali jalan,
 * dijalankan otomatis saat fetchRecords menemukan baris tanpa ID).
 */
async function backfillRowIds(
  sheet: GoogleSpreadsheetWorksheet,
  rows: GoogleSpreadsheetRow[]
): Promise<void> {
  await ensureRowIdHeader(sheet);
  for (const row of rows) {
    if (!(row.get(ROW_ID_COLUMN) || "").trim()) {
      row.set(ROW_ID_COLUMN, generateRowId());
      await row.save();
    }
  }
}

export async function getGenConfig(): Promise<GenConfig[]> {
  if (!isGoogleSheetsConfigured()) {
    return [...MOCK_GEN_CONFIG];
  }

  try {
    const doc = await getDoc();
    const configSheet = doc.sheetsByTitle[CONFIG_TAB];

    // Collect all gens from baseline default gens + all sheet tab titles in the spreadsheet
    const genMap = new Map<Gen, "aktif" | "lulus">();
    MOCK_GENS.forEach((g) => genMap.set(g, "aktif"));

    for (const title of Object.keys(doc.sheetsByTitle)) {
      const match = title.match(/^(?:GEN|Kelas)[_\s]+(\d+)$/i);
      if (match) {
        genMap.set(match[1], "aktif");
      }
    }

    if (configSheet) {
      const rows: GoogleSpreadsheetRow[] = await configSheet.getRows();
      for (const row of rows) {
        const g = (row.get("Gen") ?? "").trim();
        const s = (row.get("Status") ?? "aktif").trim().toLowerCase() === "lulus" ? "lulus" : "aktif";
        if (g) {
          genMap.set(g, s);
        }
      }
    }

    const result: GenConfig[] = Array.from(genMap.entries())
      .map(([gen, status]) => ({ gen, status }))
      .sort((a, b) => Number(a.gen) - Number(b.gen));

    return result;
  } catch (error) {
    console.error("Error fetching gen config:", error);
    return [...MOCK_GEN_CONFIG];
  }
}

export async function ensureGenTab(gen: Gen): Promise<{ created: boolean }> {
  if (!isGoogleSheetsConfigured()) {
    return { created: false };
  }

  const tabName = getGenTabName(gen);
  const doc = await getDoc(true); // force refresh sheet info

  let genSheet = doc.sheetsByTitle[tabName];
  let configSheet = doc.sheetsByTitle[CONFIG_TAB];

  // Create GEN tab if missing
  let created = false;
  if (!genSheet) {
    genSheet = await doc.addSheet({ title: tabName, headerValues: HEADERS });
    created = true;

    // Format header
    try {
      await genSheet.loadCells("A1:F1");
      for (let col = 0; col < HEADERS.length; col++) {
        const cell = genSheet.getCell(0, col);
        cell.backgroundColor = { red: 0.118, green: 0.161, blue: 0.231, alpha: 1 };
        cell.textFormat = {
          bold: true,
          foregroundColor: { red: 1, green: 1, blue: 1, alpha: 1 },
          fontSize: 10,
        };
      }
      await genSheet.saveUpdatedCells();

      await genSheet.updateProperties({
        gridProperties: {
          rowCount: genSheet.rowCount || 100,
          columnCount: genSheet.columnCount || 20,
          frozenRowCount: 1,
        },
      });
    } catch (e) {
      console.warn("Could not format GEN tab:", e);
    }
  }

  // Ensure CONFIG tab exists
  if (!configSheet) {
    configSheet = await doc.addSheet({
      title: CONFIG_TAB,
      headerValues: CONFIG_HEADERS,
    });
  }

  // Upsert CONFIG row
  const configRows: GoogleSpreadsheetRow[] = await configSheet.getRows();
  const existing = configRows.find((r: GoogleSpreadsheetRow) => r.get("Gen") === gen);
  if (existing) {
    existing.set("Status", "aktif");
    await existing.save();
  } else {
    await configSheet.addRow({ Gen: gen, Status: "aktif" });
  }

  invalidateCache();
  return { created };
}

export async function markGenLulus(gen: Gen, lulus: boolean): Promise<void> {
  const status = lulus ? "lulus" : "aktif";

  if (!isGoogleSheetsConfigured()) {
    const entry = MOCK_GEN_CONFIG.find((c) => c.gen === gen);
    if (entry) entry.status = status;
    return;
  }

  const doc = await getDoc();
  let configSheet = doc.sheetsByTitle[CONFIG_TAB];

  if (!configSheet) {
    configSheet = await doc.addSheet({
      title: CONFIG_TAB,
      headerValues: CONFIG_HEADERS,
    });
  }

  const rows: GoogleSpreadsheetRow[] = await configSheet.getRows();
  const existing = rows.find((r: GoogleSpreadsheetRow) => r.get("Gen") === gen);
  if (existing) {
    existing.set("Status", status);
    await existing.save();
  } else {
    await configSheet.addRow({ Gen: gen, Status: status });
  }
  invalidateCache();
}

// ---------------------------------------------------------------------------
// Admin: delete gen (hapus dari CONFIG + hapus tab sheet)
// ---------------------------------------------------------------------------

export async function deleteGen(gen: Gen): Promise<void> {
  if (!isGoogleSheetsConfigured()) {
    // Mock mode: hapus dari mock config
    const idx = MOCK_GEN_CONFIG.findIndex((c) => c.gen === gen);
    if (idx >= 0) MOCK_GEN_CONFIG.splice(idx, 1);
    delete mockAppended[gen];
    return;
  }

  const doc = await getDoc(true);

  // 1. Hapus entry dari CONFIG tab
  const configSheet = doc.sheetsByTitle[CONFIG_TAB];
  if (configSheet) {
    const rows: GoogleSpreadsheetRow[] = await configSheet.getRows();
    const existing = rows.find((r: GoogleSpreadsheetRow) => r.get("Gen") === gen);
    if (existing) {
      await existing.delete();
    }
  }

  // 2. Hapus tab sheet gen (jika ada)
  const tabName = getGenTabName(gen);
  const genSheet = doc.sheetsByTitle[tabName];
  if (genSheet) {
    await doc.deleteSheet(genSheet.sheetId);
  }

  invalidateCache();
}

// ---------------------------------------------------------------------------
// Records CRUD with TTL Caching
// ---------------------------------------------------------------------------

export async function fetchRecords(
  gen: Gen,
  force = false
): Promise<AttendanceRecord[]> {
  if (!isGoogleSheetsConfigured()) {
    return [...(mockAppended[gen] || [])];
  }

  const now = Date.now();
  const cached = recordsCache.get(gen);
  if (!force && cached && now - cached.timestamp < RECORDS_TTL_MS) {
    return cached.data;
  }

  const tabName = getGenTabName(gen);
  const sheet = await getSheet(tabName);
  const rows: GoogleSpreadsheetRow[] = await sheet.getRows();

  // Migrasi otomatis: isi Row_ID untuk baris lama yang belum punya ID
  const missingIds = rows.filter((r) => !(r.get(ROW_ID_COLUMN) || "").trim());
  if (missingIds.length > 0) {
    try {
      await backfillRowIds(sheet, rows);
    } catch (e) {
      console.warn(`Gagal backfill Row_ID untuk gen ${gen}:`, e);
    }
  }

  const data: AttendanceRecord[] = rows.map((row: GoogleSpreadsheetRow) => {
    const rawKas = Number(row.get("Nominal_Kas") ?? 0);
    if (isNaN(rawKas) || !Number.isFinite(rawKas)) {
      console.warn(`Nominal_Kas tidak valid pada gen ${gen} (${row.get("Nama")}): "${row.get("Nominal_Kas")}" — dianggap 0.`);
    }
    return {
      tanggal: row.get("Tanggal") ?? "",
      nama: normalizeName(row.get("Nama") ?? ""),
      kelas: row.get("Kelas") ?? "",
      statusAbsen: (row.get("Status_Absen") ?? "Hadir") as StatusAbsen,
      nominalKas: isNaN(rawKas) || !Number.isFinite(rawKas) ? 0 : rawKas,
      bulanTahun: row.get("Bulan_Tahun") ?? "",
      rowId: (row.get(ROW_ID_COLUMN) || "").trim() || undefined,
    };
  });

  recordsCache.set(gen, { data, timestamp: now });
  return data;
}

// ---------------------------------------------------------------------------
// Query + Pagination (PRD P2-6)
// Google Sheets tidak punya query language, jadi paging dilakukan di data layer
// atas dataset yang sudah di-cache server-side (recordsCache, TTL 15s).
// Data yang dikirim ke client hanya satu halaman (pageSize), bukan seluruh sheet.
// ---------------------------------------------------------------------------

export interface RecordsQuery {
  kelas?: string;
  bulan?: string; // MM-YYYY
  tanggal?: string; // DD/MM/YYYY (single date, legacy)
  tanggalFrom?: string; // DD/MM/YYYY (inclusive)
  tanggalTo?: string; // DD/MM/YYYY (inclusive)
  status?: StatusAbsen;
  search?: string; // substring nama (case-insensitive)
}

export interface RecordsPageResult {
  records: (AttendanceRecord & { _gen: Gen })[];
  total: number;
}

/**
 * Ambil satu halaman records untuk sekumpulan gen, dengan filter + sorting
 * yang konsisten dengan UI lama (gen asc → kelas terbanyak → nama asc).
 */
export async function queryRecords(
  gens: Gen[],
  query: RecordsQuery,
  page: number,
  pageSize: number
): Promise<RecordsPageResult> {
  const all = await Promise.all(gens.map((g) => fetchRecords(g)));
  const tagged = gens.flatMap((g, i) =>
    all[i].map((r) => ({ ...r, _gen: g }))
  );

  let result = tagged;
  if (query.kelas) result = result.filter((r) => r.kelas === query.kelas);
  if (query.bulan) result = result.filter((r) => r.bulanTahun === query.bulan);
  if (query.tanggal) result = result.filter((r) => r.tanggal === query.tanggal);
  if (query.tanggalFrom || query.tanggalTo) {
    const fromNum = query.tanggalFrom ? tanggalToNumber(query.tanggalFrom) : -Infinity;
    const toNum = query.tanggalTo ? tanggalToNumber(query.tanggalTo) : Infinity;
    result = result.filter((r) => {
      const t = tanggalToNumber(r.tanggal);
      return !Number.isNaN(t) && t >= fromNum && t <= toNum;
    });
  }
  if (query.status) result = result.filter((r) => r.statusAbsen === query.status);
  if (query.search) {
    const q = query.search.toLowerCase();
    result = result.filter((r) => r.nama.toLowerCase().includes(q));
  }

  const kelasCount = new Map<string, number>();
  for (const r of result) {
    kelasCount.set(r.kelas, (kelasCount.get(r.kelas) || 0) + 1);
  }

  const sorted = [...result].sort((a, b) => {
    const genCmp = Number(a._gen) - Number(b._gen);
    if (genCmp !== 0) return genCmp;
    const aCount = kelasCount.get(a.kelas) || 0;
    const bCount = kelasCount.get(b.kelas) || 0;
    if (aCount !== bCount) return bCount - aCount;
    return a.nama.localeCompare(b.nama, "id");
  });

  const total = sorted.length;
  const records = sorted.slice((page - 1) * pageSize, page * pageSize);
  return { records, total };
}

export async function appendRecord(
  gen: Gen,
  record: AttendanceRecord
): Promise<void> {
  const formattedRecord: AttendanceRecord & { rowId: string } = {
    ...record,
    nama: normalizeName(record.nama),
    rowId: record.rowId || generateRowId(),
  };

  if (!isGoogleSheetsConfigured()) {
    if (!mockAppended[gen]) mockAppended[gen] = [];
    mockAppended[gen].push(formattedRecord);
    return;
  }

  const tabName = getGenTabName(gen);
  const sheet = await getSheet(tabName);

  await sheet.addRow({
    Tanggal: formattedRecord.tanggal,
    Nama: formattedRecord.nama,
    Kelas: formattedRecord.kelas,
    Status_Absen: formattedRecord.statusAbsen,
    Nominal_Kas: formattedRecord.nominalKas,
    Bulan_Tahun: formattedRecord.bulanTahun,
    [ROW_ID_COLUMN]: formattedRecord.rowId,
  });

  invalidateCache(gen);
}

export async function appendRecords(
  gen: Gen,
  records: AttendanceRecord[]
): Promise<void> {
  const formatted = records.map((r) => ({
    ...r,
    nama: normalizeName(r.nama),
    rowId: r.rowId || generateRowId(),
  }));

  if (!isGoogleSheetsConfigured()) {
    if (!mockAppended[gen]) mockAppended[gen] = [];
    mockAppended[gen].push(...formatted);
    return;
  }

  const tabName = getGenTabName(gen);
  const sheet = await getSheet(tabName);

  const rows = formatted.map((r) => ({
    Tanggal: r.tanggal,
    Nama: r.nama,
    Kelas: r.kelas,
    Status_Absen: r.statusAbsen,
    Nominal_Kas: r.nominalKas,
    Bulan_Tahun: r.bulanTahun,
    [ROW_ID_COLUMN]: r.rowId,
  }));

  await sheet.addRows(rows);
  invalidateCache(gen);
}

export async function deleteRecord(
  gen: Gen,
  rowId: string
): Promise<void> {
  if (!isGoogleSheetsConfigured()) {
    const list = mockAppended[gen] || [];
    const idx = list.findIndex((r) => r.rowId === rowId);
    if (idx >= 0) list.splice(idx, 1);
    return;
  }

  const tabName = getGenTabName(gen);
  const sheet = await getSheet(tabName);
  const rows: GoogleSpreadsheetRow[] = await sheet.getRows();

  const row = rows.find((r) => (r.get(ROW_ID_COLUMN) || "").trim() === rowId);
  if (row) {
    await row.delete();
  } else {
    throw new Error("Data tidak ditemukan (mungkin sudah diubah/dihapus oleh admin lain).");
  }
  invalidateCache(gen);
}

export async function deleteRecordsBatch(
  gen: Gen,
  rowIds: string[]
): Promise<void> {
  const idSet = new Set(rowIds);

  if (!isGoogleSheetsConfigured()) {
    const list = mockAppended[gen] || [];
    mockAppended[gen] = list.filter((r) => !idSet.has(r.rowId || ""));
    return;
  }

  const tabName = getGenTabName(gen);
  const sheet = await getSheet(tabName);
  const rows: GoogleSpreadsheetRow[] = await sheet.getRows();

  const rowsToDelete = rows.filter((r) =>
    idSet.has((r.get(ROW_ID_COLUMN) || "").trim())
  );
  for (const row of rowsToDelete) {
    await row.delete();
  }
  invalidateCache(gen);
}

export async function updateRecord(
  gen: Gen,
  rowId: string,
  data: Partial<AttendanceRecord> & { targetGen?: Gen }
): Promise<void> {
  const targetGen = data.targetGen && data.targetGen !== gen ? data.targetGen : null;

  if (!isGoogleSheetsConfigured()) {
    const list = mockAppended[gen] || [];
    const idx = list.findIndex((r) => r.rowId === rowId);
    if (idx < 0) throw new Error("Data tidak ditemukan.");
    const targetRecord = { ...list[idx] };

    if (data.nama !== undefined) targetRecord.nama = normalizeName(data.nama);
    if (data.kelas !== undefined) targetRecord.kelas = data.kelas;
    if (data.statusAbsen !== undefined) targetRecord.statusAbsen = data.statusAbsen;
    if (data.nominalKas !== undefined) targetRecord.nominalKas = data.nominalKas;
    if (data.tanggal !== undefined) {
      targetRecord.tanggal = data.tanggal;
      targetRecord.bulanTahun =
        data.bulanTahun ||
        (targetRecord.tanggal
          ? getBulanTahunFromDate(targetRecord.tanggal)
          : targetRecord.bulanTahun);
    }

    if (targetGen) {
      if (!mockAppended[targetGen]) mockAppended[targetGen] = [];
      mockAppended[targetGen].push(targetRecord);
      list.splice(idx, 1);
    } else {
      list[idx] = targetRecord;
    }
    return;
  }

  const tabName = getGenTabName(gen);
  const sheet = await getSheet(tabName);
  const rows: GoogleSpreadsheetRow[] = await sheet.getRows();

  const row = rows.find((r) => (r.get(ROW_ID_COLUMN) || "").trim() === rowId);
  if (!row) {
    throw new Error("Data tidak ditemukan (mungkin sudah diubah/dihapus oleh admin lain).");
  }

  const existingTanggal = row.get("Tanggal") ?? "";
  const existingNama = row.get("Nama") ?? "";
  const existingKelas = row.get("Kelas") ?? "";
  const existingStatus = (row.get("Status_Absen") ?? "Hadir") as StatusAbsen;
  const existingKas = Number(row.get("Nominal_Kas") ?? 0);
  const existingBulan = row.get("Bulan_Tahun") ?? "";

  const finalTanggal = data.tanggal !== undefined ? data.tanggal : existingTanggal;
  const finalNama = data.nama !== undefined ? normalizeName(data.nama) : existingNama;
  const finalKelas = data.kelas !== undefined ? data.kelas : existingKelas;
  const finalStatus = data.statusAbsen !== undefined ? data.statusAbsen : existingStatus;
  const finalKas = data.nominalKas !== undefined ? data.nominalKas : existingKas;
  const finalBulan =
    data.bulanTahun !== undefined
      ? data.bulanTahun
      : data.tanggal
      ? getBulanTahunFromDate(finalTanggal)
      : existingBulan;

  if (targetGen) {
    await ensureGenTab(targetGen);
    const targetSheet = await getSheet(getGenTabName(targetGen));
    await targetSheet.addRow({
      Tanggal: finalTanggal,
      Nama: finalNama,
      Kelas: finalKelas,
      Status_Absen: finalStatus,
      Nominal_Kas: finalKas,
      Bulan_Tahun: finalBulan,
      [ROW_ID_COLUMN]: (row.get(ROW_ID_COLUMN) || "").trim() || generateRowId(),
    });
    await row.delete();
    invalidateCache(targetGen);
  } else {
    if (data.nama !== undefined) row.set("Nama", finalNama);
    if (data.kelas !== undefined) row.set("Kelas", finalKelas);
    if (data.statusAbsen !== undefined) row.set("Status_Absen", finalStatus);
    if (data.nominalKas !== undefined) row.set("Nominal_Kas", String(finalKas));
    if (data.tanggal !== undefined) {
      row.set("Tanggal", finalTanggal);
      row.set("Bulan_Tahun", finalBulan);
    }
    await row.save();
  }

  invalidateCache(gen);
}

export async function moveRecordsBatch(
  fromGen: Gen,
  rowIds: string[],
  targetGen: Gen
): Promise<void> {
  if (fromGen === targetGen || rowIds.length === 0) return;

  const idSet = new Set(rowIds);

  if (!isGoogleSheetsConfigured()) {
    if (!mockAppended[targetGen]) mockAppended[targetGen] = [];
    const source = mockAppended[fromGen] || [];
    mockAppended[fromGen] = source.filter((r) => {
      if (idSet.has(r.rowId || "")) {
        mockAppended[targetGen].push(r);
        return false;
      }
      return true;
    });
    return;
  }

  const fromSheet = await getSheet(getGenTabName(fromGen));
  const rows: GoogleSpreadsheetRow[] = await fromSheet.getRows();

  await ensureGenTab(targetGen);
  const targetSheet = await getSheet(getGenTabName(targetGen));

  const recordsToMove = rows.filter((r) =>
    idSet.has((r.get(ROW_ID_COLUMN) || "").trim())
  );

  if (recordsToMove.length > 0) {
    await targetSheet.addRows(
      recordsToMove.map((r) => ({
        Tanggal: r.get("Tanggal") ?? "",
        Nama: normalizeName(r.get("Nama") ?? ""),
        Kelas: r.get("Kelas") ?? "",
        Status_Absen: (r.get("Status_Absen") ?? "Hadir") as StatusAbsen,
        Nominal_Kas: Number(r.get("Nominal_Kas") ?? 0),
        Bulan_Tahun: r.get("Bulan_Tahun") ?? "",
        [ROW_ID_COLUMN]: (r.get(ROW_ID_COLUMN) || "").trim() || generateRowId(),
      }))
    );

    for (const row of recordsToMove) {
      await row.delete();
    }
  }

  invalidateCache(fromGen);
  invalidateCache(targetGen);
}

/**
 * Rename a student across Google Sheets attendance records (fixing typos).
 * If targetGen is provided, updates only that gen tab. Otherwise, updates all active gens.
 * Returns the count of attendance record rows updated.
 */
export async function renameStudentRecordInSheet(
  oldName: string,
  newName: string,
  targetGen?: Gen
): Promise<number> {
  const normOld = normalizeName(oldName);
  const normNew = normalizeName(newName);
  if (!normOld || !normNew || normOld === normNew) return 0;

  let gensToProcess: Gen[] = [];
  if (targetGen) {
    gensToProcess = [targetGen];
  } else {
    const config = await getGenConfig();
    gensToProcess = config.map((c) => c.gen);
  }

  let totalUpdated = 0;

  if (!isGoogleSheetsConfigured()) {
    for (const g of gensToProcess) {
      const list = mockAppended[g] || [];
      for (const r of list) {
        if (normalizeName(r.nama) === normOld) {
          r.nama = normNew;
          totalUpdated++;
        }
      }
      invalidateCache(g);
    }
    return totalUpdated;
  }

  for (const g of gensToProcess) {
    try {
      const tabName = getGenTabName(g);
      const sheet = await getSheet(tabName);
      const rows: GoogleSpreadsheetRow[] = await sheet.getRows();
      let genUpdated = 0;

      for (const row of rows) {
        if (normalizeName(row.get("Nama") ?? "") === normOld) {
          row.set("Nama", normNew);
          await row.save();
          genUpdated++;
          totalUpdated++;
        }
      }

      if (genUpdated > 0) {
        invalidateCache(g);
      }
    } catch {
      // Tab might not exist, skip safely
    }
  }

  return totalUpdated;
}

/**
 * Move all attendance records of a specific student from one gen to another.
 * Returns the count of records moved.
 */
export async function moveStudentRecordsInSheet(
  nama: string,
  fromGen: Gen,
  targetGen: Gen
): Promise<number> {
  const normName = normalizeName(nama);
  if (fromGen === targetGen || !normName) return 0;

  if (!isGoogleSheetsConfigured()) {
    if (!mockAppended[targetGen]) mockAppended[targetGen] = [];
    const source = mockAppended[fromGen] || [];
    let moved = 0;
    mockAppended[fromGen] = source.filter((r) => {
      if (normalizeName(r.nama) === normName) {
        mockAppended[targetGen].push(r);
        moved++;
        return false;
      }
      return true;
    });
    invalidateCache(fromGen);
    invalidateCache(targetGen);
    return moved;
  }

  const fromSheet = await getSheet(getGenTabName(fromGen));
  const rows: GoogleSpreadsheetRow[] = await fromSheet.getRows();

  const matchingRows = rows.filter(
    (r) => normalizeName(r.get("Nama") ?? "") === normName
  );

  if (matchingRows.length === 0) return 0;

  // Ensure every matching row has a valid rowId
  for (const r of matchingRows) {
    if (!(r.get(ROW_ID_COLUMN) || "").trim()) {
      r.set(ROW_ID_COLUMN, generateRowId());
      await r.save();
    }
  }

  const rowIds = matchingRows.map((r) => (r.get(ROW_ID_COLUMN) || "").trim()).filter(Boolean);
  await moveRecordsBatch(fromGen, rowIds, targetGen);
  return matchingRows.length;
}
