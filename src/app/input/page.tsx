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
  detectGenFromKelas,
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
  AlertTriangle,
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

  // Check if current Gen matches selected Class
  const detectedGenForClass = useMemo(() => {
    if (!kelas) return null;
    return detectGenFromKelas(kelas);
  }, [kelas]);

  const isGenMismatch = useMemo(() => {
    if (!detectedGenForClass || !gen) return false;
    return detectedGenForClass !== gen;
  }, [detectedGenForClass, gen]);

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
    const hadir = quickStudents.filter((s) => s.checked);
    const totalKas = hadir.reduce((sum, s) => sum + s.nominalKas, 0);
    return { hadirCount: hadir.length, totalStudents: quickStudents.length, totalKas };
  }, [quickStudents]);

  const handleStatusChange = (s: StatusAbsen) => {
    setStatusAbsen(s);
    if (s === "Hadir") {
      setBayarKas(true);
    } else {
      setBayarKas(false);
    }
  };

  const handleKelasChange = (newKelas: string) => {
    setKelas(newKelas);
    if (errors.kelas) setErrors((prev) => ({ ...prev, kelas: "" }));

    const detected = detectGenFromKelas(newKelas);
    if (detected && detected !== gen && activeGens.includes(detected)) {
      // Auto switch or alert
      setGen(detected);
    }
  };

  const handleNamaChange = (val: string) => {
    const upperVal = val.toUpperCase();
    setNama(upperVal);
    setShowSuggestions(true);
    if (errors.nama) setErrors((prev) => ({ ...prev, nama: "" }));

    const matched = existingStudents.find(
      (s) => normalizeName(s.nama) === upperVal.trim()
    );
    if (matched && matched.kelas) {
      setKelas(matched.kelas);
      if (errors.kelas) setErrors((prev) => ({ ...prev, kelas: "" }));
      const detected = detectGenFromKelas(matched.kelas);
      if (detected && detected !== gen && activeGens.includes(detected)) {
        setGen(detected);
      }
    }
  };

  const suggestions = useMemo(() => {
    if (!nama.trim()) return [];
    const q = nama.toLowerCase();
    return existingStudents
      .filter((s) => s.nama.toLowerCase().includes(q))
      .slice(0, 8);
  }, [existingStudents, nama]);

  const pickSuggestion = (s: StudentOption) => {
    setNama(s.nama);
    setKelas(s.kelas);
    setShowSuggestions(false);
    if (errors.nama || errors.kelas) setErrors((prev) => ({ ...prev, nama: "", kelas: "" }));

    const detected = detectGenFromKelas(s.kelas);
    if (detected && detected !== gen && activeGens.includes(detected)) {
      setGen(detected);
    }
  };

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!gen) e.gen = "Pilih gen terlebih dahulu.";
    if (!nama.trim()) e.nama = "Nama siswa wajib diisi.";
    if (!kelas.trim()) e.kelas = "Pilih kelas terlebih dahulu.";
    if (kasRules.wajib && !bayarKas) {
      e.kas = "Anggota yang hadir wajib membayar kas.";
    } else if (bayarKas) {
      const kas = Number(nominalKas);
      if (nominalKas === "" || isNaN(kas) || kas < 0) {
        e.kas = "Nominal kas harus berupa angka ≥ 0.";
      }
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    setToast(null);

    const savedNama = normalizeName(nama);

    const res = await submitAttendanceRecord({
      gen,
      kelas: kelas.trim(),
      nama: savedNama,
      tanggal: parseISOTanggal(tanggal),
      statusAbsen,
      nominalKas: bayarKas ? Number(nominalKas) : 0,
    });

    setSubmitting(false);

    if (res.success) {
      setToast({
        type: "success",
        message: `Data ${savedNama} (${kelas}) berhasil disimpan!`,
      });

      setNama("");
      setKelas("");
      setTanggal(getTodayISO());
      setStatusAbsen("Hadir");
      setBayarKas(true);
      setNominalKas(`${KAS_RUTIN_DEFAULT}`);
      setErrors({});

      loadGenData(gen);
    } else {
      setToast({
        type: "error",
        message: res.error ?? "Gagal menyimpan data.",
      });
    }

    setTimeout(() => setToast(null), TOAST_DURATION);
  };

  const toggleQuickStudent = (idx: number) => {
    const student = quickStudents[idx];
    if (!student) return;
    setCheckedMap((prev) => ({ ...prev, [student.nama]: !prev[student.nama] }));
    if (errors.quick) setErrors((prev) => ({ ...prev, quick: "" }));
  };

  const updateQuickKas = (idx: number, val: number) => {
    const student = quickStudents[idx];
    if (!student) return;
    setKasMap((prev) => ({ ...prev, [student.nama]: val }));
  };

  const toggleAllQuick = (checked: boolean) => {
    setCheckedMap((prev) => {
      const next = { ...prev };
      for (const s of quickStudents) {
        next[s.nama] = checked;
      }
      return next;
    });
    if (errors.quick) setErrors((prev) => ({ ...prev, quick: "" }));
  };

  const handleQuickSubmit = async () => {
    const hadir = quickStudents.filter((s) => s.checked);
    if (hadir.length === 0) {
      setErrors({ quick: "Pilih minimal 1 siswa yang hadir." });
      return;
    }
    if (!kelas.trim()) {
      setErrors({ quick: "Pilih kelas terlebih dahulu." });
      return;
    }

    setSubmitting(true);
    setToast(null);

    const res = await submitBulkAttendance(
      gen,
      kelas.trim(),
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
        message: `${count} data absensi berhasil disimpan!`,
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
        {/* Visual Gen Selector */}
        <div>
          <div className="flex items-center justify-between">
            <label className="label !mb-1.5 flex items-center gap-1.5">
              <span>Target Generasi / Angkatan</span>
              <span className="text-danger">*</span>
            </label>
            <span className="text-[11px] font-semibold text-muted">
              Pilih Gen sebelum menyimpan
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {activeGens.map((g) => {
              const isSelected = gen === g;
              const gradeHint = g === "10" ? "Kelas X" : g === "11" ? "Kelas XI" : g === "12" ? "Kelas XII" : `Angkatan ${g}`;
              return (
                <button
                  key={g}
                  type="button"
                  onClick={() => handleGenChange(g)}
                  className={`flex flex-col items-center justify-center rounded-xl border-2 p-3 transition-all min-h-[56px] text-center ${
                    isSelected
                      ? "border-accent bg-accent/10 text-accent font-extrabold hard-shadow-sm ring-2 ring-accent/20"
                      : "border-border bg-surface-2 text-foreground font-semibold hover:border-border-focus hover:bg-surface"
                  }`}
                >
                  <span className="text-sm font-display uppercase tracking-wide">
                    Gen {g}
                  </span>
                  <span className="text-[10px] font-medium text-muted">
                    {gradeHint}
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

        {/* Gen & Class Mismatch Alert */}
        {isGenMismatch && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border-2 border-amber-500/50 bg-amber-500/10 p-3.5 text-xs text-amber-900 dark:text-amber-200">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
              <span>
                Kelas <strong>{kelas}</strong> biasanya untuk <strong>Gen {detectedGenForClass}</strong> (saat ini Gen {gen}).
              </span>
            </div>
            <button
              type="button"
              onClick={() => handleGenChange(detectedGenForClass!)}
              className="btn btn-primary min-h-[36px] px-3 py-1.5 text-xs font-bold whitespace-nowrap"
            >
              Pindah ke Gen {detectedGenForClass}
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="input-kelas" className="label">
              Kelas <span className="text-danger">*</span>
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
              <optgroup label="Kelas X (Gen 10)">
                {availableClasses
                  .filter((k) => k.startsWith("X "))
                  .map((k) => (
                    <option key={k} value={k}>
                      {k}
                    </option>
                  ))}
              </optgroup>
              <optgroup label="Kelas XI (Gen 11)">
                {availableClasses
                  .filter((k) => k.startsWith("XI "))
                  .map((k) => (
                    <option key={k} value={k}>
                      {k}
                    </option>
                  ))}
              </optgroup>
              <optgroup label="Kelas XII (Gen 12)">
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
                      (k) => !k.startsWith("X ") && !k.startsWith("XI ") && !k.startsWith("XII ")
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
              <p className="mt-1 flex items-center gap-1 text-xs font-semibold text-danger">
                <AlertCircle className="h-3 w-3" />
                {errors.kelas}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="input-tanggal" className="label">
              Tanggal <span className="text-danger">*</span>
            </label>
            <input
              id="input-tanggal"
              type="date"
              className="input"
              value={tanggal}
              onChange={(e) => setTanggal(e.target.value)}
            />
          </div>
        </div>

        {/* ---- NORMAL MODE ---- */}
        {mode === "normal" && (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <div className="flex items-center justify-between">
                <label htmlFor="input-nama" className="label !mb-0">
                  Nama Lengkap Siswa <span className="text-danger">*</span>
                </label>
                {existingStudents.length > 0 && (
                  <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-muted">
                    <User className="h-3 w-3" /> {existingStudents.length} siswa terdaftar di Gen {gen}
                  </span>
                )}
              </div>

              <div className="relative mt-1.5">
                <input
                  id="input-nama"
                  type="text"
                  className={`input font-medium uppercase ${
                    errors.nama ? "!border-danger focus:!ring-danger/20" : ""
                  }`}
                  placeholder="Ketik nama siswa..."
                  value={nama}
                  onChange={(e) => handleNamaChange(e.target.value)}
                  onFocus={() => setShowSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                  autoComplete="off"
                />

                {showSuggestions && suggestions.length > 0 && (
                  <ul className="absolute z-10 mt-1 max-h-64 w-full overflow-auto rounded-xl border-2 border-border bg-surface py-1 hard-shadow-sm">
                    {suggestions.map((s) => (
                      <li key={`${s.nama}-${s.kelas}`}>
                        <button
                          type="button"
                          onClick={() => pickSuggestion(s)}
                          className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left hover:bg-accent/10"
                        >
                          <span className="truncate text-sm font-medium uppercase text-foreground">
                            {s.nama}
                          </span>
                          <span className="shrink-0 text-xs font-semibold text-muted">{s.kelas}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {errors.nama ? (
                <p className="mt-1 flex items-center gap-1 text-xs font-semibold text-danger">
                  <AlertCircle className="h-3 w-3" />
                  {errors.nama}
                </p>
              ) : (
                <p className="mt-1 text-[11px] font-medium text-muted">
                  Nama otomatis dikonversi ke huruf kapital. Nama siswa yang sudah pernah
                  tercatat akan muncul sebagai saran.
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="input-status" className="label">
                  Status Kehadiran <span className="text-danger">*</span>
                </label>
                <select
                  id="input-status"
                  className="select"
                  value={statusAbsen}
                  onChange={(e) => handleStatusChange(e.target.value as StatusAbsen)}
                >
                  {(["Hadir", "Sakit", "Izin", "Alfa"] as StatusAbsen[]).map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <span className="label">Kas Rutin</span>
                <div
                  className={`rounded-xl border-2 p-3.5 ${
                    errors.kas ? "border-danger" : "border-border"
                  }`}
                >
                  <label
                    className={`flex items-center gap-3 ${
                      statusAbsen === "Alfa" ? "cursor-not-allowed opacity-50" : "cursor-pointer"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={bayarKas}
                      disabled={statusAbsen === "Alfa"}
                      onChange={(e) => {
                        setBayarKas(e.target.checked);
                        if (errors.kas) setErrors((prev) => ({ ...prev, kas: "" }));
                      }}
                      className="h-4 w-4 rounded accent-accent"
                    />
                    <span className="text-sm font-semibold text-foreground">
                      Bayar kas rutin ({formatRupiah(KAS_RUTIN_DEFAULT)})
                    </span>
                  </label>

                  {bayarKas && (
                    <div className="mt-3">
                      <label htmlFor="input-kas" className="label !mb-0 !text-[11px]">
                        Nominal (Rp)
                      </label>
                      <input
                        id="input-kas"
                        type="number"
                        min="0"
                        step="500"
                        className="input mt-1 tabular-nums"
                        value={nominalKas}
                        onChange={(e) => {
                          setNominalKas(e.target.value);
                          if (errors.kas) setErrors((prev) => ({ ...prev, kas: "" }));
                        }}
                      />
                    </div>
                  )}

                  <p className="mt-2 text-[11px] font-medium text-muted">{kasRules.catatan}</p>
                  {errors.kas && (
                    <p className="mt-1 flex items-center gap-1 text-xs font-bold text-danger">
                      <AlertCircle className="h-3 w-3" />
                      {errors.kas}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Live Preview Card */}
            <div className="rounded-xl border-2 border-border bg-surface-2 p-3.5 text-xs">
              <p className="font-bold uppercase tracking-wider text-muted text-[10px]">
                Konfirmasi Target Penyimpanan:
              </p>
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                <span className="badge bg-accent text-white font-extrabold px-2 py-0.5">
                  GEN {gen || "?"}
                </span>
                <span className="badge bg-surface border-2 border-border font-bold text-foreground">
                  {kelas || "Belum pilih kelas"}
                </span>
                <span className="badge bg-surface border-2 border-border font-bold uppercase text-foreground">
                  {nama || "Belum isi nama"}
                </span>
                <span className="text-muted font-medium">
                  • {formatTanggalIndo(parseISOTanggal(tanggal))}
                </span>
                <span className="text-muted font-medium">
                  • {statusAbsen} ({bayarKas ? formatRupiah(Number(nominalKas) || 0) : "Rp 0"})
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-1">
              <button
                type="submit"
                disabled={submitting}
                className="btn btn-primary flex-1 min-h-[48px] py-3 text-sm"
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                {submitting ? "Menyimpan..." : "Simpan Data"}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="btn btn-secondary min-h-[48px] px-4 py-3 text-sm"
                disabled={submitting}
              >
                <RotateCcw className="h-4 w-4" />
                Reset
              </button>
            </div>
          </form>
        )}

        {/* ---- QUICK MODE ---- */}
        {mode === "cepat" && (
          <div className="space-y-4">
            {!gen ? (
              <div className="rounded-xl border-2 border-dashed border-border bg-surface-2 py-10 text-center">
                <ListChecks className="mx-auto h-8 w-8 text-muted" />
                <p className="mt-2 text-sm font-semibold text-muted">
                  Pilih gen untuk melanjutkan.
                </p>
              </div>
            ) : !kelas ? (
              <div className="rounded-xl border-2 border-dashed border-border bg-surface-2 py-10 text-center">
                <ListChecks className="mx-auto h-8 w-8 text-muted" />
                <p className="mt-2 text-sm font-semibold text-muted">
                  Pilih kelas untuk menampilkan daftar siswa.
                </p>
              </div>
            ) : quickStudents.length === 0 ? (
              <div className="rounded-xl border-2 border-dashed border-border bg-surface-2 py-10 text-center">
                <User className="mx-auto h-8 w-8 text-muted" />
                <p className="mt-2 text-sm font-semibold text-muted">
                  Belum ada data siswa di kelas <span className="font-bold text-foreground">{kelas}</span> (Gen {gen}).
                </p>
                <p className="mt-1 text-xs font-medium text-muted">
                  Input manual dulu untuk kelas ini di mode &quot;Input Manual&quot;.
                </p>
              </div>
            ) : (
              <>
                {/* Summary bar */}
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border-2 border-border bg-surface-2 px-4 py-2.5">
                  <div className="flex flex-wrap items-center gap-3 text-xs font-semibold">
                    <span className="badge bg-accent text-white font-extrabold px-2 py-0.5">
                      GEN {gen}
                    </span>
                    <span className="text-muted">
                      <span className="font-bold text-foreground">{quickStats.totalStudents}</span> siswa
                    </span>
                    <span className="text-muted">
                      Hadir: <span className="font-bold text-emerald-600 dark:text-emerald-300">{quickStats.hadirCount}</span>
                    </span>
                    <span className="text-muted">
                      Kas: <span className="font-bold text-foreground">{formatRupiah(quickStats.totalKas)}</span>
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => toggleAllQuick(true)}
                      className="btn btn-ghost min-h-[44px] px-3 py-2 text-xs"
                    >
                      Centang Semua
                    </button>
                    <button
                      onClick={() => toggleAllQuick(false)}
                      className="btn btn-ghost min-h-[44px] px-3 py-2 text-xs"
                    >
                      Batal
                    </button>
                  </div>
                </div>

                {/* Checklist table */}
                <div className="overflow-x-auto rounded-xl border-2 border-border">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th className="w-10"></th>
                        <th>Nama</th>
                        <th className="w-28 text-right">Kas (Rp)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {quickStudents.map((s, idx) => (
                        <tr
                          key={s.nama}
                          className={s.checked ? "bg-emerald-500/10" : ""}
                        >
                          <td className="text-center">
                            <input
                              type="checkbox"
                              checked={s.checked}
                              onChange={() => toggleQuickStudent(idx)}
                              className="h-5 w-5 rounded accent-accent"
                            />
                          </td>
                          <td className="font-medium uppercase text-foreground">
                            {s.nama}
                          </td>
                          <td className="text-right">
                            {s.checked ? (
                              <input
                                type="number"
                                min="0"
                                step="500"
                                value={s.nominalKas}
                                onChange={(e) =>
                                  updateQuickKas(idx, Number(e.target.value) || 0)
                                }
                                className="w-24 rounded-lg border-2 border-border bg-surface px-2 py-1.5 text-right text-xs tabular-nums text-foreground focus:border-accent focus:ring-1 focus:ring-accent"
                              />
                            ) : (
                              <span className="text-xs text-muted">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Live Target Card */}
                <div className="rounded-xl border-2 border-border bg-surface-2 p-3.5 text-xs">
                  <p className="font-bold uppercase tracking-wider text-muted text-[10px]">
                    Konfirmasi Penyimpanan Mode Cepat:
                  </p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    <span className="badge bg-accent text-white font-extrabold px-2 py-0.5">
                      GEN {gen}
                    </span>
                    <span className="badge bg-surface border-2 border-border font-bold text-foreground">
                      {kelas}
                    </span>
                    <span className="text-muted font-medium">
                      • {formatTanggalIndo(parseISOTanggal(tanggal))}
                    </span>
                    <span className="text-muted font-medium">
                      • {quickStats.hadirCount} siswa hadir (Total Kas {formatRupiah(quickStats.totalKas)})
                    </span>
                  </div>
                </div>

                {errors.quick && (
                  <p className="flex items-center gap-1 text-xs font-bold text-danger">
                    <AlertCircle className="h-3 w-3" />
                    {errors.quick}
                  </p>
                )}

                <div className="flex items-center gap-3 pt-1">
                  <button
                    onClick={handleQuickSubmit}
                    disabled={submitting || quickStats.hadirCount === 0}
                    className="btn btn-primary flex-1 min-h-[48px] py-3 text-sm"
                  >
                    {submitting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                    {submitting
                      ? "Menyimpan..."
                      : `Simpan ${quickStats.hadirCount} Data Absensi`}
                  </button>
                  <button
                    type="button"
                    onClick={resetForm}
                    className="btn btn-secondary min-h-[48px] px-4 py-3 text-sm"
                    disabled={submitting}
                  >
                    <RotateCcw className="h-4 w-4" />
                    Reset
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
