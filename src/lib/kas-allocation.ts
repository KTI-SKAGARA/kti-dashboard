import {
  type TaggedRecord,
  type Gen,
  KAS_RUTIN_DEFAULT,
} from "@/types/attendance";
import { formatRupiah } from "@/lib/utils";

export type MeetingKasStatus =
  | "LUNAS" // Dibayar pas di hari yang sama
  | "LUNAS_ALIHAN" // Lunas karena ditutup oleh sisa saldo dari minggu sebelumnya
  | "BAYAR_LEBIH" // Bayar lebih di hari ini (sisa dialihkan ke minggu selanjutnya)
  | "MENUNGGAK" // Hadir tapi uang kurang / belum bayar
  | "BEBAS" // Sakit / Izin / Alfa (tidak wajib kas)
  | "BEBAS_BAYAR"; // Tidak wajib kas tapi tetap bayar (seluruhnya dialihkan ke depan)

export interface MeetingKasDetail {
  tanggal: string;
  kelas: string;
  statusAbsen: string;
  isWajib: boolean;
  required: number;
  paid: number; // Uang riil yang dibayar di tanggal ini
  carriedFromPrevious: number; // Saldo yang diterima dari alihan minggu sebelumnya
  totalAvailable: number; // paid + carriedFromPrevious
  usedThisMeeting: number; // Jumlah yang terpakai untuk melunasi pertemuan ini
  carriedToNext: number; // Sisa uang yang dialihkan ke minggu selanjutnya
  shortage: number; // Kekurangan / tunggakan di pertemuan ini
  status: MeetingKasStatus;
  statusLabel: string;
  badgeClass: string;
  explanation: string;
  rowId?: string;
  gen: Gen;
}

export interface StudentKasSummary {
  nama: string;
  kelas: string;
  gen: Gen;
  totalMeetings: number;
  totalHadir: number;
  totalRequired: number;
  totalPaid: number;
  totalUsed: number;
  currentSurplus: number; // Saldo lebih saat ini (siap dialihkan ke minggu depan)
  currentDebt: number; // Total tunggakan belum terbayar
  netBalance: number; // totalPaid - totalRequired
  coveredWeeksCount: number; // Berapa minggu ke depan yang tercover oleh saldo lebih
  unpaidMeetingsCount: number; // Berapa pertemuan yang masih menunggak
  status: "LUNAS" | "LEBIH" | "MENUNGGAK";
  statusBadge: string;
  statusText: string;
  meetings: MeetingKasDetail[];
}

export interface OrgKasSummary {
  totalPaid: number;
  totalRequired: number;
  totalSurplus: number; // Total uang titipan/saldo lebih seluruh siswa
  totalDebt: number; // Total piutang/tunggakan seluruh siswa
  complianceRate: number; // Persentase kepatuhan kas (%)
  studentCounts: {
    total: number;
    lunas: number;
    lebih: number;
    menunggak: number;
  };
}

/**
 * Parsing tanggal DD/MM/YYYY ke timestamp angka untuk sorting kronologis
 */
export function parseTanggalToTime(tgl: string): number {
  if (!tgl) return 0;
  const parts = tgl.split("/").map(Number);
  if (parts.length !== 3) return 0;
  const [d, m, y] = parts;
  return new Date(y, m - 1, d).getTime();
}

/**
 * Hitung alihan kas kronologis untuk satu siswa:
 * Jika siswa bayar double atau lebih dari kewajiban di satu pertemuan,
 * sisanya otomatis dialihkan ke minggu selanjutnya.
 */
export function calculateStudentKas(
  records: TaggedRecord[],
  defaultNominal = KAS_RUTIN_DEFAULT,
  onlyWhenHadir = true
): StudentKasSummary {
  if (records.length === 0) {
    return {
      nama: "",
      kelas: "",
      gen: "" as Gen,
      totalMeetings: 0,
      totalHadir: 0,
      totalRequired: 0,
      totalPaid: 0,
      totalUsed: 0,
      currentSurplus: 0,
      currentDebt: 0,
      netBalance: 0,
      coveredWeeksCount: 0,
      unpaidMeetingsCount: 0,
      status: "LUNAS",
      statusBadge: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border-emerald-500/30",
      statusText: "Lunas",
      meetings: [],
    };
  }

  // Dedup: gabungkan record yang memiliki tanggal + statusAbsen sama
  // (mencegah inflasi hitungan akibat double-submit)
  const dedupedMap = new Map<string, TaggedRecord>();
  for (const r of records) {
    const key = `${r.tanggal}|${r.statusAbsen}`;
    const existing = dedupedMap.get(key);
    if (existing) {
      // Gabungkan: jumlahkan nominalKas, pertahankan record terbaru
      dedupedMap.set(key, {
        ...existing,
        nominalKas: (Number(existing.nominalKas) || 0) + (Number(r.nominalKas) || 0),
      });
    } else {
      dedupedMap.set(key, r);
    }
  }
  const deduped = Array.from(dedupedMap.values());

  // Urutkan kronologis dari pertemuan terlama ke terbaru
  const sorted = deduped.sort(
    (a, b) => parseTanggalToTime(a.tanggal) - parseTanggalToTime(b.tanggal)
  );

  const nama = sorted[0].nama;
  const latestKelas = sorted[sorted.length - 1].kelas;
  const gen = sorted[0]._gen;

  let runningSurplus = 0;
  let totalRequired = 0;
  let totalPaid = 0;
  let totalUsed = 0;
  let totalHadir = 0;
  let unpaidMeetingsCount = 0;

  const meetings: MeetingKasDetail[] = [];

  for (const r of sorted) {
    const isHadir = r.statusAbsen === "Hadir";
    if (isHadir) totalHadir++;

    const isWajib = onlyWhenHadir ? isHadir : true;
    const required = isWajib ? defaultNominal : 0;
    const paid = Number(r.nominalKas) || 0;

    totalRequired += required;
    totalPaid += paid;

    const carriedFromPrevious = runningSurplus;
    const totalAvailable = paid + carriedFromPrevious;

    let usedThisMeeting = 0;
    let carriedToNext = 0;
    let shortage = 0;
    let status: MeetingKasStatus;
    let statusLabel = "";
    let badgeClass = "";
    let explanation = "";

    if (required > 0) {
      if (totalAvailable >= required) {
        usedThisMeeting = required;
        carriedToNext = totalAvailable - required;
        runningSurplus = carriedToNext;

        if (paid === 0) {
          status = "LUNAS_ALIHAN";
          statusLabel = `Lunas (Alihan ${formatRupiah(carriedFromPrevious)})`;
          badgeClass =
            "bg-blue-500/15 text-blue-600 dark:text-blue-300 border-blue-500/30";
          explanation = `Kewajiban ${formatRupiah(required)} terpenuhi penuh dari alihan saldo minggu sebelumnya (${formatRupiah(carriedFromPrevious)}).`;
        } else if (paid > required) {
          status = "BAYAR_LEBIH";
          statusLabel = `Bayar Lebih (+${formatRupiah(carriedToNext)})`;
          badgeClass =
            "bg-amber-500/15 text-amber-600 dark:text-amber-300 border-amber-500/30";
          explanation = `Bayar ${formatRupiah(paid)}. Digunakan ${formatRupiah(usedThisMeeting)}, sisa ${formatRupiah(carriedToNext)} dialihkan ke minggu selanjutnya.`;
        } else if (carriedFromPrevious > 0) {
          status = "LUNAS_ALIHAN";
          statusLabel = `Lunas (${formatRupiah(paid)} + Alihan ${formatRupiah(carriedFromPrevious)})`;
          badgeClass =
            "bg-blue-500/15 text-blue-600 dark:text-blue-300 border-blue-500/30";
          explanation = `Bayar ${formatRupiah(paid)} + alihan ${formatRupiah(carriedFromPrevious)} melunasi kewajiban ${formatRupiah(required)}.`;
        } else {
          status = "LUNAS";
          statusLabel = "Lunas";
          badgeClass =
            "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border-emerald-500/30";
          explanation = `Kewajiban ${formatRupiah(required)} dibayar lunas pas.`;
        }
      } else {
        // totalAvailable < required -> Menunggak
        usedThisMeeting = totalAvailable;
        shortage = required - totalAvailable;
        carriedToNext = 0;
        runningSurplus = 0;
        unpaidMeetingsCount++;

        status = "MENUNGGAK";
        statusLabel = `Nunggak ${formatRupiah(shortage)}`;
        badgeClass =
          "bg-danger/15 text-danger border-danger/30";
        if (totalAvailable > 0) {
          explanation = `Hanya terbayar ${formatRupiah(totalAvailable)} dari kewajiban ${formatRupiah(required)}. Kurang ${formatRupiah(shortage)}.`;
        } else {
          explanation = `Belum membayar iuran kas pertemuan ini (${formatRupiah(required)}).`;
        }
      }
    } else {
      // Tidak wajib bayar kas (Sakit / Izin / Alfa)
      usedThisMeeting = 0;
      if (paid > 0) {
        carriedToNext = totalAvailable;
        runningSurplus = carriedToNext;
        status = "BEBAS_BAYAR";
        statusLabel = `Titip Kas (+${formatRupiah(paid)})`;
        badgeClass =
          "bg-indigo-500/15 text-indigo-600 dark:text-indigo-300 border-indigo-500/30";
        explanation = `Status ${r.statusAbsen} (tidak wajib kas), tetapi menyetor ${formatRupiah(paid)} yang dialihkan ke minggu selanjutnya.`;
      } else {
        carriedToNext = carriedFromPrevious;
        status = "BEBAS";
        statusLabel = "Tidak Wajib";
        badgeClass = "bg-surface-2 text-muted border-border";
        explanation = `Status ${r.statusAbsen} (bebas kewajiban kas).`;
      }
    }

    totalUsed += usedThisMeeting;

    meetings.push({
      tanggal: r.tanggal,
      kelas: r.kelas,
      statusAbsen: r.statusAbsen,
      isWajib,
      required,
      paid,
      carriedFromPrevious,
      totalAvailable,
      usedThisMeeting,
      carriedToNext,
      shortage,
      status,
      statusLabel,
      badgeClass,
      explanation,
      rowId: r._rowId,
      gen,
    });
  }

  const netBalance = totalPaid - totalRequired;
  const currentSurplus = runningSurplus;
  // Total tunggakan adalah total shortage yang ada
  const currentDebt = meetings.reduce((acc, m) => acc + m.shortage, 0);

  let overallStatus: "LUNAS" | "LEBIH" | "MENUNGGAK" = "LUNAS";
  let statusBadge =
    "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border-emerald-500/30";
  let statusText = "Lunas";
  const coveredWeeksCount =
    defaultNominal > 0 ? Math.floor(currentSurplus / defaultNominal) : 0;

  if (currentDebt > 0) {
    overallStatus = "MENUNGGAK";
    statusBadge = "bg-danger/15 text-danger border-danger/30";
    statusText = `Nunggak ${formatRupiah(currentDebt)}`;
  } else if (currentSurplus > 0) {
    overallStatus = "LEBIH";
    statusBadge =
      "bg-amber-500/15 text-amber-600 dark:text-amber-300 border-amber-500/30";
    statusText =
      coveredWeeksCount > 0
        ? `Lebih ${formatRupiah(currentSurplus)} (+${coveredWeeksCount} mgg)`
        : `Lebih ${formatRupiah(currentSurplus)}`;
  }

  return {
    nama,
    kelas: latestKelas,
    gen,
    totalMeetings: sorted.length,
    totalHadir,
    totalRequired,
    totalPaid,
    totalUsed,
    currentSurplus,
    currentDebt,
    netBalance,
    coveredWeeksCount,
    unpaidMeetingsCount,
    status: overallStatus,
    statusBadge,
    statusText,
    meetings,
  };
}

/**
 * Hitung rekap alihan kas seluruh siswa & ringkasan organisasi
 */
export function calculateAllStudentsKas(
  records: TaggedRecord[],
  defaultNominal = KAS_RUTIN_DEFAULT,
  onlyWhenHadir = true
): {
  students: StudentKasSummary[];
  meetingDates: string[];
  orgSummary: OrgKasSummary;
} {
  // Kelompokkan records per siswa (gen + nama)
  const studentMap = new Map<string, TaggedRecord[]>();
  const dateSet = new Set<string>();

  for (const r of records) {
    if (!r.nama) continue;
    dateSet.add(r.tanggal);
    const key = `${r._gen}|${r.nama}`;
    const list = studentMap.get(key) || [];
    list.push(r);
    studentMap.set(key, list);
  }

  // Urutkan tanggal pertemuan secara kronologis
  const meetingDates = Array.from(dateSet).sort(
    (a, b) => parseTanggalToTime(a) - parseTanggalToTime(b)
  );

  const students: StudentKasSummary[] = [];

  for (const [, studentRecords] of studentMap) {
    const summary = calculateStudentKas(
      studentRecords,
      defaultNominal,
      onlyWhenHadir
    );
    students.push(summary);
  }

  // Sorting default: Gen asc -> Kelas asc -> Nama asc
  students.sort(
    (a, b) =>
      Number(a.gen) - Number(b.gen) ||
      a.kelas.localeCompare(b.kelas, "id") ||
      a.nama.localeCompare(b.nama, "id")
  );

  // Hitung KPI organisasi
  let totalPaid = 0;
  let totalRequired = 0;
  let totalSurplus = 0;
  let totalDebt = 0;
  let lunasCount = 0;
  let lebihCount = 0;
  let menunggakCount = 0;

  for (const s of students) {
    totalPaid += s.totalPaid;
    totalRequired += s.totalRequired;
    totalSurplus += s.currentSurplus;
    totalDebt += s.currentDebt;

    if (s.status === "LUNAS") lunasCount++;
    else if (s.status === "LEBIH") lebihCount++;
    else if (s.status === "MENUNGGAK") menunggakCount++;
  }

  const complianceRate =
    totalRequired > 0
      ? Math.min(100, Math.round(((totalPaid - totalSurplus) / totalRequired) * 1000) / 10)
      : 100;

  const orgSummary: OrgKasSummary = {
    totalPaid,
    totalRequired,
    totalSurplus,
    totalDebt,
    complianceRate,
    studentCounts: {
      total: students.length,
      lunas: lunasCount,
      lebih: lebihCount,
      menunggak: menunggakCount,
    },
  };

  return {
    students,
    meetingDates,
    orgSummary,
  };
}

/**
 * Helper pembuat pesan tagihan WhatsApp yang sopan & informatif
 */
export function generateWhatsAppReminderMessage(
  student: StudentKasSummary,
  orgName = "KTI SKAGARA"
): string {
  const unpaidList = student.meetings
    .filter((m) => m.status === "MENUNGGAK")
    .map((m) => `• Pertemuan ${m.tanggal}: Kurang ${formatRupiah(m.shortage)}`)
    .join("\n");

  if (student.currentDebt > 0) {
    return (
      `Halo *${student.nama}* (${student.kelas}) 👋\n\n` +
      `Dari bendahara *${orgName}*, ingin menginformasikan rekap iuran kas kamu saat ini:\n\n` +
      `📌 *Total Tunggakan:* *${formatRupiah(student.currentDebt)}*\n` +
      `Rincian pertemuan yang belum lunas:\n${unpaidList}\n\n` +
      `Mohon bantuannya untuk menyelesaikan pembayaran pada pertemuan berikutnya ya. Jika ada kendala atau data yang keliru, silakan hubungi bendahara. Terima kasih! 🙏`
    );
  }

  if (student.currentSurplus > 0) {
    return (
      `Halo *${student.nama}* (${student.kelas}) 👋\n\n` +
      `Informasi saldo kas kamu di *${orgName}*:\n` +
      `Status kamu *LUNAS* dan saat ini memiliki *Saldo Lebih sebesar ${formatRupiah(student.currentSurplus)}* ` +
      `(cukup untuk ${student.coveredWeeksCount} pertemuan ke depan).\n\n` +
      `Terima kasih atas kedisiplinan pembayaran kasnya! ✨`
    );
  }

  return (
    `Halo *${student.nama}* (${student.kelas}) 👋\n\n` +
    `Informasi kas kamu di *${orgName}* saat ini sudah *LUNAS* untuk seluruh pertemuan yang telah berjalan. Terima kasih atas kedisiplinannya! 👍`
  );
}
