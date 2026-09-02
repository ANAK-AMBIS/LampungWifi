const defaultImageHosts = ['i.ibb.co', 'images.unsplash.com', 'lh3.googleusercontent.com']
const imageHosts = (process.env.NEXT_IMAGE_REMOTE_HOSTS ?? defaultImageHosts.join(','))
  .split(',')
  .map((host) => host.trim())
  .filter(Boolean)

/** @type {import('next').NextConfig} */
const nextConfig = {
  compress: true,
  serverExternalPackages: ["pg"],
  outputFileTracingExcludes: {
    "*": ["node_modules/pg/**", "node_modules/pg/**/*", "**/pg/**"],
  },
  images: {
    remotePatterns: imageHosts.map((hostname) => ({
      protocol: 'https',
      hostname,
    })),
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 60,
  },
  experimental: {
    optimizePackageImports: ['zod'],
  },
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, s-maxage=60, stale-while-revalidate=300',
          },
        ],
      },
      {
        source: '/sitemap.xml',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, s-maxage=3600, stale-while-revalidate=86400',
          },
        ],
      },
      {
        source: '/robots.txt',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, s-maxage=3600, stale-while-revalidate=86400',
          },
        ],
      },
      {
        source: '/manifest.webmanifest',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, s-maxage=86400, stale-while-revalidate=86400',
          },
        ],
      },
      {
        // Security hardening — applied to page routes (not /api which has helmet)
        source: '/((?!api/).*)',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
        ],
      },
    ];
  },
}

export default nextConfig
