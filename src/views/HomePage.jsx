"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getPlaces } from "../api";
import {
  BookOpen,
  Coffee,
  GraduationCap,
  Monitor,
  TreePine,
  UtensilsCrossed,
} from "lucide-react";
import {
  categoryOptions,
  categoryLabels,
  quickFilters,
} from "../lib/constants";
import {
  InfoBanner,
  LoadingGrid,
  PlaceCard,
  SectionHeader,
} from "../components/ui";

export function HomePage({ initialFeatured }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
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
  }, []);

  function handleHeroSubmit(event) {
    event.preventDefault();
    const params = new URLSearchParams();
    if (search.trim()) {
      params.set("q", search.trim());
    }
    router.push(`/places${params.toString() ? `?${params.toString()}` : ""}`);
  }

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
            publik di Bandar Lampung — lengkap dengan laporan kecepatan dan
            ulasan komunitas.
          </p>

          <form className="hero-search" onSubmit={handleHeroSubmit}>
            <label className="sr-only" htmlFor="hero-search">
              Cari tempat
            </label>
            <input
              id="hero-search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Cari tempat, kecamatan, atau suasana kerja"
            />
            <button type="submit" className="button button--primary">
              Cari
            </button>
          </form>

          <div className="hero-panel__chips">
            {quickFilters.map((filter) => (
              <Link
                key={filter.label}
                className="quick-chip"
                href={`/places?${new URLSearchParams(filter.query).toString()}`}
              >
                <strong>{filter.label}</strong>
                <span>{filter.description}</span>
              </Link>
            ))}
          </div>
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
                {categoryIcon(category)}
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
              <PlaceCard key={place.id} place={place} />
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

function categoryIcon(category) {
  const size = 28;
  const icons = {
    "Cafe / Coffee Shop": <Coffee size={size} />,
    "Coworking Space": <Monitor size={size} />,
    Library: <BookOpen size={size} />,
    "Campus Lounge": <GraduationCap size={size} />,
    Restaurant: <UtensilsCrossed size={size} />,
    "Rest Area": <TreePine size={size} />,
  };
  return icons[category] || <Monitor size={size} />;
}
