import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const alt = 'BalamWiFi — Direktori WiFi Bandar Lampung'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '1200px',
          height: '630px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '48px 56px',
          background: 'linear-gradient(135deg, #863bff 0%, #5b21d6 50%, #1e1b4b 100%)',
          color: 'white',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              fontSize: 28,
              fontWeight: 800,
              letterSpacing: '-0.02em',
            }}
          >
            <span
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 48,
                height: 48,
                borderRadius: 14,
                background: 'white',
                color: '#5b21d6',
                fontSize: 26,
              }}
            >
              ▢
            </span>
            BalamWiFi
          </div>
          <div
            style={{
              fontSize: 64,
              fontWeight: 900,
              lineHeight: 1.05,
              letterSpacing: '-0.04em',
              maxWidth: 900,
            }}
          >
            WiFi Publik
            <br />
            Bandar Lampung
          </div>
          <div style={{ fontSize: 22, opacity: 0.92, maxWidth: 760, lineHeight: 1.4 }}>
            Cari kafe, coworking, perpustakaan & area kampus — laporan kecepatan, ulasan komunitas,
            filter lengkap.
          </div>
        </div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: 18,
            opacity: 0.9,
          }}
        >
          <span>balamwifi.my.id</span>
          <span style={{ background: 'rgba(255,255,255,0.18)', padding: '8px 16px', borderRadius: 999 }}>
            Find your place to connect
          </span>
        </div>
      </div>
    ),
    { ...size },
  )
}
