import type { MetadataRoute } from 'next'

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'

  const staticPages = [
    { url: '', priority: 1 },
    { url: '/places', priority: 0.9 },
    { url: '/rules', priority: 0.7 },
    { url: '/submit', priority: 0.6 },
    { url: '/about', priority: 0.5 },
    { url: '/contact', priority: 0.4 },
    { url: '/whats-new', priority: 0.3 },
  ]

  return staticPages.map((page) => ({
    url: `${baseUrl}${page.url}`,
    lastModified: new Date(),
    changeFrequency: page.url === '/places' ? 'daily' : 'weekly',
    priority: page.priority,
  }))
}
