-- Kas payments: pisahkan pembayaran kas dari absensi

CREATE TABLE IF NOT EXISTS kas_payments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nama TEXT NOT NULL,
  gen TEXT NOT NULL,
  kelas TEXT NOT NULL,
  bulan_tahun TEXT NOT NULL,
  tanggal TEXT NOT NULL,
  nominal NUMERIC NOT NULL CHECK (nominal >= 0),
  linked_record_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE kas_payments ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "kas_payments_read" ON kas_payments FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "kas_payments_write" ON kas_payments FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_kas_payments_nama ON kas_payments(nama);
CREATE INDEX IF NOT EXISTS idx_kas_payments_gen ON kas_payments(gen);
CREATE INDEX IF NOT EXISTS idx_kas_payments_bulan_tahun ON kas_payments(bulan_tahun);
