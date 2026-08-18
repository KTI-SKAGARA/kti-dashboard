"use client";

import { useState, useEffect, useCallback } from "react";
import {
  TrendingUp,
  Plus,
  Loader2,
  ArrowLeft,
  Calendar,
  PieChart,
  BarChart3,
  Coins,
} from "lucide-react";
import Link from "next/link";
import type { Gen } from "@/types/attendance";
import type { Expense, ExpenseCategory, Budget, MonthlyReport, KasPayment } from "@/types/finance";
import {
  getExpenseCategories,
  getExpenses,
  addExpense,
  updateExpense,
  deleteExpense,
  getBudgets,
  upsertBudget,
  deleteBudget,
  getFinanceSummary,
  getMonthlyReport,
  getKasPayments,
} from "@/app/actions/finance";
import { getGenList } from "@/app/actions/attendance";
import { formatRupiah, getBulanTahunFromDate, getTodayFormatted } from "@/lib/utils";
import { APP_NAME, TOAST_DURATION } from "@/lib/constants";
import Toast from "@/components/Toast";
import FinanceSummaryCard from "@/components/finance/FinanceSummaryCard";
import ExpenseTable from "@/components/finance/ExpenseTable";
import ExpenseFormModal from "@/components/finance/ExpenseFormModal";
import BudgetView from "@/components/finance/BudgetView";
import MonthlyReportView from "@/components/finance/MonthlyReportView";
import KasTable from "@/components/finance/KasTable";

type Tab = "kas" | "ringkasan" | "pengeluaran" | "budget" | "laporan";

export default function FinancePage() {
  const [tab, setTab] = useState<Tab>("ringkasan");
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Gen list
  const [gens, setGens] = useState<Gen[]>([]);

  // Finance summary
  const [summary, setSummary] = useState<{
    totalIncome: number;
    totalExpenses: number;
    balance: number;
    incomeByGen: { gen: string; total: number }[];
  } | null>(null);

  // Expenses
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [expenseLoading, setExpenseLoading] = useState(true);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);

  // Budget
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [budgetLoading, setBudgetLoading] = useState(true);

  // Monthly report
  const [reportMonth, setReportMonth] = useState(getBulanTahunFromDate(getTodayFormatted()));
  const [report, setReport] = useState<MonthlyReport | null>(null);
  const [reportLoading, setReportLoading] = useState(false);

  // Kas payments
  const [kasPayments, setKasPayments] = useState<KasPayment[]>([]);
  const [kasLoading, setKasLoading] = useState(true);
  const [kasFilterGen, setKasFilterGen] = useState<string>("");
  const [kasFilterBulan, setKasFilterBulan] = useState<string>("");
  const [backfillLoading, setBackfillLoading] = useState(false);

  // --- Loaders ---

  const loadGens = useCallback(async () => {
    const res = await getGenList();
    if (res.success && res.data) {
      setGens(res.data.map((g) => g.gen as Gen));
    }
  }, []);

  const loadSummary = useCallback(async (genList: Gen[]) => {
    if (genList.length === 0) return;
    const res = await getFinanceSummary(genList);
    if (res.success && res.data) {
      setSummary({
        totalIncome: res.data.totalIncome,
        totalExpenses: res.data.totalExpenses,
        balance: res.data.balance,
        incomeByGen: res.data.incomeByGen,
      });
    }
  }, []);

  const loadExpenses = useCallback(async () => {
    setExpenseLoading(true);
    const res = await getExpenses();
    if (res.success && res.data) setExpenses(res.data);
    setExpenseLoading(false);
  }, []);

  const loadCategories = useCallback(async () => {
    const res = await getExpenseCategories();
    if (res.success && res.data) setCategories(res.data);
  }, []);

  const loadBudgets = useCallback(async (bulanTahun: string) => {
    setBudgetLoading(true);
    const res = await getBudgets(bulanTahun);
    if (res.success && res.data) setBudgets(res.data);
    setBudgetLoading(false);
  }, []);

  const loadReport = useCallback(async (bulanTahun: string, genList: Gen[]) => {
    if (genList.length === 0) return;
    setReportLoading(true);
    const res = await getMonthlyReport(bulanTahun, genList);
    if (res.success && res.data) setReport(res.data);
    setReportLoading(false);
  }, []);

  const loadKasPayments = useCallback(async (gen?: string, bulan?: string) => {
    setKasLoading(true);
    const res = await getKasPayments(gen || undefined, bulan || undefined);
    if (res.success && res.data) setKasPayments(res.data);
    setKasLoading(false);
  }, []);

  const handleBackfill = useCallback(async () => {
    setBackfillLoading(true);
    const { backfillKasPaymentsFromRecords } = await import("@/app/actions/finance");
    const res = await backfillKasPaymentsFromRecords();
    if (res.success && res.data) {
      setToast({
        type: "success",
        message: `Berhasil import ${res.data.inserted} data kas (${res.data.skipped} sudah ada)`,
      });
      loadKasPayments(kasFilterGen || undefined, kasFilterBulan || undefined);
      if (gens.length > 0) loadSummary(gens);
    } else {
      setToast({ type: "error", message: res.error || "Gagal import data" });
    }
    setBackfillLoading(false);
  }, [gens, kasFilterGen, kasFilterBulan, loadKasPayments, loadSummary]);

  useEffect(() => {
    loadGens();
    loadExpenses();
    loadCategories();
  }, [loadGens, loadExpenses, loadCategories]);

  useEffect(() => {
    if (gens.length > 0) loadSummary(gens);
  }, [gens, loadSummary]);

  useEffect(() => {
    const bt = getBulanTahunFromDate(getTodayFormatted());
    loadBudgets(bt);
  }, [loadBudgets]);

  useEffect(() => {
    if (gens.length > 0) loadReport(reportMonth, gens);
  }, [reportMonth, gens, loadReport]);

  useEffect(() => {
    loadKasPayments(kasFilterGen || undefined, kasFilterBulan || undefined);
  }, [kasFilterGen, kasFilterBulan, loadKasPayments]);

  // --- Expense CRUD ---

  const handleAddExpense = async (data: {
    deskripsi: string;
    nominal: number;
    category_id: string;
    tanggal: string;
    bulan_tahun: string;
  }) => {
    const res = await addExpense(data.deskripsi, data.nominal, data.category_id, data.tanggal, data.bulan_tahun);
    if (res.success) {
      setToast({ type: "success", message: "Pengeluaran ditambahkan." });
      setShowExpenseModal(false);
      loadExpenses();
      if (gens.length > 0) loadSummary(gens);
    } else {
      setToast({ type: "error", message: res.error ?? "Gagal menambah pengeluaran." });
    }
    setTimeout(() => setToast(null), TOAST_DURATION);
  };

  const handleEditExpense = async (data: {
    deskripsi: string;
    nominal: number;
    category_id: string;
    tanggal: string;
    bulan_tahun: string;
  }) => {
    if (!editingExpense) return;
    const res = await updateExpense(editingExpense.id, {
      deskripsi: data.deskripsi,
      nominal: data.nominal,
      category_id: data.category_id,
      tanggal: data.tanggal,
      bulan_tahun: data.bulan_tahun,
    });
    if (res.success) {
      setToast({ type: "success", message: "Pengeluaran diupdate." });
      setShowExpenseModal(false);
      setEditingExpense(null);
      loadExpenses();
      if (gens.length > 0) loadSummary(gens);
    } else {
      setToast({ type: "error", message: res.error ?? "Gagal update." });
    }
    setTimeout(() => setToast(null), TOAST_DURATION);
  };

  const handleDeleteExpense = async (id: string) => {
    const res = await deleteExpense(id);
    if (res.success) {
      setToast({ type: "success", message: "Pengeluaran dihapus." });
      loadExpenses();
      if (gens.length > 0) loadSummary(gens);
    } else {
      setToast({ type: "error", message: res.error ?? "Gagal menghapus." });
    }
    setTimeout(() => setToast(null), TOAST_DURATION);
  };

  // --- Budget CRUD ---

  const handleAddBudget = async (categoryId: string, target: number) => {
    const bt = getBulanTahunFromDate(getTodayFormatted());
    const res = await upsertBudget(bt, categoryId, target);
    if (res.success) {
      setToast({ type: "success", message: "Budget disimpan." });
      loadBudgets(bt);
    } else {
      setToast({ type: "error", message: res.error ?? "Gagal menyimpan budget." });
    }
    setTimeout(() => setToast(null), TOAST_DURATION);
  };

  const handleDeleteBudget = async (id: string) => {
    const res = await deleteBudget(id);
    if (res.success) {
      setToast({ type: "success", message: "Budget dihapus." });
      loadBudgets(getBulanTahunFromDate(getTodayFormatted()));
    } else {
      setToast({ type: "error", message: res.error ?? "Gagal menghapus budget." });
    }
    setTimeout(() => setToast(null), TOAST_DURATION);
  };

  // --- Tab config ---

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: "kas", label: "Kas", icon: <Coins className="h-3.5 w-3.5" /> },
    { key: "ringkasan", label: "Ringkasan", icon: <PieChart className="h-3.5 w-3.5" /> },
    { key: "pengeluaran", label: "Pengeluaran", icon: <TrendingUp className="h-3.5 w-3.5" /> },
    { key: "budget", label: "Budget", icon: <BarChart3 className="h-3.5 w-3.5" /> },
    { key: "laporan", label: "Laporan", icon: <Calendar className="h-3.5 w-3.5" /> },
  ];

  const expenseCatTotals = expenses.reduce<Record<string, number>>((acc, e) => {
    const cat = e.category_nama || "Lainnya";
    acc[cat] = (acc[cat] || 0) + e.nominal;
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-background px-4 py-6 sm:px-6">
      {toast && <Toast type={toast.type} message={toast.message} />}

      <div className="mx-auto max-w-5xl">
        {/* Header */}
        <div className="mb-5 flex items-center gap-3">
          <Link href="/" className="rounded-lg bg-surface-2 p-2 hover:bg-surface-3">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="font-display text-xl font-bold uppercase tracking-wide text-foreground">
              Keuangan<span className="text-accent">.</span>
            </h1>
            <p className="text-xs text-muted">
              {APP_NAME} — Kelola kas & pengeluaran organisasi
            </p>
          </div>
        </div>

        {/* Tab bar */}
        <div className="mb-5 flex gap-2 overflow-x-auto border-b-2 border-border pb-2">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`chip min-h-[44px] whitespace-nowrap ${tab === t.key ? "chip-on" : ""}`}
            >
              {t.icon}
              <span>{t.label}</span>
            </button>
          ))}
        </div>

        {/* Summary card (always visible) */}
        {summary && (
          <div className="mb-5">
            <FinanceSummaryCard
              totalIncome={summary.totalIncome}
              totalExpenses={summary.totalExpenses}
              balance={summary.balance}
            />
          </div>
        )}

        {/* Tab content */}
        {tab === "kas" && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label className="label">Filter Gen</label>
                <select
                  className="select min-w-[120px]"
                  value={kasFilterGen}
                  onChange={(e) => setKasFilterGen(e.target.value)}
                >
                  <option value="">Semua Gen</option>
                  {gens.map((g) => (
                    <option key={g} value={g}>Gen {g}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Filter Bulan</label>
                <input
                  type="month"
                  className="input"
                  value={kasFilterBulan.split("-").reverse().join("-")}
                  onChange={(e) => {
                    const [y, m] = e.target.value.split("-");
                    setKasFilterBulan(`${m}-${y}`);
                  }}
                />
              </div>
              <button
                onClick={() => {
                  setKasFilterGen("");
                  setKasFilterBulan("");
                }}
                className="btn btn-outline min-h-[44px]"
              >
                Reset
              </button>
              <button
                onClick={handleBackfill}
                disabled={backfillLoading}
                className="btn btn-primary min-h-[44px]"
              >
                {backfillLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Import dari Absensi"
                )}
              </button>
            </div>
            <KasTable payments={kasPayments} loading={kasLoading} />
          </div>
        )}

        {tab === "ringkasan" && (
          <div className="space-y-4">
            {/* Per-gen income */}
            {summary && (
              <div className="card p-5">
                <h3 className="font-display text-xs font-bold uppercase tracking-wide text-foreground">
                  Pemasukan per Gen
                </h3>
                <div className="mt-3 space-y-2">
                  {gens.map((g) => {
                    const genIncome = summary.incomeByGen.find((item) => item.gen === g);
                    const total = genIncome?.total ?? 0;
                    return (
                      <div key={g} className="flex items-center justify-between text-xs">
                        <span className="font-medium text-foreground">Gen {g}</span>
                        <span className="font-mono text-muted">
                          {total > 0 ? formatRupiah(total) : "-"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Expense breakdown */}
            {Object.keys(expenseCatTotals).length > 0 && (
              <div className="card p-5">
                <h3 className="font-display text-xs font-bold uppercase tracking-wide text-foreground">
                  Pengeluaran per Kategori
                </h3>
                <div className="mt-3 space-y-2">
                  {Object.entries(expenseCatTotals)
                    .sort(([, a], [, b]) => b - a)
                    .map(([cat, total]) => {
                      const pct = summary && summary.totalExpenses > 0
                        ? (total / summary.totalExpenses) * 100
                        : 0;
                      return (
                        <div key={cat}>
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-medium text-foreground">{cat}</span>
                            <span className="font-mono text-muted">{formatRupiah(total)}</span>
                          </div>
                          <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
                            <div
                              className="h-full rounded-full bg-accent"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}
          </div>
        )}

        {tab === "pengeluaran" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted">
                {expenses.length} pengeluaran tercatat
              </p>
              <button
                onClick={() => {
                  setEditingExpense(null);
                  setShowExpenseModal(true);
                }}
                className="btn btn-primary min-h-[44px]"
              >
                <Plus className="h-4 w-4" />
                <span>Tambah</span>
              </button>
            </div>
            <ExpenseTable
              expenses={expenses}
              loading={expenseLoading}
              onEdit={(e) => {
                setEditingExpense(e);
                setShowExpenseModal(true);
              }}
              onDelete={handleDeleteExpense}
            />
          </div>
        )}

        {tab === "budget" && (
          <BudgetView
            budgets={budgets}
            categories={categories}
            bulanTahun={getBulanTahunFromDate(getTodayFormatted())}
            expensesByCategory={Object.entries(expenseCatTotals).map(([category, total]) => ({
              category,
              total,
            }))}
            loading={budgetLoading}
            onAdd={handleAddBudget}
            onDelete={handleDeleteBudget}
          />
        )}

        {tab === "laporan" && (
          <div className="space-y-4">
            <div className="flex items-end gap-3">
              <div>
                <label className="label">Bulan</label>
                <input
                  type="month"
                  className="input"
                  value={reportMonth.split("-").reverse().join("-")}
                  onChange={(e) => {
                    const [y, m] = e.target.value.split("-");
                    setReportMonth(`${m}-${y}`);
                  }}
                />
              </div>
            </div>
            <MonthlyReportView report={report} loading={reportLoading} />
          </div>
        )}
      </div>

      {/* Expense form modal */}
      <ExpenseFormModal
        open={showExpenseModal}
        expense={editingExpense}
        categories={categories}
        loading={expenseLoading}
        onSubmit={editingExpense ? handleEditExpense : handleAddExpense}
        onClose={() => {
          setShowExpenseModal(false);
          setEditingExpense(null);
        }}
      />
    </div>
  );
}
