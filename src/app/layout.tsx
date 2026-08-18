import type { Metadata, Viewport } from "next";
import "./globals.css";
import Navbar from "@/components/Navbar";
import ThemeProvider from "@/components/ThemeProvider";
import SWRegister from "@/components/SWRegister";
import { AttendanceDataProvider } from "@/hooks/useAttendanceData";

export const metadata: Metadata = {
  title: "KTI Dashboard — Absensi, Keuangan & Kas (SMK Negeri 3 Jepara)",
  description:
    "Sistem Manajemen Absensi, Keuangan, dan Kas Rutin Organisasi KTI SMK Negeri 3 Jepara (SKAGARA). Terhubung dengan Google Sheets & Supabase.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "KTI Dashboard",
  },
};

export const viewport: Viewport = {
  themeColor: "#e8952e",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen antialiased">
        <ThemeProvider>
          <SWRegister />
          <AttendanceDataProvider>
            <Navbar />
            <main className="mx-auto max-w-7xl px-4 py-6 pb-24 sm:px-6 md:pb-6 lg:px-8">
              {children}
            </main>
          </AttendanceDataProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
