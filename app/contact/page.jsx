import Link from "next/link";

export const metadata = {
  title: "Kontak — BalamWiFi",
  description:
    "Punya info WiFi publik yang valid? Kirim lewat formulir komunitas BalamWiFi supaya bisa ditinjau dan tampil di direktori.",
  openGraph: {
    title: "Kontak — BalamWiFi",
    description: "Kirim tempat atau koreksi data WiFi publik Bandar Lampung.",
    type: "website",
  },
};

export default function Page() {
  return (
    <main className="static-page">
      <section className="static-card">
        <h1>Kirim tempat atau koreksi data.</h1>
        <p>
          Punya info WiFi publik yang valid? Kirim lewat formulir komunitas
          supaya bisa ditinjau dan tampil di direktori.
        </p>
        <Link href="/submit" className="button button--primary">
          Kirim tempat
        </Link>
      </section>

      <section className="contribute-banner">
        <div>
          <h2>Bantu direktori tetap akurat</h2>
          <p>
            Setiap tempat baru ditinjau admin sebelum tampil. Login Google
            dipakai untuk mencegah spam dan memberi kredit kontributor.
          </p>
        </div>
        <div className="contribute-banner__actions">
          <Link href="/submit" className="button button--primary">
            Tambah tempat
          </Link>
          <Link href="/rules" className="button button--ghost">
            Baca aturan
          </Link>
        </div>
      </section>
    </main>
  );
}
