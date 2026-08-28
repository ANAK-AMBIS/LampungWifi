import Link from "next/link";
import { Suspense } from "react";
import {
  ScrollOnRouteChange,
  TopbarLogin,
  TopbarSearch,
  WhatsNewModal,
} from "./AppShellClient";
import { appVersion } from "../lib/version";

const footerSections = [
  {
    title: "Jelajahi",
    links: [
      { href: "/places", label: "Cari WiFi" },
      { href: "/rules", label: "Aturan" },
      { href: "/submit", label: "Tambah tempat" },
    ],
  },
  {
    title: "Lainnya",
    links: [
      { href: "/whats-new", label: "What's New" },
      { href: "/about", label: "Tentang" },
      { href: "/contact", label: "Kontak" },
    ],
  },
];

export function AppShell({ children }) {
  return (
    <>
      <div className="app-shell">
        <ScrollOnRouteChange />
        <header className="topbar">
          <Link href="/" className="brand">
            <span className="brand__wordmark">BalamWiFi</span>
          </Link>
          <Suspense fallback={null}>
            <TopbarSearch />
          </Suspense>
          <TopbarLogin />
        </header>

        {children}
      </div>

      <footer className="footer">
        <div className="footer__inner">
          <div className="footer__main">
            <div className="footer__brand">
              <h3>BalamWiFi</h3>
              <p>Temukan tempat untuk bekerja, nongkrong, dan terhubung dengan WiFi terpercaya.</p>
            </div>
            {footerSections.map((section) => (
              <nav key={section.title} className="footer__nav" aria-label={section.title}>
                <h4>{section.title}</h4>
                {section.links.map((link) => (
                  <Link key={link.href} href={link.href}>
                    {link.label}
                  </Link>
                ))}
              </nav>
            ))}
          </div>
          <p className="footer__tagline">
            <span>Find your place to connect.</span>
            <span>Bandar Lampung, connected.</span>
          </p>
          <div className="footer__bottom">
            <span>&copy; 2026 BalamWiFi</span>
            <span>All rights reserved.</span>
          </div>
        </div>
      </footer>

      <WhatsNewModal version={appVersion} />
    </>
  );
}
