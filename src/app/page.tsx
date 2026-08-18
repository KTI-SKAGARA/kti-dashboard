"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import {
  type Gen,
  type FilterState,
  type FilterOptions,
  type DashboardStats,
  type GenConfig,
  type StatusAbsen,
  type TaggedRecord,
} from "@/types/attendance";
import {
  deleteAttendanceRecord,
  deleteBatchAttendanceRecords,
  updateAttendanceRecord,
  moveBatchAttendanceRecords,
  getGenList,
  getAttendanceRecordsPage,
} from "@/app/actions/attendance";
import {
  type Kegiatan,
  getLiburDates,
} from "@/types/kegiatan";
import { getKegiatan } from "@/app/actions/kegiatan";
import { useTaggedRecords, useAttendanceData } from "@/hooks/useAttendanceData";
import {
  formatBulanTahun,
  formatTanggalToISO,
  getTodayFormatted,
  getTodayISO,
  parseISOTanggal,
  tanggalToNumber,
  getGenBadgeColor,
} from "@/lib/utils";
import { APP_NAME, PAGE_SIZE, TOAST_DURATION } from "@/lib/constants";
import {
  PieChart as PieChartIcon,
  Table as TableIcon,
  PlusCircle,
} from "lucide-react";
import Link from "next/link";
import DeleteConfirmModal from "@/components/DeleteConfirmModal";
import StudentDetailModal from "@/components/StudentDetailModal";
import Toast from "@/components/Toast";
import FilterBar from "@/components/dashboard/FilterBar";
import AttendanceTable from "@/components/dashboard/AttendanceTable";
import StatsView from "@/components/dashboard/StatsView";
import IndividualStatsInline from "@/components/dashboard/IndividualStatsInline";
import TodayBanner from "@/components/dashboard/TodayBanner";
import BulkDeleteModal from "@/components/dashboard/BulkDeleteModal";
import BulkMoveModal from "@/components/dashboard/BulkMoveModal";
import EditRecordModal from "@/components/dashboard/EditRecordModal";
import FinanceSummaryCard from "@/components/finance/FinanceSummaryCard";
import { getFinanceSummary } from "@/app/actions/finance";

export default function DashboardPage() {
  const [viewMode, setViewMode] = useState<"absensi" | "rekap">("absensi");
  const [rekapSubTab, setRekapSubTab] = useState<"ringkasan" | "siswa">("ringkasan");

  // Bind URL params dari redirect /stats lama (?tab=rekap&sub=siswa), lalu bersihkan URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (!params.get("tab") && !params.get("sub")) return;
    const t = setTimeout(() => {
      if (params.get("tab") === "rekap") {
        setViewMode("rekap");
        if (params.get("sub") === "siswa") setRekapSubTab("siswa");
      }
      window.history.replaceState({}, "", window.location.pathname);
    }, 0);
    return () => clearTimeout(t);
  }, []);

  const [genList, setGenList] = useState<GenConfig[]>([]);

  const [filters, setFilters] = useState<FilterState>({
    gen: "semua",
    kelas: "",
    bulan: "",
    tanggalFrom: "",
    tanggalTo: "",
    status: "",
    search: "",
  });

  const [page, setPage] = useState(1);
  const [dataVersion, setDataVersion] = useState(0);

  // Tabel: halaman aktif + total dari server (PRD P2-6)
  const [tableRecords, setTableRecords] = useState<TaggedRecord[]>([]);
  const [tableTotal, setTableTotal] = useState(0);
  const [tableLoading, setTableLoading] = useState(true);

  // Single Delete modal
  const [deleteModal, setDeleteModal] = useState<{
    open: boolean;
    rowId: string;
    record: TaggedRecord | null;
  }>({ open: false, rowId: "", record: null });
  const [deleting, setDeleting] = useState(false);

  // Edit modal
  const [editModal, setEditModal] = useState<{
    open: boolean;
    rowId: string;
    record: TaggedRecord | null;
  }>({ open: false, rowId: "", record: null });
  const [editGen, setEditGen] = useState<Gen>("");
  const [editTanggal, setEditTanggal] = useState("");
  const [editNama, setEditNama] = useState("");
  const [editKelas, setEditKelas] = useState("");
  const [editStatus, setEditStatus] = useState<StatusAbsen>("Hadir");
  const [editKas, setEditKas] = useState(0);
  const [editing, setEditing] = useState(false);

  // Selection & Bulk actions
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [bulkDeleteModal, setBulkDeleteModal] = useState(false);

  // Bulk Move Gen modal
  const [bulkMoveModal, setBulkMoveModal] = useState(false);
  const [bulkMoveTargetGen, setBulkMoveTargetGen] = useState<Gen>("");
  const [bulkMoving, setBulkMoving] = useState(false);

  // Finance summary (for dashboard card)
  const [financeSummary, setFinanceSummary] = useState<{
    totalIncome: number;
    totalExpenses: number;
    balance: number;
  } | null>(null);

  const [studentDetail, setStudentDetail] = useState<string | null>(null);

  const [toast, setToast] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const [kegiatanList, setKegiatanList] = useState<Kegiatan[]>([]);

  // Load kegiatan for libur filtering
  useEffect(() => {
    getKegiatan().then(setKegiatanList);
  }, []);

  const liburDates = useMemo(() => getLiburDates(kegiatanList), [kegiatanList]);

  // Only active gens
  const activeGens = useMemo(
    () => genList.filter((g) => g.status === "aktif").map((g) => g.gen),
    [genList]
  );

  // Load gen list
  const loadGenList = useCallback(async () => {
    try {
      const res = await getGenList();
      if (res.success && res.data) {
        setGenList(res.data);
      }
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    loadGenList();
  }, [loadGenList]);

  // Finance summary for dashboard card
  const loadFinance = useCallback(async (genList: GenConfig[]) => {
    const gens = genList.filter((g) => g.status === "aktif").map((g) => g.gen as Gen);
    if (gens.length === 0) return;
    const res = await getFinanceSummary(gens);
    if (res.success && res.data) {
      setFinanceSummary({
        totalIncome: res.data.totalIncome,
        totalExpenses: res.data.totalExpenses,
        balance: res.data.balance,
      });
    }
  }, []);

  useEffect(() => {
    if (genList.length > 0) loadFinance(genList); // eslint-disable-line react-hooks/set-state-in-effect
  }, [genList, loadFinance]);

  // Shared data layer: fetch + cache per Gen, dipakai lintas route (PRD §4.1)
  const gensToLoad = useMemo(
    () => (filters.gen === "semua" ? activeGens : [filters.gen as Gen]),
    [filters.gen, activeGens]
  );
  const { records: allRecords, loading, refresh: loadRecords } = useTaggedRecords(gensToLoad);
  const { invalidate: invalidateRecordsCache } = useAttendanceData();

  // Setelah operasi tulis: invalidate cache client + refetch paksa (server sudah fresh)
  const reloadAll = useCallback(() => {
    invalidateRecordsCache();
    setDataVersion((v) => v + 1);
    return loadRecords({ force: true });
  }, [invalidateRecordsCache, loadRecords]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [filters.gen, filters.kelas, filters.bulan, filters.tanggalFrom, filters.tanggalTo, filters.status, filters.search]);

  // Fetch halaman tabel dari server (filter + sort di data layer)
  useEffect(() => {
    let cancelled = false;
    setTableLoading(true);
    getAttendanceRecordsPage(
      filters.gen,
      page,
      PAGE_SIZE,
      {
        kelas: filters.kelas || undefined,
        bulan: filters.bulan || undefined,
        tanggalFrom: filters.tanggalFrom ? parseISOTanggal(filters.tanggalFrom) : undefined,
        tanggalTo: filters.tanggalTo ? parseISOTanggal(filters.tanggalTo) : undefined,
        status: (filters.status || undefined) as StatusAbsen | undefined,
        search: filters.search || undefined,
      }
    )
      .then((res) => {
        if (cancelled) return;
        if (res.success && res.data) {
          setTableRecords(res.data.records);
          setTableTotal(res.data.total);
        } else {
          setTableRecords([]);
          setTableTotal(0);
        }
        setTableLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setTableRecords([]);
        setTableTotal(0);
        setTableLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [
    filters.gen,
    filters.kelas,
    filters.bulan,
    filters.tanggalFrom,
    filters.tanggalTo,
    filters.status,
    filters.search,
    page,
    dataVersion,
  ]);

  // In-memory Filter Options derived directly from allRecords (Instant 0ms calculation)
  const filterOptions = useMemo<FilterOptions>(() => {
    const kelasSet = new Set<string>();
    const bulanSet = new Set<string>();
    const tanggalSet = new Set<string>();

    for (const r of allRecords) {
      if (r.kelas) kelasSet.add(r.kelas);
      if (r.bulanTahun) bulanSet.add(r.bulanTahun);
      if (r.tanggal) tanggalSet.add(r.tanggal);
    }

    const kelasList = Array.from(kelasSet).sort((a, b) => a.localeCompare(b, "id"));
    const bulanList = Array.from(bulanSet).sort((a, b) => {
      const [am, ay] = a.split("-").map(Number);
      const [bm, by] = b.split("-").map(Number);
      return ay !== by ? ay - by : am - bm;
    });
    const tanggalList = Array.from(tanggalSet).sort((a, b) => {
      const [ad, am, ay] = a.split("/").map(Number);
      const [bd, bm, by] = b.split("/").map(Number);
      if (ay !== by) return by - ay; // newest date first
      if (am !== bm) return bm - am;
      return bd - ad;
    });

    return { kelasList, bulanList, tanggalList };
  }, [allRecords]);

  // Client-side filtering (untuk stats, export, dan daftar per tanggal)
  const records = useMemo(() => {
    let result = allRecords;
    // Exclude libur records from all calculations
    if (liburDates.size > 0) {
      result = result.filter((r) => !liburDates.has(r.tanggal));
    }
    if (filters.kelas) result = result.filter((r) => r.kelas === filters.kelas);
    if (filters.bulan) result = result.filter((r) => r.bulanTahun === filters.bulan);
    if (filters.tanggalFrom || filters.tanggalTo) {
      const fromNum = filters.tanggalFrom
        ? tanggalToNumber(parseISOTanggal(filters.tanggalFrom))
        : -Infinity;
      const toNum = filters.tanggalTo
        ? tanggalToNumber(parseISOTanggal(filters.tanggalTo))
        : Infinity;
      result = result.filter((r) => {
        const t = tanggalToNumber(r.tanggal);
        return !Number.isNaN(t) && t >= fromNum && t <= toNum;
      });
    }
    if (filters.status) result = result.filter((r) => r.statusAbsen === filters.status);
    if (filters.search) {
      const q = filters.search.toLowerCase();
      result = result.filter((r) => r.nama.toLowerCase().includes(q));
    }
    return result;
  }, [allRecords, liburDates, filters.kelas, filters.bulan, filters.tanggalFrom, filters.tanggalTo, filters.status, filters.search]);

  // Dynamic Dashboard Stats calculated from filtered records
  const stats = useMemo<DashboardStats>(() => {
    const s: DashboardStats = {
      totalRecords: records.length,
      totalKas: 0,
      hadirCount: 0,
      sakitCount: 0,
      izinCount: 0,
      alfaCount: 0,
      attendanceRate: 0,
      avgKasPerStudent: 0,
      classSummaries: [],
    };

    const classMap = new Map<
      string,
      { totalKas: number; totalRecords: number; hadirCount: number }
    >();

    for (const r of records) {
      s.totalKas += r.nominalKas;
      switch (r.statusAbsen) {
        case "Hadir":
          s.hadirCount++;
          break;
        case "Sakit":
          s.sakitCount++;
          break;
        case "Izin":
          s.izinCount++;
          break;
        case "Alfa":
          s.alfaCount++;
          break;
      }

      if (r.kelas) {
        const current = classMap.get(r.kelas) || {
          totalKas: 0,
          totalRecords: 0,
          hadirCount: 0,
        };
        current.totalKas += r.nominalKas;
        current.totalRecords += 1;
        if (r.statusAbsen === "Hadir") current.hadirCount += 1;
        classMap.set(r.kelas, current);
      }
    }

    if (s.totalRecords > 0) {
      s.attendanceRate =
        Math.round((s.hadirCount / s.totalRecords) * 1000) / 10;
      s.avgKasPerStudent = Math.round(s.totalKas / s.totalRecords);
    }

    s.classSummaries = Array.from(classMap.entries())
      .map(([kelas, summary]) => ({
        kelas,
        totalKas: summary.totalKas,
        totalRecords: summary.totalRecords,
        hadirCount: summary.hadirCount,
      }))
      .sort((a, b) => a.kelas.localeCompare(b.kelas, "id"));

    return s;
  }, [records]);

  // Daily presensi meeting summaries (for stats view & quick jump)
  // Derive from `records` (already gen+kelas+bulan+date filtered)
  const dailySummaries = useMemo(() => {
    const map = new Map<
      string,
      {
        tanggal: string;
        bulanTahun: string;
        total: number;
        hadir: number;
        sakit: number;
        izin: number;
        alfa: number;
        kas: number;
        gens: Set<Gen>;
      }
    >();

    for (const r of records) {
      if (!r.tanggal) continue;
      if (liburDates.has(r.tanggal)) continue; // skip libur records
      const cur = map.get(r.tanggal) || {
        tanggal: r.tanggal,
        bulanTahun: r.bulanTahun,
        total: 0,
        hadir: 0,
        sakit: 0,
        izin: 0,
        alfa: 0,
        kas: 0,
        gens: new Set<Gen>(),
      };
      cur.total += 1;
      if (r.statusAbsen === "Hadir") cur.hadir += 1;
      else if (r.statusAbsen === "Sakit") cur.sakit += 1;
      else if (r.statusAbsen === "Izin") cur.izin += 1;
      else if (r.statusAbsen === "Alfa") cur.alfa += 1;
      cur.kas += r.nominalKas;
      cur.gens.add(r._gen);
      map.set(r.tanggal, cur);
    }

    return Array.from(map.values()).sort((a, b) => {
      const [ad, am, ay] = a.tanggal.split("/").map(Number);
      const [bd, bm, by] = b.tanggal.split("/").map(Number);
      if (ay !== by) return by - ay;
      if (am !== bm) return bm - am;
      return bd - ad;
    });
  }, [records, liburDates]);

  // Delete single record handler
  const confirmDeleteRecord = async () => {
    if (!deleteModal.rowId || !deleteModal.record) return;
    setDeleting(true);
    try {
      const res = await deleteAttendanceRecord(deleteModal.record._gen, deleteModal.rowId);
      if (res.success) {
        setToast({ type: "success", message: "Catatan absensi berhasil dihapus." });
        setDeleteModal({ open: false, rowId: "", record: null });
        reloadAll();
      } else {
        setToast({ type: "error", message: res.error || "Gagal menghapus data." });
      }
    } catch {
      setToast({ type: "error", message: "Gagal menghapus data." });
    } finally {
      setDeleting(false);
      setTimeout(() => setToast(null), TOAST_DURATION);
    }
  };

  // Edit handler
  const openEditModal = (record: TaggedRecord) => {
    setEditModal({ open: true, rowId: record._rowId, record });
    setEditGen(record._gen);
    setEditTanggal(formatTanggalToISO(record.tanggal) || getTodayISO());
    setEditNama(record.nama);
    setEditKelas(record.kelas);
    setEditStatus(record.statusAbsen);
    setEditKas(record.nominalKas);
  };

  const confirmEditRecord = async () => {
    if (!editModal.rowId || !editModal.record) return;
    setEditing(true);
    try {
      const targetGenChanged = editGen && editGen !== editModal.record._gen;
      const res = await updateAttendanceRecord(editModal.record._gen, editModal.rowId, {
        nama: editNama.toUpperCase(),
        kelas: editKelas,
        statusAbsen: editStatus,
        nominalKas: editKas,
        tanggal: parseISOTanggal(editTanggal),
        targetGen: targetGenChanged ? editGen : undefined,
      });
      if (res.success) {
        const movedNotice = targetGenChanged
          ? ` dan dipindahkan dari Gen ${editModal.record._gen} ke Gen ${editGen}`
          : "";
        setToast({ type: "success", message: `Data berhasil diupdate${movedNotice}!` });
        setEditModal({ open: false, rowId: "", record: null });
        reloadAll();
      } else {
        setToast({ type: "error", message: res.error || "Gagal mengupdate data." });
      }
    } catch {
      setToast({ type: "error", message: "Gagal mengupdate data." });
    } finally {
      setEditing(false);
      setTimeout(() => setToast(null), TOAST_DURATION);
    }
  };

  // Bulk delete handler
  const confirmBulkDelete = async () => {
    if (selectedKeys.size === 0) return;
    setBulkDeleting(true);

    const grouped = new Map<Gen, string[]>();
    for (const record of records) {
      const key = `${record._gen}|${record._rowId}`;
      if (selectedKeys.has(key)) {
        const arr = grouped.get(record._gen) || [];
        arr.push(record._rowId);
        grouped.set(record._gen, arr);
      }
    }

    try {
      let allOk = true;
      for (const [gen, rowIds] of grouped) {
        const res = await deleteBatchAttendanceRecords(gen, rowIds);
        if (!res.success) allOk = false;
      }
      if (allOk) {
        setToast({ type: "success", message: `${selectedKeys.size} catatan berhasil dihapus.` });
        setSelectedKeys(new Set());
        reloadAll();
      } else {
        setToast({ type: "error", message: "Gagal menghapus beberapa data." });
        reloadAll();
      }
    } catch {
      setToast({ type: "error", message: "Gagal menghapus data." });
    } finally {
      setBulkDeleting(false);
      setBulkDeleteModal(false);
      setTimeout(() => setToast(null), TOAST_DURATION);
    }
  };

  // Bulk move Gen handler
  const confirmBulkMove = async () => {
    if (selectedKeys.size === 0 || !bulkMoveTargetGen) return;
    setBulkMoving(true);

    const grouped = new Map<Gen, string[]>();
    for (const record of records) {
      const key = `${record._gen}|${record._rowId}`;
      if (selectedKeys.has(key)) {
        const arr = grouped.get(record._gen) || [];
        arr.push(record._rowId);
        grouped.set(record._gen, arr);
      }
    }

    try {
      let totalMoved = 0;
      let allOk = true;

      for (const [fromGen, rowIds] of grouped) {
        if (fromGen === bulkMoveTargetGen) continue;
        const res = await moveBatchAttendanceRecords(
          fromGen,
          rowIds,
          bulkMoveTargetGen
        );
        if (res.success) {
          totalMoved += res.data?.moved ?? rowIds.length;
        } else {
          allOk = false;
        }
      }

      if (allOk) {
        setToast({
          type: "success",
          message: `${totalMoved || selectedKeys.size} catatan berhasil dipindahkan ke Gen ${bulkMoveTargetGen}!`,
        });
        setSelectedKeys(new Set());
        setBulkMoveModal(false);
        reloadAll();
      } else {
        setToast({ type: "error", message: "Sebagian catatan gagal dipindahkan." });
        reloadAll();
      }
    } catch {
      setToast({ type: "error", message: "Gagal memindahkan catatan ke Gen baru." });
    } finally {
      setBulkMoving(false);
      setTimeout(() => setToast(null), TOAST_DURATION);
    }
  };

  const toggleSelectRecord = (key: string) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedKeys.size === tableRecords.length) {
      setSelectedKeys(new Set());
    } else {
      const keys = tableRecords.map((r) => `${r._gen}|${r._rowId}`);
      setSelectedKeys(new Set(keys));
    }
  };

  const allSelected =
    tableRecords.length > 0 && selectedKeys.size === tableRecords.length;

  // Export per gen per bulan — Excel format
  const exportToExcel = async () => {
    if (records.length === 0) return;

    const XLSX = await import("xlsx");

    const bulanSlug = filters.bulan ? `_${filters.bulan.replace("-", "")}` : "";
    const tglSlug =
      filters.tanggalFrom || filters.tanggalTo
        ? `_${(filters.tanggalFrom || filters.tanggalTo).replace(/-/g, "")}${filters.tanggalFrom && filters.tanggalTo && filters.tanggalFrom !== filters.tanggalTo ? "-" + filters.tanggalTo.replace(/-/g, "") : ""}`
        : "";

    const wb = XLSX.utils.book_new();

    if (filters.gen === "semua") {
      // 1. All records combined sheet (tanpa kolom kas — kas sudah dipisah)
      const allRows = records.map((r, i) => ({
        No: i + 1,
        Gen: `GEN ${r._gen}`,
        Tanggal: r.tanggal,
        Nama: r.nama,
        Kelas: r.kelas,
        Status_Absen: r.statusAbsen,
        Bulan_Tahun: r.bulanTahun,
      }));
      const allWs = XLSX.utils.json_to_sheet(allRows);
      allWs["!cols"] = [
        { wch: 5 },
        { wch: 10 },
        { wch: 12 },
        { wch: 24 },
        { wch: 12 },
        { wch: 14 },
        { wch: 12 },
      ];
      XLSX.utils.book_append_sheet(wb, allWs, "Semua Data");

      // 2. Individual Gen sheets
      for (const g of activeGens) {
        const genRecs = records.filter((r) => r._gen === g);
        if (genRecs.length === 0) continue;
        const gRows = genRecs.map((r, i) => ({
          No: i + 1,
          Tanggal: r.tanggal,
          Nama: r.nama,
          Kelas: r.kelas,
          Status_Absen: r.statusAbsen,
          Bulan_Tahun: r.bulanTahun,
        }));
        const gWs = XLSX.utils.json_to_sheet(gRows);
        gWs["!cols"] = [
          { wch: 5 },
          { wch: 12 },
          { wch: 24 },
          { wch: 12 },
          { wch: 14 },
          { wch: 12 },
        ];
        XLSX.utils.book_append_sheet(wb, gWs, `GEN ${g}`);
      }

      // 3. Rekap Individu (All students)
      const students = new Map<
        string,
        {
          gen: string;
          nama: string;
          kelas: string;
          hadir: number;
          sakit: number;
          izin: number;
          alfa: number;
        }
      >();

      for (const r of records) {
        const key = `${r._gen}|${r.kelas}|${r.nama}`;
        const s = students.get(key) || {
          gen: r._gen,
          nama: r.nama,
          kelas: r.kelas,
          hadir: 0,
          sakit: 0,
          izin: 0,
          alfa: 0,
        };
        if (r.statusAbsen === "Hadir") s.hadir += 1;
        else if (r.statusAbsen === "Sakit") s.sakit += 1;
        else if (r.statusAbsen === "Izin") s.izin += 1;
        else s.alfa += 1;
        students.set(key, s);
      }

      const studentRows = Array.from(students.values())
        .sort((a, b) => {
          const genCmp = Number(a.gen) - Number(b.gen);
          if (genCmp !== 0) return genCmp;
          const kCmp = a.kelas.localeCompare(b.kelas, "id");
          if (kCmp !== 0) return kCmp;
          return a.nama.localeCompare(b.nama, "id");
        })
        .map((s, i) => {
          const total = s.hadir + s.sakit + s.izin + s.alfa;
          return {
            No: i + 1,
            Gen: `GEN ${s.gen}`,
            Nama: s.nama,
            Kelas: s.kelas,
            Hadir: s.hadir,
            Sakit: s.sakit,
            Izin: s.izin,
            Alfa: s.alfa,
            Total: total,
            "Kehadiran (%)": total > 0 ? Math.round((s.hadir / total) * 1000) / 10 : 0,
          };
        });
      const studentWs = XLSX.utils.json_to_sheet(studentRows);
      studentWs["!cols"] = [
        { wch: 5 },
        { wch: 10 },
        { wch: 24 },
        { wch: 12 },
        { wch: 8 },
        { wch: 8 },
        { wch: 8 },
        { wch: 8 },
        { wch: 8 },
        { wch: 14 },
      ];
      XLSX.utils.book_append_sheet(wb, studentWs, "Rekap Individu");

      // 4. Ringkasan per Gen
      const genSummaryRows = activeGens.map((g, i) => {
        const gRecs = records.filter((r) => r._gen === g);
        const uniqueStudents = new Set(gRecs.map((r) => `${r.kelas}|${r.nama}`));
        const hadir = gRecs.filter((r) => r.statusAbsen === "Hadir").length;
        const sakit = gRecs.filter((r) => r.statusAbsen === "Sakit").length;
        const izin = gRecs.filter((r) => r.statusAbsen === "Izin").length;
        const alfa = gRecs.filter((r) => r.statusAbsen === "Alfa").length;
        const total = gRecs.length;

        return {
          No: i + 1,
          Generasi: `GEN ${g}`,
          "Jumlah Siswa": uniqueStudents.size,
          "Total Catatan": total,
          Hadir: hadir,
          Sakit: sakit,
          Izin: izin,
          Alfa: alfa,
          "Kehadiran (%)": total > 0 ? Math.round((hadir / total) * 1000) / 10 : 0,
        };
      });
      const genSummaryWs = XLSX.utils.json_to_sheet(genSummaryRows);
      genSummaryWs["!cols"] = [
        { wch: 5 },
        { wch: 12 },
        { wch: 14 },
        { wch: 14 },
        { wch: 8 },
        { wch: 8 },
        { wch: 8 },
        { wch: 8 },
        { wch: 14 },
      ];
      XLSX.utils.book_append_sheet(wb, genSummaryWs, "Ringkasan per Gen");

      XLSX.writeFile(wb, `Rekap_Semua_Gen${bulanSlug}${tglSlug}.xlsx`);
    } else {
      // Single Gen export
      const genRecords = [...records];
      const data = genRecords.map((r, i) => ({
        No: i + 1,
        Tanggal: r.tanggal,
        Nama: r.nama,
        Kelas: r.kelas,
        Status_Absen: r.statusAbsen,
        Bulan_Tahun: r.bulanTahun,
      }));
      const rawWs = XLSX.utils.json_to_sheet(data);
      rawWs["!cols"] = [
        { wch: 5 },
        { wch: 12 },
        { wch: 24 },
        { wch: 12 },
        { wch: 14 },
        { wch: 12 },
      ];

      const students = new Map<
        string,
        {
          nama: string;
          kelas: string;
          hadir: number;
          sakit: number;
          izin: number;
          alfa: number;
        }
      >();
      const classes = new Map<
        string,
        {
          siswa: Set<string>;
          total: number;
          hadir: number;
          sakit: number;
          izin: number;
          alfa: number;
        }
      >();

      for (const r of genRecords) {
        const key = `${r.kelas}|${r.nama}`;
        const s = students.get(key) || {
          nama: r.nama,
          kelas: r.kelas,
          hadir: 0,
          sakit: 0,
          izin: 0,
          alfa: 0,
        };
        if (r.statusAbsen === "Hadir") s.hadir += 1;
        else if (r.statusAbsen === "Sakit") s.sakit += 1;
        else if (r.statusAbsen === "Izin") s.izin += 1;
        else s.alfa += 1;
        students.set(key, s);

        const c = classes.get(r.kelas) || {
          siswa: new Set<string>(),
          total: 0,
          hadir: 0,
          sakit: 0,
          izin: 0,
          alfa: 0,
        };
        c.siswa.add(r.nama);
        c.total += 1;
        if (r.statusAbsen === "Hadir") c.hadir += 1;
        else if (r.statusAbsen === "Sakit") c.sakit += 1;
        else if (r.statusAbsen === "Izin") c.izin += 1;
        else c.alfa += 1;
        classes.set(r.kelas, c);
      }

      const kelasOrder = Array.from(classes.entries())
        .sort(
          (a, b) =>
            b[1].total - a[1].total || a[0].localeCompare(b[0], "id")
        )
        .map(([k]) => k);

      const studentRows = Array.from(students.values())
        .sort(
          (a, b) =>
            kelasOrder.indexOf(a.kelas) - kelasOrder.indexOf(b.kelas) ||
            a.nama.localeCompare(b.nama, "id")
        )
        .map((s, i) => ({
          No: i + 1,
          Nama: s.nama,
          Kelas: s.kelas,
          Hadir: s.hadir,
          Sakit: s.sakit,
          Izin: s.izin,
          Alfa: s.alfa,
          Total: s.hadir + s.sakit + s.izin + s.alfa,
          "Kehadiran (%)":
            Math.round(
              (s.hadir / (s.hadir + s.sakit + s.izin + s.alfa)) * 1000
            ) / 10,
        }));
      const studentWs = XLSX.utils.json_to_sheet(studentRows);
      studentWs["!cols"] = [
        { wch: 5 },
        { wch: 24 },
        { wch: 12 },
        { wch: 8 },
        { wch: 8 },
        { wch: 8 },
        { wch: 8 },
        { wch: 8 },
        { wch: 14 },
      ];

      const classRows = kelasOrder.map((k, i) => {
        const c = classes.get(k)!;
        return {
          No: i + 1,
          Kelas: k,
          "Jumlah Siswa": c.siswa.size,
          "Total Catatan": c.total,
          Hadir: c.hadir,
          Sakit: c.sakit,
          Izin: c.izin,
          Alfa: c.alfa,
          "Kehadiran (%)":
            Math.round((c.hadir / c.total) * 1000) / 10,
        };
      });
      const classWs = XLSX.utils.json_to_sheet(classRows);
      classWs["!cols"] = [
        { wch: 5 },
        { wch: 12 },
        { wch: 14 },
        { wch: 14 },
        { wch: 8 },
        { wch: 8 },
        { wch: 8 },
        { wch: 8 },
        { wch: 14 },
        { wch: 14 },
      ];

      XLSX.utils.book_append_sheet(wb, classWs, "Rekap per Kelas");
      XLSX.writeFile(wb, `Rekap_Gen${filters.gen}${bulanSlug}${tglSlug}.xlsx`);
    }
  };

  // Stats per gen (when "semua")
  const genSummaries = useMemo(() => {
    if (filters.gen !== "semua") return [];
    const map = new Map<Gen, { total: number; hadir: number; kas: number }>();
    for (const r of allRecords) {
      const cur = map.get(r._gen) || { total: 0, hadir: 0, kas: 0 };
      cur.total += 1;
      if (r.statusAbsen === "Hadir") cur.hadir += 1;
      cur.kas += r.nominalKas;
      map.set(r._gen, cur);
    }
    return Array.from(map.entries())
      .map(([g, s]) => ({
        gen: g,
        ...s,
        isLulus: genList.find((gc) => gc.gen === g)?.status === "lulus",
      }))
      .sort((a, b) => Number(a.gen) - Number(b.gen));
  }, [allRecords, filters.gen, genList]);

  const todayStats = useMemo(() => {
    const today = getTodayFormatted();
    const [dd, mm, yyyy] = today.split("/");
    let total = 0, hadir = 0, sakit = 0, izin = 0, alfa = 0, kas = 0;
    for (const r of allRecords) {
      if (r.tanggal !== today) continue;
      if (liburDates.has(r.tanggal)) continue; // skip libur records
      total++;
      if (r.statusAbsen === "Hadir") hadir++;
      else if (r.statusAbsen === "Sakit") sakit++;
      else if (r.statusAbsen === "Izin") izin++;
      else alfa++;
      kas += r.nominalKas;
    }
    return {
      today,
      dateLabel: `${dd} ${formatBulanTahun(`${mm}-${yyyy}`)}`,
      total, hadir, sakit, izin, alfa, kas,
    };
  }, [allRecords, liburDates]);

  const hasActiveFilter = Boolean(
    filters.kelas ||
      filters.bulan ||
      filters.tanggalFrom ||
      filters.tanggalTo ||
      filters.status ||
      filters.search
  );

  const genLabel = (g: Gen) => {
    const gc = genList.find((x) => x.gen === g);
    if (!gc) return `Gen ${g}`;
    return `Gen ${g}${gc.status === "lulus" ? " (Lulus)" : ""}`;
  };

  const activeGenBadgeColor = (g: Gen) => getGenBadgeColor(g);

  return (
    <div className="mx-auto max-w-5xl animate-page">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-border pb-5">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-accent">
            {APP_NAME} — {filters.gen === "semua" ? "Semua Gen" : genLabel(filters.gen as Gen)}
          </p>
          <h1 className="mt-0.5 font-display text-2xl font-extrabold uppercase tracking-tight text-foreground sm:text-3xl">
            Rekap <span className="text-accent">Absensi</span> &amp; Kas
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex items-center gap-1 rounded-xl border-2 border-border bg-surface p-1">
            <button
              onClick={() => setViewMode("absensi")}
              className={`chip min-h-[44px] ${viewMode === "absensi" ? "chip-on" : ""}`}
            >
              <TableIcon className="h-4 w-4" />
              Absensi
            </button>
            <button
              onClick={() => setViewMode("rekap")}
              className={`chip min-h-[44px] ${viewMode === "rekap" ? "chip-on" : ""}`}
            >
              <PieChartIcon className="h-4 w-4" />
              Rekap
            </button>
          </div>
          <Link href="/input" className="btn btn-primary min-h-[44px] px-3 py-2 text-sm">
            <PlusCircle className="h-4 w-4" />
            Input Data
          </Link>
        </div>
      </div>

      {/* Hari ini banner */}
      <TodayBanner
        dateLabel={todayStats.dateLabel}
        total={todayStats.total}
        hadir={todayStats.hadir}
        sakit={todayStats.sakit}
        izin={todayStats.izin}
        alfa={todayStats.alfa}
        kas={todayStats.kas}
        filters={filters}
        onFilterToday={() =>
          setFilters((f) => ({
            ...f,
            tanggalFrom: getTodayISO(),
            tanggalTo: getTodayISO(),
          }))
        }
      />

      {/* Finance summary */}
      {financeSummary && (
        <div className="mb-4">
          <Link href="/finance" className="block hover:opacity-90">
            <FinanceSummaryCard
              totalIncome={financeSummary.totalIncome}
              totalExpenses={financeSummary.totalExpenses}
              balance={financeSummary.balance}
            />
          </Link>
        </div>
      )}

      {/* Filters Toolbar */}
      <FilterBar
        filters={filters}
        onFiltersChange={setFilters}
        filterOptions={filterOptions}
        activeGens={activeGens}
        hasActiveFilter={hasActiveFilter}
        recordsTotal={records.length}
        onReload={reloadAll}
        onExport={exportToExcel}
      />

      {/* VIEW 1: ABSENSI (pagination + filter di server, PRD P2-6) */}
      {viewMode === "absensi" && (
        <AttendanceTable
          records={tableRecords}
          total={tableTotal}
          loading={tableLoading || loading}
          page={page}
          onPageChange={setPage}
          hasActiveFilter={hasActiveFilter}
          selectedKeys={selectedKeys}
          allSelected={allSelected}
          onToggleSelectAll={toggleSelectAll}
          onToggleSelect={toggleSelectRecord}
          onClearSelection={() => setSelectedKeys(new Set())}
          onBulkDelete={() => setBulkDeleteModal(true)}
          onBulkMove={() => {
            setBulkMoveTargetGen(activeGens[0] || "12");
            setBulkMoveModal(true);
          }}
          onEdit={openEditModal}
          onDelete={(r) =>
            setDeleteModal({ open: true, rowId: r._rowId, record: r })
          }
          onStudentDetail={setStudentDetail}
          onFilterTanggal={(tanggal) => {
            const iso = formatTanggalToISO(tanggal) || getTodayISO();
            setFilters((f) => ({ ...f, tanggalFrom: iso, tanggalTo: iso }));
          }}
          getGenBadgeColor={activeGenBadgeColor}
        />
      )}

      {/* VIEW 2: REKAP */}
      {viewMode === "rekap" && (
        <>
          {/* Sub-tabs: Ringkasan / Per Siswa */}
          <div className="flex items-center gap-2">
            <div className="inline-flex items-center gap-1 rounded-xl border-2 border-border bg-surface p-1">
              <button
                onClick={() => setRekapSubTab("ringkasan")}
                className={`chip min-h-[44px] text-xs ${rekapSubTab === "ringkasan" ? "chip-on" : ""}`}
              >
                Ringkasan
              </button>
              <button
                onClick={() => setRekapSubTab("siswa")}
                className={`chip min-h-[44px] text-xs ${rekapSubTab === "siswa" ? "chip-on" : ""}`}
              >
                Per Siswa
              </button>
            </div>
          </div>

          {rekapSubTab === "ringkasan" && (
            <StatsView
              stats={stats}
              records={records}
              filters={filters}
              onFiltersChange={setFilters}
              dailySummaries={dailySummaries}
              genSummaries={genSummaries}
              onOpenTableMode={() => setViewMode("absensi")}
              onStudentDetail={setStudentDetail}
              getGenBadgeColor={activeGenBadgeColor}
            />
          )}

          {rekapSubTab === "siswa" && (
            <IndividualStatsInline
              allRecords={allRecords}
              getGenBadgeColor={activeGenBadgeColor}
              onStudentDetail={setStudentDetail}
            />
          )}
        </>
      )}

      {/* Delete modal */}
      {deleteModal.open && deleteModal.record && (
        <DeleteConfirmModal
          record={deleteModal.record}
          deleting={deleting}
          onConfirm={confirmDeleteRecord}
          onCancel={() => setDeleteModal({ open: false, rowId: "", record: null })}
        />
      )}

      {/* Bulk delete modal */}
      {bulkDeleteModal && (
        <BulkDeleteModal
          count={selectedKeys.size}
          deleting={bulkDeleting}
          onConfirm={confirmBulkDelete}
          onCancel={() => setBulkDeleteModal(false)}
        />
      )}

      {/* Bulk move Gen modal */}
      {bulkMoveModal && (
        <BulkMoveModal
          count={selectedKeys.size}
          activeGens={activeGens}
          targetGen={bulkMoveTargetGen}
          moving={bulkMoving}
          onTargetChange={setBulkMoveTargetGen}
          onConfirm={confirmBulkMove}
          onCancel={() => setBulkMoveModal(false)}
        />
      )}

      {/* Student detail modal */}
      {studentDetail && (
        <StudentDetailModal
          nama={studentDetail}
          records={allRecords}
          onClose={() => setStudentDetail(null)}
        />
      )}

      {/* Edit modal */}
      {editModal.open && editModal.record && (
        <EditRecordModal
          record={editModal.record}
          activeGens={activeGens}
          editGen={editGen}
          editTanggal={editTanggal}
          editNama={editNama}
          editKelas={editKelas}
          editStatus={editStatus}
          editKas={editKas}
          saving={editing}
          onGenChange={setEditGen}
          onTanggalChange={setEditTanggal}
          onNamaChange={setEditNama}
          onKelasChange={setEditKelas}
          onStatusChange={setEditStatus}
          onKasChange={setEditKas}
          onConfirm={confirmEditRecord}
          onCancel={() => setEditModal({ open: false, rowId: "", record: null })}
        />
      )}

      {/* Toast */}
      {toast && <Toast type={toast.type} message={toast.message} />}
    </div>
  );
}