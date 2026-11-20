import type { NextConfig } from 'next';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  images: {
    // Lot photos are already compressed to WebP on upload; serve them as-is.
    unoptimized: true,
    remotePatterns: [{ protocol: new URL(supabaseUrl).protocol.replace(':', '') as 'http' | 'https', hostname: new URL(supabaseUrl).hostname }],
  },
  async headers() {
    return [
      {
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'no-cache' },
          { key: 'Service-Worker-Allowed', value: '/' },
        ],
      },
    ];
  },
};

export default nextConfig;
