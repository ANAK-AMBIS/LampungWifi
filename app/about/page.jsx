import Link from "next/link";

export const metadata = {
  title: "Tentang — BalamWiFi",
  description:
    "BalamWiFi adalah direktori WiFi publik Bandar Lampung yang membantu warga menemukan tempat kerja, nongkrong, dan transit dengan akses internet.",
  openGraph: {
    title: "Tentang — BalamWiFi",
    description:
      "Platform tempat kerja, nongkrong, dan transit dengan WiFi publik yang jelas status legalnya.",
    type: "website",
  },
};

export default function Page() {
  return (
    <main className="static-page">
      <section className="static-card static-card--hero">
        <h1>Direktori WiFi publik Bandar Lampung.</h1>
        <p>
          BalamWiFi membantu warga dan pendatang menemukan tempat dengan akses
          internet publik yang jelas — mulai dari kafe, coworking, perpustakaan,
          hingga area kampus.
        </p>
      </section>

      <section className="static-card">
        <h2>Kenapa BalamWiFi ada</h2>
        <p>
          Di Bandar Lampung, banyak tempat punya WiFi tapi informasinya tersebar
          — mana yang cepat, mana yang nyaman buat kerja, mana yang cuma cukup
          buat browsing. BalamWiFi menyatukan laporan kecepatan, ulasan
          komunitas, dan catatan akses dalam satu direktori.
        </p>
        <p>
          Setiap tempat ditinjau oleh admin sebelum tampil ke publik. Password
          WiFi hanya muncul jika sumbernya jelas dan terverifikasi — terpampang
          di lokasi atau dibagikan langsung oleh staf/pemilik.
        </p>
      </section>

      <section className="static-card">
        <h2>Yang membedakan</h2>
        <div className="about-features">
          <div className="about-feature-card">
            <span className="about-feature-card__icon">
              <i className="hgi-stroke hgi-shield-check" style={{ fontSize: 24 }} aria-hidden="true"></i>
            </span>
            <h3>Data terverifikasi</h3>
            <p>
              Setiap tempat ditinjau admin. Password hanya muncul jika sumbernya
              jelas — terpampang di lokasi atau dibagikan staf.
            </p>
          </div>
          <div className="about-feature-card">
            <span className="about-feature-card__icon">
              <i className="hgi-stroke hgi-star" style={{ fontSize: 24 }} aria-hidden="true"></i>
            </span>
            <h3>Rating ganda</h3>
            <p>
              Kecepatan dan kenyamanan dinilai terpisah. Tempat cepat tapi ramai
              tetap terlihat jujur di mata pengunjung.
            </p>
          </div>
          <div className="about-feature-card">
            <span className="about-feature-card__icon">
              <i className="hgi-stroke hgi-user-check-01" style={{ fontSize: 24 }} aria-hidden="true"></i>
            </span>
            <h3>Kontributor dihargai</h3>
            <p>
              Nama kontributor tampil di setiap tempat yang disetujui. Login
              Google membantu mencegah spam tanpa mengorbankan privasi.
            </p>
          </div>
        </div>
      </section>

      <section className="contribute-banner">
        <div>
          <h2>Jelajahi atau kontribusi</h2>
          <p>
            Cari tempat WiFi terbaik atau bantu komunitas dengan menambah tempat
            baru.
          </p>
        </div>
        <div className="contribute-banner__actions">
          <Link href="/places" className="button button--primary">
            Cari WiFi
          </Link>
          <Link href="/submit" className="button button--ghost">
            Tambah tempat
          </Link>
        </div>
      </section>
    </main>
  );
}
