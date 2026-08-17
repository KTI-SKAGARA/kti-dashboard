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
  SKAGARA_CLASSES,
} from "@/types/attendance";
import {
  deleteAttendanceRecord,
  deleteBatchAttendanceRecords,
  updateAttendanceRecord,
  moveBatchAttendanceRecords,
  getGenList,
  getAttendanceRecordsPage,
} from "@/app/actions/attendance";
import { useTaggedRecords, useAttendanceData } from "@/hooks/useAttendanceData";
import {
  formatRupiah,
  formatBulanTahun,
  formatTanggalToISO,
  getTodayFormatted,
  getTodayISO,
  parseISOTanggal,
  getGenBadgeColor,
  getGenCardSelectedStyle,
} from "@/lib/utils";
import { APP_NAME, PAGE_SIZE, TOAST_DURATION } from "@/lib/constants";
import {
  PieChart as PieChartIcon,
  Table as TableIcon,
  Calendar,
  PlusCircle,
  Trash2,
  Loader2,
  ArrowRightLeft,
} from "lucide-react";
import Link from "next/link";
import * as XLSX from "xlsx";
import DeleteConfirmModal from "@/components/DeleteConfirmModal";
import StudentDetailModal from "@/components/StudentDetailModal";
import Toast from "@/components/Toast";
import FilterBar from "@/components/dashboard/FilterBar";
import AttendanceTable from "@/components/dashboard/AttendanceTable";
import StatsView from "@/components/dashboard/StatsView";

export default function DashboardPage() {
  const [viewMode, setViewMode] = useState<"table" | "stats">("table");

  const [genList, setGenList] = useState<GenConfig[]>([]);

  const [filters, setFilters] = useState<FilterState>({
    gen: "semua",
    kelas: "",
    bulan: "",
    tanggal: "",
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

  const [studentDetail, setStudentDetail] = useState<string | null>(null);

  const [toast, setToast] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // Only active gens
  const iterGens = useMemo(() => {
    return genList.filter((g) => g.status === "aktif").map((g) => g.gen);
  }, [genList]);

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

  // Shared data layer: fetch + cache per Gen, dipakai lintas route (PRD §4.1)
  const gensToLoad = useMemo(
    () => (filters.gen === "semua" ? iterGens : [filters.gen as Gen]),
    [filters.gen, iterGens]
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
  }, [filters.gen, filters.kelas, filters.bulan, filters.tanggal, filters.status, filters.search]);

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
        tanggal: filters.tanggal || undefined,
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
    filters.tanggal,
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
    if (filters.kelas) result = result.filter((r) => r.kelas === filters.kelas);
    if (filters.bulan) result = result.filter((r) => r.bulanTahun === filters.bulan);
    if (filters.tanggal) result = result.filter((r) => r.tanggal === filters.tanggal);
    if (filters.status) result = result.filter((r) => r.statusAbsen === filters.status);
    if (filters.search) {
      const q = filters.search.toLowerCase();
      result = result.filter((r) => r.nama.toLowerCase().includes(q));
    }
    return result;
  }, [allRecords, filters.kelas, filters.bulan, filters.tanggal, filters.status, filters.search]);

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
  const dailySummaries = useMemo(() => {
    let source = allRecords;
    if (filters.gen !== "semua") source = source.filter((r) => r._gen === filters.gen);
    if (filters.bulan) source = source.filter((r) => r.bulanTahun === filters.bulan);
    if (filters.kelas) source = source.filter((r) => r.kelas === filters.kelas);

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

    for (const r of source) {
      if (!r.tanggal) continue;
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
  }, [allRecords, filters.gen, filters.bulan, filters.kelas]);

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
  const exportToExcel = () => {
    if (records.length === 0) return;

    const bulanSlug = filters.bulan ? `_${filters.bulan.replace("-", "")}` : "";
    const tglSlug = filters.tanggal ? `_${filters.tanggal.replace(/\//g, "")}` : "";

    const wb = XLSX.utils.book_new();

    if (filters.gen === "semua") {
      // 1. All records combined sheet
      const allRows = records.map((r, i) => ({
        No: i + 1,
        Gen: `GEN ${r._gen}`,
        Tanggal: r.tanggal,
        Nama: r.nama,
        Kelas: r.kelas,
        Status_Absen: r.statusAbsen,
        Nominal_Kas: r.nominalKas,
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
        { wch: 14 },
        { wch: 12 },
      ];
      XLSX.utils.book_append_sheet(wb, allWs, "Semua Data");

      // 2. Individual Gen sheets
      for (const g of iterGens) {
        const genRecs = records.filter((r) => r._gen === g);
        if (genRecs.length === 0) continue;
        const gRows = genRecs.map((r, i) => ({
          No: i + 1,
          Tanggal: r.tanggal,
          Nama: r.nama,
          Kelas: r.kelas,
          Status_Absen: r.statusAbsen,
          Nominal_Kas: r.nominalKas,
          Bulan_Tahun: r.bulanTahun,
        }));
        const gWs = XLSX.utils.json_to_sheet(gRows);
        gWs["!cols"] = [
          { wch: 5 },
          { wch: 12 },
          { wch: 24 },
          { wch: 12 },
          { wch: 14 },
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
          kas: number;
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
          kas: 0,
        };
        if (r.statusAbsen === "Hadir") s.hadir += 1;
        else if (r.statusAbsen === "Sakit") s.sakit += 1;
        else if (r.statusAbsen === "Izin") s.izin += 1;
        else s.alfa += 1;
        s.kas += r.nominalKas;
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
            "Total Kas": s.kas,
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
        { wch: 14 },
      ];
      XLSX.utils.book_append_sheet(wb, studentWs, "Rekap Individu");

      // 4. Ringkasan per Gen
      const genSummaryRows = iterGens.map((g, i) => {
        const gRecs = records.filter((r) => r._gen === g);
        const uniqueStudents = new Set(gRecs.map((r) => `${r.kelas}|${r.nama}`));
        const hadir = gRecs.filter((r) => r.statusAbsen === "Hadir").length;
        const sakit = gRecs.filter((r) => r.statusAbsen === "Sakit").length;
        const izin = gRecs.filter((r) => r.statusAbsen === "Izin").length;
        const alfa = gRecs.filter((r) => r.statusAbsen === "Alfa").length;
        const total = gRecs.length;
        const kas = gRecs.reduce((sum, r) => sum + r.nominalKas, 0);

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
          "Total Kas": kas,
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
        Nominal_Kas: r.nominalKas,
        Bulan_Tahun: r.bulanTahun,
      }));
      const rawWs = XLSX.utils.json_to_sheet(data);
      rawWs["!cols"] = [
        { wch: 5 },
        { wch: 12 },
        { wch: 24 },
        { wch: 12 },
        { wch: 14 },
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
          kas: number;
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
          kas: number;
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
          kas: 0,
        };
        if (r.statusAbsen === "Hadir") s.hadir += 1;
        else if (r.statusAbsen === "Sakit") s.sakit += 1;
        else if (r.statusAbsen === "Izin") s.izin += 1;
        else s.alfa += 1;
        s.kas += r.nominalKas;
        students.set(key, s);

        const c = classes.get(r.kelas) || {
          siswa: new Set<string>(),
          total: 0,
          hadir: 0,
          sakit: 0,
          izin: 0,
          alfa: 0,
          kas: 0,
        };
        c.siswa.add(r.nama);
        c.total += 1;
        if (r.statusAbsen === "Hadir") c.hadir += 1;
        else if (r.statusAbsen === "Sakit") c.sakit += 1;
        else if (r.statusAbsen === "Izin") c.izin += 1;
        else c.alfa += 1;
        c.kas += r.nominalKas;
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
          "Total Kas": s.kas,
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
          "Total Kas": c.kas,
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
    const todayRecords = allRecords.filter((r) => r.tanggal === today);
    const [dd, mm, yyyy] = today.split("/");
    const total = todayRecords.length;
    const hadir = todayRecords.filter((r) => r.statusAbsen === "Hadir").length;
    const sakit = todayRecords.filter((r) => r.statusAbsen === "Sakit").length;
    const izin = todayRecords.filter((r) => r.statusAbsen === "Izin").length;
    const alfa = todayRecords.filter((r) => r.statusAbsen === "Alfa").length;
    const kas = todayRecords.reduce((sum, r) => sum + r.nominalKas, 0);
    return {
      today,
      dateLabel: `${dd} ${formatBulanTahun(`${mm}-${yyyy}`)}`,
      total,
      hadir,
      sakit,
      izin,
      alfa,
      kas,
    };
  }, [allRecords]);

  const hasActiveFilter = Boolean(
    filters.kelas ||
      filters.bulan ||
      filters.tanggal ||
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
              onClick={() => setViewMode("table")}
              className={`chip min-h-[44px] ${viewMode === "table" ? "chip-on" : ""}`}
            >
              <TableIcon className="h-4 w-4" />
              Tabel
            </button>
            <button
              onClick={() => setViewMode("stats")}
              className={`chip min-h-[44px] ${viewMode === "stats" ? "chip-on" : ""}`}
            >
              <PieChartIcon className="h-4 w-4" />
              Statistik
            </button>
          </div>
          <Link href="/input" className="btn btn-primary min-h-[44px] px-3 py-2 text-sm">
            <PlusCircle className="h-4 w-4" />
            Input Data
          </Link>
        </div>
      </div>

      {/* Hari ini banner */}
      <div className="card mt-4 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-bold uppercase tracking-wide text-muted">
            Hari ini — {todayStats.dateLabel}
          </p>
          {todayStats.total > 0 && filters.tanggal !== todayStats.today && (
            <button
              onClick={() => setFilters((f) => ({ ...f, tanggal: todayStats.today }))}
              className="inline-flex items-center gap-1 text-[11px] font-bold text-accent hover:underline"
            >
              <Calendar className="h-3 w-3" />
              Filter Catatan Hari Ini
            </button>
          )}
        </div>
        {todayStats.total === 0 ? (
          <p className="mt-2 text-xs text-muted">Belum ada catatan hari ini.</p>
        ) : (
          <div className="mt-2.5 flex flex-wrap gap-2">
            {[
              { label: "Total", value: todayStats.total, cls: "bg-surface-2 text-foreground" },
              {
                label: "Hadir",
                value: todayStats.hadir,
                cls: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300",
              },
              {
                label: "Sakit",
                value: todayStats.sakit,
                cls: "bg-amber-500/15 text-amber-600 dark:text-amber-300",
              },
              { label: "Izin", value: todayStats.izin, cls: "bg-accent/15 text-accent" },
              { label: "Alfa", value: todayStats.alfa, cls: "bg-danger/15 text-danger" },
            ].map((s) => (
              <span
                key={s.label}
                className={`badge ${s.cls} min-w-[48px] justify-center`}
              >
                {s.label} {s.value}
              </span>
            ))}
            {todayStats.kas > 0 && (
              <span className="badge bg-accent/10 text-accent min-w-[48px] justify-center">
                Kas {formatRupiah(todayStats.kas)}
              </span>
            )}
          </div>
        )}
      </div>

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

      {/* VIEW 1: TABLE (pagination + filter di server, PRD P2-6) */}
      {viewMode === "table" && (
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
          onFilterTanggal={(tanggal) => setFilters((f) => ({ ...f, tanggal }))}
          getGenBadgeColor={activeGenBadgeColor}
        />
      )}

      {/* VIEW 2: STATS */}
      {viewMode === "stats" && (
        <StatsView
          stats={stats}
          records={records}
          filters={filters}
          onFiltersChange={setFilters}
          dailySummaries={dailySummaries}
          genSummaries={genSummaries}
          onOpenTableMode={() => setViewMode("table")}
          onStudentDetail={setStudentDetail}
          getGenBadgeColor={activeGenBadgeColor}
        />
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/50 p-4">
           <div className="card w-full max-w-sm p-6 shadow-lg">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-danger/40 bg-danger/15">
                <Trash2 className="h-4.5 w-4.5 text-danger" />
              </div>
              <div>
                <h3 className="font-display text-base font-extrabold uppercase tracking-tight text-foreground">
                  Hapus {selectedKeys.size} catatan?
                </h3>
                <p className="mt-0.5 text-xs font-medium text-muted">
                  Tindakan ini tidak dapat dibatalkan.
                </p>
              </div>
            </div>
            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                onClick={() => setBulkDeleteModal(false)}
                disabled={bulkDeleting}
                className="btn btn-secondary min-h-[44px] px-4 py-2 text-sm"
              >
                Batal
              </button>
              <button
                onClick={confirmBulkDelete}
                disabled={bulkDeleting}
                className="btn btn-danger min-h-[44px] px-4 py-2 text-sm"
              >
                {bulkDeleting && <Loader2 className="h-4 w-4 animate-spin" />}
                {bulkDeleting ? "Menghapus..." : "Hapus Semua"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk move Gen modal */}
      {bulkMoveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/50 p-4">
          <div className="card w-full max-w-md p-6 shadow-lg">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-accent/40 bg-accent/15">
                <ArrowRightLeft className="h-4.5 w-4.5 text-accent" />
              </div>
              <div>
                <h3 className="font-display text-base font-extrabold uppercase tracking-tight text-foreground">
                  Pindah Gen ({selectedKeys.size} Catatan)
                </h3>
                <p className="mt-0.5 text-xs font-medium text-muted">
                  Pindahkan seluruh data yang dipilih ke Generasi / Angkatan lain.
                </p>
              </div>
            </div>

            <div className="mt-4 space-y-3">
              <div>
                <label className="label">Pilih Gen Tujuan</label>
                <div className="grid grid-cols-3 gap-2">
                  {activeGens.map((g) => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => setBulkMoveTargetGen(g)}
                      className={`flex flex-col items-center justify-center rounded-xl border-2 p-2.5 transition-all text-center ${
                        bulkMoveTargetGen === g
                          ? getGenCardSelectedStyle(g)
                          : "border-border bg-surface-2 text-foreground font-semibold hover:bg-surface"
                      }`}
                    >
                      <span className="text-sm font-display">Gen {g}</span>
                      <span className="text-[10px] text-muted">
                        Angkatan {g}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <p className="text-[11px] text-muted bg-surface-2 rounded-lg p-2.5 border border-border">
                💡 Seluruh baris yang dipilih akan dipindahkan dari tab asal Google Sheets ke tab <strong>GEN {bulkMoveTargetGen}</strong>.
              </p>
            </div>

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                onClick={() => setBulkMoveModal(false)}
                disabled={bulkMoving}
                className="btn btn-secondary min-h-[44px] px-4 py-2 text-sm"
              >
                Batal
              </button>
              <button
                onClick={confirmBulkMove}
                disabled={bulkMoving || !bulkMoveTargetGen}
                className="btn btn-primary min-h-[44px] px-4 py-2 text-sm font-bold"
              >
                {bulkMoving && <Loader2 className="h-4 w-4 animate-spin" />}
                {bulkMoving ? "Memindahkan..." : `Pindahkan ke Gen ${bulkMoveTargetGen}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Student detail modal */}
      {studentDetail && (
        <StudentDetailModal
          nama={studentDetail}
          records={allRecords}
          onClose={() => setStudentDetail(null)}
        />
      )}

      {/* Edit modal (Supports changing Gen, Tanggal, Nama, Kelas, Status, Kas) */}
      {editModal.open && editModal.record && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/50 p-4">
          <div className="card w-full max-w-md p-6 shadow-lg">
            <h3 className="font-display text-lg font-extrabold uppercase tracking-tight text-foreground">
              Edit Data Absensi
            </h3>
            <p className="mt-0.5 text-xs font-semibold uppercase tracking-wide text-muted">
              {editModal.record.nama} — Semula di Gen {editModal.record._gen}
            </p>

            <div className="mt-4 space-y-3.5">
              {/* Gen Switcher */}
              <div>
                <label className="label !mb-1.5 flex items-center justify-between">
                  <span>Generasi (Gen)</span>
                  {editGen !== editModal.record._gen && (
                    <span className="text-[10px] font-bold text-accent">
                      Akan dipindahkan ke Gen {editGen}
                    </span>
                  )}
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {activeGens.map((g) => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => setEditGen(g)}
                      className={`flex flex-col items-center justify-center rounded-xl border-2 p-2 transition-all text-center ${
                        editGen === g
                          ? getGenCardSelectedStyle(g)
                          : "border-border bg-surface-2 text-foreground font-semibold hover:bg-surface"
                      }`}
                    >
                      <span className="text-xs font-display">Gen {g}</span>
                      <span className="text-[10px] text-muted">
                        Angkatan {g}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Tanggal */}
              <div>
                <label className="label">Tanggal</label>
                <input
                  type="date"
                  className="input"
                  value={editTanggal}
                  onChange={(e) => setEditTanggal(e.target.value)}
                />
              </div>

              {/* Nama */}
              <div>
                <label className="label">Nama Siswa</label>
                <input
                  type="text"
                  className="input font-medium uppercase"
                  value={editNama}
                  onChange={(e) => setEditNama(e.target.value.toUpperCase())}
                />
              </div>

              {/* Kelas */}
              <div>
                <label className="label">Kelas</label>
                <select
                  className="select"
                  value={editKelas}
                  onChange={(e) => setEditKelas(e.target.value)}
                >
                  <optgroup label="Kelas X (Sepuluh)">
                    {SKAGARA_CLASSES.filter((k) => k.startsWith("X ")).map((k) => (
                      <option key={k} value={k}>
                        {k}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Kelas XI (Sebelas)">
                    {SKAGARA_CLASSES.filter((k) => k.startsWith("XI ")).map((k) => (
                      <option key={k} value={k}>
                        {k}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Kelas XII (Dua Belas)">
                    {SKAGARA_CLASSES.filter((k) => k.startsWith("XII ")).map((k) => (
                      <option key={k} value={k}>
                        {k}
                      </option>
                    ))}
                  </optgroup>
                </select>
              </div>

              {/* Status */}
              <div>
                <label className="label">Status Absen</label>
                <select
                  className="select"
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value as StatusAbsen)}
                >
                  {(["Hadir", "Sakit", "Izin", "Alfa"] as StatusAbsen[]).map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              {/* Kas */}
              <div>
                <label className="label">Nominal Kas (Rp)</label>
                <input
                  type="number"
                  min="0"
                  step="500"
                  className="input tabular-nums"
                  value={editKas}
                  onChange={(e) => setEditKas(Number(e.target.value) || 0)}
                />
              </div>
            </div>

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                onClick={() => setEditModal({ open: false, rowId: "", record: null })}
                disabled={editing}
                className="btn btn-secondary min-h-[44px] px-4 py-2 text-sm"
              >
                Batal
              </button>
              <button
                onClick={confirmEditRecord}
                disabled={editing}
                className="btn btn-primary min-h-[44px] px-4 py-2 text-sm"
              >
                {editing && <Loader2 className="h-4 w-4 animate-spin" />}
                {editing ? "Menyimpan..." : "Simpan Perubahan"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && <Toast type={toast.type} message={toast.message} />}
    </div>
  );
}