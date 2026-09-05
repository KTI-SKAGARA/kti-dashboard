import type { Expense, Budget } from "@/types/finance";
import type { StudentKasSummary } from "@/lib/kas-allocation";
import { getTodayFormatted } from "@/lib/utils";

interface ExportFinanceParams {
  summary: {
    totalIncome: number;
    totalExpenses: number;
    balance: number;
    incomeByGen?: { gen: string; total: number }[];
  } | null;
  expenses: Expense[];
  students: StudentKasSummary[];
  meetingDates: string[];
  budgets?: Budget[];
  expenseCatTotals?: Record<string, number>;
  selectedGen?: string;
}

export async function exportFinanceWorkbook({
  summary,
  expenses,
  students,
  meetingDates,
  budgets = [],
  expenseCatTotals = {},
  selectedGen = "semua",
}: ExportFinanceParams) {
  const XLSX = await import("xlsx");
  const wb = XLSX.utils.book_new();
  const todayStr = getTodayFormatted().replace(/\//g, "-");

  // ==========================================
  // SHEET 1: RINGKASAN ARUS KAS
  // ==========================================
  const summaryAoa: (string | number)[][] = [
    ["LAPORAN REKAPITULASI KEUANGAN ORGANISASI"],
    ["KTI SKAGARA — SMK NEGERI 3 JEPARA"],
    ["Tanggal Export:", getTodayFormatted()],
    ["Filter Angkatan:", selectedGen === "semua" ? "Semua Angkatan" : `GEN ${selectedGen}`],
    [],
    ["=== RINGKASAN ARUS KAS UTAMA ==="],
    ["Metrik", "Nominal (Rp)"],
    ["Total Pemasukan (Cash In)", summary?.totalIncome || 0],
    ["Total Pengeluaran (Cash Out)", summary?.totalExpenses || 0],
    ["Saldo Kas Bersih", summary?.balance || 0],
    [],
    ["=== PEMASUKAN PER ANGKATAN (GEN) ==="],
    ["Angkatan", "Total Pemasukan (Rp)"],
  ];

  if (summary?.incomeByGen && summary.incomeByGen.length > 0) {
    for (const item of summary.incomeByGen) {
      summaryAoa.push([`GEN ${item.gen}`, item.total]);
    }
  } else {
    summaryAoa.push(["Data per angkatan belum tersedia", 0]);
  }

  summaryAoa.push([], ["=== PENGELUARAN PER KATEGORI ==="], ["Kategori", "Total Pengeluaran (Rp)"]);

  const catEntries = Object.entries(expenseCatTotals);
  if (catEntries.length > 0) {
    for (const [cat, total] of catEntries) {
      summaryAoa.push([cat, total]);
    }
  } else {
    summaryAoa.push(["Belum ada pengeluaran", 0]);
  }

  const summaryWs = XLSX.utils.aoa_to_sheet(summaryAoa);
  summaryWs["!cols"] = [{ wch: 35 }, { wch: 25 }];
  XLSX.utils.book_append_sheet(wb, summaryWs, "Ringkasan Arus Kas");

  // ==========================================
  // SHEET 2: IURAN KAS SISWA (MATRIKS)
  // ==========================================
  if (students.length > 0) {
    const studentRows = students.map((s, index) => {
      const dateMap = new Map(s.meetings.map((m) => [m.tanggal, m.statusLabel]));
      const row: Record<string, string | number> = {
        No: index + 1,
        Nama: s.nama,
        Gen: `GEN ${s.gen}`,
        Kelas: s.kelas || "—",
        "Total Hadir": s.totalHadir,
        "Total Pertemuan": s.totalMeetings,
        "Total Kas Dibayar (Rp)": s.totalPaid,
        "Total Kewajiban (Rp)": s.totalRequired,
        "Status Saldo": s.statusText,
        "Tunggakan (Rp)": s.currentDebt,
        "Saldo Lebih (Rp)": s.currentSurplus,
      };

      // Add dynamic meeting dates
      for (const d of meetingDates) {
        row[`Pertemuan ${d}`] = dateMap.get(d) || "-";
      }

      return row;
    });

    const studentWs = XLSX.utils.json_to_sheet(studentRows);

    // Auto calculate column widths
    const colWidths = [
      { wch: 6 },  // No
      { wch: 30 }, // Nama
      { wch: 10 }, // Gen
      { wch: 14 }, // Kelas
      { wch: 12 }, // Total Hadir
      { wch: 15 }, // Total Pertemuan
      { wch: 22 }, // Total Kas Dibayar
      { wch: 20 }, // Total Kewajiban
      { wch: 16 }, // Status Saldo
      { wch: 16 }, // Tunggakan
      { wch: 16 }, // Saldo Lebih
      ...meetingDates.map(() => ({ wch: 22 })),
    ];
    studentWs["!cols"] = colWidths;
    XLSX.utils.book_append_sheet(wb, studentWs, "Iuran Kas Siswa");
  }

  // ==========================================
  // SHEET 3: CATATAN PENGELUARAN (CASH OUT)
  // ==========================================
  if (expenses.length > 0) {
    const expenseRows = expenses.map((e, index) => ({
      No: index + 1,
      Tanggal: e.tanggal,
      "Bulan-Tahun": e.bulan_tahun,
      Kategori: e.category_nama || "Lainnya",
      "Deskripsi / Keperluan": e.deskripsi,
      "Nominal (Rp)": e.nominal,
      Status: e.status.toUpperCase(),
    }));

    const expenseWs = XLSX.utils.json_to_sheet(expenseRows);
    expenseWs["!cols"] = [
      { wch: 6 },
      { wch: 14 },
      { wch: 14 },
      { wch: 20 },
      { wch: 38 },
      { wch: 18 },
      { wch: 14 },
    ];
    XLSX.utils.book_append_sheet(wb, expenseWs, "Catatan Pengeluaran");
  }

  // ==========================================
  // SHEET 4: TARGET ANGGARAN (BUDGET)
  // ==========================================
  if (budgets.length > 0) {
    const budgetRows = budgets.map((b, index) => {
      const cat = b.category_nama || "Lainnya";
      const spent = expenseCatTotals[cat] || 0;
      const remaining = b.target_nominal - spent;
      return {
        No: index + 1,
        "Bulan-Tahun": b.bulan_tahun,
        Kategori: cat,
        "Target Anggaran (Rp)": b.target_nominal,
        "Realisasi Terpakai (Rp)": spent,
        "Sisa Anggaran (Rp)": remaining,
        Catatan: b.catatan || "—",
      };
    });

    const budgetWs = XLSX.utils.json_to_sheet(budgetRows);
    budgetWs["!cols"] = [
      { wch: 6 },
      { wch: 14 },
      { wch: 20 },
      { wch: 22 },
      { wch: 22 },
      { wch: 22 },
      { wch: 30 },
    ];
    XLSX.utils.book_append_sheet(wb, budgetWs, "Target Anggaran");
  }

  // Generate and download workbook
  const filename = `Rekap_Keuangan_KTI_SKAGARA_${selectedGen}_${todayStr}.xlsx`;
  XLSX.writeFile(wb, filename);
}
