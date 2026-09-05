"use client";

import { useState } from "react";
import { X, Printer, Settings, FileText, UserCheck } from "lucide-react";
import type { MonthlyReport } from "@/types/finance";
import { formatRupiah, formatBulanTahun, getTodayFormatted, formatTanggalIndo } from "@/lib/utils";
import { SCHOOL_NAME, ORG_NAME } from "@/lib/constants";

interface Props {
  open: boolean;
  onClose: () => void;
  report: MonthlyReport | null;
}

export default function PrintLPJModal({ open, onClose, report }: Props) {
  // Signers state (editable for flexibility)
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [pembinaNama, setPembinaNama] = useState<string>("Dra. Hj. Nurul Hidayati / Pembina KTI");
  const [pembinaNip, setPembinaNip] = useState<string>("NIP. 19780512 200501 2 008");
  const [ketuaNama, setKetuaNama] = useState<string>("Muhammad Rizky Pratama");
  const [ketuaNisn, setKetuaNisn] = useState<string>("NISN. 0089234123 / XI TKJ 1");
  const [bendaharaNama, setBendaharaNama] = useState<string>("Siti Nurhaliza");
  const [bendaharaNisn, setBendaharaNisn] = useState<string>("NISN. 0089456781 / XI RPL 2");
  const [kotaTanggal, setKotaTanggal] = useState<string>(
    `Jepara, ${formatTanggalIndo(getTodayFormatted())}`
  );

  if (!open || !report) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/70 p-2 sm:p-4 backdrop-blur-xs">
      {/* Global Print-specific CSS styles injected dynamically */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #printable-lpj-document,
          #printable-lpj-document * {
            visibility: visible !important;
          }
          #printable-lpj-document {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
            color: black !important;
            box-shadow: none !important;
            border: none !important;
          }
          @page {
            size: A4 portrait;
            margin: 1.5cm 1.5cm 1.5cm 1.5cm;
          }
        }
      `}</style>

      <div
        className="relative flex flex-col w-full max-w-5xl max-h-[92vh] overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Toolbar (Screen-only) */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-surface-alt/80 px-5 py-3.5 print:hidden">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent/15 text-accent">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-display text-sm font-extrabold uppercase tracking-tight text-foreground flex items-center gap-2">
                <span>Pratinjau Cetak LPJ Resmi Pembina</span>
                <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-bold text-accent">
                  A4 Print-Ready
                </span>
              </h2>
              <p className="text-[11px] text-muted">
                Kop Resmi {SCHOOL_NAME} • Format Lembar Pengesahan Lengkap
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowSettings(!showSettings)}
              className={`btn min-h-[38px] px-3 text-xs font-semibold ${
                showSettings ? "btn-primary" : "btn-secondary"
              }`}
              title="Atur nama penandatangan"
            >
              <Settings className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Data Penandatangan</span>
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="btn min-h-[38px] px-4 text-xs font-bold bg-accent text-accent-foreground hover:brightness-105 shadow-xs flex items-center gap-2"
            >
              <Printer className="h-4 w-4" />
              <span>Cetak / Simpan PDF</span>
            </button>

            <button
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-surface-2 hover:text-foreground transition-colors ml-1"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Customization Drawer (Screen-only) */}
        {showSettings && (
          <div className="border-b border-border bg-surface-2/60 px-5 py-3 space-y-3 print:hidden animate-fade-in">
            <p className="text-xs font-bold text-foreground flex items-center gap-1.5">
              <UserCheck className="h-3.5 w-3.5 text-accent" />
              <span>Kustomisasi Pejabat Penandatangan Dokumen</span>
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Pembina */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase text-muted">Nama Pembina KTI</label>
                <input
                  type="text"
                  value={pembinaNama}
                  onChange={(e) => setPembinaNama(e.target.value)}
                  className="input !h-8 text-xs w-full"
                />
                <input
                  type="text"
                  value={pembinaNip}
                  onChange={(e) => setPembinaNip(e.target.value)}
                  placeholder="NIP Pembina"
                  className="input !h-8 text-xs w-full"
                />
              </div>

              {/* Ketua Umum */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase text-muted">Nama Ketua Umum KTI</label>
                <input
                  type="text"
                  value={ketuaNama}
                  onChange={(e) => setKetuaNama(e.target.value)}
                  className="input !h-8 text-xs w-full"
                />
                <input
                  type="text"
                  value={ketuaNisn}
                  onChange={(e) => setKetuaNisn(e.target.value)}
                  placeholder="NISN / Kelas Ketua"
                  className="input !h-8 text-xs w-full"
                />
              </div>

              {/* Bendahara */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase text-muted">Nama Bendahara KTI</label>
                <input
                  type="text"
                  value={bendaharaNama}
                  onChange={(e) => setBendaharaNama(e.target.value)}
                  className="input !h-8 text-xs w-full"
                />
                <input
                  type="text"
                  value={bendaharaNisn}
                  onChange={(e) => setBendaharaNisn(e.target.value)}
                  placeholder="NISN / Kelas Bendahara"
                  className="input !h-8 text-xs w-full"
                />
              </div>
            </div>

            <div className="w-full sm:w-1/3">
              <label className="text-[10px] font-bold uppercase text-muted">Tempat &amp; Tanggal Surat</label>
              <input
                type="text"
                value={kotaTanggal}
                onChange={(e) => setKotaTanggal(e.target.value)}
                className="input !h-8 text-xs w-full"
              />
            </div>
          </div>
        )}

        {/* Scrollable Container with Paper Preview */}
        <div className="flex-1 overflow-y-auto bg-neutral-200/50 dark:bg-neutral-900/60 p-4 sm:p-8 flex justify-center">
          {/* Printable Document Paper */}
          <div
            id="printable-lpj-document"
            className="w-full max-w-[210mm] min-h-[297mm] bg-white text-black p-8 sm:p-12 shadow-xl font-serif text-[12px] leading-relaxed transition-all"
          >
            {/* KOP SURAT RESMI KEDINASAN */}
            <div className="text-center space-y-0.5 select-none">
              <h3 className="text-[13px] font-bold uppercase tracking-wider text-black">
                Pemerintah Provinsi Jawa Tengah
              </h3>
              <h3 className="text-[13px] font-bold uppercase tracking-wider text-black">
                Dinas Pendidikan dan Kebudayaan
              </h3>
              <h2 className="text-[16px] font-extrabold uppercase tracking-wide text-black">
                {SCHOOL_NAME}
              </h2>
              <h1 className="text-[14px] font-bold uppercase tracking-widest text-black">
                Ekstrakurikuler Kelompok Teknologi Informasi ({ORG_NAME})
              </h1>
              <p className="text-[10px] text-neutral-600 italic">
                Jl. Raya Mayong - Welahan, Bakalan, Kec. Kalinyamatan, Kabupaten Jepara, Jawa Tengah 59462
              </p>

              {/* Garis Ganda Kop Surat Resmi */}
              <div className="pt-2">
                <div className="border-b-[3px] border-black" />
                <div className="border-b-[1px] border-black mt-[1.5px]" />
              </div>
            </div>

            {/* DOKUMEN TITLE */}
            <div className="text-center my-6 space-y-1">
              <h2 className="text-[15px] font-bold uppercase tracking-wider underline underline-offset-4 text-black">
                Laporan Pertanggungjawaban (LPJ) Keuangan Kas
              </h2>
              <p className="text-[12px] font-medium text-neutral-800">
                Periode Bulan: {formatBulanTahun(report.bulan_tahun)}
              </p>
            </div>

            {/* INTRODUCTORY PARAGRAPH */}
            <p className="text-justify mb-4 text-[12px]">
              Sehubungan dengan pelaksanaan program kerja dan kegiatan rutin Ekstrakurikuler Kelompok
              Teknologi Informasi (KTI SKAGARA), bersama ini kami sampaikan laporan pertanggungjawaban
              arus kas penerimaan iuran anggota serta realisasi belanja operasional untuk periode bulan{" "}
              <strong>{formatBulanTahun(report.bulan_tahun)}</strong> sebagai berikut:
            </p>

            {/* SECTION 1: RINGKASAN ARUS KAS */}
            <div className="mb-5">
              <h3 className="text-[12px] font-bold uppercase tracking-wider mb-1.5 text-black">
                I. Ringkasan Arus Kas (Cashflow Summary)
              </h3>
              <table className="w-full border-collapse border border-black text-[11px]">
                <thead>
                  <tr className="bg-neutral-100">
                    <th className="border border-black px-3 py-1.5 text-left font-bold w-12 text-center">
                      No
                    </th>
                    <th className="border border-black px-3 py-1.5 text-left font-bold">
                      Uraian Kas
                    </th>
                    <th className="border border-black px-3 py-1.5 text-right font-bold w-44">
                      Nominal (Rp)
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="border border-black px-3 py-1.5 text-center">1</td>
                    <td className="border border-black px-3 py-1.5">
                      Penerimaan Kas Siswa / Anggota (Cash In)
                    </td>
                    <td className="border border-black px-3 py-1.5 text-right font-bold font-mono">
                      {formatRupiah(report.income)}
                    </td>
                  </tr>
                  <tr>
                    <td className="border border-black px-3 py-1.5 text-center">2</td>
                    <td className="border border-black px-3 py-1.5">
                      Realisasi Pengeluaran / Belanja Kegiatan (Cash Out)
                    </td>
                    <td className="border border-black px-3 py-1.5 text-right font-bold font-mono text-neutral-800">
                      {formatRupiah(report.expenses)}
                    </td>
                  </tr>
                  <tr className="bg-neutral-50 font-bold">
                    <td className="border border-black px-3 py-1.5 text-center" colSpan={2}>
                      SALDO KAS BERSIH PERIODE INI (SURPLUS / DEFISIT)
                    </td>
                    <td className="border border-black px-3 py-1.5 text-right font-mono text-[12px]">
                      {formatRupiah(report.balance)}
                    </td>
                  </tr>
                  <tr>
                    <td className="border border-black px-3 py-1 text-center italic text-[10px]">Catatan</td>
                    <td className="border border-black px-3 py-1 text-[10px] italic" colSpan={2}>
                      Total siswa aktif yang tercatat berpartisipasi pada periode ini:{" "}
                      <strong>{report.attendanceCount} siswa</strong>.
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* SECTION 2: PENERIMAAN PER ANGKATAN (GEN) */}
            {report.incomeByGen && report.incomeByGen.length > 0 && (
              <div className="mb-5">
                <h3 className="text-[12px] font-bold uppercase tracking-wider mb-1.5 text-black">
                  II. Penerimaan Kas per Angkatan
                </h3>
                <table className="w-full border-collapse border border-black text-[11px]">
                  <thead>
                    <tr className="bg-neutral-100">
                      <th className="border border-black px-3 py-1.5 text-left font-bold">
                        Angkatan (Gen)
                      </th>
                      <th className="border border-black px-3 py-1.5 text-right font-bold w-44">
                        Penerimaan Kas (Rp)
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.incomeByGen.map((g) => (
                      <tr key={g.gen}>
                        <td className="border border-black px-3 py-1">GEN {g.gen}</td>
                        <td className="border border-black px-3 py-1 text-right font-mono">
                          {formatRupiah(g.total)}
                        </td>
                      </tr>
                    ))}
                    <tr className="bg-neutral-50 font-bold">
                      <td className="border border-black px-3 py-1.5">Total Penerimaan</td>
                      <td className="border border-black px-3 py-1.5 text-right font-mono">
                        {formatRupiah(report.income)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}

            {/* SECTION 3: RINCIAN PENGELUARAN (CASH OUT) */}
            <div className="mb-6">
              <h3 className="text-[12px] font-bold uppercase tracking-wider mb-1.5 text-black">
                {report.incomeByGen && report.incomeByGen.length > 0 ? "III." : "II."} Rincian Realisasi Pengeluaran Kas
              </h3>
              {report.expenseItems && report.expenseItems.length > 0 ? (
                <table className="w-full border-collapse border border-black text-[11px]">
                  <thead>
                    <tr className="bg-neutral-100">
                      <th className="border border-black px-2 py-1.5 text-center w-8">No</th>
                      <th className="border border-black px-2 py-1.5 text-center w-24">Tanggal</th>
                      <th className="border border-black px-2 py-1.5 text-left w-32">Kategori</th>
                      <th className="border border-black px-2 py-1.5 text-left">Uraian Kebutuhan</th>
                      <th className="border border-black px-2 py-1.5 text-right w-36">Jumlah (Rp)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.expenseItems.map((item, idx) => (
                      <tr key={idx}>
                        <td className="border border-black px-2 py-1 text-center">{idx + 1}</td>
                        <td className="border border-black px-2 py-1 text-center">{item.tanggal}</td>
                        <td className="border border-black px-2 py-1">{item.category}</td>
                        <td className="border border-black px-2 py-1">{item.deskripsi}</td>
                        <td className="border border-black px-2 py-1 text-right font-mono">
                          {formatRupiah(item.nominal)}
                        </td>
                      </tr>
                    ))}
                    <tr className="bg-neutral-50 font-bold">
                      <td className="border border-black px-2 py-1.5 text-center" colSpan={4}>
                        TOTAL REALISASI PENGELUARAN
                      </td>
                      <td className="border border-black px-2 py-1.5 text-right font-mono">
                        {formatRupiah(report.expenses)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              ) : report.expenseBreakdown.length > 0 ? (
                <table className="w-full border-collapse border border-black text-[11px]">
                  <thead>
                    <tr className="bg-neutral-100">
                      <th className="border border-black px-3 py-1.5 text-left">Kategori Belanja</th>
                      <th className="border border-black px-3 py-1.5 text-right w-44">Nominal (Rp)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.expenseBreakdown.map((b) => (
                      <tr key={b.category}>
                        <td className="border border-black px-3 py-1">{b.category}</td>
                        <td className="border border-black px-3 py-1 text-right font-mono">
                          {formatRupiah(b.nominal)}
                        </td>
                      </tr>
                    ))}
                    <tr className="bg-neutral-50 font-bold">
                      <td className="border border-black px-3 py-1.5">Total Pengeluaran</td>
                      <td className="border border-black px-3 py-1.5 text-right font-mono">
                        {formatRupiah(report.expenses)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              ) : (
                <p className="text-neutral-500 italic text-[11px] py-2">
                  Tidak ada transaksi pengeluaran (Cash Out) pada periode ini.
                </p>
              )}
            </div>

            {/* CLOSING PARAGRAPH */}
            <p className="text-justify mb-8 text-[12px]">
              Demikian laporan pertanggungjawaban keuangan kas ini kami susun dengan sebenar-benarnya
              sebagai bentuk transparansi dan akuntabilitas kepengurusan Ekstrakurikuler KTI SKAGARA.
              Atas perhatian dan bimbingan Pembina, kami haturkan terima kasih.
            </p>

            {/* LEMBAR PENGESAHAN / TANDA TANGAN (3 KOLOM RESMI) */}
            <div className="pt-2 text-[11px] break-inside-avoid">
              <div className="text-right mb-4">
                <p>{kotaTanggal}</p>
              </div>

              {/* Baris 1: Ketua & Bendahara */}
              <div className="grid grid-cols-2 gap-8 text-center">
                <div>
                  <p className="font-bold">Ketua Umum KTI,</p>
                  <div className="h-20" /> {/* Space for signature */}
                  <p className="font-bold underline uppercase">{ketuaNama}</p>
                  <p className="text-[10px] text-neutral-700">{ketuaNisn}</p>
                </div>
                <div>
                  <p className="font-bold">Bendahara KTI,</p>
                  <div className="h-20" /> {/* Space for signature */}
                  <p className="font-bold underline uppercase">{bendaharaNama}</p>
                  <p className="text-[10px] text-neutral-700">{bendaharaNisn}</p>
                </div>
              </div>

              {/* Baris 2: Pembina KTI (Tengah) */}
              <div className="mt-6 text-center">
                <p className="font-bold">Mengetahui,</p>
                <p className="font-bold">Pembina Ekstrakurikuler KTI SKAGARA,</p>
                <div className="h-20" /> {/* Space for signature & school stamp */}
                <p className="font-bold underline uppercase">{pembinaNama}</p>
                <p className="text-[10px] text-neutral-700">{pembinaNip}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
