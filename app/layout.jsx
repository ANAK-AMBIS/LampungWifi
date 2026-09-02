import "../src/index.css";
import "../src/globals.css";
import { AppShell } from "../src/components/AppShell.jsx";
import { ErrorBoundary } from "../src/components/ErrorBoundary.jsx";
import { ToastProvider } from "../src/components/Toast.jsx";
import { JsonLd, websiteJsonLd } from "../src/components/JsonLd.jsx";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://balamwifi.my.id";

export const metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "BalamWiFi — WiFi Publik Bandar Lampung",
    template: "%s — BalamWiFi",
  },
  description:
    "Direktori WiFi publik Bandar Lampung — cari kafe, coworking, perpustakaan, dan area kampus dengan laporan kecepatan, ulasan komunitas, dan filter lengkap.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "BalamWiFi — WiFi Publik Bandar Lampung",
    description:
      "Direktori tempat kerja, nongkrong, dan transit dengan WiFi publik yang jelas status legalnya.",
    url: "/",
    siteName: "BalamWiFi",
    locale: "id_ID",
    type: "website",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "BalamWiFi — Direktori WiFi Bandar Lampung",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "BalamWiFi — WiFi Publik Bandar Lampung",
    description:
      "Cari kafe, coworking, dan perpustakaan dengan WiFi publik terverifikasi di Bandar Lampung.",
    images: ["/opengraph-image"],
  },
  icons: {
    icon: [{ url: "/favicon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/favicon.svg", sizes: "180x180", type: "image/svg+xml" }],
  },
  manifest: "/manifest.webmanifest",
  ...(process.env.GOOGLE_SITE_VERIFICATION
    ? { verification: { google: process.env.GOOGLE_SITE_VERIFICATION } }
    : {}),
  category: "travel",
};

export const viewport = {
  themeColor: "#863bff",
  colorScheme: "light",
};

export default function RootLayout({ children }) {
  return (
    <html lang="id">
      <head>
        <link rel="preconnect" href="https://cdn.hugeicons.com" crossOrigin="anonymous" />
        <link rel="stylesheet" href="https://cdn.hugeicons.com/font/hgi-stroke-rounded.css" crossOrigin="anonymous" />
        <JsonLd data={websiteJsonLd(siteUrl)} />
      </head>
      <body>
        <ErrorBoundary>
          <ToastProvider>
            <AppShell>{children}</AppShell>
          </ToastProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
