"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { AttendanceRecord, Gen, TaggedRecord } from "@/types/attendance";
import { getAttendanceRecords } from "@/app/actions/attendance";

// TTL cache client-side: data presensi dibagi antar route (/ , /stats, /kalender)
// sehingga tidak di-fetch ulang total tiap pindah halaman (PRD §4.1).
const CACHE_TTL_MS = 30_000;

interface GenCacheEntry {
  data: AttendanceRecord[];
  at: number;
}

interface AttendanceDataContextValue {
  cache: Map<Gen, GenCacheEntry>;
  loadingGens: Set<Gen>;
  getRecords: (gen: Gen) => AttendanceRecord[] | null;
  loadGen: (gen: Gen, opts?: { force?: boolean }) => Promise<AttendanceRecord[] | null>;
  invalidate: (gen?: Gen) => void;
}

const AttendanceDataContext = createContext<AttendanceDataContextValue | null>(null);

export function AttendanceDataProvider({ children }: { children: ReactNode }) {
  const [cache, setCache] = useState<Map<Gen, GenCacheEntry>>(new Map());
  const [loadingGens, setLoadingGens] = useState<Set<Gen>>(new Set());

  const getRecords = useCallback(
    (gen: Gen) => cache.get(gen)?.data ?? null,
    [cache]
  );

  const invalidate = useCallback((gen?: Gen) => {
    setCache((prev) => {
      const next = new Map(prev);
      if (gen) next.delete(gen);
      else next.clear();
      return next;
    });
  }, []);

  const loadGen = useCallback(
    async (gen: Gen, opts?: { force?: boolean }): Promise<AttendanceRecord[] | null> => {
      const now = Date.now();
      const entry = cache.get(gen);
      if (!opts?.force && entry && now - entry.at < CACHE_TTL_MS) {
        return entry.data;
      }

      setLoadingGens((prev) => new Set(prev).add(gen));
      try {
        const res = await getAttendanceRecords(gen);
        const data = res.data;
        if (res.success && data) {
          setCache((prev) => new Map(prev).set(gen, { data, at: Date.now() }));
          return data;
        }
        return entry?.data ?? null; // fallback: data basi kalau fetch gagal
      } finally {
        setLoadingGens((prev) => {
          const next = new Set(prev);
          next.delete(gen);
          return next;
        });
      }
    },
    [cache]
  );

  const value = useMemo(
    () => ({ cache, loadingGens, getRecords, loadGen, invalidate }),
    [cache, loadingGens, getRecords, loadGen, invalidate]
  );

  return (
    <AttendanceDataContext.Provider value={value}>
      {children}
    </AttendanceDataContext.Provider>
  );
}

export function useAttendanceData(): AttendanceDataContextValue {
  const ctx = useContext(AttendanceDataContext);
  if (!ctx) {
    throw new Error("useAttendanceData harus dipakai di dalam AttendanceDataProvider.");
  }
  return ctx;
}

/**
 * Hook utama: fetch + cache records untuk daftar gen, digabung jadi TaggedRecord.
 * Memuat tiap gen sekali, lalu re-render otomatis saat data gen berubah.
 */
export function useTaggedRecords(gens: Gen[]): {
  records: TaggedRecord[];
  loading: boolean;
  refresh: (opts?: { force?: boolean }) => Promise<void>;
} {
  const { getRecords, loadGen, cache, loadingGens } = useAttendanceData();
  const gensKey = gens.join(",");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await Promise.all(gens.map((g) => loadGen(g)));
      void cancelled;
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gensKey, loadGen]);

  const records = useMemo(() => {
    const out: TaggedRecord[] = [];
    for (const g of gens) {
      const data = getRecords(g);
      if (data) {
        for (const r of data) {
          out.push({
            ...r,
            _gen: g,
            _rowId: r.rowId || `tmp-${g}-${r.tanggal}-${r.nama}`,
          });
        }
      }
    }
    return out;
  }, [gens, getRecords]);

  const loading = gens.length > 0 && gens.some((g) => !cache.has(g));

  const refresh = useCallback(
    async (opts?: { force?: boolean }) => {
      await Promise.all(gens.map((g) => loadGen(g, opts)));
    },
    [gens, loadGen]
  );

  const hasInflight = gens.some((g) => loadingGens.has(g));

  return { records, loading: loading || hasInflight, refresh };
}