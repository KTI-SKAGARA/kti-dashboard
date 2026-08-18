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
  GripVertical,
} from "lucide-react";
import Link from "next/link";
import Toast from "@/components/Toast";

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
  const [pickedStatus, setPickedStatus] = useState<StatusAbsen | null>(null);
  const [dragOverNama, setDragOverNama] = useState<string | null>(null);

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

  useEffect(() => {
    if (gen) loadGenData(gen); // eslint-disable-line react-hooks/set-state-in-effect
  }, [gen, loadGenData]);

  // Students for selected class (quick mode)
  const studentsForKelas = useMemo(() => {
    if (!kelas) return [];
    return existingStudents
      .filter((s) => s.kelas === kelas)
      .sort((a, b) => a.nama.localeCompare(b.nama, "id"));
  }, [existingStudents, kelas]);

  const quickStudents: QuickStudent[] = useMemo(() => {
    if (mode !== "cepat" || !kelas) return [];
    return studentsForKelas.map((s) => ({
      nama: s.nama,
      kelas: s.kelas,
      status: statusMap[s.nama] ?? null,
      nominalKas: kasMap[s.nama] ?? KAS_RUTIN_DEFAULT,
    }));
  }, [mode, kelas, studentsForKelas, statusMap, kasMap]);

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
        if (s.status === "Hadir") totalKas += s.nominalKas;
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
    if (newStatus === "Hadir") {
      setBayarKas(true);
      setNominalKas(`${KAS_RUTIN_DEFAULT}`);
    } else if (newStatus === "Alfa") {
      setBayarKas(false);
      setNominalKas("0");
    } else {
      setBayarKas(false);
      setNominalKas("0");
    }
  };

  const handleBayarKasToggle = (checked: boolean) => {
    setBayarKas(checked);
    if (checked) {
      setNominalKas(`${KAS_RUTIN_DEFAULT}`);
    } else {
      setNominalKas("0");
    }
  };

  const handleSelectSuggestion = (student: StudentOption) => {
    setNama(student.nama);
    if (student.kelas) {
      setKelas(student.kelas);
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
    setPickedStatus(null);
  };

  // Quick mode handlers
  const applyStatus = (studentNama: string, st: StatusAbsen) => {
    setStatusMap((prev) => ({ ...prev, [studentNama]: st }));
    if (st !== "Hadir") {
      setKasMap((prev) => ({ ...prev, [studentNama]: 0 }));
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

  // Tap row: status ter-pick diterapkan; tanpa pick = toggle Hadir
  const handleRowTap = (studentNama: string) => {
    if (pickedStatus) {
      applyStatus(studentNama, pickedStatus);
    } else if (statusMap[studentNama]) {
      clearStudentStatus(studentNama);
    } else {
      applyStatus(studentNama, "Hadir");
    }
  };

  const setStudentKas = (studentNama: string, amount: number) => {
    setKasMap((prev) => ({
      ...prev,
      [studentNama]: amount,
    }));
  };

  const toggleAllStudents = (st: StatusAbsen | null) => {
    if (st) {
      const next: Record<string, StatusAbsen> = {};
      for (const s of studentsForKelas) next[s.nama] = st;
      setStatusMap(next);
      if (st !== "Hadir") {
        const kas: Record<string, number> = {};
        for (const s of studentsForKelas) kas[s.nama] = 0;
        setKasMap(kas);
      }
    } else {
      setStatusMap({});
      setKasMap({});
    }
  };

  // Drag & drop: chip status di-drag ke baris siswa (desktop)
  const handleStatusDragStart = (e: React.DragEvent, st: StatusAbsen) => {
    e.dataTransfer.setData("text/plain", st);
    e.dataTransfer.effectAllowed = "copy";
    setPickedStatus(st);
  };

  const handleRowDrop = (e: React.DragEvent, studentNama: string) => {
    e.preventDefault();
    const st = (e.dataTransfer.getData("text/plain") ||
      pickedStatus) as StatusAbsen;
    if (st) applyStatus(studentNama, st);
    setDragOverNama(null);
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
        nominalKas: s.status === "Hadir" ? s.nominalKas : 0,
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
      setPickedStatus(null);
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
    setKelas("");
    setNama("");
    setTanggal(getTodayISO());
    setStatusAbsen("Hadir");
    setBayarKas(true);
    setNominalKas(`${KAS_RUTIN_DEFAULT}`);
    setStatusMap({});
    setKasMap({});
    setPickedStatus(null);
    setErrors({});
    setToast(null);
  };

  const handleGenChange = (newGen: Gen) => {
    setGen(newGen);
    setKelas("");
    setNama("");
    setStatusMap({});
    setKasMap({});
    setPickedStatus(null);
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
          onClick={() => setMode("normal")}
          className={`chip min-h-[44px] flex-1 ${mode === "normal" ? "chip-on" : ""}`}
        >
          <PenLine className="h-4 w-4" />
          Input Manual
        </button>
        <button
          onClick={() => setMode("cepat")}
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
              <option value="">-- Pilih Kelas --</option>
              <optgroup label="Kelas X (Sepuluh)">
                {availableClasses
                  .filter((k) => k.startsWith("X "))
                  .map((k) => (
                    <option key={k} value={k}>
                      {k}
                    </option>
                  ))}
              </optgroup>
              <optgroup label="Kelas XI (Sebelas)">
                {availableClasses
                  .filter((k) => k.startsWith("XI "))
                  .map((k) => (
                    <option key={k} value={k}>
                      {k}
                    </option>
                  ))}
              </optgroup>
              <optgroup label="Kelas XII (Dua Belas)">
                {availableClasses
                  .filter((k) => k.startsWith("XII "))
                  .map((k) => (
                    <option key={k} value={k}>
                      {k}
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
                        {k}
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

              {bayarKas && (
                <div className="pt-2 border-t border-border/50">
                  <label htmlFor="input-kas" className="label text-xs">
                    Nominal Kas (Rp)
                  </label>
                  <input
                    id="input-kas"
                    type="number"
                    min="0"
                    step="500"
                    className="input tabular-nums font-bold"
                    value={nominalKas}
                    onChange={(e) => setNominalKas(e.target.value)}
                  />
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
              <div className="py-8 text-center text-xs text-muted">
                <AlertCircle className="mx-auto h-8 w-8 text-muted" />
                <p className="mt-2 font-medium">
                  Belum ada riwayat siswa untuk kelas <strong>{kelas}</strong> di Gen {gen}.
                </p>
                <p className="mt-1">
                  Gunakan <strong>Input Manual</strong> terlebih dahulu untuk mendaftarkan siswa baru.
                </p>
              </div>
            ) : (
              <>
                {/* Header & Quick stats */}
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border-2 border-border bg-surface-2 p-4">
                  <div>
                    <p className="text-xs font-bold uppercase text-foreground">
                      Daftar Siswa {kelas} (Gen {gen})
                    </p>
                    <p className="text-xs text-muted">
                      {quickStats.terisi} dari {quickStats.total} siswa diisi •{" "}
                      <span className="text-emerald-600 dark:text-emerald-300 font-bold">{quickStats.hadir} Hadir</span> •{" "}
                      <span className="text-amber-600 dark:text-amber-300 font-bold">{quickStats.sakit} Sakit</span> •{" "}
                      <span className="text-accent font-bold">{quickStats.izin} Izin</span> •{" "}
                      <span className="text-danger font-bold">{quickStats.alfa} Alfa</span> •{" "}
                      Kas: <strong className="text-accent">{formatRupiah(quickStats.totalKas)}</strong>
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => toggleAllStudents("Hadir")}
                      className="btn btn-secondary min-h-[44px] px-3 py-1.5 text-xs font-bold"
                    >
                      Hadir Semua
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleAllStudents(null)}
                      className="btn btn-ghost min-h-[44px] px-3 py-1.5 text-xs font-bold"
                    >
                      Kosongkan
                    </button>
                  </div>
                </div>

                {/* Status palette: drag (desktop) / ketuk lalu ketuk siswa (HP) */}
                <div className="rounded-xl border-2 border-border bg-surface p-3">
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {(["Hadir", "Sakit", "Izin", "Alfa"] as StatusAbsen[]).map((st) => {
                      const isPicked = pickedStatus === st;
                      return (
                        <button
                          key={st}
                          type="button"
                          draggable
                          onDragStart={(e) => handleStatusDragStart(e, st)}
                          onClick={() =>
                            setPickedStatus((prev) => (prev === st ? null : st))
                          }
                          className={`flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border-2 font-display text-sm font-extrabold uppercase tracking-wide transition-all cursor-grab active:cursor-grabbing ${
                            isPicked
                              ? `${STATUS_STYLES[st].chip} ring-2 ring-offset-2 ring-offset-surface`
                              : `${STATUS_STYLES[st].chip} opacity-80 hover:opacity-100`
                          }`}
                        >
                          <GripVertical className="h-3.5 w-3.5" />
                          {st}
                          {isPicked && (
                            <span className="ml-0.5 text-[9px] font-bold normal-case tracking-normal">
                              dipilih
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                  <p className="mt-2 text-center text-[10px] font-semibold uppercase tracking-wider text-muted">
                    {pickedStatus
                      ? `Ketuk siswa untuk menandai ${pickedStatus}`
                      : "Drag / ketuk status, lalu ketuk nama siswa untuk menandai"}
                  </p>
                </div>

                {/* Quick students checklist */}
                <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                  {quickStudents.map((s) => (
                    <div
                      key={s.nama}
                      onClick={() => handleRowTap(s.nama)}
                      onDragOver={(e) => {
                        e.preventDefault();
                        setDragOverNama(s.nama);
                      }}
                      onDragLeave={() => setDragOverNama((prev) => (prev === s.nama ? null : prev))}
                      onDrop={(e) => handleRowDrop(e, s.nama)}
                      className={`flex cursor-pointer items-center justify-between rounded-xl border-2 p-3 transition-all ${
                        s.status
                          ? STATUS_STYLES[s.status].row
                          : "border-border bg-surface hover:bg-surface-2 text-muted"
                      } ${dragOverNama === s.nama ? "ring-2 ring-accent" : ""}`}
                    >
                      <div className="flex min-w-0 items-center gap-2.5">
                        <span className="font-semibold text-sm uppercase text-foreground truncate">
                          {s.nama}
                        </span>
                        {s.status ? (
                          <span className={`badge shrink-0 font-bold ${STATUS_STYLES[s.status].badge}`}>
                            {s.status}
                          </span>
                        ) : (
                          <span className="shrink-0 text-[10px] font-bold uppercase text-muted">
                            belum diisi
                          </span>
                        )}
                      </div>

                      {s.status === "Hadir" && (
                        <div
                          className="flex items-center gap-1.5"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <span className="text-xs font-bold text-muted">Kas:</span>
                          <input
                            type="number"
                            min="0"
                            step="500"
                            className="input !h-8 !w-24 px-2 py-1 text-right text-xs font-bold tabular-nums"
                            value={s.nominalKas}
                            onChange={(e) =>
                              setStudentKas(s.nama, Number(e.target.value) || 0)
                            }
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Live Target Confirmation Card */}
                <div className="rounded-xl border-2 border-accent/40 bg-accent/5 p-3.5 text-xs">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-accent">
                    Target Konfirmasi Mode Cepat:
                  </p>
                  <p className="mt-1 font-bold text-foreground">
                    Menyimpan <strong className="text-accent">{quickStats.terisi} siswa</strong> ke <strong>GEN {gen}</strong> • Kelas <strong>{kelas}</strong> • Tanggal <strong>{formatTanggalIndo(parseISOTanggal(tanggal))}</strong>
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
