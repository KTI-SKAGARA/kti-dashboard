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
} from "lucide-react";
import Link from "next/link";
import Toast from "@/components/Toast";

type InputMode = "normal" | "cepat";

interface QuickStudent {
  nama: string;
  kelas: string;
  checked: boolean;
  nominalKas: number;
}

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

  // Quick mode state
  const [checkedMap, setCheckedMap] = useState<Record<string, boolean>>({});
  const [kasMap, setKasMap] = useState<Record<string, number>>({});

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
      checked: checkedMap[s.nama] ?? false,
      nominalKas: kasMap[s.nama] ?? KAS_RUTIN_DEFAULT,
    }));
  }, [mode, kelas, studentsForKelas, checkedMap, kasMap]);

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
    const total = quickStudents.length;
    const hadir = quickStudents.filter((s) => s.checked).length;
    const totalKas = quickStudents
      .filter((s) => s.checked)
      .reduce((sum, s) => sum + s.nominalKas, 0);
    return { total, hadir, totalKas };
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
    setCheckedMap({});
    setKasMap({});
  };

  // Quick mode handlers
  const toggleStudentCheck = (studentNama: string) => {
    setCheckedMap((prev) => ({
      ...prev,
      [studentNama]: !prev[studentNama],
    }));
  };

  const setStudentKas = (studentNama: string, amount: number) => {
    setKasMap((prev) => ({
      ...prev,
      [studentNama]: amount,
    }));
  };

  const toggleAllStudents = (checked: boolean) => {
    const next: Record<string, boolean> = {};
    for (const s of studentsForKelas) {
      next[s.nama] = checked;
    }
    setCheckedMap(next);
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

    const hadir = quickStudents.filter((s) => s.checked);
    if (hadir.length === 0) {
      setToast({
        type: "error",
        message: "Pilih minimal 1 siswa yang hadir.",
      });
      setTimeout(() => setToast(null), TOAST_DURATION);
      return;
    }

    setSubmitting(true);
    const res = await submitBulkAttendance(
      gen,
      kelas,
      parseISOTanggal(tanggal),
      hadir.map((s) => ({
        nama: s.nama,
        statusAbsen: "Hadir" as StatusAbsen,
        nominalKas: s.nominalKas,
      }))
    );

    setSubmitting(false);

    if (res.success) {
      const count = res.data?.saved ?? hadir.length;
      setToast({
        type: "success",
        message: `${count} data absensi berhasil disimpan ke Gen ${gen}!`,
      });
      setCheckedMap({});
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
    setKelas("");
    setNama("");
    setTanggal(getTodayISO());
    setStatusAbsen("Hadir");
    setBayarKas(true);
    setNominalKas(`${KAS_RUTIN_DEFAULT}`);
    setCheckedMap({});
    setKasMap({});
    setErrors({});
    setToast(null);
  };

  const handleGenChange = (newGen: Gen) => {
    setGen(newGen);
    setKelas("");
    setNama("");
    setCheckedMap({});
    setKasMap({});
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
              Input <span className="marker">Absensi</span> &amp; Kas
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
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                <input
                  id="input-nama"
                  type="text"
                  placeholder="Ketik nama siswa..."
                  className={`input pl-10 uppercase ${
                    errors.nama ? "!border-danger focus:!ring-danger/20" : ""
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
                          ? `${colorMap[st]} hard-shadow-sm`
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
                      {quickStats.hadir} dari {quickStats.total} siswa hadir • Total Kas:{" "}
                      <strong className="text-accent">{formatRupiah(quickStats.totalKas)}</strong>
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => toggleAllStudents(true)}
                      className="btn btn-secondary min-h-[36px] px-3 py-1.5 text-xs font-bold"
                    >
                      Hadir Semua
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleAllStudents(false)}
                      className="btn btn-ghost min-h-[36px] px-3 py-1.5 text-xs font-bold"
                    >
                      Kosongkan
                    </button>
                  </div>
                </div>

                {/* Quick students checklist */}
                <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                  {quickStudents.map((s) => (
                    <div
                      key={s.nama}
                      onClick={() => toggleStudentCheck(s.nama)}
                      className={`flex cursor-pointer items-center justify-between rounded-xl border-2 p-3 transition-all ${
                        s.checked
                          ? "border-emerald-500/50 bg-emerald-500/10 text-foreground hard-shadow-sm"
                          : "border-border bg-surface hover:bg-surface-2 text-muted"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={s.checked}
                          onChange={() => {}} // handled by parent div
                          className="h-4 w-4 rounded accent-emerald-600"
                        />
                        <span className="font-semibold text-sm uppercase text-foreground">
                          {s.nama}
                        </span>
                      </div>

                      {s.checked && (
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
                    Menyimpan <strong className="text-accent">{quickStats.hadir} siswa</strong> ke <strong>GEN {gen}</strong> • Kelas <strong>{kelas}</strong> • Tanggal <strong>{formatTanggalIndo(parseISOTanggal(tanggal))}</strong>
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
                    disabled={submitting || quickStats.hadir === 0}
                    className="btn btn-primary min-h-[44px] px-6 py-2 text-sm font-bold"
                  >
                    {submitting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                    {submitting
                      ? "Menyimpan..."
                      : `Simpan ${quickStats.hadir} Siswa Hadir`}
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
