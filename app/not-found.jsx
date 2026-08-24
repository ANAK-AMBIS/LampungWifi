import Link from "next/link";

export const metadata = {
  title: "404 — BalamWiFi",
  description:
    "Halaman tidak ditemukan. Link mungkin berubah atau tempat belum disetujui.",
};

export default function NotFound() {
  return (
    <main className="not-found-page">
      <section className="not-found-card">
        <span className="not-found-card__code">404</span>
        <h1>Halaman tidak ditemukan.</h1>
        <p>
          Link ini mungkin sudah berubah, tempat belum disetujui, atau alamat
          halaman salah.
        </p>
        <div className="not-found-card__actions">
          <Link href="/places" className="button button--primary">
            Cari WiFi
          </Link>
          <Link href="/" className="button button--ghost">
            Kembali ke home
          </Link>
        </div>
      </section>
    </main>
  );
}
