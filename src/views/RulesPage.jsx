import Link from "next/link";
import { SectionHeader } from "../components/ui";

export function RulesPage() {
  const moderationSteps = [
    {
      text: "Kontributor login Google lalu mengirim detail tempat.",
      icon: <i className="hgi-stroke hgi-clipboard-list" style={{ fontSize: 20 }} aria-hidden="true"></i>,
    },
    {
      text: "Admin memeriksa alamat, jenis akses, dan sumber password jika ada.",
      icon: <i className="hgi-stroke hgi-search-check" style={{ fontSize: 20 }} aria-hidden="true"></i>,
    },
    {
      text: "Tempat yang valid disetujui dan nama kontributor tampil sebagai apresiasi.",
      icon: <i className="hgi-stroke hgi-checkmark-circle-02" style={{ fontSize: 20 }} aria-hidden="true"></i>,
    },
  ];
  const privacyRules = [
    "Email kontributor dipakai untuk identifikasi internal dan tindak lanjut moderasi.",
    "Yang tampil publik hanya nama kontributor, nama reviewer, dan isi kontribusi.",
    "Password privat, akun staf, voucher personal, atau akses internal tidak dipublikasikan.",
  ];

  return (
    <main className="rules-page">
      <section className="rules-hero">
        <h1>Direktori WiFi aman dimulai dari data yang boleh dibagikan.</h1>
        <p>
          BalamWiFi hanya menampilkan informasi WiFi publik yang punya konteks
          jelas. Aturan ini menjaga pemilik tempat, kontributor, dan pengunjung
          supaya data yang tampil tetap berguna tanpa membocorkan akses privat.
        </p>
        <div className="rules-hero__actions">
          <Link href="/places" className="button button--ghost">
            Cari WiFi
          </Link>
          <Link href="/submit" className="button button--primary">
            Tambah tempat
          </Link>
        </div>
      </section>

      <section id="legal-policy" className="section rules-layout">
        <aside className="rules-panel rules-panel--dark">
          <h2>Setiap tempat baru ditinjau sebelum masuk daftar publik.</h2>
          <div className="rules-list rules-list--dark">
            {moderationSteps.map((step) => (
              <article key={step.text} className="rule-card rule-card--dark">
                <span>{step.icon}</span>
                <p>{step.text}</p>
              </article>
            ))}
          </div>
        </aside>
      </section>

      <section className="rules-panel rules-panel--privacy">
        <SectionHeader
          title="Kontributor dihargai, data sensitif tetap dibatasi."
          description="Login Google membantu mengurangi spam dan memberi kredit saat tempat sudah disetujui."
        />
        <div className="rules-list rules-list--privacy">
          {privacyRules.map((rule) => (
            <article key={rule} className="rule-card rule-card--privacy">
              <span>
                <i className="hgi-stroke hgi-shield-check" style={{ fontSize: 20 }} aria-hidden="true"></i>
              </span>
              <p>{rule}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="rules-cta">
        <div>
          <h2>Kirim tempat yang memang punya akses WiFi publik.</h2>
          <p>
            Lengkapi alamat, tipe akses, catatan lokasi, dan laporan kecepatan
            supaya admin bisa meninjau lebih cepat.
          </p>
        </div>
        <Link href="/submit" className="button button--primary">
          Kirim sekarang
        </Link>
      </section>
    </main>
  );
}
