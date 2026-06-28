import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin();

const nextConfig: NextConfig = {
  // Image optimization configuration
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
      {
        protocol: "https",
        hostname: "avatars.githubusercontent.com",
      },
      {
        protocol: "https",
        hostname: "*.public.blob.vercel-storage.com",
      },
      {
        // Hotelbeds GIATA photo CDN (live hotel/room images).
        protocol: "https",
        hostname: "photos.hotelbeds.com",
      },
      {
        // Sample/placeholder photos used when live supplier data is unavailable.
        protocol: "https",
        hostname: "picsum.photos",
      },
      {
        protocol: "https",
        hostname: "fastly.picsum.photos",
      },
    ],
  },

  // Enable compression
  compress: true,

  // URL canonicalization: rewrites serve new canonical URLs from existing page
  // files without moving code. Redirects preserve old bookmarks.
  async rewrites() {
    return [
      // /proposals/* → served by /products/* (canonical URL is /proposals)
      { source: "/proposals", destination: "/products" },
      { source: "/proposals/:path*", destination: "/products/:path*" },
      // /sourcing/hotels/* → served by /hotels/* (canonical URL is /sourcing/hotels)
      { source: "/sourcing/hotels", destination: "/hotels" },
      { source: "/sourcing/hotels/:path*", destination: "/hotels/:path*" },
    ];
  },

  async redirects() {
    return [
      // Old product URLs → canonical /proposals (permanent)
      { source: "/products", destination: "/proposals", permanent: true },
      { source: "/products/:path*", destination: "/proposals/:path*", permanent: true },
      // Old sourcing URLs → canonical new paths (temporary during transition)
      { source: "/search", destination: "/sourcing/flights", permanent: false },
      { source: "/hotels", destination: "/sourcing/hotels", permanent: false },
      { source: "/hotels/:path*", destination: "/sourcing/hotels/:path*", permanent: false },
      // Operations → Bookings (the board view toggle lives there)
      { source: "/operations", destination: "/bookings", permanent: false },
    ];
  },

  // Security headers
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "X-XSS-Protection",
            value: "1; mode=block",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};

export default withNextIntl(nextConfig);
