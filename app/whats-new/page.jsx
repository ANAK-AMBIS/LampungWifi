import Link from "next/link";
import { appVersion } from "../../src/lib/version";

export const metadata = {
  title: "What's New — BalamWiFi",
  description:
    "Update terbaru BalamWiFi: direktori WiFi publik Bandar Lampung dengan pencarian ringkas, filter adaptif, dan login Google.",
  openGraph: {
    title: "What's New — BalamWiFi",
    description:
      "Lihat update terbaru dari direktori WiFi publik Bandar Lampung.",
    type: "website",
  },
};

export default function Page() {
  return (
    <main className="static-page">
      <section className="static-card">
        <h1>Update terbaru BalamWiFi.</h1>
        <p>
          Direktori kini punya halaman aturan baru, pencarian lebih ringkas, dan
          filter yang bisa dibuka saat dibutuhkan.
        </p>
        <div className="version-card">
          <span>Version {appVersion}</span>
          <h2>Rilis awal direktori WiFi publik.</h2>
          <ul>
            <li>Pencarian tempat WiFi publik di Bandar Lampung.</li>
            <li>
              Filter berdasarkan kecepatan, akses, kategori, colokan, dan 24
              jam.
            </li>
            <li>Halaman aturan untuk menjaga data tetap aman dibagikan.</li>
          </ul>
        </div>
        <Link href="/places" className="button button--primary">
          Coba cari WiFi
        </Link>
      </section>

      <section className="contribute-banner">
        <div>
          <h2>Bantu direktori bertumbuh</h2>
          <p>
            Punya info tempat WiFi yang belum ada? Kirim lewat formulir
            komunitas.
          </p>
        </div>
        <div className="contribute-banner__actions">
          <Link href="/submit" className="button button--primary">
            Tambah tempat
          </Link>
          <Link href="/places" className="button button--ghost">
            Cari WiFi
          </Link>
        </div>
      </section>
    </main>
  );
}
