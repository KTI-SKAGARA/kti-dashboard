"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import {
  type Gen,
  type AttendanceRecord,
  type FilterState,
  type FilterOptions,
  type DashboardStats,
  type GenConfig,
  type StatusAbsen,
  SKAGARA_CLASSES,
} from "@/types/attendance";
import {
  getAttendanceRecords,
  deleteAttendanceRecord,
  deleteBatchAttendanceRecords,
  updateAttendanceRecord,
  moveBatchAttendanceRecords,
  getGenList,
} from "@/app/actions/attendance";
import {
  formatRupiah,
  formatBulanTahun,
  formatTanggalIndo,
  formatTanggalToISO,
  getTodayFormatted,
  getTodayISO,
  parseISOTanggal,
  getGenBadgeColor,
  getGenCardSelectedStyle,
} from "@/lib/utils";
import { APP_NAME, PAGE_SIZE, TOAST_DURATION } from "@/lib/constants";
import {
  Search,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Loader2,
  FilterX,
  PieChart as PieChartIcon,
  Table as TableIcon,
  Calendar as CalendarIcon,
  Download,
  PlusCircle,
  Trash2,
  Users,
  Archive,
  Pencil,
  CheckSquare,
  Square,
  ArrowRightLeft,
  Calendar,
  Eye,
} from "lucide-react";
import Link from "next/link";
import * as XLSX from "xlsx";
import DeleteConfirmModal from "@/components/DeleteConfirmModal";
import StudentDetailModal from "@/components/StudentDetailModal";
import Toast from "@/components/Toast";
import StatCard from "@/components/StatCard";
import ProgressBarRow from "@/components/ProgressBarRow";
import AttendanceTrendChart from "@/components/AttendanceTrendChart";
import AttendanceCalendar from "@/components/AttendanceCalendar";

type TaggedRecord = AttendanceRecord & { _gen: Gen; _rawIdx: number };

export default function DashboardPage() {
  const [viewMode, setViewMode] = useState<"table" | "calendar" | "stats">("table");

  const [genList, setGenList] = useState<GenConfig[]>([]);
  const [showLulus, setShowLulus] = useState(false);

  const [filters, setFilters] = useState<FilterState>({
    gen: "semua",
    kelas: "",
    bulan: "",
    tanggal: "",
    status: "",
    search: "",
  });

  const [allRecords, setAllRecords] = useState<TaggedRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  // Single Delete modal
  const [deleteModal, setDeleteModal] = useState<{
    open: boolean;
    index: number;
    record: TaggedRecord | null;
  }>({ open: false, index: -1, record: null });
  const [deleting, setDeleting] = useState(false);

  // Edit modal
  const [editModal, setEditModal] = useState<{
    open: boolean;
    index: number;
    record: TaggedRecord | null;
  }>({ open: false, index: -1, record: null });
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

  // Gens to iterate based on showLulus toggle
  const iterGens = useMemo(() => {
    if (showLulus) return genList.map((g) => g.gen);
    return genList.filter((g) => g.status === "aktif").map((g) => g.gen);
  }, [genList, showLulus]);

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

  // Load records from data layer (fast & cached)
  const loadRecords = useCallback(async () => {
    setLoading(true);
    try {
      const tagged: TaggedRecord[] = [];

      if (filters.gen === "semua") {
        const results = await Promise.all(
          iterGens.map((g) => getAttendanceRecords(g))
        );
        iterGens.forEach((g, i) => {
          if (results[i].success && results[i].data) {
            results[i].data!.forEach((r, idx) =>
              tagged.push({ ...r, _gen: g, _rawIdx: idx })
            );
          }
        });
      } else {
        const res = await getAttendanceRecords(filters.gen);
        if (res.success && res.data) {
          res.data.forEach((r, idx) =>
            tagged.push({ ...r, _gen: filters.gen as Gen, _rawIdx: idx })
          );
        }
      }

      setAllRecords(tagged);
      setPage(1);
    } catch {
      setAllRecords([]);
    } finally {
      setLoading(false);
    }
  }, [filters.gen, iterGens]);

  // Load data on Gen change or showLulus toggle
  useEffect(() => {
    if (iterGens.length > 0) {
      loadRecords();
    }
  }, [filters.gen, iterGens, loadRecords]);

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

  // Client-side filtering + sorting
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

    // Count members per kelas for sort weight
    const kelasCount = new Map<string, number>();
    for (const r of result) {
      kelasCount.set(r.kelas, (kelasCount.get(r.kelas) || 0) + 1);
    }

    // Sort: gen asc → kelas (most members first) → nama asc
    return [...result].sort((a, b) => {
      const genCmp = Number(a._gen) - Number(b._gen);
      if (genCmp !== 0) return genCmp;

      const aCount = kelasCount.get(a.kelas) || 0;
      const bCount = kelasCount.get(b.kelas) || 0;
      if (aCount !== bCount) return bCount - aCount;

      return a.nama.localeCompare(b.nama, "id");
    });
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

  // Reset page on filter change
  useEffect(() => {
    setPage(1);
  }, [filters.gen, filters.kelas, filters.bulan, filters.tanggal, filters.status, filters.search]);

  // Delete single record handler
  const confirmDeleteRecord = async () => {
    if (deleteModal.index < 0 || !deleteModal.record) return;
    setDeleting(true);
    try {
      const res = await deleteAttendanceRecord(deleteModal.record._gen, deleteModal.index);
      if (res.success) {
        setToast({ type: "success", message: "Catatan absensi berhasil dihapus." });
        setDeleteModal({ open: false, index: -1, record: null });
        loadRecords();
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
    setEditModal({ open: true, index: record._rawIdx, record });
    setEditGen(record._gen);
    setEditTanggal(formatTanggalToISO(record.tanggal) || getTodayISO());
    setEditNama(record.nama);
    setEditKelas(record.kelas);
    setEditStatus(record.statusAbsen);
    setEditKas(record.nominalKas);
  };

  const confirmEditRecord = async () => {
    if (editModal.index < 0 || !editModal.record) return;
    setEditing(true);
    try {
      const targetGenChanged = editGen && editGen !== editModal.record._gen;
      const res = await updateAttendanceRecord(editModal.record._gen, editModal.index, {
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
        setEditModal({ open: false, index: -1, record: null });
        loadRecords();
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

  // Pagination
  const totalPages = Math.max(1, Math.ceil(records.length / PAGE_SIZE));
  const paginatedRecords = records.slice(
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE
  );

  // Bulk delete handler
  const confirmBulkDelete = async () => {
    if (selectedKeys.size === 0) return;
    setBulkDeleting(true);

    const grouped = new Map<Gen, number[]>();
    for (const record of records) {
      const key = `${record._gen}|${record._rawIdx}`;
      if (selectedKeys.has(key)) {
        const arr = grouped.get(record._gen) || [];
        arr.push(record._rawIdx);
        grouped.set(record._gen, arr);
      }
    }

    try {
      let allOk = true;
      for (const [gen, indexes] of grouped) {
        const res = await deleteBatchAttendanceRecords(gen, indexes);
        if (!res.success) allOk = false;
      }
      if (allOk) {
        setToast({ type: "success", message: `${selectedKeys.size} catatan berhasil dihapus.` });
        setSelectedKeys(new Set());
        loadRecords();
      } else {
        setToast({ type: "error", message: "Gagal menghapus beberapa data." });
        loadRecords();
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

    const grouped = new Map<Gen, number[]>();
    for (const record of records) {
      const key = `${record._gen}|${record._rawIdx}`;
      if (selectedKeys.has(key)) {
        const arr = grouped.get(record._gen) || [];
        arr.push(record._rawIdx);
        grouped.set(record._gen, arr);
      }
    }

    try {
      let totalMoved = 0;
      let allOk = true;

      for (const [fromGen, indexes] of grouped) {
        if (fromGen === bulkMoveTargetGen) continue;
        const res = await moveBatchAttendanceRecords(
          fromGen,
          indexes,
          bulkMoveTargetGen
        );
        if (res.success) {
          totalMoved += res.data?.moved ?? indexes.length;
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
        loadRecords();
      } else {
        setToast({ type: "error", message: "Sebagian catatan gagal dipindahkan." });
        loadRecords();
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
    if (selectedKeys.size === paginatedRecords.length) {
      setSelectedKeys(new Set());
    } else {
      const keys = paginatedRecords.map((r) => `${r._gen}|${r._rawIdx}`);
      setSelectedKeys(new Set(keys));
    }
  };

  const allSelected =
    paginatedRecords.length > 0 && selectedKeys.size === paginatedRecords.length;

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

  const hasActiveFilter =
    filters.kelas ||
    filters.bulan ||
    filters.tanggal ||
    filters.status ||
    filters.search;

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
            Rekap <span className="marker">Absensi</span> &amp; Kas
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
              onClick={() => setViewMode("calendar")}
              className={`chip min-h-[44px] ${viewMode === "calendar" ? "chip-on" : ""}`}
            >
              <CalendarIcon className="h-4 w-4" />
              Kalender
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
      <div className="card mt-5 p-4 sm:p-5">
        {/* Gen filter */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={() => setFilters((f) => ({ ...f, gen: "semua" }))}
            className={`chip min-h-[44px] ${filters.gen === "semua" ? "chip-on" : ""}`}
          >
            Semua Gen
          </button>
          {activeGens.map((g) => (
            <button
              key={g}
              onClick={() => setFilters((f) => ({ ...f, gen: g }))}
              className={`chip min-h-[44px] ${filters.gen === g ? "chip-on" : ""}`}
            >
              Gen {g}
            </button>
          ))}
          <button
            onClick={() => setShowLulus((v) => !v)}
            className={`chip min-h-[44px] ${showLulus ? "chip-on" : ""}`}
            title="Tampilkan gen lulus"
          >
            <Archive className="h-4 w-4" />
            Arsip
          </button>
        </div>

        {/* Secondary filters */}
        <div className="mt-3.5 flex flex-wrap items-center justify-between gap-2 border-t-2 border-border pt-3">
          <div className="flex flex-wrap items-center gap-1.5">
            {([
              { id: "" as const, label: "Semua Status" },
              { id: "Hadir" as const, label: "Hadir" },
              { id: "Sakit" as const, label: "Sakit" },
              { id: "Izin" as const, label: "Izin" },
              { id: "Alfa" as const, label: "Alfa" },
            ]).map((st) => (
              <button
                key={st.id}
                onClick={() => setFilters((prev) => ({ ...prev, status: st.id }))}
                className={`chip min-h-[44px] ${filters.status === st.id ? "chip-on" : ""}`}
              >
                {st.label}
              </button>
            ))}

            {/* Filter Tanggal Dropdown */}
            <div className="relative">
              <select
                className={`select min-h-[44px] w-auto py-2 text-sm font-medium ${
                  filters.tanggal ? "!border-accent !bg-accent/10 !text-accent font-bold" : ""
                }`}
                value={filters.tanggal}
                onChange={(e) => setFilters((f) => ({ ...f, tanggal: e.target.value }))}
              >
                <option value="">📅 Semua Tanggal</option>
                {filterOptions.tanggalList.map((t) => (
                  <option key={t} value={t}>
                    {formatTanggalIndo(t, true)} ({t})
                  </option>
                ))}
              </select>
            </div>

            {/* Filter Bulan Dropdown */}
            <select
              className="select min-h-[44px] w-auto py-2 text-sm"
              value={filters.bulan}
              onChange={(e) => setFilters((f) => ({ ...f, bulan: e.target.value }))}
            >
              <option value="">Semua Bulan</option>
              {filterOptions.bulanList.map((b) => (
                <option key={b} value={b}>
                  {formatBulanTahun(b)}
                </option>
              ))}
            </select>

            {/* Filter Kelas Dropdown */}
            <select
              className="select min-h-[44px] w-auto py-2 text-sm"
              value={filters.kelas}
              onChange={(e) => setFilters((f) => ({ ...f, kelas: e.target.value }))}
            >
              <option value="">Semua Kelas</option>
              {Array.from(new Set([...SKAGARA_CLASSES, ...filterOptions.kelasList]))
                .sort((a, b) => a.localeCompare(b, "id"))
                .map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <input
                type="text"
                placeholder="Cari nama..."
                className="input min-h-[44px] w-44 pl-9 pr-3 text-sm sm:w-auto"
                value={filters.search}
                onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
              />
            </div>
            {hasActiveFilter && (
              <button
                onClick={() =>
                  setFilters({
                    gen: filters.gen,
                    kelas: "",
                    bulan: "",
                    tanggal: "",
                    status: "",
                    search: "",
                  })
                }
                className="btn btn-ghost min-h-[44px] min-w-[44px] px-2 py-2"
                title="Hapus semua filter"
              >
                <FilterX className="h-4 w-4" />
              </button>
            )}
            <button
              onClick={() => {
                loadRecords();
              }}
              className="btn btn-ghost min-h-[44px] min-w-[44px] px-2 py-2"
              title="Muat ulang data"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
            <button
              onClick={exportToExcel}
              disabled={records.length === 0}
              className="btn btn-primary min-h-[44px] px-3 py-2 text-sm"
            >
              <Download className="h-4 w-4" />
              Export
            </button>
          </div>
        </div>

        {/* Active Filter Badges */}
        {filters.tanggal && (
          <div className="mt-3 flex items-center gap-2 rounded-lg border border-accent/30 bg-accent/5 px-3 py-2 text-xs">
            <Calendar className="h-4 w-4 text-accent" />
            <span className="font-semibold text-foreground">
              Menampilkan data tanggal: <strong>{formatTanggalIndo(filters.tanggal)}</strong> ({filters.tanggal})
            </span>
            <button
              onClick={() => setFilters((f) => ({ ...f, tanggal: "" }))}
              className="ml-auto text-xs font-bold text-accent hover:underline"
            >
              Reset Tanggal
            </button>
          </div>
        )}
      </div>

      {/* VIEW 1: TABLE */}
      {viewMode === "table" && (
        <div className="card mt-4 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-5 w-5 animate-spin text-accent" />
              <span className="ml-2 text-sm font-medium text-muted">Memuat data...</span>
            </div>
          ) : records.length === 0 ? (
            <div className="py-16 text-center">
              <Users className="mx-auto h-8 w-8 text-muted" />
              <p className="mt-2 text-sm font-medium text-muted">
                {hasActiveFilter
                  ? "Tidak ada data yang cocok dengan filter yang dipilih."
                  : "Belum ada data."}
              </p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th className="w-10">
                        <button
                          onClick={toggleSelectAll}
                          className="btn btn-ghost min-h-[44px] min-w-[44px] p-2"
                          title={allSelected ? "Batalkan semua" : "Pilih semua"}
                        >
                          {allSelected ? (
                            <CheckSquare className="h-4 w-4 text-accent" />
                          ) : (
                            <Square className="h-4 w-4" />
                          )}
                        </button>
                      </th>
                      <th className="w-10">No</th>
                      <th>Tanggal</th>
                      <th>Nama</th>
                      <th>Kelas</th>
                      <th>Status</th>
                      <th className="text-right">Kas</th>
                      <th>Gen</th>
                      <th className="w-24"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedRecords.map((r, i) => {
                      return (
                        <tr key={`${r._gen}-${r.tanggal}-${r.nama}-${r._rawIdx}`}>
                          <td>
                            <button
                              onClick={() => toggleSelectRecord(`${r._gen}|${r._rawIdx}`)}
                              className="btn btn-ghost min-h-[44px] min-w-[44px] p-2"
                              title="Pilih"
                            >
                              {selectedKeys.has(`${r._gen}|${r._rawIdx}`) ? (
                                <CheckSquare className="h-4 w-4 text-accent" />
                              ) : (
                                <Square className="h-4 w-4" />
                              )}
                            </button>
                          </td>
                          <td className="text-muted tabular-nums">
                            {(page - 1) * PAGE_SIZE + i + 1}
                          </td>
                          <td className="whitespace-nowrap font-medium text-foreground">
                            <button
                              onClick={() => setFilters((f) => ({ ...f, tanggal: r.tanggal }))}
                              className="hover:text-accent hover:underline"
                              title={`Filter hanya tanggal ${r.tanggal}`}
                            >
                              {r.tanggal}
                            </button>
                          </td>
                          <td>
                            <button
                              onClick={() => setStudentDetail(r.nama)}
                              className="font-medium uppercase text-foreground underline decoration-accent/40 decoration-dashed underline-offset-2 hover:text-accent hover:decoration-accent"
                            >
                              {r.nama}
                            </button>
                          </td>
                          <td className="text-muted">{r.kelas}</td>
                          <td>
                            <span
                              className={`badge ${
                                r.statusAbsen === "Hadir"
                                  ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300"
                                  : r.statusAbsen === "Sakit"
                                  ? "bg-amber-500/15 text-amber-600 dark:text-amber-300"
                                  : r.statusAbsen === "Izin"
                                  ? "bg-accent/15 text-accent dark:text-accent"
                                  : "bg-danger/15 text-danger"
                              }`}
                            >
                              {r.statusAbsen}
                            </span>
                          </td>
                          <td className="text-right tabular-nums">
                            {r.nominalKas > 0 ? formatRupiah(r.nominalKas) : "—"}
                          </td>
                          <td>
                            <span
                              className={`badge font-bold ${activeGenBadgeColor(
                                r._gen
                              )}`}
                            >
                              GEN {r._gen}
                            </span>
                          </td>
                          <td className="whitespace-nowrap text-right">
                            <div className="inline-flex items-center gap-0.5">
                              <button
                                onClick={() => openEditModal(r)}
                                className="btn btn-ghost min-h-[44px] min-w-[44px] p-2 text-muted hover:!text-accent"
                                title="Edit data & ubah Gen"
                              >
                                <Pencil className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() =>
                                  setDeleteModal({
                                    open: true,
                                    index: r._rawIdx,
                                    record: r,
                                  })
                                }
                                className="btn btn-ghost min-h-[44px] min-w-[44px] p-2 text-muted hover:!text-danger"
                                title="Hapus"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Bulk action bar */}
              {selectedKeys.size > 0 && (
                <div className="flex flex-wrap items-center justify-between gap-3 border-t-2 border-border bg-accent/5 px-4 py-3">
                  <p className="text-xs font-bold uppercase tracking-wide text-foreground">
                    {selectedKeys.size} catatan dipilih
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setSelectedKeys(new Set())}
                      className="btn btn-ghost min-h-[44px] px-3 py-2 text-sm"
                    >
                      Batal
                    </button>
                    <button
                      onClick={() => {
                        setBulkMoveTargetGen(activeGens[0] || "12");
                        setBulkMoveModal(true);
                      }}
                      className="btn btn-secondary min-h-[44px] px-3 py-2 text-sm font-bold"
                      title="Pindahkan semua catatan yang dipilih ke Gen lain"
                    >
                      <ArrowRightLeft className="h-4 w-4 text-accent" />
                      Pindah Gen ({selectedKeys.size})
                    </button>
                    <button
                      onClick={() => setBulkDeleteModal(true)}
                      className="btn btn-danger min-h-[44px] px-3 py-2 text-sm"
                    >
                      <Trash2 className="h-4 w-4" />
                      Hapus Terpilih
                    </button>
                  </div>
                </div>
              )}

              {/* Pagination */}
              {totalPages > 1 && (
                <>
                  <div className="flex items-center justify-between gap-2 border-t-2 border-border px-4 py-3">
                    <p className="text-xs font-medium text-muted">
                      Menampilkan{" "}
                      <span className="font-bold text-foreground tabular-nums">
                        {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, records.length)}
                      </span>{" "}
                      dari{" "}
                      <span className="font-bold text-foreground tabular-nums">{records.length}</span>{" "}
                      data
                    </p>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={page <= 1}
                        className="btn btn-ghost min-h-[44px] min-w-[44px] p-2"
                        aria-label="Halaman sebelumnya"
                      >
                        <ChevronLeft className="h-5 w-5" />
                      </button>
                      <span className="px-2 text-sm font-bold text-foreground tabular-nums">
                        {page} / {totalPages}
                      </span>
                      <button
                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                        disabled={page >= totalPages}
                        className="btn btn-ghost min-h-[44px] min-w-[44px] p-2"
                        aria-label="Halaman berikutnya"
                      >
                        <ChevronRight className="h-5 w-5" />
                      </button>
                    </div>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      )}

      {/* VIEW 2: CALENDAR */}
      {viewMode === "calendar" && (
        <div className="mt-4">
          <AttendanceCalendar
            records={allRecords}
            selectedDate={filters.tanggal}
            onSelectDate={(tanggal) => setFilters((f) => ({ ...f, tanggal }))}
            onOpenTableMode={() => setViewMode("table")}
          />
        </div>
      )}

      {/* VIEW 3: STATS */}
      {viewMode === "stats" && (
        <div className="mt-5 space-y-5">
          {/* Header detail if date filtered */}
          {filters.tanggal && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border-2 border-accent bg-accent/10 p-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-accent">
                  Statistik Presensi Harian
                </p>
                <h2 className="text-base font-extrabold text-foreground">
                  Tanggal: {formatTanggalIndo(filters.tanggal)} ({filters.tanggal})
                </h2>
              </div>
              <button
                onClick={() => setFilters((f) => ({ ...f, tanggal: "" }))}
                className="btn btn-secondary min-h-[40px] px-3 py-1.5 text-xs font-bold"
              >
                Lihat Semua Tanggal
              </button>
            </div>
          )}

          {/* Quick Summary Cards */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard label="Total Siswa" value={stats.totalRecords} />
            <StatCard label="Siswa Hadir" value={stats.hadirCount} />
            <StatCard label="Tingkat Hadir" value={`${stats.attendanceRate}%`} />
            <StatCard label="Total Kas" value={formatRupiah(stats.totalKas)} />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="card p-5">
              <h2 className="font-display text-sm font-bold uppercase tracking-wide text-foreground">
                Distribusi Kehadiran {filters.tanggal ? `(${filters.tanggal})` : ""}
              </h2>
              {stats.totalRecords === 0 ? (
                <p className="py-6 text-center text-xs text-muted">Belum ada data.</p>
              ) : (
                <div className="mt-4 space-y-3">
                  <ProgressBarRow
                    label="Hadir"
                    count={stats.hadirCount}
                    total={stats.totalRecords}
                    fillClass="bg-emerald-500"
                  />
                  <ProgressBarRow
                    label="Sakit"
                    count={stats.sakitCount}
                    total={stats.totalRecords}
                    fillClass="bg-amber-400"
                  />
                  <ProgressBarRow
                    label="Izin"
                    count={stats.izinCount}
                    total={stats.totalRecords}
                    fillClass="bg-accent"
                  />
                  <ProgressBarRow
                    label="Alfa"
                    count={stats.alfaCount}
                    total={stats.totalRecords}
                    fillClass="bg-danger"
                  />
                </div>
              )}
            </div>

            <div className="card p-5">
              <h2 className="font-display text-sm font-bold uppercase tracking-wide text-foreground">
                Ringkasan Kas {filters.tanggal ? `(${filters.tanggal})` : ""}
              </h2>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <StatCard label="Total Kas" value={formatRupiah(stats.totalKas)} />
                <StatCard
                  label="Rata-rata / Siswa"
                  value={formatRupiah(stats.avgKasPerStudent)}
                />
              </div>
              <div className="mt-3 rounded-lg border-2 border-border bg-surface-2 p-3.5">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold uppercase tracking-wide text-foreground">
                    Persentase Kehadiran
                  </p>
                  <span className="text-base font-extrabold text-foreground tabular-nums">
                    <span>{stats.attendanceRate}%</span>
                  </span>
                </div>
                <div className="mt-2 h-2.5 w-full rounded-full bg-border">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-accent to-accent-2"
                    style={{ width: `${stats.attendanceRate}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* If date is filtered, show direct list of students on that date */}
          {filters.tanggal ? (
            <div className="card p-5">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-border pb-3">
                <div>
                  <h2 className="font-display text-sm font-bold uppercase tracking-wide text-foreground">
                    Daftar Siswa pada {formatTanggalIndo(filters.tanggal)}
                  </h2>
                  <p className="text-xs text-muted">
                    Total {records.length} siswa tercatat pada tanggal ini
                  </p>
                </div>
                <button
                  onClick={() => setViewMode("table")}
                  className="btn btn-secondary min-h-[36px] px-3 py-1.5 text-xs font-bold"
                >
                  <TableIcon className="h-3.5 w-3.5" />
                  Buka di Mode Tabel
                </button>
              </div>

              <div className="mt-3 overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th className="w-10">No</th>
                      <th>Nama Siswa</th>
                      <th>Kelas</th>
                      <th>Status Absen</th>
                      <th className="text-right">Nominal Kas</th>
                      <th>Gen</th>
                    </tr>
                  </thead>
                  <tbody>
                    {records.map((r, i) => (
                      <tr key={`${r._gen}-${r.nama}-${r._rawIdx}`}>
                        <td className="text-muted tabular-nums">{i + 1}</td>
                        <td className="font-medium uppercase text-foreground">
                          <button
                            onClick={() => setStudentDetail(r.nama)}
                            className="hover:text-accent hover:underline"
                          >
                            {r.nama}
                          </button>
                        </td>
                        <td className="text-muted">{r.kelas}</td>
                        <td>
                          <span
                            className={`badge ${
                              r.statusAbsen === "Hadir"
                                ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300"
                                : r.statusAbsen === "Sakit"
                                ? "bg-amber-500/15 text-amber-600 dark:text-amber-300"
                                : r.statusAbsen === "Izin"
                                ? "bg-accent/15 text-accent"
                                : "bg-danger/15 text-danger"
                            }`}
                          >
                            {r.statusAbsen}
                          </span>
                        </td>
                        <td className="text-right font-medium text-foreground tabular-nums">
                          {r.nominalKas > 0 ? formatRupiah(r.nominalKas) : "—"}
                        </td>
                        <td>
                          <span
                            className={`badge font-bold ${activeGenBadgeColor(
                              r._gen
                            )}`}
                          >
                            GEN {r._gen}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            /* Daily meeting dates breakdown table */
            <div className="card p-5">
              <div className="flex items-center justify-between border-b-2 border-border pb-3">
                <div>
                  <h2 className="font-display text-sm font-bold uppercase tracking-wide text-foreground">
                    Rekap Presensi Harian (Riwayat Pertemuan)
                  </h2>
                  <p className="text-xs text-muted">
                    Klik tombol &quot;Lihat Data&quot; untuk memfilter data siswa pada tanggal tertentu
                  </p>
                </div>
              </div>

              {dailySummaries.length === 0 ? (
                <p className="py-6 text-center text-xs text-muted">
                  Belum ada riwayat pertemuan.
                </p>
              ) : (
                <div className="mt-3 overflow-x-auto">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Tanggal Pertemuan</th>
                        <th>Gen</th>
                        <th>Total Siswa</th>
                        <th>Hadir</th>
                        <th>Sakit</th>
                        <th>Izin</th>
                        <th>Alfa</th>
                        <th className="text-right">Total Kas</th>
                        <th className="w-24 text-center">Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dailySummaries.map((ds) => (
                        <tr key={ds.tanggal}>
                          <td className="font-bold text-foreground">
                            {formatTanggalIndo(ds.tanggal)} ({ds.tanggal})
                          </td>
                          <td>
                            <div className="flex flex-wrap gap-1">
                              {Array.from(ds.gens).map((g) => (
                                <span
                                  key={g}
                                  className={`badge font-bold ${activeGenBadgeColor(
                                    g
                                  )}`}
                                >
                                  GEN {g}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="text-foreground font-semibold tabular-nums">
                            {ds.total}
                          </td>
                          <td className="text-emerald-600 dark:text-emerald-300 font-semibold tabular-nums">
                            {ds.hadir}
                          </td>
                          <td className="text-amber-600 dark:text-amber-300 tabular-nums">
                            {ds.sakit}
                          </td>
                          <td className="text-accent tabular-nums">{ds.izin}</td>
                          <td className="text-danger tabular-nums">{ds.alfa}</td>
                          <td className="text-right font-medium text-foreground tabular-nums">
                            {formatRupiah(ds.kas)}
                          </td>
                          <td className="text-center">
                            <button
                              onClick={() => {
                                setFilters((f) => ({ ...f, tanggal: ds.tanggal }));
                              }}
                              className="btn btn-secondary min-h-[36px] px-2.5 py-1 text-xs font-bold"
                              title={`Filter data presensi tanggal ${ds.tanggal}`}
                            >
                              <Eye className="h-3.5 w-3.5" />
                              Lihat Data
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Class summaries */}
          <div className="card p-5">
            <h2 className="font-display text-sm font-bold uppercase tracking-wide text-foreground">
              Rekap Kas per Kelas
            </h2>
            {stats.classSummaries.length === 0 ? (
              <p className="py-6 text-center text-xs text-muted">Belum ada rekap per kelas.</p>
            ) : (
              <div className="mt-3 overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Nama Kelas</th>
                      <th>Jumlah Catatan</th>
                      <th>Jumlah Hadir</th>
                      <th>Total Kas Terkumpul</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.classSummaries.map((cs) => (
                      <tr key={cs.kelas}>
                        <td className="font-medium text-foreground">{cs.kelas}</td>
                        <td className="text-muted tabular-nums">{cs.totalRecords}</td>
                        <td className="text-muted tabular-nums">{cs.hadirCount}</td>
                        <td className="font-medium text-foreground tabular-nums">
                          {formatRupiah(cs.totalKas)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {filters.gen === "semua" && genSummaries.length > 0 && (
            <div className="card p-5">
              <h2 className="font-display text-sm font-bold uppercase tracking-wide text-foreground">
                Rekap per Gen
              </h2>
              <div className="mt-3 overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Gen</th>
                      <th>Status</th>
                      <th>Total Catatan</th>
                      <th>Jumlah Hadir</th>
                      <th>Total Kas Terkumpul</th>
                    </tr>
                  </thead>
                  <tbody>
                    {genSummaries.map((gs) => (
                      <tr key={gs.gen} className={gs.isLulus ? "opacity-60" : ""}>
                        <td className="font-medium text-foreground">
                          <span className="font-display font-extrabold">Gen {gs.gen}</span>
                        </td>
                        <td>
                          {gs.isLulus ? (
                            <span className="badge border-amber-400/40 bg-amber-400/15 text-amber-600 dark:text-amber-300">
                              Lulus
                            </span>
                          ) : (
                            <span className="badge border-emerald-500/40 bg-emerald-500/15 text-emerald-600 dark:text-emerald-300">
                              Aktif
                            </span>
                          )}
                        </td>
                        <td className="text-muted tabular-nums">{gs.total}</td>
                        <td className="text-muted tabular-nums">{gs.hadir}</td>
                        <td className="font-medium text-foreground tabular-nums">
                          {formatRupiah(gs.kas)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Trend Chart */}
          <div className="card p-5">
            <h2 className="font-display text-sm font-bold uppercase tracking-wide text-foreground">
              Trend Kehadiran per Bulan
            </h2>
            <div className="mt-4">
              <AttendanceTrendChart records={allRecords} />
            </div>
            <div className="mt-3 flex items-center justify-center gap-4 text-[10px] font-bold uppercase tracking-wide text-muted">
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2.5 w-4 rounded-sm bg-accent/20" />
                Jumlah Catatan
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-0.5 w-4 rounded bg-accent" />
                % Kehadiran
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Delete modal */}
      {deleteModal.open && deleteModal.record && (
        <DeleteConfirmModal
          record={deleteModal.record}
          deleting={deleting}
          onConfirm={confirmDeleteRecord}
          onCancel={() => setDeleteModal({ open: false, index: -1, record: null })}
        />
      )}

      {/* Bulk delete modal */}
      {bulkDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/50 p-4">
          <div className="card w-full max-w-sm p-6 hard-shadow">
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
          <div className="card w-full max-w-md p-6 hard-shadow">
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
          <div className="card w-full max-w-md p-6 hard-shadow">
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
                onClick={() => setEditModal({ open: false, index: -1, record: null })}
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
