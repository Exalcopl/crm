import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/",
        destination: "/admin/panel",
        permanent: false,
      },
      {
        source: "/admin",
        destination: "/admin/panel",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;

