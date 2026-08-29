"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getPlaces } from "../api";
import { categoryOptions, categoryLabels } from "../lib/constants";
import {
  CategoryIcon,
  InfoBanner,
  LoadingGrid,
  PlaceCard,
  SectionHeader,
} from "../components/ui";

export function HomePage({ initialFeatured }) {
  const [featured, setFeatured] = useState(initialFeatured);

  useEffect(() => {
    if (featured?.error || (!featured?.loading && featured?.items?.length === 0)) {
      let active = true;
      (async () => {
        try {
          const res = await getPlaces({ limit: 6 });
          if (!active) return;
          setFeatured({ loading: false, error: "", source: res.meta.source, items: res.data, total: res.meta.total ?? res.data.length });
        } catch (e) {
          if (!active) return;
          setFeatured((c) => ({ ...c, error: e.message }));
        }
      })();
      return () => { active = false; };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fallback fetch once when initialFeatured empty/error
  }, []);

  return (
    <main>
      {/* 1. HERO */}
      <section className="hero-panel">
        <div className="hero-panel__backdrop" />
        <div className="hero-panel__content">
          <h1>
            <span className="hero-title__line">Internet Cepat</span>
            <span className="hero-title__line">Dimana Saja.</span>
          </h1>
          <p>
            Cari kafe, coworking, perpustakaan, dan area kampus dengan WiFi
            publik di Bandar Lampung, lengkap dengan laporan kecepatan dan
            ulasan komunitas.
          </p>
        </div>
      </section>

      {/* 2. KATEGORI */}
      <section className="section">
        <SectionHeader
          title="Jelajahi berdasarkan kategori"
          description="Temukan tempat WiFi publik yang sesuai dengan kebutuhan kerja atau istirahat."
        />
        <div className="category-grid">
          {categoryOptions.map((category) => (
            <Link
              key={category}
              href={`/places?category=${encodeURIComponent(category)}`}
              className="category-card"
            >
              <span className="category-card__icon">
                <CategoryIcon category={category} />
              </span>
              <span className="category-card__label">
                {categoryLabels[category] || category}
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* 3. REKOMENDASI */}
      <section className="section">
        <SectionHeader
          title="Rekomendasi minggu ini"
          description="Dipilih dari rating, kecepatan, dan jumlah ulasan supaya kunjungan pertama tidak terasa acak."
          action={
            <Link href="/places" className="button button--ghost button--small">
              Lihat semua
            </Link>
          }
        />
        {featured?.error ? (
          <InfoBanner tone="danger">{featured.error}</InfoBanner>
        ) : null}
        {featured?.loading ? (
          <LoadingGrid />
        ) : featured?.items?.length ? (
          <div className="place-grid">
            {featured?.items?.map((place) => (
              <PlaceCard key={place.id} place={place} showBadge={false} />
            ))}
          </div>
        ) : (
          <InfoBanner tone="muted">Belum ada rekomendasi — coba muat ulang atau cek koneksi API.</InfoBanner>
        )}
      </section>

      {/* 4. KONTRIBUSI */}
      <section className="contribute-banner">
        <div>
          <h2>Bantu komunitas Bandar Lampung</h2>
          <p>
            Punya info tempat WiFi publik yang valid? Kirim tempat baru atau
            tambah ulasan supaya direktori tetap akurat.
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
