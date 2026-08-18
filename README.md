# KTI SKAGARA — Sistem Presensi & Kas Komunitas

Aplikasi Web Full-Stack modern berbasis **Next.js 16 (App Router)**, **TypeScript**, dan **Tailwind CSS v4** untuk manajemen presensi dan kas rutin organisasi **KTI (Komunitas Teknologi Informasi) SMK Negeri 3 Jepara (SKAGARA)**. Menggunakan **Google Sheets API** sebagai basis data persisten dengan dukungan *in-memory caching* berkecepatan tinggi.

---

## 🌟 Fitur Utama

### 1. 🔄 Manajemen Generasi (Angkatan) Dinamis
- **Pemisahan Konsep Gen & Kelas**: Generasi (Gen) merepresentasikan angkatan masuk komunitas siswa di KTI (contoh: Gen 10, Gen 11, Gen 12, dst.), terpisah dari jenjang kelas formal di sekolah (X, XI, XII).
- **Edit & Pindah Gen (Bulk Move)**: Fitur untuk mengubah Gen pada data siswa atau memindahkan banyak catatan sekaligus antar tab sheet generasi jika terjadi kesalahan input.
- **Warna Badge Khas per Angkatan**: Setiap generasi memiliki warna badge dan kartu visual unik (Gen 10: *Sky Blue*, Gen 11: *Purple*, Gen 12: *Emerald Green*, Gen 13: *Amber*, dst).
- **Panel Admin Generasi (`/admin`)**: Menambah generasi baru otomatis serta menandai generasi yang telah lulus (arsip).

### 2. 📅 Tampilan Kalender Presensi & Filter Fleksibel
- **Mode Kalender Interaktif**: Visualisasi tanggal pertemuan dalam kalender bulanan, lengkap dengan indikator kehadiran dan drawer daftar hadir siswa per tanggal.
- **Multi-Filter Cepat**: Filter data berdasarkan Angkatan (Gen), Jenjang/Jurusan Kelas, Bulan, Tanggal Pertemuan spesifik, Status Absen, dan Pencarian Nama secara *real-time*.

### 3. 📊 Analisis Statistik & Diagram Mingguan (Per Pertemuan)
- **Ringkasan Metrik**: Total Presensi, Saldo Kas Terkumpul, Rasio Kehadiran (%), Jumlah Hadir, Sakit, Izin, dan Alfa.
- **Grafik Trend Kehadiran Interaktif**: Mendukung mode **Mingguan (Per Pertemuan)** dalam 1 bulan terpilih serta mode **Semua Bulan**, dilengkapi kurva persentase kehadiran dan kartu breakdown per pertemuan.

### 4. ⚡ Input Presensi Cepat & Fleksibel (`/input`)
- **Mode Input Manual**: Pengisian data presensi siswa satuan dengan validasi otomatis nama, kelas, dan nominal kas rutin (default Rp 2.000).
- **Mode Cepat (Bulk Checklist)**: Presensi massal siswa dalam satu kelas sekaligus hanya dengan mencentang nama.

### 5. 📑 Ekspor Excel Multi-Sheet Komprehensif
- Mendukung ekspor format `.xlsx` (Excel) terpadu:
  - **Ekspor "Semua Gen"**: Menghasilkan 1 file workbook berisi Sheet *Semua Data*, Sheet *Per Gen* (`GEN 10`, `GEN 11`, `GEN 12`), Sheet *Rekap Individu* (kehadiran & kas per siswa), dan Sheet *Ringkasan per Gen*.
  - **Ekspor Gen Spesifik**: Menghasilkan rekap data, rekap per individu, dan rekap per kelas.

### 6. 🔒 Keamanan & Autentikasi
- Proteksi seluruh rute internal melalui middleware sesi.
- Dedicated HTTP Route Handler (`/api/auth/logout`) yang kompatibel dengan seluruh browser (termasuk *Brave shields* dan Chromium).

---

## 🛠️ Tech Stack

- **Framework**: [Next.js 16](https://nextjs.org/) (App Router, Turbopack, React 19)
- **Bahasa**: [TypeScript](https://www.typescriptlang.org/)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/)
- **Penyimpanan Data**: Google Sheets API via `google-spreadsheet` & `google-auth-library`
- **Manipulasi Spreadsheet**: `xlsx`
- **Ikonografi**: [Lucide React](https://lucide.dev/)
- **Tema**: Light & Dark mode via `next-themes`

---

## 🚀 Panduan Instalasi Lokal

### 1. Clone Repository
```bash
git clone https://github.com/KTI-SKAGARA/kti-attendance-system.git
cd kti-attendance-system
```

### 2. Pasang Dependencies
```bash
npm install
```

### 3. Konfigurasi Lingkungan (`.env.local`)
Buat file `.env.local` di root proyek:
```env
# Google Spreadsheet ID (dari URL Google Sheets)
GOOGLE_SPREADSHEET_ID=your_spreadsheet_id_here

# Kredensial Service Account (jika tidak menggunakan service-account.json)
GOOGLE_SERVICE_ACCOUNT_EMAIL=your-bot@project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# Password Login Admin (Default: ktiskagara2026)
ADMIN_PASSWORD=ktiskagara2026
```

> **Catatan**: Kredensial Google Service Account juga dapat diletakkan pada file `service-account.json` di root direktori proyek. Jika tidak ada kredensial yang disetel, sistem otomatis berjalan dalam **Mock Mode** (in-memory) untuk kemudahan pengujian lokal.

### 4. Format Struktur Google Sheets
Setiap tab sheet generasi (`GEN 10`, `GEN 11`, `GEN 12`, dst.) memiliki header baris 1 sebagai berikut:
| Tanggal | Nama | Kelas | Status_Absen | Nominal_Kas | Bulan_Tahun |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `01/08/2026` | `NAMA LENGKAP` | `XII TKJ 1` | `Hadir` | `2000` | `08-2026` |

Tab konfigurasi generasi bernama `CONFIG` dengan kolom:
| Gen | Status |
| :--- | :--- |
| `10` | `aktif` |
| `9` | `lulus` |

### 5. Jalankan Dev Server
```bash
npm run dev
```
Buka browser di [http://localhost:3000](http://localhost:3000).

---

## 📜 Scripts & Perintah

| Perintah | Deskripsi |
| :--- | :--- |
| `npm run dev` | Menjalankan server pengembangan lokal (Turbopack) |
| `npm run build` | Membuat bundle produksi & typecheck otomatis |
| `npm run lint` | Menjalankan ESLint untuk pemeriksaan kode |
| `npx tsc --noEmit` | Menjalankan TypeScript typecheck saja |

---

## 🌿 Alur Kontribusi (Branching Workflow)

Selalu bekerja pada branch `dev` dan gunakan alur fork:

1. Buat perubahan di branch `dev` lokal.
2. Push perubahan ke fork Anda (`origin`):
   ```bash
   git push origin dev
   ```
3. Buka Pull Request ke repository upstream (`KTI-SKAGARA/kti-attendance-system`):
   ```bash
   gh pr create --repo KTI-SKAGARA/kti-attendance-system --head naidrahiqa:dev --base main --title "..." --body "..."
   ```

---

## 📄 Lisensi
Dikembangkan untuk dan dikelola oleh **Komunitas Teknologi Informasi (KTI) SMK Negeri 3 Jepara**.
