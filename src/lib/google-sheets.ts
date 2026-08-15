import {
  type Gen,
  type GenConfig,
  type AttendanceRecord,
  type StatusAbsen,
  MOCK_GENS,
  getGenTabName,
  CONFIG_TAB,
} from "@/types/attendance";
import { normalizeName, getBulanTahunFromDate } from "@/lib/utils";
import fs from "fs";
import path from "path";
import type { GoogleSpreadsheet, GoogleSpreadsheetRow } from "google-spreadsheet";

// ---------------------------------------------------------------------------
// In-Memory Performance Cache (TTL)
// ---------------------------------------------------------------------------

let cachedDoc: GoogleSpreadsheet | null = null;
let docLoadedAt = 0;
const DOC_TTL_MS = 60 * 1000; // 60 seconds

const recordsCache = new Map<
  string,
  { data: AttendanceRecord[]; timestamp: number }
>();
const RECORDS_TTL_MS = 15 * 1000; // 15 seconds

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

const MOCK_DATA: AttendanceRecord[] = [];

function getMockDataForGen(gen: Gen): AttendanceRecord[] {
  const prefix = `${gen} `;
  return MOCK_DATA.filter((r) => r.kelas.startsWith(prefix));
}

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

function getServiceAccountCredentials(): { email: string; key: string } {
  const jsonPath = path.join(process.cwd(), "service-account.json");
  if (fs.existsSync(jsonPath)) {
    try {
      const fileContent = fs.readFileSync(jsonPath, "utf-8");
      const parsed = JSON.parse(fileContent);
      if (parsed.client_email && parsed.private_key) {
        return {
          email: parsed.client_email,
          key: parsed.private_key.replace(/\\n/g, "\n"),
        };
      }
    } catch (e) {
      console.warn("Error reading service-account.json:", e);
    }
  }

  return {
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || "",
    key: getFormattedPrivateKey(),
  };
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

const HEADERS = ["Tanggal", "Nama", "Kelas", "Status_Absen", "Nominal_Kas", "Bulan_Tahun"];
const CONFIG_HEADERS = ["Gen", "Status"];

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
// Records CRUD with TTL Caching
// ---------------------------------------------------------------------------

export async function fetchRecords(
  gen: Gen,
  force = false
): Promise<AttendanceRecord[]> {
  if (!isGoogleSheetsConfigured()) {
    return [
      ...getMockDataForGen(gen),
      ...(mockAppended[gen] || []),
    ];
  }

  const now = Date.now();
  const cached = recordsCache.get(gen);
  if (!force && cached && now - cached.timestamp < RECORDS_TTL_MS) {
    return cached.data;
  }

  const tabName = getGenTabName(gen);
  const sheet = await getSheet(tabName);
  const rows: GoogleSpreadsheetRow[] = await sheet.getRows();

  const data: AttendanceRecord[] = rows.map((row: GoogleSpreadsheetRow) => ({
    tanggal: row.get("Tanggal") ?? "",
    nama: normalizeName(row.get("Nama") ?? ""),
    kelas: row.get("Kelas") ?? "",
    statusAbsen: (row.get("Status_Absen") ?? "Hadir") as StatusAbsen,
    nominalKas: Number(row.get("Nominal_Kas") ?? 0),
    bulanTahun: row.get("Bulan_Tahun") ?? "",
  }));

  recordsCache.set(gen, { data, timestamp: now });
  return data;
}

export async function appendRecord(
  gen: Gen,
  record: AttendanceRecord
): Promise<void> {
  const formattedRecord: AttendanceRecord = {
    ...record,
    nama: normalizeName(record.nama),
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
  }));

  await sheet.addRows(rows);
  invalidateCache(gen);
}

export async function deleteRecord(
  gen: Gen,
  recordIndex: number
): Promise<void> {
  if (!isGoogleSheetsConfigured()) {
    const mockList = getMockDataForGen(gen);
    const mockLen = mockList.length;
    if (recordIndex < mockLen) return;
    const appendedIdx = recordIndex - mockLen;
    if (mockAppended[gen] && appendedIdx >= 0 && appendedIdx < mockAppended[gen].length) {
      mockAppended[gen].splice(appendedIdx, 1);
    }
    return;
  }

  const tabName = getGenTabName(gen);
  const sheet = await getSheet(tabName);
  const rows: GoogleSpreadsheetRow[] = await sheet.getRows();

  if (recordIndex >= 0 && recordIndex < rows.length) {
    await rows[recordIndex].delete();
  }
  invalidateCache(gen);
}

export async function deleteRecordsBatch(
  gen: Gen,
  recordIndexes: number[]
): Promise<void> {
  const sorted = [...recordIndexes].sort((a, b) => b - a);

  if (!isGoogleSheetsConfigured()) {
    const mockList = getMockDataForGen(gen);
    const mockLen = mockList.length;
    for (const idx of sorted) {
      if (idx < mockLen) continue;
      const appendedIdx = idx - mockLen;
      if (mockAppended[gen] && appendedIdx >= 0 && appendedIdx < mockAppended[gen].length) {
        mockAppended[gen].splice(appendedIdx, 1);
      }
    }
    return;
  }

  const tabName = getGenTabName(gen);
  const sheet = await getSheet(tabName);
  const rows: GoogleSpreadsheetRow[] = await sheet.getRows();

  for (const idx of sorted) {
    if (idx >= 0 && idx < rows.length) {
      await rows[idx].delete();
    }
  }
  invalidateCache(gen);
}

export async function updateRecord(
  gen: Gen,
  recordIndex: number,
  data: Partial<AttendanceRecord> & { targetGen?: Gen }
): Promise<void> {
  const targetGen = data.targetGen && data.targetGen !== gen ? data.targetGen : null;

  if (!isGoogleSheetsConfigured()) {
    const mockList = getMockDataForGen(gen);
    const mockLen = mockList.length;
    let targetRecord: AttendanceRecord | null = null;

    if (recordIndex < mockLen) {
      targetRecord = { ...mockList[recordIndex] };
    } else {
      const appendedIdx = recordIndex - mockLen;
      if (mockAppended[gen] && appendedIdx >= 0 && appendedIdx < mockAppended[gen].length) {
        targetRecord = { ...mockAppended[gen][appendedIdx] };
      }
    }

    if (targetRecord) {
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
        if (recordIndex >= mockLen) {
          const appendedIdx = recordIndex - mockLen;
          mockAppended[gen]?.splice(appendedIdx, 1);
        }
      } else {
        if (recordIndex < mockLen) {
          mockList[recordIndex] = targetRecord;
        } else {
          const appendedIdx = recordIndex - mockLen;
          if (mockAppended[gen] && appendedIdx >= 0 && appendedIdx < mockAppended[gen].length) {
            mockAppended[gen][appendedIdx] = targetRecord;
          }
        }
      }
    }
    return;
  }

  const tabName = getGenTabName(gen);
  const sheet = await getSheet(tabName);
  const rows: GoogleSpreadsheetRow[] = await sheet.getRows();

  if (recordIndex >= 0 && recordIndex < rows.length) {
    const row = rows[recordIndex];
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
  }

  invalidateCache(gen);
}

export async function moveRecordsBatch(
  fromGen: Gen,
  recordIndexes: number[],
  targetGen: Gen
): Promise<void> {
  if (fromGen === targetGen || recordIndexes.length === 0) return;

  const sorted = [...recordIndexes].sort((a, b) => b - a);

  if (!isGoogleSheetsConfigured()) {
    const mockList = getMockDataForGen(fromGen);
    const mockLen = mockList.length;
    if (!mockAppended[targetGen]) mockAppended[targetGen] = [];

    for (const idx of sorted) {
      let record: AttendanceRecord | null = null;
      if (idx < mockLen) {
        record = { ...mockList[idx] };
      } else {
        const appendedIdx = idx - mockLen;
        if (mockAppended[fromGen] && appendedIdx >= 0 && appendedIdx < mockAppended[fromGen].length) {
          record = mockAppended[fromGen][appendedIdx];
          mockAppended[fromGen].splice(appendedIdx, 1);
        }
      }
      if (record) {
        mockAppended[targetGen].push(record);
      }
    }
    return;
  }

  const fromSheet = await getSheet(getGenTabName(fromGen));
  const rows: GoogleSpreadsheetRow[] = await fromSheet.getRows();

  await ensureGenTab(targetGen);
  const targetSheet = await getSheet(getGenTabName(targetGen));

  const recordsToMove: AttendanceRecord[] = [];
  const rowsToDelete: GoogleSpreadsheetRow[] = [];

  for (const idx of sorted) {
    if (idx >= 0 && idx < rows.length) {
      const row = rows[idx];
      recordsToMove.push({
        tanggal: row.get("Tanggal") ?? "",
        nama: normalizeName(row.get("Nama") ?? ""),
        kelas: row.get("Kelas") ?? "",
        statusAbsen: (row.get("Status_Absen") ?? "Hadir") as StatusAbsen,
        nominalKas: Number(row.get("Nominal_Kas") ?? 0),
        bulanTahun: row.get("Bulan_Tahun") ?? "",
      });
      rowsToDelete.push(row);
    }
  }

  if (recordsToMove.length > 0) {
    await targetSheet.addRows(
      recordsToMove.map((r) => ({
        Tanggal: r.tanggal,
        Nama: r.nama,
        Kelas: r.kelas,
        Status_Absen: r.statusAbsen,
        Nominal_Kas: r.nominalKas,
        Bulan_Tahun: r.bulanTahun,
      }))
    );

    for (const row of rowsToDelete) {
      await row.delete();
    }
  }

  invalidateCache(fromGen);
  invalidateCache(targetGen);
}
