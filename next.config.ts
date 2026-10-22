import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdf.js loads its worker from disk; keep it out of the server bundle.
  serverExternalPackages: ["pdfjs-dist"],
  experimental: {
    // CAS statements are often 1-5 MB.
    serverActions: { bodySizeLimit: "10mb" },
  },
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "same-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
