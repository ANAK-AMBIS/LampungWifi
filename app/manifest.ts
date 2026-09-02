import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'BalamWiFi — WiFi Publik Bandar Lampung',
    short_name: 'BalamWiFi',
    description: 'Direktori WiFi publik Bandar Lampung — kafe, coworking, perpustakaan, dan area kampus.',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#863bff',
    lang: 'id',
    dir: 'ltr',
    icons: [
      {
        src: '/favicon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'any',
      },
      {
        src: '/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'maskable',
      },
    ],
  }
}
