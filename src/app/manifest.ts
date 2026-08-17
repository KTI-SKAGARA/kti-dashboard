import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "KTI SKAGARA — Absensi & Kas",
    short_name: "KTI SKAGARA",
    description:
      "Sistem Manajemen Absensi dan Kas Rutin Organisasi KTI SMK Negeri 3 Jepara (SKAGARA).",
    start_url: "/",
    display: "standalone",
    background_color: "#fafafa",
    theme_color: "#2563eb",
    icons: [
      {
        src: "/logo-kti.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
    ],
  };
}
