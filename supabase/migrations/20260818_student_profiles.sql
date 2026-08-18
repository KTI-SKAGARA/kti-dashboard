-- Student profiles table: stores current class per student per gen
CREATE TABLE IF NOT EXISTS student_profiles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nama TEXT NOT NULL,
  gen TEXT NOT NULL,
  kelas TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(nama, gen)
);

ALTER TABLE student_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "student_profiles_all_auth" ON student_profiles
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Add index for faster gen-based queries
CREATE INDEX IF NOT EXISTS idx_student_profiles_gen ON student_profiles(gen);
CREATE INDEX IF NOT EXISTS idx_student_profiles_nama_gen ON student_profiles(nama, gen);
