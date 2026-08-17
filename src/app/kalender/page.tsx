"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Pencil,
  Trash2,
  Calendar as CalendarIcon,
  List,
  X,
} from "lucide-react";
import {
  type Kegiatan,
  type JenisKegiatan,
  JENIS_KEGIATAN_OPTIONS,
  STORAGE_KEY_KEGIATAN,
} from "@/types/kegiatan";

const DAY_NAMES = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
const MONTH_NAMES = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function parseTanggal(tgl: string): { d: number; m: number; y: number } {
  const [d, m, y] = tgl.split("/").map(Number);
  return { d, m, y };
}

function toTanggal(d: number, m: number, y: number): string {
  return `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}/${y}`;
}

function getDaysInMonth(month: number, year: number): number {
  return new Date(year, month, 0).getDate();
}

function getFirstDayOfMonth(month: number, year: number): number {
  return new Date(year, month - 1, 1).getDay();
}

export default function KalenderPage() {
  const [kegiatan, setKegiatan] = useState<Kegiatan[]>([]);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth() + 1);
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [formTanggal, setFormTanggal] = useState("");
  const [formJudul, setFormJudul] = useState("");
  const [formDeskripsi, setFormDeskripsi] = useState("");
  const [formJenis, setFormJenis] = useState<JenisKegiatan>("materi");
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Load from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_KEGIATAN);
      if (raw) setKegiatan(JSON.parse(raw));
    } catch {}
  }, []);

  // Save to localStorage
  const saveToStorage = useCallback((data: Kegiatan[]) => {
    localStorage.setItem(STORAGE_KEY_KEGIATAN, JSON.stringify(data));
  }, []);

  // Kegiatan for current month
  const monthKegiatan = useMemo(() => {
    return kegiatan.filter((k) => {
      const { m, y } = parseTanggal(k.tanggal);
      return m === currentMonth && y === currentYear;
    });
  }, [kegiatan, currentMonth, currentYear]);

  // Map tanggal -> kegiatan[]
  const kegiatanByDate = useMemo(() => {
    const map = new Map<string, Kegiatan[]>();
    for (const k of monthKegiatan) {
      const list = map.get(k.tanggal) || [];
      list.push(k);
      map.set(k.tanggal, list);
    }
    return map;
  }, [monthKegiatan]);

  // All kegiatan sorted by date (for list view)
  const allSorted = useMemo(() => {
    return [...kegiatan].sort((a, b) => {
      const [ad, am, ay] = a.tanggal.split("/").map(Number);
      const [bd, bm, by] = b.tanggal.split("/").map(Number);
      return by !== ay ? by - ay : bm !== am ? bm - ad : bd - ad;
    });
  }, [kegiatan]);

  // Calendar grid data
  const calendarDays = useMemo(() => {
    const daysInMonth = getDaysInMonth(currentMonth, currentYear);
    const firstDay = getFirstDayOfMonth(currentMonth, currentYear);
    const days: (number | null)[] = [];
    for (let i = 0; i < firstDay; i++) days.push(null);
    for (let i = 1; i <= daysInMonth; i++) days.push(i);
    return days;
  }, [currentMonth, currentYear]);

  const navigateMonth = (dir: number) => {
    let m = currentMonth + dir;
    let y = currentYear;
    if (m < 1) { m = 12; y--; }
    if (m > 12) { m = 1; y++; }
    setCurrentMonth(m);
    setCurrentYear(y);
    setSelectedDate(null);
  };

  const goToToday = () => {
    const now = new Date();
    setCurrentMonth(now.getMonth() + 1);
    setCurrentYear(now.getFullYear());
    setSelectedDate(null);
  };

  const openAddForm = (tanggal?: string) => {
    setEditId(null);
    setFormTanggal(tanggal || toTanggal(new Date().getDate(), currentMonth, currentYear));
    setFormJudul("");
    setFormDeskripsi("");
    setFormJenis("materi");
    setFormOpen(true);
  };

  const openEditForm = (k: Kegiatan) => {
    setEditId(k.id);
    setFormTanggal(k.tanggal);
    setFormJudul(k.judul);
    setFormDeskripsi(k.deskripsi);
    setFormJenis(k.jenis);
    setFormOpen(true);
  };

  const handleSave = () => {
    if (!formJudul.trim() || !formTanggal.trim()) return;
    if (editId) {
      setKegiatan((prev) => {
        const next = prev.map((k) =>
          k.id === editId
            ? { ...k, tanggal: formTanggal, judul: formJudul.trim(), deskripsi: formDeskripsi.trim(), jenis: formJenis }
            : k
        );
        saveToStorage(next);
        return next;
      });
    } else {
      const newK: Kegiatan = {
        id: generateId(),
        tanggal: formTanggal,
        judul: formJudul.trim(),
        deskripsi: formDeskripsi.trim(),
        jenis: formJenis,
      };
      setKegiatan((prev) => {
        const next = [...prev, newK];
        saveToStorage(next);
        return next;
      });
    }
    setFormOpen(false);
  };

  const handleDelete = (id: string) => {
    setKegiatan((prev) => {
      const next = prev.filter((k) => k.id !== id);
      saveToStorage(next);
      return next;
    });
    setDeleteId(null);
  };

  const getJenisStyle = (jenis: JenisKegiatan) => {
    return JENIS_KEGIATAN_OPTIONS.find((j) => j.value === jenis)?.idle || JENIS_KEGIATAN_OPTIONS[5].idle;
  };

  const getJenisActiveStyle = (jenis: JenisKegiatan) => {
    return JENIS_KEGIATAN_OPTIONS.find((j) => j.value === jenis)?.active || JENIS_KEGIATAN_OPTIONS[5].active;
  };

  const getJenisDot = (jenis: JenisKegiatan) => {
    return JENIS_KEGIATAN_OPTIONS.find((j) => j.value === jenis)?.dot || JENIS_KEGIATAN_OPTIONS[5].dot;
  };

  const getJenisLabel = (jenis: JenisKegiatan) => {
    return JENIS_KEGIATAN_OPTIONS.find((j) => j.value === jenis)?.label || "Lainnya";
  };

  const today = new Date();
  const todayStr = toTanggal(today.getDate(), today.getMonth() + 1, today.getFullYear());

  return (
    <div className="animate-page space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-extrabold uppercase tracking-tight text-foreground">
            Kalender Kegiatan
          </h1>
          <p className="text-xs text-muted">
            Jadwal kegiatan KTI SKAGARA
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode(viewMode === "grid" ? "list" : "grid")}
            className="btn btn-secondary min-h-[40px] px-3 py-1.5 text-xs font-bold"
          >
            {viewMode === "grid" ? <List className="h-4 w-4" /> : <CalendarIcon className="h-4 w-4" />}
            {viewMode === "grid" ? "List" : "Kalender"}
          </button>
          <button
            onClick={() => openAddForm()}
            className="btn btn-primary min-h-[40px] px-3 py-1.5 text-xs font-bold"
          >
            <Plus className="h-4 w-4" />
            Tambah Kegiatan
          </button>
        </div>
      </div>

      {/* Month Navigation */}
      <div className="card p-4">
        <div className="flex items-center justify-between">
          <button onClick={() => navigateMonth(-1)} className="btn btn-ghost min-h-[40px] px-2 py-2">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div className="text-center">
            <h2 className="font-display text-lg font-extrabold uppercase tracking-tight text-foreground">
              {MONTH_NAMES[currentMonth - 1]} {currentYear}
            </h2>
            <button onClick={goToToday} className="text-[10px] font-bold uppercase tracking-wider text-accent hover:underline">
              Kembali ke Hari Ini
            </button>
          </div>
          <button onClick={() => navigateMonth(1)} className="btn btn-ghost min-h-[40px] px-2 py-2">
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Grid View */}
      {viewMode === "grid" && (
        <div className="card p-4">
          {/* Day headers */}
          <div className="grid grid-cols-7 gap-1 mb-1">
            {DAY_NAMES.map((d) => (
              <div key={d} className="py-2 text-center text-[10px] font-bold uppercase tracking-wider text-muted">
                {d}
              </div>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7 gap-1">
            {calendarDays.map((day, i) => {
              if (day === null) return <div key={`empty-${i}`} />;
              const tanggal = toTanggal(day, currentMonth, currentYear);
              const dayKegiatan = kegiatanByDate.get(tanggal) || [];
              const isToday = tanggal === todayStr;
              const isSelected = tanggal === selectedDate;

              return (
                <button
                  key={day}
                  onClick={() => setSelectedDate(isSelected ? null : tanggal)}
                  className={`relative min-h-[70px] rounded-lg border p-1.5 text-left transition-all sm:min-h-[80px] ${
                    isSelected
                      ? "border-accent bg-accent/8 ring-1 ring-accent"
                      : isToday
                      ? "border-accent/40 bg-accent/5"
                      : "border-border hover:border-border-strong"
                  }`}
                >
                  <span
                    className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                      isToday
                        ? "bg-accent text-on-accent"
                        : "text-foreground"
                    }`}
                  >
                    {day}
                  </span>
                  <div className="mt-0.5 space-y-0.5">
                    {dayKegiatan.slice(0, 2).map((k) => (
                      <div
                        key={k.id}
                        className={`flex items-center gap-1 truncate rounded px-1 py-0.5 text-[9px] font-semibold border ${getJenisStyle(k.jenis)}`}
                      >
                        <span className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${getJenisDot(k.jenis)}`} />
                        {k.judul}
                      </div>
                    ))}
                    {dayKegiatan.length > 2 && (
                      <span className="block text-center text-[9px] font-bold text-muted">
                        +{dayKegiatan.length - 2} lagi
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Selected Date Detail (grid mode) */}
      {viewMode === "grid" && selectedDate && (
        <div className="card p-5">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div>
              <h3 className="font-display text-sm font-bold uppercase tracking-wide text-foreground">
                {selectedDate}
              </h3>
              <p className="text-xs text-muted">
                {(kegiatanByDate.get(selectedDate) || []).length} kegiatan
              </p>
            </div>
            <button
              onClick={() => openAddForm(selectedDate)}
              className="btn btn-secondary min-h-[36px] px-2.5 py-1 text-xs font-bold"
            >
              <Plus className="h-3.5 w-3.5" />
              Tambah
            </button>
          </div>
          {(kegiatanByDate.get(selectedDate) || []).length === 0 ? (
            <p className="py-6 text-center text-xs text-muted">Belum ada kegiatan pada tanggal ini.</p>
          ) : (
            <div className="mt-3 space-y-2">
              {(kegiatanByDate.get(selectedDate) || []).map((k) => (
                <div key={k.id} className="flex items-start justify-between gap-3 rounded-lg border border-border p-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className={`inline-block h-2 w-2 rounded-full ${getJenisDot(k.jenis)}`} />
                      <span className={`badge text-[10px] border ${getJenisStyle(k.jenis)}`}>
                        {getJenisLabel(k.jenis)}
                      </span>
                    </div>
                    <p className="mt-1 font-semibold text-foreground">{k.judul}</p>
                    {k.deskripsi && <p className="mt-0.5 text-xs text-muted">{k.deskripsi}</p>}
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => openEditForm(k)} className="btn btn-ghost min-h-[36px] min-w-[36px] p-1.5">
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => setDeleteId(k.id)} className="btn btn-ghost min-h-[36px] min-w-[36px] p-1.5 text-danger hover:bg-danger/10">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* List View */}
      {viewMode === "list" && (
        <div className="card p-5">
          <h3 className="font-display text-sm font-bold uppercase tracking-wide text-foreground">
            Semua Kegiatan
          </h3>
          {allSorted.length === 0 ? (
            <p className="py-10 text-center text-xs text-muted">Belum ada kegiatan.</p>
          ) : (
            <div className="mt-3 space-y-2">
              {allSorted.map((k) => (
                <div key={k.id} className="flex items-start gap-3 rounded-lg border border-border p-3">
                  <div className="flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-lg border border-border bg-surface-2">
                    <span className="text-[10px] font-bold uppercase text-muted">
                      {MONTH_NAMES[parseTanggal(k.tanggal).m - 1].slice(0, 3)}
                    </span>
                    <span className="text-sm font-extrabold text-foreground leading-tight">
                      {parseTanggal(k.tanggal).d}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`inline-block h-2 w-2 rounded-full ${getJenisDot(k.jenis)}`} />
                      <span className={`badge text-[10px] border ${getJenisStyle(k.jenis)}`}>
                        {getJenisLabel(k.jenis)}
                      </span>
                    </div>
                    <p className="mt-1 font-semibold text-foreground">{k.judul}</p>
                    {k.deskripsi && <p className="mt-0.5 text-xs text-muted truncate">{k.deskripsi}</p>}
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => openEditForm(k)} className="btn btn-ghost min-h-[36px] min-w-[36px] p-1.5">
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => setDeleteId(k.id)} className="btn btn-ghost min-h-[36px] min-w-[36px] p-1.5 text-danger hover:bg-danger/10">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted">Keterangan:</span>
        {JENIS_KEGIATAN_OPTIONS.map((j) => (
          <span key={j.value} className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
            <span className={`inline-block h-2.5 w-2.5 rounded-full ${j.dot}`} />
            {j.label}
          </span>
        ))}
      </div>

      {/* Form Modal */}
      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/50 p-4">
          <div className="card w-full max-w-md p-6 shadow-lg">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-base font-extrabold uppercase tracking-tight text-foreground">
                {editId ? "Edit Kegiatan" : "Tambah Kegiatan"}
              </h3>
              <button onClick={() => setFormOpen(false)} className="btn btn-ghost min-h-[44px] min-w-[44px] p-2">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <div>
                <label className="label">Tanggal</label>
                <input
                  type="text"
                  value={formTanggal}
                  onChange={(e) => setFormTanggal(e.target.value)}
                  placeholder="DD/MM/YYYY"
                  className="input"
                />
              </div>
              <div>
                <label className="label">Judul Kegiatan</label>
                <input
                  type="text"
                  value={formJudul}
                  onChange={(e) => setFormJudul(e.target.value)}
                  placeholder="contoh: Pengenalan KTI & Basic HTML"
                  className="input"
                />
              </div>
              <div>
                <label className="label">Deskripsi (opsional)</label>
                <textarea
                  value={formDeskripsi}
                  onChange={(e) => setFormDeskripsi(e.target.value)}
                  placeholder="Detail kegiatan..."
                  rows={2}
                  className="input resize-none"
                />
              </div>
              <div>
                <label className="label">Jenis Kegiatan</label>
                <div className="grid grid-cols-3 gap-2">
                  {JENIS_KEGIATAN_OPTIONS.map((j) => {
                    const isActive = formJenis === j.value;
                    return (
                      <button
                        key={j.value}
                        onClick={() => setFormJenis(j.value)}
                        className={`flex items-center gap-2 rounded-lg border-2 px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wide transition-all ${
                          isActive ? j.active : j.idle
                        }`}
                      >
                        <span className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${j.dot} ${isActive ? "ring-2 ring-white/50" : ""}`} />
                        {j.label}
                        {isActive && (
                          <svg className="ml-auto h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="mt-5 flex items-center justify-end gap-2">
              <button onClick={() => setFormOpen(false)} className="btn btn-secondary min-h-[40px] px-3 py-1.5 text-xs font-bold">
                Batal
              </button>
              <button onClick={handleSave} className="btn btn-primary min-h-[40px] px-3 py-1.5 text-xs font-bold">
                {editId ? "Simpan" : "Tambah"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm Modal */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/50 p-4">
          <div className="card w-full max-w-sm p-6 shadow-lg">
            <h3 className="font-display text-base font-extrabold uppercase tracking-tight text-foreground">
              Hapus Kegiatan?
            </h3>
            <p className="mt-1 text-xs text-muted">Tindakan ini tidak dapat dibatalkan.</p>
            <div className="mt-5 flex items-center justify-end gap-2">
              <button onClick={() => setDeleteId(null)} className="btn btn-secondary min-h-[40px] px-3 py-1.5 text-xs font-bold">
                Batal
              </button>
              <button onClick={() => handleDelete(deleteId)} className="btn btn-danger min-h-[40px] px-3 py-1.5 text-xs font-bold">
                Hapus
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
