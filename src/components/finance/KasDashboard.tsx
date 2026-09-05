"use client";

import { useState, useMemo, useCallback } from "react";
import {
  Coins,
  Search,
  Download,
  Plus,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Sparkles,
  RefreshCw,
  LayoutGrid,
  Table,
  MessageSquare,
  FileSpreadsheet,
} from "lucide-react";
import type { Gen, TaggedRecord } from "@/types/attendance";
import { KAS_RUTIN_DEFAULT } from "@/types/attendance";
import type { Expense, Budget } from "@/types/finance";
import {
  calculateAllStudentsKas,
  type StudentKasSummary,
  type MeetingKasDetail,
} from "@/lib/kas-allocation";
import { formatRupiah, getGenBadgeColor, getTodayFormatted } from "@/lib/utils";
import { recordDirectKasPayment } from "@/app/actions/attendance";
import { exportFinanceWorkbook } from "@/lib/export-finance";
import StudentKasModal from "./StudentKasModal";
import KasPaymentModal from "./KasPaymentModal";
import WhatsAppRekapModal from "./WhatsAppRekapModal";
import Toast from "@/components/Toast";

interface Props {
  gens: Gen[];
  records: TaggedRecord[];
  loading: boolean;
  onRefresh: () => Promise<void>;
  expenses?: Expense[];
  summary?: {
    totalIncome: number;
    totalExpenses: number;
    balance: number;
    incomeByGen: { gen: string; total: number }[];
  } | null;
  budgets?: Budget[];
  expenseCatTotals?: Record<string, number>;
}

type StatusFilter = "semua" | "menunggak" | "lunas" | "lebih";

export default function KasDashboard({
  gens,
  records,
  loading,
  onRefresh,
  expenses = [],
  summary = null,
  budgets = [],
  expenseCatTotals = {},
}: Props) {
  const [selectedGen, setSelectedGen] = useState<string>("semua");
  const [selectedKelas, setSelectedKelas] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("semua");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [onlyWhenHadir, setOnlyWhenHadir] = useState<boolean>(true);
  const [nominalRutin] = useState<number>(KAS_RUTIN_DEFAULT);
  const [viewLayout, setViewLayout] = useState<"matriks" | "kartu">("matriks");

  // Selected student for detail modal
  const [selectedStudent, setSelectedStudent] = useState<StudentKasSummary | null>(null);

  // WhatsApp broadcast modal state
  const [rekapWaOpen, setRekapWaOpen] = useState<boolean>(false);

  // Excel exporting state
  const [exportingExcel, setExportingExcel] = useState<boolean>(false);

  // Payment modal state
  const [paymentModalOpen, setPaymentModalOpen] = useState<boolean>(false);
  const [paymentInitialData, setPaymentInitialData] = useState<{
    gen?: Gen;
    nama?: string;
    kelas?: string;
    tanggal?: string;
    nominalKas?: number;
    rowId?: string;
  } | null>(null);

  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(
    null
  );
  const [refreshing, setRefreshing] = useState(false);

  // Filter records by selected Gen first
  const genRecords = useMemo(() => {
    if (selectedGen === "semua") return records;
    return records.filter((r) => r._gen === selectedGen);
  }, [records, selectedGen]);

  // Run allocation engine
  const { students, meetingDates, orgSummary } = useMemo(() => {
    return calculateAllStudentsKas(genRecords, nominalRutin, onlyWhenHadir);
  }, [genRecords, nominalRutin, onlyWhenHadir]);

  // Extract unique classes for filter
  const availableClasses = useMemo(() => {
    const set = new Set<string>();
    for (const s of students) {
      if (s.kelas) set.add(s.kelas);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, "id"));
  }, [students]);

  // Apply search & filters
  const filteredStudents = useMemo(() => {
    const q = searchQuery.toUpperCase().trim();
    return students.filter((s) => {
      if (q && !s.nama.toUpperCase().includes(q)) return false;
      if (selectedKelas && s.kelas !== selectedKelas) return false;
      if (statusFilter === "menunggak" && s.status !== "MENUNGGAK") return false;
      if (statusFilter === "lunas" && s.status !== "LUNAS") return false;
      if (statusFilter === "lebih" && s.status !== "LEBIH") return false;
      return true;
    });
  }, [students, searchQuery, selectedKelas, statusFilter]);

  // Handle manual refresh
  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await onRefresh();
      setToast({ type: "success", message: "Data kas berhasil diperbarui." });
    } catch {
      setToast({ type: "error", message: "Gagal memperbarui data kas." });
    } finally {
      setRefreshing(false);
      setTimeout(() => setToast(null), 3000);
    }
  };

  // Quick 1-tap payment handler for phone ergonomics
  const handleQuickPay = async (s: StudentKasSummary, nominal: number) => {
    try {
      if (typeof navigator !== "undefined" && navigator.vibrate) {
        navigator.vibrate([15, 30, 15]);
      }
      const lastDate = meetingDates[meetingDates.length - 1] || getTodayFormatted();
      const res = await recordDirectKasPayment({
        gen: s.gen,
        nama: s.nama,
        kelas: s.kelas,
        tanggal: lastDate,
        nominalKas: nominal,
      });
      if (res.success) {
        setToast({
          type: "success",
          message: `Kas ${s.nama} (${formatRupiah(nominal)}) berhasil dicatat!`,
        });
        await onRefresh();
        setSelectedStudent(null);
      } else {
        setToast({ type: "error", message: res.error || "Gagal mencatat kas." });
      }
    } catch {
      setToast({ type: "error", message: "Gagal mencatat kas." });
    } finally {
      setTimeout(() => setToast(null), 3000);
    }
  };

  // Export CSV
  const handleExportCSV = useCallback(() => {
    if (filteredStudents.length === 0) return;

    const headers = [
      "Nama",
      "Gen",
      "Kelas",
      "Total Hadir",
      "Total Pertemuan",
      "Total Kas Dibayar",
      "Total Kewajiban",
      "Status Saldo",
      "Tunggakan (Rp)",
      "Saldo Lebih (Rp)",
      ...meetingDates.map((d) => `Pertemuan ${d}`),
    ];

    const rows = filteredStudents.map((s) => {
      const dateMap = new Map(s.meetings.map((m) => [m.tanggal, m.statusLabel]));
      return [
        `"${s.nama}"`,
        `"Gen ${s.gen}"`,
        `"${s.kelas}"`,
        s.totalHadir,
        s.totalMeetings,
        s.totalPaid,
        s.totalRequired,
        `"${s.statusText}"`,
        s.currentDebt,
        s.currentSurplus,
        ...meetingDates.map((d) => `"${dateMap.get(d) || "-"}"`),
      ].join(",");
    });

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `rekap_kas_skagara_${selectedGen}_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [filteredStudents, meetingDates, selectedGen]);

  // Export Excel (.xlsx) multi-sheet
  const handleExportExcel = useCallback(async () => {
    if (filteredStudents.length === 0) return;
    setExportingExcel(true);
    try {
      await exportFinanceWorkbook({
        summary: summary || {
          totalIncome: orgSummary.totalPaid,
          totalExpenses: 0,
          balance: orgSummary.totalPaid,
        },
        expenses,
        students: filteredStudents,
        meetingDates,
        budgets,
        expenseCatTotals,
        selectedGen,
      });
      setToast({ type: "success", message: "File Excel keuangan berhasil diunduh!" });
    } catch {
      setToast({ type: "error", message: "Gagal mengunduh file Excel." });
    } finally {
      setExportingExcel(false);
      setTimeout(() => setToast(null), 3000);
    }
  }, [
    filteredStudents,
    meetingDates,
    selectedGen,
    summary,
    orgSummary,
    expenses,
    budgets,
    expenseCatTotals,
  ]);

  // Open edit modal for specific meeting
  const handleEditMeeting = (m: MeetingKasDetail) => {
    if (!selectedStudent) return;
    setPaymentInitialData({
      gen: m.gen,
      nama: selectedStudent.nama,
      kelas: m.kelas,
      tanggal: m.tanggal,
      nominalKas: m.paid,
      rowId: m.rowId,
    });
    setPaymentModalOpen(true);
  };

  // Open modal for recording new payment for student
  const handleAddPaymentForStudent = (s: StudentKasSummary) => {
    setPaymentInitialData({
      gen: s.gen,
      nama: s.nama,
      kelas: s.kelas,
      tanggal: meetingDates[meetingDates.length - 1] || "",
      nominalKas: nominalRutin,
    });
    setPaymentModalOpen(true);
  };

  return (
    <div className="space-y-5">
      {toast && <Toast type={toast.type} message={toast.message} />}

      {/* KPI Cards — Double-Bezel Bento Grid */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {/* Total Kas Masuk */}
        <div className="group relative rounded-2xl border border-border/80 bg-surface-alt/40 p-1.5 shadow-xs transition-all duration-300 hover:border-accent/40 hover:shadow-sm">
          <div className="flex h-full flex-col justify-between rounded-xl border border-border/60 bg-surface p-4 transition-all">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1 rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-accent">
                Terkumpul
              </span>
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-accent/10 text-accent transition-transform duration-300 group-hover:scale-110">
                <Coins className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-3">
              <p className="font-mono text-xl font-black tracking-tight text-foreground sm:text-2xl">
                {formatRupiah(orgSummary.totalPaid)}
              </p>
              <p className="mt-1 text-[11px] font-medium text-muted">
                Dari {orgSummary.studentCounts.total} siswa tercatat
              </p>
            </div>
          </div>
        </div>

        {/* Total Tunggakan */}
        <div className="group relative rounded-2xl border border-border/80 bg-surface-alt/40 p-1.5 shadow-xs transition-all duration-300 hover:border-danger/40 hover:shadow-sm">
          <div className="flex h-full flex-col justify-between rounded-xl border border-border/60 bg-surface p-4 transition-all">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1 rounded-full bg-danger/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-danger">
                Tunggakan
              </span>
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-danger/10 text-danger transition-transform duration-300 group-hover:scale-110">
                <AlertCircle className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-3">
              <p className="font-mono text-xl font-black tracking-tight text-danger sm:text-2xl">
                {formatRupiah(orgSummary.totalDebt)}
              </p>
              <p className="mt-1 text-[11px] font-medium text-danger/90">
                {orgSummary.studentCounts.menunggak} siswa menunggak
              </p>
            </div>
          </div>
        </div>

        {/* Saldo Lebih / Titipan */}
        <div className="group relative rounded-2xl border border-border/80 bg-surface-alt/40 p-1.5 shadow-xs transition-all duration-300 hover:border-amber-500/40 hover:shadow-sm">
          <div className="flex h-full flex-col justify-between rounded-xl border border-border/60 bg-surface p-4 transition-all">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                Titipan Alihan
              </span>
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 transition-transform duration-300 group-hover:scale-110">
                <Sparkles className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-3">
              <p className="font-mono text-xl font-black tracking-tight text-amber-600 dark:text-amber-400 sm:text-2xl">
                {formatRupiah(orgSummary.totalSurplus)}
              </p>
              <p className="mt-1 text-[11px] font-medium text-muted">
                {orgSummary.studentCounts.lebih} siswa bayar di muka
              </p>
            </div>
          </div>
        </div>

        {/* Tingkat Kepatuhan */}
        <div className="group relative rounded-2xl border border-border/80 bg-surface-alt/40 p-1.5 shadow-xs transition-all duration-300 hover:border-emerald-500/40 hover:shadow-sm">
          <div className="flex h-full flex-col justify-between rounded-xl border border-border/60 bg-surface p-4 transition-all">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                Kepatuhan Kas
              </span>
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 transition-transform duration-300 group-hover:scale-110">
                <CheckCircle2 className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="flex items-baseline gap-1.5">
                <p className="font-mono text-xl font-black tracking-tight text-emerald-600 dark:text-emerald-400 sm:text-2xl">
                  {orgSummary.complianceRate}%
                </p>
                <span className="text-[11px] font-medium text-muted">disiplin</span>
              </div>
              <p className="mt-1 text-[11px] font-medium text-muted">
                {orgSummary.studentCounts.lunas + orgSummary.studentCounts.lebih} dari {orgSummary.studentCounts.total} siswa
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Control & Filter Tray — Double-Bezel Architecture */}
      <div className="rounded-2xl border border-border/80 bg-surface-alt/40 p-2 shadow-xs">
        <div className="rounded-xl border border-border/60 bg-surface p-3.5 space-y-3">
          {/* Gen Tabs & Action Buttons */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-3">
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 max-w-full">
              <span className="mr-1 text-[11px] font-bold uppercase tracking-wider text-muted shrink-0">
                Angkatan:
              </span>
              <button
                onClick={() => setSelectedGen("semua")}
                className={`inline-flex shrink-0 min-h-[36px] items-center rounded-xl px-3 py-1.5 text-xs font-semibold transition-all duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-[0.98] ${
                  selectedGen === "semua"
                    ? "bg-accent text-accent-foreground shadow-xs font-bold"
                    : "bg-surface-alt/60 text-muted hover:text-foreground hover:bg-surface-2"
                }`}
              >
                Semua Gen
              </button>
              {gens.map((g) => (
                <button
                  key={g}
                  onClick={() => setSelectedGen(g)}
                  className={`inline-flex shrink-0 min-h-[36px] items-center rounded-xl px-3 py-1.5 text-xs font-semibold transition-all duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-[0.98] ${
                    selectedGen === g
                      ? "bg-accent text-accent-foreground shadow-xs font-bold"
                      : "bg-surface-alt/60 text-muted hover:text-foreground hover:bg-surface-2"
                  }`}
                >
                  Gen {g}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setRekapWaOpen(true)}
                className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3 text-xs font-bold text-emerald-600 dark:text-emerald-400 transition-all duration-200 hover:bg-emerald-500/20 active:scale-[0.98] shadow-2xs"
                title="Format & Salin pesan rekap kas untuk grup WhatsApp"
              >
                <MessageSquare className="h-3.5 w-3.5" />
                <span>Rekap WA</span>
              </button>

              <button
                onClick={handleExportExcel}
                disabled={exportingExcel || filteredStudents.length === 0}
                className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl border border-border/80 bg-surface-alt/50 px-3 text-xs font-bold text-foreground transition-all duration-200 hover:bg-surface-2 active:scale-[0.98]"
                title="Download buku kas format Excel (.xlsx)"
              >
                {exportingExcel ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-accent" />
                ) : (
                  <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                )}
                <span className="hidden sm:inline">Export Excel</span>
              </button>

              <button
                onClick={handleExportCSV}
                disabled={filteredStudents.length === 0}
                className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl border border-border/80 bg-surface-alt/50 px-2.5 text-xs font-medium text-muted hover:text-foreground transition-all duration-200 hover:bg-surface-2 active:scale-[0.98]"
                title="Download rekap CSV sederhana"
              >
                <Download className="h-3.5 w-3.5" />
                <span className="hidden md:inline">CSV</span>
              </button>

              <button
                onClick={handleRefresh}
                disabled={refreshing || loading}
                className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl border border-border/80 bg-surface-alt/50 px-3 text-xs font-semibold text-foreground transition-all duration-200 hover:bg-surface-2 active:scale-[0.98]"
                title="Perbarui data dari sheet"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
                <span className="hidden sm:inline">Refresh</span>
              </button>

              <button
                onClick={() => {
                  setPaymentInitialData(null);
                  setPaymentModalOpen(true);
                }}
                className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl bg-accent px-4 text-xs font-bold text-accent-foreground shadow-xs transition-all duration-200 hover:brightness-105 active:scale-[0.98]"
              >
                <Plus className="h-4 w-4" />
                <span>Catat Kas</span>
              </button>
            </div>
          </div>

          {/* Secondary filters: Search, Kelas, Status, Toggle */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Search Box with icon */}
            <div className="relative min-w-[200px] flex-1">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
              <input
                type="text"
                placeholder="Cari nama siswa..."
                className="input !h-9 pl-8 text-xs uppercase rounded-xl border-border/80 bg-surface focus:ring-2 focus:ring-accent/20"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {/* Kelas Dropdown */}
            <div className="w-36 sm:w-40">
              <select
                className="select !h-9 text-xs rounded-xl border-border/80 bg-surface"
                value={selectedKelas}
                onChange={(e) => setSelectedKelas(e.target.value)}
              >
                <option value="">Semua Kelas</option>
                {availableClasses.map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </select>
            </div>

            {/* Status Filter Dropdown */}
            <div className="w-40 sm:w-48">
              <select
                className="select !h-9 text-xs font-medium rounded-xl border-border/80 bg-surface"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              >
                <option value="semua">Semua Status</option>
                <option value="menunggak">🔴 Hanya Menunggak</option>
                <option value="lebih">🟡 Hanya Bayar di Muka (Lebih)</option>
                <option value="lunas">🟢 Hanya Lunas</option>
              </select>
            </div>

            {/* Setting Toggle: Hanya Saat Hadir */}
            <div className="flex items-center gap-2 rounded-xl border border-border/80 bg-surface-alt/50 px-3 py-1.5 text-xs">
              <label className="cursor-pointer select-none font-medium text-muted flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={onlyWhenHadir}
                  onChange={(e) => setOnlyWhenHadir(e.target.checked)}
                  className="rounded border-border text-accent focus:ring-accent"
                />
                <span className="hidden sm:inline">Wajib Kas Hanya Saat Hadir</span>
                <span className="sm:hidden">Wajib Saat Hadir</span>
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* Main Kas Section — Double Bezel Architecture */}
      <div className="rounded-2xl border border-border/80 bg-surface shadow-xs overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 bg-surface-alt/40 px-4 py-3">
          <div className="flex items-center gap-2.5">
            <span className="font-display text-xs font-extrabold uppercase tracking-wider text-foreground">
              Rekap Kas Siswa
            </span>
            <span className="inline-flex items-center rounded-full bg-surface px-2 py-0.5 font-mono text-[10px] font-bold text-muted border border-border/60">
              {filteredStudents.length} Siswa
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Legend for Matrix & Status */}
            <div className="hidden md:flex flex-wrap items-center gap-2 text-[10px] font-medium text-muted mr-1">
              <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-1.5 py-0.5 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Lunas
              </span>
              <span className="inline-flex items-center gap-1 rounded-md bg-sky-500/10 px-1.5 py-0.5 text-sky-600 dark:text-sky-400 border border-sky-500/20">
                <span className="h-1.5 w-1.5 rounded-full bg-sky-500" /> Alihan
              </span>
              <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/10 px-1.5 py-0.5 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500" /> Lebih
              </span>
              <span className="inline-flex items-center gap-1 rounded-md bg-danger/10 px-1.5 py-0.5 text-danger border border-danger/20">
                <span className="h-1.5 w-1.5 rounded-full bg-danger" /> Nunggak
              </span>
            </div>

            {/* Layout Toggle (Tabel Tanggal vs Kartu Ringkas) */}
            <div className="inline-flex items-center gap-1 rounded-xl border border-border/80 bg-surface p-1 shadow-2xs">
              <button
                type="button"
                onClick={() => setViewLayout("matriks")}
                className={`inline-flex min-h-[34px] items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-bold transition-all ${
                  viewLayout === "matriks"
                    ? "bg-accent text-accent-foreground shadow-xs"
                    : "text-muted hover:text-foreground hover:bg-surface-alt/60"
                }`}
                title="Tampilan tabel matriks per tanggal lengkap"
              >
                <Table className="h-3.5 w-3.5" />
                <span>Tabel Tanggal</span>
              </button>
              <button
                type="button"
                onClick={() => setViewLayout("kartu")}
                className={`inline-flex min-h-[34px] items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-bold transition-all ${
                  viewLayout === "kartu"
                    ? "bg-accent text-accent-foreground shadow-xs"
                    : "text-muted hover:text-foreground hover:bg-surface-alt/60"
                }`}
                title="Tampilan kartu cepat cocok untuk HP"
              >
                <LayoutGrid className="h-3.5 w-3.5" />
                <span>Kartu Ringkas</span>
              </button>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-accent" />
          </div>
        ) : filteredStudents.length === 0 ? (
          <div className="py-12 text-center text-xs text-muted">
            <p className="font-semibold text-foreground">Tidak ada data siswa yang cocok.</p>
            <p className="mt-1">Coba sesuaikan filter atau kata kunci pencarian.</p>
          </div>
        ) : viewLayout === "kartu" ? (
          /* Mobile-First Kartu HP Layout */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 p-3 sm:p-4">
            {filteredStudents.map((s) => (
              <div
                key={`${s.gen}-${s.nama}`}
                className="group rounded-2xl border border-border/80 bg-surface p-3.5 shadow-2xs hover:border-accent/40 transition-all flex flex-col justify-between gap-2.5"
              >
                <div>
                  {/* Top row: Name & Gen/Kelas */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p
                        onClick={() => setSelectedStudent(s)}
                        className="font-display text-sm font-extrabold uppercase tracking-tight text-foreground truncate cursor-pointer group-hover:text-accent transition-colors"
                      >
                        {s.nama}
                      </p>
                      <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-muted">
                        <span className={`badge text-[9px] font-bold ${getGenBadgeColor(s.gen)}`}>
                          Gen {s.gen}
                        </span>
                        <span>•</span>
                        <span className="font-medium text-foreground">{s.kelas}</span>
                      </div>
                    </div>
                    <span className={`badge border text-[10px] font-bold shrink-0 ${s.statusBadge}`}>
                      {s.statusText}
                    </span>
                  </div>

                  {/* Summary pill */}
                  <div className="mt-2.5 flex items-center justify-between rounded-xl bg-surface-alt/50 px-3 py-1.5 text-[11px]">
                    <span className="text-muted">
                      Hadir: <strong className="text-foreground font-mono">{s.totalHadir}/{s.totalMeetings}</strong>
                    </span>
                    <span className="text-muted">
                      Total: <strong className="text-accent font-mono">{formatRupiah(s.totalPaid)}</strong>
                    </span>
                  </div>

                  {/* Short Debt / Surplus status callout */}
                  {s.currentDebt > 0 && (
                    <p className="mt-1.5 text-[11px] font-semibold text-danger">
                      ⚠️ Menunggak {formatRupiah(s.currentDebt)} ({s.unpaidMeetingsCount} mgg)
                    </p>
                  )}
                  {s.currentSurplus > 0 && (
                    <p className="mt-1.5 text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                      ✨ Ada alihan {formatRupiah(s.currentSurplus)} ({s.coveredWeeksCount} mgg ke depan)
                    </p>
                  )}
                </div>

                {/* 1-Tap Quick Actions Bar (Ultra convenient for phone bendahara) */}
                <div className="flex items-center gap-1.5 border-t border-border/60 pt-2.5">
                  <button
                    onClick={() => handleQuickPay(s, 2000)}
                    className="flex-1 min-h-[38px] inline-flex items-center justify-center rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-xs font-bold transition-all hover:bg-emerald-500/20 active:scale-[0.96]"
                    title="1-tap catat bayar Rp 2.000 pas"
                  >
                    +2k Lunas
                  </button>
                  <button
                    onClick={() => handleQuickPay(s, 4000)}
                    className="flex-1 min-h-[38px] inline-flex items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300 text-xs font-bold transition-all hover:bg-amber-500/20 active:scale-[0.96]"
                    title="1-tap catat bayar dobel Rp 4.000 (sisa otomatis dialihkan)"
                  >
                    +4k (+Alih)
                  </button>
                  <button
                    onClick={() => setSelectedStudent(s)}
                    className="min-h-[38px] px-3 inline-flex items-center justify-center rounded-xl border border-border/80 bg-surface-alt/60 text-foreground text-xs font-semibold hover:bg-surface-2 active:scale-[0.96]"
                    title="Buka rincian kronologis & kirim WA"
                  >
                    Detail / WA
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* Matriks Table view */
          <div>
            <div className="bg-surface-alt/40 border-b border-border/60 px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
              <span className="flex items-center gap-1.5 font-medium">
                💡 <strong className="text-foreground">Tabel Buku Kas:</strong> Setiap kolom adalah tanggal pertemuan. Geser tabel ke kanan untuk melihat seluruh riwayat tanggal.
              </span>
              <span className="badge bg-surface text-accent border border-border/80 font-mono text-[10px] font-bold">
                {meetingDates.length} Tanggal Pertemuan
              </span>
            </div>

            <div className="overflow-x-auto max-h-[65vh] overflow-y-auto relative border-b border-border/60">
              <table className="data-table !text-xs whitespace-nowrap w-full">
                <thead className="sticky top-0 z-20 bg-surface-alt/95 backdrop-blur-xs shadow-xs">
                  <tr>
                    <th className="min-w-[200px] sticky left-0 bg-surface-alt/95 z-30 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.15)] text-left px-3">
                      Siswa
                    </th>
                    <th>Gen</th>
                    <th>Kelas</th>
                    <th className="text-center">Hadir</th>
                    <th className="text-right">Total Bayar</th>
                    <th className="text-center min-w-[130px]">Status Saldo</th>
                    {meetingDates.map((d, i) => (
                      <th
                        key={d}
                        className="text-center px-3 py-2.5 min-w-[125px] bg-surface-alt/95 border-b-2 border-border"
                      >
                        <div className="flex flex-col items-center">
                          <span className="text-[10px] font-extrabold uppercase tracking-wider text-accent">
                            P{i + 1}
                          </span>
                          <span className="font-mono text-xs font-black text-foreground">
                            {d}
                          </span>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredStudents.map((s, idx) => {
                    const meetingMap = new Map(s.meetings.map((m) => [m.tanggal, m]));

                    return (
                      <tr
                        key={`${s.gen}-${s.nama}`}
                        className="group cursor-pointer hover:bg-surface-alt/60 transition-all duration-150"
                        onClick={() => setSelectedStudent(s)}
                      >
                        <td className="sticky left-0 bg-surface group-hover:bg-surface-alt/80 z-10 font-bold uppercase text-foreground shadow-[2px_0_4px_-2px_rgba(0,0,0,0.15)] transition-colors px-3 py-2">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-[10px] text-muted w-5 text-right shrink-0">
                              {idx + 1}.
                            </span>
                            <span className="truncate group-hover:text-accent transition-colors font-bold text-xs">
                              {s.nama}
                            </span>
                          </div>
                        </td>
                        <td>
                          <span className={`badge text-[9px] font-bold ${getGenBadgeColor(s.gen)}`}>
                            Gen {s.gen}
                          </span>
                        </td>
                        <td className="text-muted font-medium">{s.kelas}</td>
                        <td className="text-center font-mono text-muted">
                          {s.totalHadir} <span className="text-[10px]">/ {s.totalMeetings}</span>
                        </td>
                        <td className="text-right font-mono font-bold text-accent">
                          {formatRupiah(s.totalPaid)}
                        </td>
                        <td className="text-center">
                          <span
                            className={`badge border text-[10px] font-bold px-2 py-0.5 ${s.statusBadge}`}
                          >
                            {s.statusText}
                          </span>
                        </td>

                        {/* Meeting Dates Cells */}
                        {meetingDates.map((d) => {
                          const m = meetingMap.get(d);
                          if (!m) {
                            return (
                              <td key={d} className="text-center text-muted/40 font-mono text-[11px]">
                                —
                              </td>
                            );
                          }

                          let cellClass = "bg-surface-alt/50 text-muted border-border/60";
                          let cellText = formatRupiah(m.paid);
                          let subText: string | null = null;

                          if (m.status === "LUNAS") {
                            cellClass =
                              "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/25 ring-1 ring-emerald-500/10";
                            cellText = formatRupiah(m.paid);
                          } else if (m.status === "LUNAS_ALIHAN") {
                            cellClass =
                              "bg-sky-500/10 text-sky-700 dark:text-sky-400 border-sky-500/25 ring-1 ring-sky-500/10";
                            cellText = "⏩ Alihan";
                            subText = formatRupiah(m.usedThisMeeting);
                          } else if (m.status === "BAYAR_LEBIH") {
                            cellClass =
                              "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/25 ring-1 ring-amber-500/10";
                            cellText = formatRupiah(m.paid);
                            subText = `+${formatRupiah(m.carriedToNext)} alih`;
                          } else if (m.status === "MENUNGGAK") {
                            cellClass =
                              "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/25 ring-1 ring-rose-500/10 font-bold";
                            cellText = `❌ Kurang`;
                            subText = formatRupiah(m.shortage);
                          } else if (m.status === "BEBAS_BAYAR") {
                            cellClass =
                              "bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/25 ring-1 ring-purple-500/10";
                            cellText = `Titip ${formatRupiah(m.paid)}`;
                          } else {
                            cellText = "—";
                          }

                          return (
                            <td key={d} className="text-center p-1">
                              <div
                                className={`rounded-lg border px-2 py-1 flex flex-col items-center justify-center transition-transform group-hover:scale-[1.02] ${cellClass}`}
                              >
                                <span className="font-mono text-[10px] font-bold leading-tight">
                                  {cellText}
                                </span>
                                {subText && (
                                  <span className="font-mono text-[9px] font-semibold opacity-90 leading-tight">
                                    {subText}
                                  </span>
                                )}
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>

                {/* Footer Row: Total Kas per Tanggal Pertemuan */}
                {filteredStudents.length > 0 && (
                  <tfoot>
                    <tr className="bg-surface-alt/95 font-bold border-t-2 border-border sticky bottom-0 z-10 shadow-[0_-2px_4px_rgba(0,0,0,0.08)]">
                      <td colSpan={3} className="text-right py-3 px-3 text-xs uppercase tracking-wider text-foreground">
                        Total Kas Terkumpul:
                      </td>
                      <td className="text-center font-mono text-xs text-muted">
                        {filteredStudents.reduce((acc, s) => acc + s.totalHadir, 0)} mgg
                      </td>
                      <td className="text-right font-mono text-xs font-black text-accent">
                        {formatRupiah(filteredStudents.reduce((acc, s) => acc + s.totalPaid, 0))}
                      </td>
                      <td className="text-center text-[10px] text-muted">
                        {filteredStudents.filter((s) => s.status === "LUNAS" || s.status === "LEBIH").length} Lunas
                      </td>

                      {/* Total Kas Masuk Tiap Tanggal */}
                      {meetingDates.map((d) => {
                        const totalOnDate = filteredStudents.reduce((acc, s) => {
                          const m = s.meetings.find((x) => x.tanggal === d);
                          return acc + (m ? m.paid : 0);
                        }, 0);
                        const payingCount = filteredStudents.filter((s) => {
                          const m = s.meetings.find((x) => x.tanggal === d);
                          return m && m.paid > 0;
                        }).length;

                        return (
                          <td key={d} className="text-center py-2.5 px-2 bg-emerald-500/5 border-l border-border/40">
                            <div className="flex flex-col items-center justify-center">
                              <span className="font-mono text-xs font-black text-emerald-600 dark:text-emerald-400">
                                {formatRupiah(totalOnDate)}
                              </span>
                              <span className="text-[9px] text-muted font-normal">
                                {payingCount} siswa
                              </span>
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Student Detail Modal */}
      {selectedStudent && (
        <StudentKasModal
          student={selectedStudent}
          onClose={() => setSelectedStudent(null)}
          onEditMeeting={handleEditMeeting}
          onAddPayment={handleAddPaymentForStudent}
          onQuickPay={handleQuickPay}
        />
      )}

      {/* Record Kas Payment Modal */}
      <KasPaymentModal
        open={paymentModalOpen}
        onClose={() => setPaymentModalOpen(false)}
        onSuccess={async () => {
          setToast({ type: "success", message: "Pembayaran kas berhasil disimpan!" });
          await onRefresh();
          // Update selected student if modal was open
          if (selectedStudent) {
            setSelectedStudent(null);
          }
          setTimeout(() => setToast(null), 3000);
        }}
        gens={gens}
        availableDates={meetingDates}
        initialData={paymentInitialData}
      />

      {/* WhatsApp Broadcast Rekap Modal */}
      <WhatsAppRekapModal
        open={rekapWaOpen}
        onClose={() => setRekapWaOpen(false)}
        students={students}
        meetingDates={meetingDates}
        gens={gens}
        initialGen={selectedGen}
        initialKelas={selectedKelas}
        nominalRutin={nominalRutin}
      />
    </div>
  );
}
