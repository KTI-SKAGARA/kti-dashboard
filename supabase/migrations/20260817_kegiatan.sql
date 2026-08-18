-- Tabel kegiatan untuk kalender KTI SKAGARA
CREATE TABLE IF NOT EXISTS kegiatan (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tanggal TEXT NOT NULL,
  judul TEXT NOT NULL,
  deskripsi TEXT DEFAULT '',
  jenis TEXT NOT NULL DEFAULT 'materi',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS: allow all authenticated users
ALTER TABLE kegiatan ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kegiatan_all_auth" ON kegiatan
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Seed data contoh jadwal Agustus 2026
INSERT INTO kegiatan (tanggal, judul, deskripsi, jenis) VALUES
  ('01/08/2026', 'Basic HTML', 'Pengenalan struktur HTML dasar', 'materi'),
  ('08/08/2026', 'Libur', '', 'libur'),
  ('15/08/2026', 'Basic Cybersecurity', 'Pengenalan keamanan siber dasar', 'materi'),
  ('22/08/2026', 'Basic CSS', 'Styling dengan CSS dasar', 'materi'),
  ('29/08/2026', 'Praktek HTML & CSS', 'Latihan membuat halaman web sederhana', 'praktek');
