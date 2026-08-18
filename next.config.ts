import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/stats/individual",
        destination: "/?tab=rekap&sub=siswa",
        permanent: true,
      },
      {
        source: "/stats",
        destination: "/?tab=rekap",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
