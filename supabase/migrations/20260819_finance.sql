-- Finance system: expenses, categories, budgets, kas_payments

-- Pembayaran kas (pisah dari absensi)
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

-- Kategori pengeluaran
CREATE TABLE IF NOT EXISTS expense_categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nama TEXT NOT NULL UNIQUE,
  deskripsi TEXT DEFAULT '',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Pengeluaran kas
CREATE TABLE IF NOT EXISTS expenses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tanggal TEXT NOT NULL,
  bulan_tahun TEXT NOT NULL,
  category_id UUID REFERENCES expense_categories(id) ON DELETE SET NULL,
  deskripsi TEXT NOT NULL,
  nominal NUMERIC NOT NULL CHECK (nominal > 0),
  status TEXT NOT NULL DEFAULT 'disetujui' CHECK (status IN ('draft', 'disetujui', 'ditolak')),
  submitted_by UUID REFERENCES auth.users(id),
  approved_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Budget planning per bulan per kategori
CREATE TABLE IF NOT EXISTS budgets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  bulan_tahun TEXT NOT NULL,
  category_id UUID REFERENCES expense_categories(id) ON DELETE CASCADE,
  target_nominal NUMERIC NOT NULL CHECK (target_nominal >= 0),
  catatan TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(bulan_tahun, category_id)
);

-- RLS
ALTER TABLE kas_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE budgets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kas_payments_read" ON kas_payments FOR SELECT USING (true);
CREATE POLICY "kas_payments_write" ON kas_payments FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "expense_categories_read" ON expense_categories FOR SELECT USING (true);
CREATE POLICY "expense_categories_write" ON expense_categories FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "expenses_read" ON expenses FOR SELECT USING (true);
CREATE POLICY "expenses_write" ON expenses FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "budgets_read" ON budgets FOR SELECT USING (true);
CREATE POLICY "budgets_write" ON budgets FOR ALL USING (true) WITH CHECK (true);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_kas_payments_nama ON kas_payments(nama);
CREATE INDEX IF NOT EXISTS idx_kas_payments_gen ON kas_payments(gen);
CREATE INDEX IF NOT EXISTS idx_kas_payments_bulan_tahun ON kas_payments(bulan_tahun);
CREATE INDEX IF NOT EXISTS idx_expenses_bulan_tahun ON expenses(bulan_tahun);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category_id);
CREATE INDEX IF NOT EXISTS idx_expenses_status ON expenses(status);
CREATE INDEX IF NOT EXISTS idx_budgets_bulan_tahun ON budgets(bulan_tahun);

-- Seed: default kategori
INSERT INTO expense_categories (nama, deskripsi) VALUES
  ('Konsumsi', 'Makanan dan minuman untuk kegiatan'),
  ('ATK', 'Alat tulis kantor dan perlengkapan'),
  ('Sewa Tempat', 'Biaya sewa ruangan/fasilitas'),
  ('Perlengkapan', 'Peralatan organisasi'),
  ('Transport', 'Biaya transportasi'),
  ('Lainnya', 'Pengeluaran lain')
ON CONFLICT (nama) DO NOTHING;
