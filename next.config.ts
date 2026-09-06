// zenith-os/next.config.ts
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // ✅ These should be at the root level of the config
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },

  // Redirects for multi-provider architecture migration
  async redirects() {
    return [
      // QuickBooks routes - redirect legacy paths to /qb/
      {
        source: '/reports',
        destination: '/qb/reports',
        permanent: true,
      },
      {
        source: '/reports/:path*',
        destination: '/qb/reports/:path*',
        permanent: true,
      },
      {
        source: '/sales',
        destination: '/qb/sales',
        permanent: true,
      },
      {
        source: '/sales/:path*',
        destination: '/qb/sales/:path*',
        permanent: true,
      },
      {
        source: '/expenses',
        destination: '/qb/expenses/vendors',
        permanent: true,
      },
      {
        source: '/expenses/:path*',
        destination: '/qb/expenses/:path*',
        permanent: true,
      },
      {
        source: '/journal',
        destination: '/qb/journal',
        permanent: true,
      },
      {
        source: '/forecasting',
        destination: '/qb/forecasting',
        permanent: true,
      },
      // Business Central routes - redirect /aqua/ to /bc/
      {
        source: '/aqua',
        destination: '/bc/reports',
        permanent: true,
      },
      // /bc/pnl is now a real page — no redirect needed
      {
        source: '/aqua/:path*',
        destination: '/bc/:path*',
        permanent: true,
      },
    ]
  },

  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'img.clerk.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'avatars.githubusercontent.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'cdn.discordapp.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 's.gravatar.com',
        port: '',
        pathname: '/**',
      },
    ],
  },

  // Add other config here if needed...
}

export default nextConfig
