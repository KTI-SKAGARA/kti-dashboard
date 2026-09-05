"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  type Gen,
  type StatusAbsen,
  type StudentOption,
  type GenConfig,
  SKAGARA_CLASSES,
  KAS_RUTIN_DEFAULT,
} from "@/types/attendance";
import {
  type Kegiatan,
  getLiburDates,
} from "@/types/kegiatan";
import { getKegiatan } from "@/app/actions/kegiatan";
import {
  submitAttendanceRecord,
  submitBulkAttendance,
  getExistingStudents,
  getFilterOptions,
  getGenList,
} from "@/app/actions/attendance";
import {
  getTodayISO,
  parseISOTanggal,
  normalizeName,
  formatRupiah,
  formatTanggalIndo,
  getGenCardSelectedStyle,
  getStatusBadgeClass,
} from "@/lib/utils";
import { APP_NAME, SCHOOL_NAME, TOAST_DURATION } from "@/lib/constants";
import {
  Send,
  Loader2,
  AlertCircle,
  RotateCcw,
  ArrowLeft,
  User,
  ListChecks,
  PenLine,
  Sparkles,
  Plus,
  UserPlus,
  Check,
} from "lucide-react";
import Link from "next/link";
import Toast from "@/components/Toast";
import { useAttendanceData } from "@/hooks/useAttendanceData";
import { calculateStudentKas } from "@/lib/kas-allocation";

type InputMode = "normal" | "cepat";

interface QuickStudent {
  nama: string;
  kelas: string;
  status: StatusAbsen | null;
  nominalKas: number;
}

// Palet warna status (konsisten dengan mode manual & tabel)
const STATUS_STYLES: Record<
  StatusAbsen,
  { chip: string; row: string; badge: string }
> = {
  Hadir: {
    chip: "border-emerald-500 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
    row: "border-emerald-500/50 bg-emerald-500/10 text-foreground",
    badge: getStatusBadgeClass("Hadir"),
  },
  Sakit: {
    chip: "border-amber-500 bg-amber-500/15 text-amber-700 dark:text-amber-300",
    row: "border-amber-500/50 bg-amber-500/10 text-foreground",
    badge: getStatusBadgeClass("Sakit"),
  },
  Izin: {
    chip: "border-accent bg-accent/15 text-accent",
    row: "border-accent/50 bg-accent/10 text-foreground",
    badge: getStatusBadgeClass("Izin"),
  },
  Alfa: {
    chip: "border-danger bg-danger/15 text-danger",
    row: "border-danger/50 bg-danger/10 text-foreground",
    badge: getStatusBadgeClass("Alfa"),
  },
};

export default function InputPage() {
  const [mode, setMode] = useState<InputMode>("normal");
  const [gen, setGen] = useState<Gen>("");
  const [genList, setGenList] = useState<GenConfig[]>([]);
  const [kelas, setKelas] = useState("");
  const [tanggal, setTanggal] = useState(getTodayISO());

  // Normal mode state
  const [nama, setNama] = useState("");
  const [statusAbsen, setStatusAbsen] = useState<StatusAbsen>("Hadir");
  const [bayarKas, setBayarKas] = useState(true);
  const [nominalKas, setNominalKas] = useState(`${KAS_RUTIN_DEFAULT}`);

  // Shared state
  const [existingStudents, setExistingStudents] = useState<StudentOption[]>([]);
  const [existingClasses, setExistingClasses] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [kegiatanList, setKegiatanList] = useState<Kegiatan[]>([]);

  const liburDates = useMemo(() => getLiburDates(kegiatanList), [kegiatanList]);
  const isLibur = useMemo(() => {
    if (!tanggal) return false;
    return liburDates.has(parseISOTanggal(tanggal));
  }, [tanggal, liburDates]);

  // Quick mode state
  const [statusMap, setStatusMap] = useState<Record<string, StatusAbsen>>({});
  const [kasMap, setKasMap] = useState<Record<string, number>>({});
  const [quickNewNama, setQuickNewNama] = useState("");
  const [quickNewKelas, setQuickNewKelas] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);

  // Active gens only (for dropdown & buttons)
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
        const firstActive = res.data.find((g) => g.status === "aktif");
        if (firstActive) setGen(firstActive.gen);
      }
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    loadGenList(); // eslint-disable-line react-hooks/set-state-in-effect
  }, [loadGenList]);

  // Load kegiatan for libur check
  useEffect(() => {
    getKegiatan().then(setKegiatanList);
  }, []);

  // All classes: 39 official + whatever is in the sheet
  const availableClasses = useMemo(() => {
    const official = [...SKAGARA_CLASSES];
    const all = new Set([...official, ...existingClasses]);
    return Array.from(all).sort((a, b) => a.localeCompare(b, "id"));
  }, [existingClasses]);

  const loadGenData = useCallback(async (selectedGen: Gen) => {
    try {
      const [studentRes, filterRes] = await Promise.all([
        getExistingStudents(selectedGen),
        getFilterOptions(selectedGen),
      ]);

      if (studentRes.success && studentRes.data) {
        setExistingStudents(studentRes.data);
      } else {
        setExistingStudents([]);
      }

      if (filterRes.success && filterRes.data) {
        setExistingClasses(filterRes.data.kelasList);
      } else {
        setExistingClasses([]);
      }
    } catch {
      setExistingStudents([]);
      setExistingClasses([]);
    }
  }, []);

  const { loadGen, getRecords } = useAttendanceData();

  useEffect(() => {
    if (gen) {
      loadGenData(gen); // eslint-disable-line react-hooks/set-state-in-effect
      loadGen(gen);
    }
  }, [gen, loadGenData, loadGen]);

  // Hitung saldo lebih (surplus alihan) per siswa di Gen aktif
  const studentSurplusMap = useMemo(() => {
    if (!gen) return new Map<string, number>();
    const genRecords = getRecords(gen) || [];
    const map = new Map<string, number>();

    const studentGroups = new Map<string, import("@/types/attendance").TaggedRecord[]>();
    for (const r of genRecords) {
      if (!r.nama) continue;
      const list = studentGroups.get(r.nama) || [];
      list.push({ ...r, _gen: gen, _rowId: r.rowId || "" });
      studentGroups.set(r.nama, list);
    }

    for (const [sNama, sRecords] of studentGroups) {
      const summary = calculateStudentKas(sRecords);
      if (summary.currentSurplus > 0) {
        map.set(sNama, summary.currentSurplus);
      }
    }

    return map;
  }, [gen, getRecords]);

  // Hitung jumlah siswa per kelas di Gen aktif
  const classStudentCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const s of existingStudents) {
      if (s.kelas) {
        counts.set(s.kelas, (counts.get(s.kelas) || 0) + 1);
      }
    }
    return counts;
  }, [existingStudents]);

  const classesWithStudents = useMemo(() => {
    return Array.from(classStudentCounts.keys()).sort((a, b) => a.localeCompare(b, "id"));
  }, [classStudentCounts]);

  // Students for selected class (quick mode) — mendukung "semua" untuk tampilkan seluruh siswa Gen ini
  const studentsForKelas = useMemo(() => {
    if (!kelas) return [];
    if (kelas === "semua") {
      return [...existingStudents].sort((a, b) => a.nama.localeCompare(b.nama, "id"));
    }
    return existingStudents
      .filter((s) => s.kelas === kelas)
      .sort((a, b) => a.nama.localeCompare(b.nama, "id"));
  }, [existingStudents, kelas]);

  const quickStudents: QuickStudent[] = useMemo(() => {
    if (mode !== "cepat" || !kelas) return [];
    return studentsForKelas.map((s) => {
      const surplus = studentSurplusMap.get(s.nama) || 0;
      const defaultKas = Math.max(0, KAS_RUTIN_DEFAULT - surplus);
      return {
        nama: s.nama,
        kelas: s.kelas,
        status: statusMap[s.nama] ?? null,
        nominalKas: kasMap[s.nama] ?? defaultKas,
      };
    });
  }, [mode, kelas, studentsForKelas, statusMap, kasMap, studentSurplusMap]);

  // Kas rules (normal mode)
  const kasRules = useMemo(() => {
    switch (statusAbsen) {
      case "Hadir":
        return { wajib: true, catatan: "Anggota yang hadir wajib membayar kas." };
      case "Alfa":
        return { wajib: false, catatan: "Tidak membayar kas (status Alfa)." };
      default:
        return { wajib: false, catatan: "Opsional — centang jika tetap membayar kas." };
    }
  }, [statusAbsen]);

  // Quick mode stats
  const quickStats = useMemo(() => {
    const counts = { hadir: 0, sakit: 0, izin: 0, alfa: 0, terisi: 0 };
    let totalKas = 0;
    for (const s of quickStudents) {
      if (s.status) {
        counts[s.status.toLowerCase() as keyof typeof counts] += 1;
        counts.terisi += 1;
        if (s.status !== "Alfa") totalKas += (s.nominalKas || 0);
      }
    }
    return {
      total: quickStudents.length,
      ...counts,
      totalKas,
    };
  }, [quickStudents]);

  // Autocomplete suggestions for normal mode
  const filteredSuggestions = useMemo(() => {
    if (!nama || nama.length < 2) return [];
    const query = nama.toUpperCase();
    return existingStudents.filter(
      (s) => s.nama.includes(query) && (!kelas || s.kelas === kelas)
    );
  }, [nama, kelas, existingStudents]);

  // Handlers for normal mode
  const handleStatusChange = (newStatus: StatusAbsen) => {
    setStatusAbsen(newStatus);
    const surplus = studentSurplusMap.get(normalizeName(nama)) || 0;
    if (newStatus === "Hadir") {
      const needed = Math.max(0, KAS_RUTIN_DEFAULT - surplus);
      if (needed === 0) {
        setBayarKas(false);
        setNominalKas("0");
      } else {
        setBayarKas(true);
        setNominalKas(`${needed}`);
      }
    } else {
      setBayarKas(false);
      setNominalKas("0");
    }
  };

  const handleBayarKasToggle = (checked: boolean) => {
    setBayarKas(checked);
    if (checked) {
      const surplus = studentSurplusMap.get(normalizeName(nama)) || 0;
      const needed = Math.max(0, KAS_RUTIN_DEFAULT - surplus);
      setNominalKas(`${needed > 0 ? needed : KAS_RUTIN_DEFAULT}`);
    } else {
      setNominalKas("0");
    }
  };

  const handleSelectSuggestion = (student: StudentOption) => {
    setNama(student.nama);
    if (student.kelas) {
      setKelas(student.kelas);
    }
    const surplus = studentSurplusMap.get(student.nama) || 0;
    const needed = Math.max(0, KAS_RUTIN_DEFAULT - surplus);
    if (needed === 0) {
      setBayarKas(false);
      setNominalKas("0");
    } else {
      setBayarKas(true);
      setNominalKas(`${needed}`);
    }
    setShowSuggestions(false);
    if (errors.nama) setErrors((prev) => ({ ...prev, nama: "" }));
    if (errors.kelas) setErrors((prev) => ({ ...prev, kelas: "" }));
  };

  const handleKelasChange = (newKelas: string) => {
    setKelas(newKelas);
    if (errors.kelas) setErrors((prev) => ({ ...prev, kelas: "" }));
    setStatusMap({});
    setKasMap({});
  };

  // Quick mode handlers
  const applyStatus = (studentNama: string, st: StatusAbsen) => {
    setStatusMap((prev) => ({ ...prev, [studentNama]: st }));
    if (st === "Alfa") {
      setKasMap((prev) => ({ ...prev, [studentNama]: 0 }));
    } else if (st === "Hadir") {
      const surplus = studentSurplusMap.get(studentNama) || 0;
      const needed = Math.max(0, KAS_RUTIN_DEFAULT - surplus);
      setKasMap((prev) => ({
        ...prev,
        [studentNama]:
          prev[studentNama] !== undefined && prev[studentNama] > 0
            ? prev[studentNama]
            : needed,
      }));
    }
  };

  const clearStudentStatus = (studentNama: string) => {
    setStatusMap((prev) => {
      const next = { ...prev };
      delete next[studentNama];
      return next;
    });
    setKasMap((prev) => {
      const next = { ...prev };
      delete next[studentNama];
      return next;
    });
  };

  const handleStatusClick = (studentNama: string, st: StatusAbsen) => {
    if (statusMap[studentNama] === st) {
      clearStudentStatus(studentNama);
    } else {
      applyStatus(studentNama, st);
    }
  };

  const handleAddQuickStudent = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = normalizeName(quickNewNama.trim());
    if (!cleanName) return;

    const assignedKelas =
      kelas !== "semua"
        ? kelas
        : quickNewKelas.trim() || (classesWithStudents[0] || "Umum");

    if (existingStudents.some((s) => s.nama === cleanName)) {
      setToast({
        type: "error",
        message: `Siswa "${cleanName}" sudah terdaftar di daftar absensi.`,
      });
      setTimeout(() => setToast(null), 3000);
      return;
    }

    const newStudent: StudentOption = { nama: cleanName, kelas: assignedKelas };
    setExistingStudents((prev) => [...prev, newStudent]);
    applyStatus(cleanName, "Hadir");
    setQuickNewNama("");
    setQuickNewKelas("");
    setShowAddForm(false);
    setToast({
      type: "success",
      message: `${cleanName} (${assignedKelas}) berhasil ditambahkan & ditandai Hadir!`,
    });
    setTimeout(() => setToast(null), 3000);
  };

  const setStudentKas = (studentNama: string, amount: number) => {
    setKasMap((prev) => ({
      ...prev,
      [studentNama]: amount,
    }));
    // Jika siswa belum punya status kehadiran dan nominal kas > 0, otomatis tandai Hadir
    if (!statusMap[studentNama] && amount > 0) {
      setStatusMap((prev) => ({ ...prev, [studentNama]: "Hadir" }));
    }
  };

  const setAllStudentsKas = (amount: number) => {
    const kas: Record<string, number> = {};
    for (const s of studentsForKelas) {
      kas[s.nama] = amount;
    }
    setKasMap((prev) => ({ ...prev, ...kas }));
  };

  const toggleAllStudents = (st: StatusAbsen | null) => {
    if (st) {
      const next: Record<string, StatusAbsen> = {};
      const kas: Record<string, number> = {};
      for (const s of studentsForKelas) {
        next[s.nama] = st;
        if (st === "Hadir") {
          const surplus = studentSurplusMap.get(s.nama) || 0;
          kas[s.nama] = Math.max(0, KAS_RUTIN_DEFAULT - surplus);
        } else {
          kas[s.nama] = 0;
        }
      }
      setStatusMap(next);
      setKasMap(kas);
    } else {
      setStatusMap({});
      setKasMap({});
    }
  };

  // Validation & Submit for normal mode
  const validateNormal = (): boolean => {
    const errs: Record<string, string> = {};
    if (!gen) errs.gen = "Pilih Gen terlebih dahulu.";
    if (!kelas) errs.kelas = "Pilih kelas.";
    if (!nama.trim()) errs.nama = "Nama siswa wajib diisi.";
    if (!tanggal) errs.tanggal = "Tanggal wajib diisi.";
    if (bayarKas && (!nominalKas || Number(nominalKas) <= 0)) {
      errs.nominalKas = "Nominal kas harus lebih dari 0 jika bayar kas dicentang.";
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleNormalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateNormal()) return;

    setSubmitting(true);
    const res = await submitAttendanceRecord({
      gen,
      nama: normalizeName(nama),
      kelas,
      statusAbsen,
      nominalKas: bayarKas ? Number(nominalKas) : 0,
      tanggal: parseISOTanggal(tanggal),
    });
    setSubmitting(false);

    if (res.success) {
      setToast({
        type: "success",
        message: `Data absensi ${normalizeName(nama)} (${kelas}) berhasil disimpan ke Gen ${gen}!`,
      });
      setNama("");
      setStatusAbsen("Hadir");
      setBayarKas(true);
      setNominalKas(`${KAS_RUTIN_DEFAULT}`);
      loadGenData(gen);
    } else {
      setToast({
        type: "error",
        message: res.error ?? "Gagal menyimpan data.",
      });
    }

    setTimeout(() => setToast(null), TOAST_DURATION);
  };

  // Quick mode submit
  const handleQuickSubmit = async () => {
    if (!gen) {
      setErrors({ gen: "Pilih Gen terlebih dahulu." });
      return;
    }
    if (!kelas) {
      setErrors({ kelas: "Pilih kelas terlebih dahulu." });
      return;
    }

    const marked = quickStudents.filter((s) => s.status);
    if (marked.length === 0) {
      setToast({
        type: "error",
        message: "Pilih minimal 1 siswa (beri status kehadiran).",
      });
      setTimeout(() => setToast(null), TOAST_DURATION);
      return;
    }

    setSubmitting(true);
    const res = await submitBulkAttendance(
      gen,
      kelas,
      parseISOTanggal(tanggal),
      marked.map((s) => ({
        nama: s.nama,
        statusAbsen: s.status as StatusAbsen,
        nominalKas: s.status === "Alfa" ? 0 : (s.nominalKas || 0),
        kelas: s.kelas,
      }))
    );

    setSubmitting(false);

    if (res.success) {
      const count = res.data?.saved ?? marked.length;
      setToast({
        type: "success",
        message: `${count} data absensi berhasil disimpan ke Gen ${gen}!`,
      });
      setStatusMap({});
      setKasMap({});
      loadGenData(gen);
    } else {
      setToast({
        type: "error",
        message: res.error ?? "Gagal menyimpan data.",
      });
    }

    setTimeout(() => setToast(null), TOAST_DURATION);
  };

  const resetForm = () => {
    setGen(activeGens[0] ?? "");
    setKelas(mode === "cepat" ? "semua" : "");
    setNama("");
    setTanggal(getTodayISO());
    setStatusAbsen("Hadir");
    setBayarKas(true);
    setNominalKas(`${KAS_RUTIN_DEFAULT}`);
    setStatusMap({});
    setKasMap({});
    setQuickNewNama("");
    setQuickNewKelas("");
    setShowAddForm(false);
    setErrors({});
    setToast(null);
  };

  const handleGenChange = (newGen: Gen) => {
    setGen(newGen);
    setNama("");
    setStatusMap({});
    setKasMap({});
    setQuickNewNama("");
    setQuickNewKelas("");
    setShowAddForm(false);
    if (mode === "cepat") {
      setKelas("semua");
    } else {
      setKelas("");
    }
  };

  const handleModeSwitch = (newMode: InputMode) => {
    setMode(newMode);
    if (newMode === "cepat") {
      if (!kelas) {
        setKelas("semua");
      }
    } else {
      if (kelas === "semua") {
        setKelas("");
      }
    }
  };

  return (
    <div className="mx-auto max-w-2xl animate-page">
      {/* Header */}
      <div className="flex items-center justify-between border-b-2 border-border pb-5">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="btn btn-secondary min-h-[44px] min-w-[44px] p-2"
            aria-label="Kembali ke dashboard"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-accent">
              {APP_NAME} — {SCHOOL_NAME}
            </p>
            <h1 className="mt-0.5 font-display text-2xl font-extrabold uppercase tracking-tight text-foreground">
              Input <span className="text-accent">Absensi</span> &amp; Kas
            </h1>
          </div>
        </div>
      </div>

      {/* Mode Toggle */}
      <div className="mt-5 inline-flex items-center gap-1 rounded-xl border-2 border-border bg-surface p-1">
        <button
          onClick={() => handleModeSwitch("normal")}
          className={`chip min-h-[44px] flex-1 ${mode === "normal" ? "chip-on" : ""}`}
        >
          <PenLine className="h-4 w-4" />
          Input Manual
        </button>
        <button
          onClick={() => handleModeSwitch("cepat")}
          className={`chip min-h-[44px] flex-1 ${mode === "cepat" ? "chip-on" : ""}`}
        >
          <ListChecks className="h-4 w-4" />
          Mode Cepat
        </button>
      </div>

      {/* Shared: Gen + Kelas + Tanggal */}
      <div className="card mt-4 p-6 space-y-5 sm:p-8">
        {/* Visual Gen Selector (Angkatan Komunitas KTI) */}
        <div>
          <div className="flex items-center justify-between">
            <label className="label !mb-1.5 flex items-center gap-1.5">
              <span>Target Generasi / Angkatan Komunitas</span>
              <span className="text-danger">*</span>
            </label>
            <span className="text-[11px] font-semibold text-muted">
              Pilih Angkatan Komunitas
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {activeGens.map((g) => {
              const isSelected = gen === g;
              return (
                <button
                  key={g}
                  type="button"
                  onClick={() => handleGenChange(g)}
                  className={`flex flex-col items-center justify-center rounded-xl border-2 p-3 transition-all min-h-[56px] text-center ${
                    isSelected
                      ? getGenCardSelectedStyle(g)
                      : "border-border bg-surface-2 text-foreground font-semibold hover:border-border-focus hover:bg-surface"
                  }`}
                >
                  <span className="text-sm font-display uppercase tracking-wide">
                    Gen {g}
                  </span>
                  <span className="text-[10px] font-medium text-muted">
                    Angkatan {g}
                  </span>
                </button>
              );
            })}
          </div>

          {errors.gen && (
            <p className="mt-1.5 flex items-center gap-1 text-xs font-semibold text-danger">
              <AlertCircle className="h-3 w-3" />
              {errors.gen}
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="input-kelas" className="label">
              Kelas Siswa <span className="text-danger">*</span>
            </label>
            <select
              id="input-kelas"
              className={`select ${
                errors.kelas ? "!border-danger focus:!ring-danger/20" : ""
              }`}
              value={kelas}
              onChange={(e) => handleKelasChange(e.target.value)}
            >
              {mode === "cepat" ? (
                <option value="semua">
                  🌟 Semua Siswa di Gen {gen} ({existingStudents.length} siswa)
                </option>
              ) : (
                <option value="">-- Pilih Kelas --</option>
              )}

              {classesWithStudents.length > 0 && (
                <optgroup label="⭐ Kelas yang Ada Anggotanya (Gen ini)">
                  {classesWithStudents.map((k) => (
                    <option key={k} value={k}>
                      {k} ({classStudentCounts.get(k)} siswa terdaftar)
                    </option>
                  ))}
                </optgroup>
              )}

              <optgroup label="Kelas X (Sepuluh)">
                {availableClasses
                  .filter((k) => k.startsWith("X "))
                  .map((k) => (
                    <option key={k} value={k}>
                      {k} {classStudentCounts.get(k) ? `(${classStudentCounts.get(k)} siswa)` : ""}
                    </option>
                  ))}
              </optgroup>
              <optgroup label="Kelas XI (Sebelas)">
                {availableClasses
                  .filter((k) => k.startsWith("XI "))
                  .map((k) => (
                    <option key={k} value={k}>
                      {k} {classStudentCounts.get(k) ? `(${classStudentCounts.get(k)} siswa)` : ""}
                    </option>
                  ))}
              </optgroup>
              <optgroup label="Kelas XII (Dua Belas)">
                {availableClasses
                  .filter((k) => k.startsWith("XII "))
                  .map((k) => (
                    <option key={k} value={k}>
                      {k} {classStudentCounts.get(k) ? `(${classStudentCounts.get(k)} siswa)` : ""}
                    </option>
                  ))}
              </optgroup>
              {availableClasses.filter(
                (k) => !k.startsWith("X ") && !k.startsWith("XI ") && !k.startsWith("XII ")
              ).length > 0 && (
                <optgroup label="Kelas Lainnya">
                  {availableClasses
                    .filter(
                      (k) =>
                        !k.startsWith("X ") &&
                        !k.startsWith("XI ") &&
                        !k.startsWith("XII ")
                    )
                    .map((k) => (
                      <option key={k} value={k}>
                        {k} {classStudentCounts.get(k) ? `(${classStudentCounts.get(k)} siswa)` : ""}
                      </option>
                    ))}
                </optgroup>
              )}
            </select>
            {errors.kelas && (
              <p className="mt-1.5 flex items-center gap-1 text-xs font-semibold text-danger">
                <AlertCircle className="h-3 w-3" />
                {errors.kelas}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="input-tanggal" className="label">
              Tanggal Presensi <span className="text-danger">*</span>
            </label>
            <input
              id="input-tanggal"
              type="date"
              className={`input ${
                errors.tanggal ? "!border-danger focus:!ring-danger/20" : ""
              }`}
              value={tanggal}
              onChange={(e) => {
                setTanggal(e.target.value);
                if (errors.tanggal) setErrors((prev) => ({ ...prev, tanggal: "" }));
              }}
            />
            {errors.tanggal && (
              <p className="mt-1.5 flex items-center gap-1 text-xs font-semibold text-danger">
                <AlertCircle className="h-3 w-3" />
                {errors.tanggal}
              </p>
            )}
            {isLibur && !errors.tanggal && (
              <p className="mt-1.5 flex items-center gap-1 text-xs font-semibold text-amber-600 dark:text-amber-400">
                <AlertCircle className="h-3 w-3" />
                Tanggal ini adalah hari libur. Data yang diinput tidak akan dihitung dalam kalkulasi absensi.
              </p>
            )}
          </div>
        </div>

        {/* MODE: NORMAL */}
        {mode === "normal" && (
          <form onSubmit={handleNormalSubmit} className="space-y-5 pt-2 border-t-2 border-border">
            {/* Nama Siswa + Autocomplete */}
            <div className="relative">
              <label htmlFor="input-nama" className="label">
                Nama Siswa <span className="text-danger">*</span>
              </label>
              <div className="flex items-center gap-2 rounded-[0.375rem] border border-border bg-surface px-3 py-2 transition-colors focus-within:border-accent focus-within:shadow-[0_0_0_3px_color-mix(in_srgb,var(--color-accent)_12%,transparent)]">
                <User className="h-4 w-4 shrink-0 text-muted" />
                <input
                  id="input-nama"
                  type="text"
                  placeholder="Ketik nama siswa..."
                  className={`flex-1 min-w-0 bg-transparent text-sm text-foreground outline-none placeholder:text-muted uppercase ${
                    errors.nama ? "text-danger" : ""
                  }`}
                  value={nama}
                  onChange={(e) => {
                    setNama(e.target.value);
                    setShowSuggestions(true);
                    if (errors.nama) setErrors((prev) => ({ ...prev, nama: "" }));
                  }}
                  onFocus={() => setShowSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                  autoComplete="off"
                />
              </div>

              {/* Suggestions dropdown */}
              {showSuggestions && filteredSuggestions.length > 0 && (
                <div className="absolute z-20 mt-1 max-h-48 w-full overflow-y-auto rounded-xl border-2 border-border bg-surface p-1 shadow-lg">
                  {filteredSuggestions.map((s) => (
                    <button
                      key={`${s.kelas}-${s.nama}`}
                      type="button"
                      className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm hover:bg-surface-2 transition-colors"
                      onMouseDown={() => handleSelectSuggestion(s)}
                    >
                      <span className="font-semibold text-foreground">{s.nama}</span>
                      <span className="text-xs font-bold text-muted">{s.kelas}</span>
                    </button>
                  ))}
                </div>
              )}

              {errors.nama && (
                <p className="mt-1.5 flex items-center gap-1 text-xs font-semibold text-danger">
                  <AlertCircle className="h-3 w-3" />
                  {errors.nama}
                </p>
              )}
            </div>

            {/* Status Absen */}
            <div>
              <label className="label">
                Status Kehadiran <span className="text-danger">*</span>
              </label>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {(["Hadir", "Sakit", "Izin", "Alfa"] as StatusAbsen[]).map((st) => {
                  const isSelected = statusAbsen === st;
                  const colorMap = {
                    Hadir: "border-emerald-500 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
                    Sakit: "border-amber-500 bg-amber-500/15 text-amber-700 dark:text-amber-300",
                    Izin: "border-accent bg-accent/15 text-accent",
                    Alfa: "border-danger bg-danger/15 text-danger",
                  };
                  return (
                    <button
                      key={st}
                      type="button"
                      onClick={() => handleStatusChange(st)}
                      className={`flex min-h-[44px] items-center justify-center rounded-xl border-2 font-display text-sm font-extrabold uppercase tracking-wide transition-all ${
                        isSelected
                          ? `${colorMap[st]}`
                          : "border-border bg-surface-2 text-muted hover:border-border-focus"
                      }`}
                    >
                      {st}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Bayar Kas */}
            <div className="rounded-xl border-2 border-border bg-surface-2 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-extrabold uppercase tracking-wide text-foreground">
                    Iuran Kas Rutin
                  </p>
                  <p className="mt-0.5 text-xs text-muted">{kasRules.catatan}</p>
                </div>
                <label className="relative inline-flex cursor-pointer items-center">
                  <input
                    type="checkbox"
                    checked={bayarKas}
                    onChange={(e) => handleBayarKasToggle(e.target.checked)}
                    className="peer sr-only"
                  />
                  <div className="peer h-6 w-11 rounded-full bg-border peer-checked:bg-accent peer-checked:after:translate-x-full peer-checked:after:border-white after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all"></div>
                </label>
              </div>

              {/* Saldo lebih terdeteksi notice */}
              {nama && (studentSurplusMap.get(normalizeName(nama)) || 0) > 0 && (() => {
                const currentSurplus = studentSurplusMap.get(normalizeName(nama))!;
                const isFullyCovered = currentSurplus >= KAS_RUTIN_DEFAULT;
                return (
                  <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-2.5 text-xs text-emerald-700 dark:text-emerald-300">
                    <Sparkles className="h-4 w-4 shrink-0 text-emerald-500" />
                    <div>
                      <span className="font-bold">
                        Saldo Lebih Terdeteksi: {formatRupiah(currentSurplus)}
                      </span>
                      <p className="text-[11px] opacity-90">
                        {isFullyCovered
                          ? "Siswa ini memiliki saldo kas penuh dari minggu sebelumnya. Iuran kas otomatis tertutupi dari alihan saldo."
                          : `Siswa memiliki tabungan alihan ${formatRupiah(currentSurplus)}. Cukup bayar kekurangan ${formatRupiah(KAS_RUTIN_DEFAULT - currentSurplus)} untuk melunasi iuran ${formatRupiah(KAS_RUTIN_DEFAULT)} minggu ini.`}
                      </p>
                    </div>
                  </div>
                );
              })()}

              {bayarKas && (
                <div className="pt-2 border-t border-border/50 space-y-2">
                  <div className="flex items-center justify-between">
                    <label htmlFor="input-kas" className="label text-xs !mb-0">
                      Nominal Kas (Rp)
                    </label>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setNominalKas("0")}
                        className={`px-2 py-0.5 text-[10px] font-bold rounded-lg border transition-all ${
                          nominalKas === "0"
                            ? "bg-rose-500/20 text-rose-600 border-rose-500/40"
                            : "bg-surface-2 text-muted border-border hover:text-foreground"
                        }`}
                        title="Member tidak bawa uang kas hari ini"
                      >
                        Rp 0 (Nunggak)
                      </button>
                      <button
                        type="button"
                        onClick={() => setNominalKas(`${KAS_RUTIN_DEFAULT}`)}
                        className={`px-2 py-0.5 text-[10px] font-bold rounded-lg border transition-all ${
                          nominalKas === `${KAS_RUTIN_DEFAULT}`
                            ? "bg-emerald-500/20 text-emerald-600 border-emerald-500/40"
                            : "bg-surface-2 text-muted border-border hover:text-foreground"
                        }`}
                        title="Bayar pas Rp 2.000"
                      >
                        Rp 2k (Pas)
                      </button>
                      <button
                        type="button"
                        onClick={() => setNominalKas("5000")}
                        className={`px-2 py-0.5 text-[10px] font-bold rounded-lg border transition-all ${
                          nominalKas === "5000"
                            ? "bg-amber-500/20 text-amber-600 border-amber-500/40"
                            : "bg-surface-2 text-muted border-border hover:text-foreground"
                        }`}
                        title="Bayar Rp 5.000 (sisa Rp 3.000 dialihkan)"
                      >
                        Rp 5k (+Alih 3k)
                      </button>
                    </div>
                  </div>

                  <input
                    id="input-kas"
                    type="number"
                    min="0"
                    step="500"
                    className="input tabular-nums font-bold"
                    value={nominalKas}
                    onChange={(e) => setNominalKas(e.target.value)}
                  />

                  {Number(nominalKas) === 0 && statusAbsen === "Hadir" && (
                    <p className="mt-1 flex items-center gap-1.5 text-xs font-semibold text-rose-600 dark:text-rose-400 bg-rose-500/10 p-2 rounded-lg border border-rose-500/20">
                      <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                      <span>
                        Siswa Hadir tapi kas Rp 0 (tidak bawa uang). Akan tercatat <strong>Menunggak {formatRupiah(KAS_RUTIN_DEFAULT)}</strong> untuk pertemuan ini.
                      </span>
                    </p>
                  )}

                  {Number(nominalKas) > KAS_RUTIN_DEFAULT && (
                    <p className="mt-1.5 flex items-center gap-1.5 text-xs font-semibold text-amber-600 dark:text-amber-300">
                      <Sparkles className="h-3.5 w-3.5 shrink-0" />
                      <span>
                        {formatRupiah(KAS_RUTIN_DEFAULT)} untuk pertemuan ini. Sisa{" "}
                        <strong>{formatRupiah(Number(nominalKas) - KAS_RUTIN_DEFAULT)}</strong> otomatis dialihkan ke minggu selanjutnya!
                      </span>
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Live Target Confirmation Card */}
            {gen && (
              <div className="rounded-xl border-2 border-accent/40 bg-accent/5 p-3.5 text-xs">
                <p className="text-[10px] font-bold uppercase tracking-wider text-accent">
                  Target Konfirmasi Simpan:
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-1.5 font-bold text-foreground">
                  <span className="badge bg-accent text-white">GEN {gen}</span>
                  <span>•</span>
                  <span>{kelas || "(Pilih Kelas)"}</span>
                  <span>•</span>
                  <span>{nama ? normalizeName(nama) : "(Ketik Nama)"}</span>
                  <span>•</span>
                  <span className="text-muted">{formatTanggalIndo(parseISOTanggal(tanggal))}</span>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-3 pt-3">
              <button
                type="button"
                onClick={resetForm}
                className="btn btn-secondary min-h-[44px] px-4 py-2 text-sm"
              >
                <RotateCcw className="h-4 w-4" />
                Reset
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="btn btn-primary min-h-[44px] px-6 py-2 text-sm font-bold"
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                {submitting ? "Menyimpan..." : "Simpan Data"}
              </button>
            </div>
          </form>
        )}

        {/* MODE: CEPAT (BULK) */}
        {mode === "cepat" && (
          <div className="space-y-5 pt-2 border-t-2 border-border">
            {!kelas ? (
              <div className="py-8 text-center text-xs text-muted">
                <ListChecks className="mx-auto h-8 w-8 text-muted" />
                <p className="mt-2 font-medium">
                  Pilih kelas di atas untuk memuat daftar siswa di Gen {gen}.
                </p>
              </div>
            ) : quickStudents.length === 0 ? (
              <div className="rounded-2xl border-2 border-dashed border-border bg-surface-2 p-6 text-center space-y-3">
                <AlertCircle className="mx-auto h-8 w-8 text-accent" />
                <p className="text-sm font-bold text-foreground">
                  {kelas === "semua"
                    ? `Belum ada riwayat siswa di Gen ${gen}.`
                    : `Belum ada riwayat siswa untuk kelas ${kelas} di Gen ${gen}.`}
                </p>
                <p className="text-xs text-muted">
                  Anda bisa langsung menambahkan nama siswa ke daftar di bawah ini:
                </p>
                <form onSubmit={handleAddQuickStudent} className="mx-auto max-w-md flex flex-col sm:flex-row gap-2 pt-2">
                  <input
                    type="text"
                    placeholder="Nama siswa baru..."
                    value={quickNewNama}
                    onChange={(e) => setQuickNewNama(e.target.value)}
                    className="input text-xs uppercase flex-1"
                    required
                  />
                  {kelas === "semua" && (
                    <input
                      type="text"
                      placeholder="Kelas (misal: X TJKT 1)"
                      value={quickNewKelas}
                      onChange={(e) => setQuickNewKelas(e.target.value)}
                      className="input text-xs uppercase w-full sm:w-36"
                      required
                    />
                  )}
                  <button
                    type="submit"
                    className="btn btn-primary min-h-[38px] px-4 text-xs font-bold shrink-0 flex items-center justify-center gap-1.5"
                  >
                    <UserPlus className="h-4 w-4" />
                    Tambah
                  </button>
                </form>
              </div>
            ) : (
              <>
                {/* Header & Quick stats */}
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border-2 border-border bg-surface-2 p-4">
                  <div>
                    <p className="text-xs font-bold uppercase text-foreground">
                      Daftar Siswa {kelas === "semua" ? `Semua Kelas (Gen ${gen})` : `${kelas} (Gen ${gen})`}
                    </p>
                    <p className="mt-1 text-xs text-muted">
                      {quickStats.terisi} dari {quickStats.total} siswa terisi •{" "}
                      <span className="text-emerald-600 dark:text-emerald-300 font-bold">{quickStats.hadir} Hadir</span> •{" "}
                      <span className="text-amber-600 dark:text-amber-300 font-bold">{quickStats.sakit} Sakit</span> •{" "}
                      <span className="text-accent font-bold">{quickStats.izin} Izin</span> •{" "}
                      <span className="text-danger font-bold">{quickStats.alfa} Alfa</span> •{" "}
                      Kas: <strong className="text-accent">{formatRupiah(quickStats.totalKas)}</strong>
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={() => toggleAllStudents("Hadir")}
                      className="btn btn-secondary min-h-[38px] px-3 py-1.5 text-xs font-bold"
                    >
                      Hadir Semua (+Rp 2k)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        toggleAllStudents("Hadir");
                        setAllStudentsKas(0);
                      }}
                      className="btn btn-ghost min-h-[38px] px-2.5 py-1.5 text-xs font-semibold border border-border"
                      title="Tandai Hadir semua dengan kas Rp 0 (Free Kas)"
                    >
                      Hadir (Kas Rp 0)
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleAllStudents(null)}
                      className="btn btn-ghost min-h-[38px] px-3 py-1.5 text-xs font-bold"
                    >
                      Kosongkan
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowAddForm((prev) => !prev)}
                      className="btn btn-ghost min-h-[38px] px-2.5 py-1.5 text-xs font-bold text-accent border border-accent/30 hover:bg-accent/10"
                      title="Tambah siswa baru ke daftar"
                    >
                      <UserPlus className="h-3.5 w-3.5" />
                      <span>{showAddForm ? "Tutup" : "+ Siswa"}</span>
                    </button>
                  </div>
                </div>

                {/* Inline form to add student to list */}
                {showAddForm && (
                  <form
                    onSubmit={handleAddQuickStudent}
                    className="flex flex-col sm:flex-row gap-2 rounded-xl border-2 border-accent/40 bg-accent/5 p-3 animate-fade-in"
                  >
                    <input
                      type="text"
                      placeholder="Ketik nama siswa baru..."
                      value={quickNewNama}
                      onChange={(e) => setQuickNewNama(e.target.value)}
                      className="input text-xs uppercase flex-1"
                      required
                      autoFocus
                    />
                    {kelas === "semua" && (
                      <input
                        type="text"
                        placeholder="Kelas (contoh: X TJKT 1)"
                        value={quickNewKelas}
                        onChange={(e) => setQuickNewKelas(e.target.value)}
                        className="input text-xs uppercase w-full sm:w-36"
                        required
                      />
                    )}
                    <button
                      type="submit"
                      className="btn btn-primary min-h-[38px] px-4 text-xs font-bold shrink-0 flex items-center justify-center gap-1.5"
                    >
                      <Plus className="h-4 w-4" />
                      Tambahkan
                    </button>
                  </form>
                )}

                {/* Quick students checklist cards with 1-tap buttons */}
                <div className="space-y-2.5 max-h-[500px] overflow-y-auto pr-1">
                  {quickStudents.map((s) => {
                    const surplus = studentSurplusMap.get(s.nama) || 0;
                    const isLunasViaAlihan = surplus >= KAS_RUTIN_DEFAULT && s.nominalKas === 0;

                    return (
                      <div
                        key={s.nama}
                        className={`rounded-2xl border-2 p-3.5 transition-all shadow-2xs ${
                          s.status
                            ? STATUS_STYLES[s.status].row
                            : "border-border bg-surface hover:bg-surface-2"
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                          {/* Nama & Kelas & Saldo */}
                          <div className="flex items-center gap-2 min-w-0 flex-wrap">
                            <span className="font-bold text-sm uppercase text-foreground truncate">
                              {s.nama}
                            </span>
                            <span className="badge bg-surface-2 text-muted text-[10px] font-semibold shrink-0">
                              {s.kelas}
                            </span>
                            {surplus > 0 && (
                              <span
                                className="badge bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 text-[9px] font-bold shrink-0"
                                title="Siswa memiliki saldo alihan lebih dari pertemuan sebelumnya"
                              >
                                Saldo +{formatRupiah(surplus)}
                              </span>
                            )}
                          </div>

                          {/* 4 Direct 1-Tap Status Buttons */}
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {(["Hadir", "Sakit", "Izin", "Alfa"] as StatusAbsen[]).map((st) => {
                              const isSelected = s.status === st;
                              return (
                                <button
                                  key={st}
                                  type="button"
                                  onClick={() => handleStatusClick(s.nama, st)}
                                  className={`flex items-center gap-1 min-h-[36px] px-3 py-1 text-xs font-bold rounded-xl border transition-all ${
                                    isSelected
                                      ? `${STATUS_STYLES[st].chip} ring-2 ring-current shadow-xs scale-102`
                                      : "border-border bg-surface-2 text-muted hover:text-foreground hover:bg-surface"
                                  }`}
                                >
                                  {isSelected && <Check className="h-3 w-3" />}
                                  {st}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Kas Input (Selalu Tampil agar Mudah Diedit / Dilihat) */}
                        <div className="mt-2.5 pt-2.5 border-t border-border/40 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {isLunasViaAlihan ? (
                              <span className="badge bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 text-[10px] font-bold">
                                ✓ Lunas Otomatis (Alihan Saldo)
                              </span>
                            ) : surplus > 0 && surplus < KAS_RUTIN_DEFAULT ? (
                              <span className="badge bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 text-[10px] font-bold">
                                Sisa Kurang: {formatRupiah(KAS_RUTIN_DEFAULT - surplus)}
                              </span>
                            ) : s.status === "Sakit" || s.status === "Izin" ? (
                              <span className="badge bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/30 text-[10px] font-bold">
                                Titip Kas (Opsional):
                              </span>
                            ) : s.status === "Alfa" ? (
                              <span className="badge bg-danger/15 text-danger border border-danger/30 text-[10px] font-bold">
                                Alfa (Kas Rp 0):
                              </span>
                            ) : s.nominalKas === 0 ? (
                              <span className="badge bg-rose-500/15 text-rose-700 dark:text-rose-400 border border-rose-500/30 text-[10px] font-bold">
                                ⚠️ Ga Bawa Uang (Nunggak)
                              </span>
                            ) : (
                              <span className="text-[11px] font-bold text-muted flex items-center gap-1">
                                <span>Iuran Kas:</span>
                                {s.status === null && (
                                  <span className="text-[9px] font-normal text-muted italic">
                                    (klik nominal auto Hadir)
                                  </span>
                                )}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5 flex-wrap">
                            {/* Quick Presets: 0 | 2k | 5k */}
                            <div className="inline-flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => setStudentKas(s.nama, 0)}
                                className={`px-2 py-0.5 text-[10px] font-bold rounded-lg border transition-all ${
                                  s.nominalKas === 0
                                    ? "bg-rose-500/20 text-rose-600 border-rose-500/40 font-black"
                                    : "bg-surface-2 text-muted border-border hover:text-foreground"
                                }`}
                                title="Ga bawa uang kas (catat nunggak)"
                              >
                                Rp 0
                              </button>
                              <button
                                type="button"
                                onClick={() => setStudentKas(s.nama, KAS_RUTIN_DEFAULT)}
                                className={`px-2 py-0.5 text-[10px] font-bold rounded-lg border transition-all ${
                                  s.nominalKas === KAS_RUTIN_DEFAULT
                                    ? "bg-emerald-500/20 text-emerald-600 border-emerald-500/40 font-black"
                                    : "bg-surface-2 text-muted border-border hover:text-foreground"
                                }`}
                                title="Bayar pas Rp 2.000"
                              >
                                2k
                              </button>
                              <button
                                type="button"
                                onClick={() => setStudentKas(s.nama, 5000)}
                                className={`px-2 py-0.5 text-[10px] font-bold rounded-lg border transition-all ${
                                  s.nominalKas === 5000
                                    ? "bg-amber-500/20 text-amber-600 border-amber-500/40 font-black"
                                    : "bg-surface-2 text-muted border-border hover:text-foreground"
                                }`}
                                title="Bayar Rp 5.000 (sisa Rp 3.000 dialihkan)"
                              >
                                5k
                              </button>
                            </div>

                            <span className="text-xs font-mono text-muted">Rp</span>
                            <input
                              type="number"
                              min="0"
                              step="500"
                              className="input !h-8 !w-20 px-2 py-1 text-right text-xs font-bold tabular-nums"
                              value={s.nominalKas}
                              onChange={(e) =>
                                setStudentKas(s.nama, Number(e.target.value) || 0)
                              }
                            />
                            {s.nominalKas > KAS_RUTIN_DEFAULT && (
                              <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded">
                                +Alih {formatRupiah(s.nominalKas - KAS_RUTIN_DEFAULT)}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Live Target Confirmation Card */}
                <div className="rounded-xl border-2 border-accent/40 bg-accent/5 p-3.5 text-xs">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-accent">
                    Target Konfirmasi Mode Cepat:
                  </p>
                  <p className="mt-1 font-bold text-foreground">
                    Menyimpan <strong className="text-accent">{quickStats.terisi} siswa</strong> ke <strong>GEN {gen}</strong> • {kelas === "semua" ? "Semua Kelas" : `Kelas ${kelas}`} • Tanggal <strong>{formatTanggalIndo(parseISOTanggal(tanggal))}</strong>
                  </p>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center justify-end gap-3 pt-3">
                  <button
                    type="button"
                    onClick={resetForm}
                    className="btn btn-secondary min-h-[44px] px-4 py-2 text-sm"
                  >
                    <RotateCcw className="h-4 w-4" />
                    Reset
                  </button>
                  <button
                    type="button"
                    onClick={handleQuickSubmit}
                    disabled={submitting || quickStats.terisi === 0}
                    className="btn btn-primary min-h-[44px] px-6 py-2 text-sm font-bold"
                  >
                    {submitting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                    {submitting
                      ? "Menyimpan..."
                      : `Simpan ${quickStats.terisi} Siswa`}
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Toast */}
      {toast && <Toast type={toast.type} message={toast.message} />}
    </div>
  );
}
