"use server";

import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/supabase/auth-helpers";
import type { ApiResponse, Gen } from "@/types/attendance";
import type {
  ExpenseCategory,
  Expense,
  Budget,
  FinanceSummary,
  MonthlyReport,
  KasPayment,
} from "@/types/finance";
import { getBulanTahunFromDate, getTodayFormatted } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Kas Payments (pembayaran kas siswa — pisah dari absensi)
// ---------------------------------------------------------------------------

export async function getKasPayments(gen?: string, bulanTahun?: string): Promise<ApiResponse<KasPayment[]>> {
  const supabase = await createClient();
  let query = supabase
    .from("kas_payments")
    .select("*")
    .order("tanggal", { ascending: false });

  if (gen) query = query.eq("gen", gen);
  if (bulanTahun) query = query.eq("bulan_tahun", bulanTahun);

  const { data, error } = await query;
  if (error) return { success: false, error: error.message };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const payments: KasPayment[] = (data || []).map((r: any) => ({
    id: String(r.id),
    nama: String(r.nama),
    gen: String(r.gen),
    kelas: String(r.kelas),
    bulan_tahun: String(r.bulan_tahun),
    tanggal: String(r.tanggal),
    nominal: Number(r.nominal),
    created_at: String(r.created_at),
  }));

  return { success: true, data: payments };
}

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

export async function getExpenseCategories(): Promise<ApiResponse<ExpenseCategory[]>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("expense_categories")
    .select("*")
    .eq("is_active", true)
    .order("nama");

  if (error) return { success: false, error: error.message };
  return { success: true, data: (data || []) as ExpenseCategory[] };
}

export async function upsertExpenseCategory(
  nama: string,
  deskripsi?: string
): Promise<ApiResponse<ExpenseCategory>> {
  const auth = await requireAdmin();
  if (!auth.ok) return { success: false, error: auth.error };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("expense_categories")
    .upsert({ nama: nama.trim(), deskripsi: deskripsi || "" }, { onConflict: "nama" })
    .select()
    .single();

  if (error) return { success: false, error: error.message };
  return { success: true, data: data as ExpenseCategory };
}

export async function deleteExpenseCategory(id: string): Promise<ApiResponse<void>> {
  const auth = await requireAdmin();
  if (!auth.ok) return { success: false, error: auth.error };

  const supabase = await createClient();
  const { error } = await supabase
    .from("expense_categories")
    .update({ is_active: false })
    .eq("id", id);

  if (error) return { success: false, error: error.message };
  return { success: true };
}

// ---------------------------------------------------------------------------
// Expenses
// ---------------------------------------------------------------------------

export async function getExpenses(bulanTahun?: string): Promise<ApiResponse<Expense[]>> {
  const supabase = await createClient();
  let query = supabase
    .from("expenses")
    .select("*, expense_categories(nama)")
    .order("tanggal", { ascending: false });

  if (bulanTahun) {
    query = query.eq("bulan_tahun", bulanTahun);
  }

  const { data, error } = await query;
  if (error) return { success: false, error: error.message };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const expenses: Expense[] = (data || []).map((r: any) => ({
    id: String(r.id),
    tanggal: String(r.tanggal),
    bulan_tahun: String(r.bulan_tahun),
    category_id: String(r.category_id),
    deskripsi: String(r.deskripsi),
    nominal: Number(r.nominal),
    status: r.status as Expense["status"],
    submitted_by: r.submitted_by ? String(r.submitted_by) : undefined,
    approved_by: r.approved_by ? String(r.approved_by) : undefined,
    created_at: String(r.created_at),
    updated_at: String(r.updated_at),
    category_nama: r.expense_categories?.nama as string | undefined,
  }));

  return { success: true, data: expenses };
}

export async function addExpense(
  deskripsi: string,
  nominal: number,
  categoryId: string,
  tanggal?: string,
  bulanTahun?: string
): Promise<ApiResponse<Expense>> {
  const auth = await requireAdmin();
  if (!auth.ok) return { success: false, error: auth.error };

  const tgl = tanggal || getTodayFormatted();
  const bt = bulanTahun || getBulanTahunFromDate(tgl);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("expenses")
    .insert({
      tanggal: tgl,
      bulan_tahun: bt,
      category_id: categoryId,
      deskripsi: deskripsi.trim(),
      nominal,
      status: "disetujui",
      submitted_by: auth.userId,
    })
    .select("*, expense_categories(nama)")
    .single();

  if (error) return { success: false, error: error.message };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d: any = data;
  const expense: Expense = {
    id: String(d.id),
    tanggal: String(d.tanggal),
    bulan_tahun: String(d.bulan_tahun),
    category_id: String(d.category_id),
    deskripsi: String(d.deskripsi),
    nominal: Number(d.nominal),
    status: d.status,
    submitted_by: d.submitted_by ? String(d.submitted_by) : undefined,
    approved_by: d.approved_by ? String(d.approved_by) : undefined,
    created_at: String(d.created_at),
    updated_at: String(d.updated_at),
    category_nama: d.expense_categories?.nama as string | undefined,
  };

  return { success: true, data: expense };
}

export async function updateExpense(
  id: string,
  updates: Partial<Pick<Expense, "deskripsi" | "nominal" | "category_id" | "status" | "tanggal" | "bulan_tahun">>
): Promise<ApiResponse<Expense>> {
  const auth = await requireAdmin();
  if (!auth.ok) return { success: false, error: auth.error };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("expenses")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("*, expense_categories(nama)")
    .single();

  if (error) return { success: false, error: error.message };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d: any = data;
  const expense: Expense = {
    id: String(d.id),
    tanggal: String(d.tanggal),
    bulan_tahun: String(d.bulan_tahun),
    category_id: String(d.category_id),
    deskripsi: String(d.deskripsi),
    nominal: Number(d.nominal),
    status: d.status,
    submitted_by: d.submitted_by ? String(d.submitted_by) : undefined,
    approved_by: d.approved_by ? String(d.approved_by) : undefined,
    created_at: String(d.created_at),
    updated_at: String(d.updated_at),
    category_nama: d.expense_categories?.nama as string | undefined,
  };

  return { success: true, data: expense };
}

export async function deleteExpense(id: string): Promise<ApiResponse<void>> {
  const auth = await requireAdmin();
  if (!auth.ok) return { success: false, error: auth.error };

  const supabase = await createClient();
  const { error } = await supabase.from("expenses").delete().eq("id", id);
  if (error) return { success: false, error: error.message };
  return { success: true };
}

// ---------------------------------------------------------------------------
// Budgets
// ---------------------------------------------------------------------------

export async function getBudgets(bulanTahun?: string): Promise<ApiResponse<Budget[]>> {
  const supabase = await createClient();
  let query = supabase
    .from("budgets")
    .select("*, expense_categories(nama)")
    .order("created_at", { ascending: false });

  if (bulanTahun) {
    query = query.eq("bulan_tahun", bulanTahun);
  }

  const { data, error } = await query;
  if (error) return { success: false, error: error.message };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const budgets: Budget[] = (data || []).map((r: any) => ({
    id: String(r.id),
    bulan_tahun: String(r.bulan_tahun),
    category_id: String(r.category_id),
    target_nominal: Number(r.target_nominal),
    catatan: String(r.catatan || ""),
    created_at: String(r.created_at),
    category_nama: r.expense_categories?.nama as string | undefined,
  }));

  return { success: true, data: budgets };
}

export async function upsertBudget(
  bulanTahun: string,
  categoryId: string,
  targetNominal: number,
  catatan?: string
): Promise<ApiResponse<Budget>> {
  const auth = await requireAdmin();
  if (!auth.ok) return { success: false, error: auth.error };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("budgets")
    .upsert(
      {
        bulan_tahun: bulanTahun,
        category_id: categoryId,
        target_nominal: targetNominal,
        catatan: catatan || "",
      },
      { onConflict: "bulan_tahun,category_id" }
    )
    .select("*, expense_categories(nama)")
    .single();

  if (error) return { success: false, error: error.message };

  const budget: Budget = {
    id: data.id,
    bulan_tahun: data.bulan_tahun,
    category_id: data.category_id,
    target_nominal: Number(data.target_nominal),
    catatan: data.catatan || "",
    created_at: data.created_at,
    category_nama: (data.expense_categories as { nama: string } | null)?.nama,
  };

  return { success: true, data: budget };
}

export async function deleteBudget(id: string): Promise<ApiResponse<void>> {
  const auth = await requireAdmin();
  if (!auth.ok) return { success: false, error: auth.error };

  const supabase = await createClient();
  const { error } = await supabase.from("budgets").delete().eq("id", id);
  if (error) return { success: false, error: error.message };
  return { success: true };
}

// ---------------------------------------------------------------------------
// Finance Summary (Income from kas_payments + Expenses from Supabase)
// ---------------------------------------------------------------------------

export async function getFinanceSummary(
  gens: Gen[]
): Promise<ApiResponse<FinanceSummary>> {
  try {
    const supabase = await createClient();

    // Income: read from kas_payments (pisah dari absensi)
    const { data: kasRows } = await supabase
      .from("kas_payments")
      .select("gen, nominal, bulan_tahun");

    const incomeByGenMap = new Map<string, number>();
    const monthIncomeMap = new Map<string, number>();
    let totalIncome = 0;

    for (const r of kasRows || []) {
      const gen = String(r.gen);
      const nominal = Number(r.nominal) || 0;
      const bt = String(r.bulan_tahun);

      if (gens.includes(gen as Gen)) {
        incomeByGenMap.set(gen, (incomeByGenMap.get(gen) || 0) + nominal);
        monthIncomeMap.set(bt, (monthIncomeMap.get(bt) || 0) + nominal);
        totalIncome += nominal;
      }
    }

    const incomeByGen = Array.from(incomeByGenMap.entries()).map(([gen, total]) => ({ gen, total }));

    // Expenses from Supabase
    const { data: expenseRows } = await supabase
      .from("expenses")
      .select("nominal, bulan_tahun, expense_categories(nama)")
      .eq("status", "disetujui");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const expenses: Expense[] = (expenseRows || []).map((r: any) => ({
      id: "",
      tanggal: "",
      bulan_tahun: String(r.bulan_tahun),
      category_id: "",
      deskripsi: "",
      nominal: Number(r.nominal),
      status: "disetujui" as const,
      created_at: "",
      updated_at: "",
      category_nama: r.expense_categories?.nama as string | undefined,
    }));

    const totalExpenses = expenses.reduce((sum, e) => sum + e.nominal, 0);

    // Expenses by category
    const catMap = new Map<string, number>();
    for (const e of expenses) {
      const cat = e.category_nama || "Lainnya";
      catMap.set(cat, (catMap.get(cat) || 0) + e.nominal);
    }
    const expensesByCategory = Array.from(catMap.entries()).map(([category, total]) => ({
      category,
      total,
    }));

    // Monthly trend
    const monthMap = new Map<string, { income: number; expenses: number }>();

    for (const [bt, income] of monthIncomeMap) {
      monthMap.set(bt, { income, expenses: 0 });
    }

    for (const e of expenses) {
      if (!e.bulan_tahun) continue;
      const cur = monthMap.get(e.bulan_tahun) || { income: 0, expenses: 0 };
      cur.expenses += e.nominal;
      monthMap.set(e.bulan_tahun, cur);
    }

    const monthlyTrend = Array.from(monthMap.entries())
      .map(([bulan_tahun, v]) => ({ bulan_tahun, ...v }))
      .sort((a, b) => a.bulan_tahun.localeCompare(b.bulan_tahun))
      .slice(-6);

    return {
      success: true,
      data: {
        totalIncome,
        totalExpenses,
        balance: totalIncome - totalExpenses,
        incomeByGen,
        expensesByCategory,
        monthlyTrend,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Gagal mengambil data keuangan.",
    };
  }
}

// ---------------------------------------------------------------------------
// Backfill: copy existing nominalKas from Google Sheets → kas_payments
// ---------------------------------------------------------------------------

export async function backfillKasPaymentsFromRecords(): Promise<
  ApiResponse<{ inserted: number; skipped: number }>
> {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return { success: false, error: auth.error };

    const { fetchRecords } = await import("@/lib/google-sheets");
    const { getGenConfig } = await import("@/lib/google-sheets");
    const supabase = await createClient();

    const config = await getGenConfig();
    const activeGens = config.filter((g) => g.status === "aktif");

    let inserted = 0;
    let skipped = 0;

    for (const gen of activeGens) {
      const records = await fetchRecords(gen.gen);
      const kasRecords = records.filter(
        (r) => r.statusAbsen === "Hadir" && r.nominalKas > 0
      );

      if (kasRecords.length === 0) continue;

      // Check existing payments for this gen to avoid duplicates
      const { data: existing } = await supabase
        .from("kas_payments")
        .select("nama, bulan_tahun, tanggal")
        .eq("gen", gen.gen);

      const existingSet = new Set(
        (existing || []).map(
          (r) => `${r.nama}|${r.bulan_tahun}|${r.tanggal}`
        )
      );

      const toInsert = kasRecords
        .filter((r) => {
          const key = `${r.nama}|${r.bulanTahun}|${r.tanggal}`;
          return !existingSet.has(key);
        })
        .map((r) => ({
          nama: r.nama,
          gen: gen.gen,
          kelas: r.kelas,
          bulan_tahun: r.bulanTahun,
          tanggal: r.tanggal,
          nominal: r.nominalKas,
        }));

      if (toInsert.length > 0) {
        const { error } = await supabase.from("kas_payments").insert(toInsert);
        if (!error) inserted += toInsert.length;
      }

      skipped += kasRecords.length - toInsert.length;
    }

    return {
      success: true,
      data: { inserted, skipped },
    };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Gagal backfill kas payments.",
    };
  }
}

// ---------------------------------------------------------------------------
// Monthly Report
// ---------------------------------------------------------------------------

export async function getMonthlyReport(
  bulanTahun: string,
  gens: Gen[]
): Promise<ApiResponse<MonthlyReport>> {
  try {
    // Income for this month from kas_payments
    const supabase = await createClient();
    const genStrings = gens.map((g) => String(g));
    const { data: kasRows } = await supabase
      .from("kas_payments")
      .select("nominal")
      .eq("bulan_tahun", bulanTahun)
      .in("gen", genStrings);

    let income = 0;
    for (const r of kasRows || []) {
      income += Number(r.nominal) || 0;
    }

    // Presensi: hitung unique orang dari attendance records (bukan dari kas_payments)
    const { fetchRecords } = await import("@/lib/google-sheets");
    const { getGenConfig } = await import("@/lib/google-sheets");
    const config = await getGenConfig();
    const activeGens = config.filter((g) => g.status === "aktif");

    const uniqueNames = new Set<string>();
    for (const gen of activeGens) {
      if (!gens.includes(gen.gen as Gen)) continue;
      const records = await fetchRecords(gen.gen);
      for (const r of records) {
        if (r.bulanTahun === bulanTahun) {
          uniqueNames.add(r.nama);
        }
      }
    }
    const attendanceCount = uniqueNames.size;

    // Expenses for this month
    const { data: expenseRows } = await supabase
      .from("expenses")
      .select("nominal, expense_categories(nama)")
      .eq("bulan_tahun", bulanTahun)
      .eq("status", "disetujui");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const expenses = (expenseRows || []).map((r: any) => ({
      nominal: Number(r.nominal),
      category: (r.expense_categories?.nama as string) || "Lainnya",
    }));

    const totalExpenses = expenses.reduce((sum, e) => sum + e.nominal, 0);

    // Expense breakdown by category
    const catMap = new Map<string, number>();
    for (const e of expenses) {
      catMap.set(e.category, (catMap.get(e.category) || 0) + e.nominal);
    }
    const expenseBreakdown = Array.from(catMap.entries()).map(([category, nominal]) => ({
      category,
      nominal,
    }));

    return {
      success: true,
      data: {
        bulan_tahun: bulanTahun,
        income,
        expenses: totalExpenses,
        balance: income - totalExpenses,
        expenseBreakdown,
        attendanceCount,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Gagal mengambil laporan.",
    };
  }
}
