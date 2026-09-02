import type { MetadataRoute } from 'next'

const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://balamwifi.my.id'

const staticPages: Array<{
  url: string
  priority: number
  changeFrequency: 'daily' | 'weekly' | 'monthly'
}> = [
  { url: '', priority: 1, changeFrequency: 'weekly' },
  { url: '/places', priority: 0.9, changeFrequency: 'daily' },
  { url: '/rules', priority: 0.7, changeFrequency: 'monthly' },
  { url: '/submit', priority: 0.6, changeFrequency: 'monthly' },
  { url: '/about', priority: 0.5, changeFrequency: 'monthly' },
  { url: '/contact', priority: 0.4, changeFrequency: 'monthly' },
  { url: '/whats-new', priority: 0.3, changeFrequency: 'weekly' },
]

async function getDynamicPlaces(): Promise<
  Array<{ id: number; updated_at?: string; image_url?: string | null }>
> {
  // 1) Try D1 direct (Cloudflare Workers / OpenNext) — no HTTP round-trip
  try {
    const { getCloudflareContext } = await import('@opennextjs/cloudflare').catch(
      () => ({ getCloudflareContext: null }) as never,
    )
    if (getCloudflareContext) {
      try {
        const ctx = await getCloudflareContext({ async: true } as never)
        const env = (ctx as unknown as { env?: Record<string, unknown> })?.env as
          | { DB?: unknown }
          | undefined
        if (env?.DB) {
          const { createStore } = await import('../server/db.js')
          const store = await createStore(env as never)
          const result = await store.listPlaces({ status: 'approved', limit: 5000 })
          return (result.places ?? []).map((p: { id: number; updated_at?: string; image_url?: string | null }) => ({
            id: p.id,
            updated_at: p.updated_at,
            image_url: p.image_url ?? null,
          }))
        }
      } catch {
        // fall through to HTTP
      }
    }
  } catch {
    // ignore
  }

  // 2) HTTP fallback — works in `next build` and local dev
  try {
    const apiBase =
      process.env.API_SERVER_URL ?? process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:8787'
    const url = apiBase.startsWith('http')
      ? `${apiBase.replace(/\/$/, '')}/api/places?status=approved&limit=5000`
      : `http://localhost:8787/api/places?status=approved&limit=5000`
    const res = await fetch(url, { next: { revalidate: 3600 } } as RequestInit)
    if (!res.ok) return []
    const payload = (await res.json()) as { data?: Array<{ id: number; updated_at?: string; image_url?: string | null }> }
    return payload.data ?? []
  } catch {
    return []
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticEntries: MetadataRoute.Sitemap = staticPages.map((page) => ({
    url: `${baseUrl}${page.url}`,
    lastModified: new Date(),
    changeFrequency: page.changeFrequency,
    priority: page.priority,
  }))

  const places = await getDynamicPlaces()
  const dynamicEntries: MetadataRoute.Sitemap = places.map((place) => ({
    url: `${baseUrl}/places/${place.id}`,
    lastModified: place.updated_at ? new Date(place.updated_at) : new Date(),
    changeFrequency: 'weekly' as const,
    priority: 0.8,
    ...(place.image_url ? { images: [place.image_url] } : {}),
  }))

  return [...staticEntries, ...dynamicEntries]
}
