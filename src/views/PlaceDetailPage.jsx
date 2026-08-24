"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { createReview, getPlace } from "../api";
import { localizeLabel } from "../lib/constants";
import { buildMapsUrl, formatMbps } from "../lib/format";
import { useAuth } from "../lib/useAuth";
import {
  EmptyState,
  InfoBanner,
  LoadingGrid,
  MetricRow,
  MetricTile,
  ReviewCard,
  SectionHeader,
  StarMeter,
  StatusPill,
} from "../components/ui";
import { LoginGate } from "../components/LoginGate";
import { compressReviewImage } from "../lib/browserImage";

const ratingOptions = [1, 2, 3, 4, 5];
const maxReviewImageBytes = 350 * 1024;

const emptyPlaceState = {
  loading: true,
  error: "",
  place: null,
  source: "",
};

export function PlaceDetailPage({ placeId, initialState = emptyPlaceState }) {
  const auth = useAuth();
  const [state, setState] = useState(initialState);
  const [reviewForm, setReviewForm] = useState({
    authorName: "",
    reviewTitle: "",
    ratingSpeed: 5,
    ratingComfort: 5,
    imageUrl: "",
    comment: "",
  });
  const [reviewMessage, setReviewMessage] = useState({ tone: "", text: "" });
  const [sendingReview, setSendingReview] = useState(false);

  async function handleReviewSubmit(event) {
    event.preventDefault();
    if (!auth.user) {
      setReviewMessage({
        tone: "danger",
        text: "Login Google diperlukan sebelum mengirim ulasan.",
      });
      return;
    }
    setSendingReview(true);
    setReviewMessage({ tone: "", text: "" });

    try {
      await createReview({
        placeId: Number(placeId),
        reviewTitle: reviewForm.reviewTitle,
        ratingSpeed: Number(reviewForm.ratingSpeed),
        ratingComfort: Number(reviewForm.ratingComfort),
        imageUrl: reviewForm.imageUrl,
        comment: reviewForm.comment,
      });

      const refreshed = await getPlace(placeId);
      setState((current) => ({
        ...current,
        place: refreshed.data,
        source: refreshed.meta.source,
      }));
      setReviewForm({
        authorName: "",
        reviewTitle: "",
        ratingSpeed: 5,
        ratingComfort: 5,
        imageUrl: "",
        comment: "",
      });
      setReviewMessage({
        tone: "success",
        text: "Ulasan terkirim dan tampil di halaman.",
      });
    } catch (error) {
      setReviewMessage({ tone: "danger", text: error.message });
    } finally {
      setSendingReview(false);
    }
  }

  async function handleReviewImageChange(event) {
    const file = event.target.files?.[0];

    if (!file) {
      setReviewForm((current) => ({ ...current, imageUrl: "" }));
      return;
    }

    if (!file.type.startsWith("image/")) {
      setReviewMessage({ tone: "danger", text: "File harus berupa gambar." });
      event.target.value = "";
      return;
    }

    if (file.size > maxReviewImageBytes) {
      setReviewMessage({
        tone: "danger",
        text: "Ukuran foto maksimal 350 KB.",
      });
      event.target.value = "";
      return;
    }

    try {
      const imageUrl = await compressReviewImage(file);
      setReviewMessage({ tone: "", text: "" });
      setReviewForm((current) => ({ ...current, imageUrl }));
    } catch (error) {
      setReviewMessage({ tone: "danger", text: error.message });
    }
  }

  if (state.loading) {
    return (
      <main className="page">
        <section className="section">
          <LoadingGrid />
        </section>
      </main>
    );
  }

  if (state.error || !state.place) {
    return (
      <main className="page">
        <section className="section">
          <InfoBanner tone="danger">
            {state.error || "Tempat tidak ditemukan"}
          </InfoBanner>
        </section>
      </main>
    );
  }

  const place = state.place;

  return (
    <main className="page">
      <section className="section detail-page">
        <div className="detail-page__main">
          <div className={`detail-hero tone--${place.image_tone || "lagoon"}`}>
            <div className="detail-hero__media">
              {place.image_url ? (
                <Image
                  src={place.image_url}
                  alt=""
                  width={960}
                  height={620}
                  sizes="(max-width: 900px) 100vw, 760px"
                  priority
                />
              ) : null}
            </div>
            <div className="detail-hero__content">
              <h1>{place.name}</h1>
              <p>{place.address}</p>
              <p className="detail-hero__hours">
                {place.operating_hours || "Jam operasional belum tersedia."}
              </p>
              <div className="detail-hero__meta">
                <StatusPill tone="muted">{place.district}</StatusPill>
                <StatusPill tone="warning">
                  {place.avg_rating.toFixed(1)} / 5
                </StatusPill>
                <StatusPill tone="muted">
                  {place.review_count} ulasan
                </StatusPill>
              </div>
              {place.submitter_name ? (
                <p className="contributor-credit">
                  Dikontribusikan oleh {place.submitter_name}
                </p>
              ) : null}
              <p className="detail-hero__context">
                {place.map_context ||
                  "Catatan lokasi dari kontributor belum ada."}
              </p>
              <div className="detail-hero__location">
                <div className="map-card__visual">
                  <div className="map-pin" />
                </div>
                <div>
                  <h2>Konteks lokasi</h2>
                  <p>{place.map_context || "Catatan peta belum ada."}</p>
                  <a
                    href={buildMapsUrl(place)}
                    target="_blank"
                    rel="noreferrer"
                    className="button button--ghost"
                  >
                    Lihat di peta
                  </a>
                </div>
              </div>
            </div>
          </div>

          <div className="detail-grid">
            <article className="panel">
              <h2>Akses WiFi</h2>
              <div className="metric-stack">
                <MetricRow
                  label="Metode akses"
                  value={
                    localizeLabel(place.wifi_access_type) || "Perlu update"
                  }
                />
                <MetricRow
                  label="Password"
                  value={place.wifi_password || "Tidak ada password publik"}
                  note="Ditampilkan hanya untuk akses publik, disetujui pemilik, atau dikonfirmasi staf."
                />
                <MetricRow
                  label="Sumber password"
                  value={
                    localizeLabel(place.password_source) ||
                    "Tidak ada password publik"
                  }
                />
                <MetricRow
                  label="Catatan"
                  value={place.access_notes || "Tidak ada catatan tambahan"}
                />
              </div>
            </article>

            <article className="panel">
              <h2>Suasana dan kualitas</h2>
              <div className="quality-grid">
                <MetricTile
                  label="Unduh"
                  value={
                    place.wifi_speed_mbps
                      ? `${formatMbps(place.wifi_speed_mbps)} Mbps`
                      : "Menunggu"
                  }
                />
                <MetricTile
                  label="Unggah"
                  value={
                    place.upload_mbps
                      ? `${formatMbps(place.upload_mbps)} Mbps`
                      : "Menunggu"
                  }
                />
                <MetricTile
                  label="Ping"
                  value={place.ping_ms ? `${place.ping_ms} ms` : "Menunggu"}
                />
                <MetricTile
                  label="Suasana"
                  value={localizeLabel(place.ambience_label) || "Menunggu"}
                />
              </div>
              <div className="quality-grid">
                <StarMeter
                  label="Rating kecepatan"
                  value={place.avg_speed_rating}
                />
                <StarMeter
                  label="Rating kenyamanan"
                  value={place.avg_comfort_rating}
                />
              </div>
            </article>
          </div>

          <article className="panel">
            <SectionHeader
              title="Kata Pengunjung"
              description="Rating kecepatan dan kenyamanan dipisah agar tempat cepat tapi ramai tetap terlihat jujur."
            />
            <div className="review-list">
              {place.reviews?.length ? (
                place.reviews.map((review) => (
                  <ReviewCard key={review.id} review={review} />
                ))
              ) : (
                <EmptyState
                  title="Belum ada ulasan."
                  description="Ulasan pertama membantu pengunjung berikutnya."
                />
              )}
            </div>
          </article>

          <article className="panel">
            <SectionHeader
              title="Tambahkan laporan kecepatan dan kenyamanan"
              description="Rating harus antara 1 sampai 5. Tulis komentar yang praktis dan spesifik."
            />
            {reviewMessage.text ? (
              <InfoBanner tone={reviewMessage.tone}>
                {reviewMessage.text}
              </InfoBanner>
            ) : null}
            <LoginGate {...auth} />
            <form className="review-form" onSubmit={handleReviewSubmit}>
              <label className="field">
                <span>Judul ulasan</span>
                <input
                  value={reviewForm.reviewTitle}
                  onChange={(event) =>
                    setReviewForm((current) => ({
                      ...current,
                      reviewTitle: event.target.value,
                    }))
                  }
                  placeholder="Contoh: WiFi kencang buat deadline"
                  required
                />
              </label>
              <div className="review-form__grid">
                <label className="field">
                  <span>Rating kecepatan</span>
                  <select
                    value={reviewForm.ratingSpeed}
                    onChange={(event) =>
                      setReviewForm((current) => ({
                        ...current,
                        ratingSpeed: Number(event.target.value),
                      }))
                    }
                  >
                    {ratingOptions.map((value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>Rating kenyamanan</span>
                  <select
                    value={reviewForm.ratingComfort}
                    onChange={(event) =>
                      setReviewForm((current) => ({
                        ...current,
                        ratingComfort: Number(event.target.value),
                      }))
                    }
                  >
                    {ratingOptions.map((value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <label className="field">
                <span>Komentar</span>
                <textarea
                  value={reviewForm.comment}
                  onChange={(event) =>
                    setReviewForm((current) => ({
                      ...current,
                      comment: event.target.value,
                    }))
                  }
                  placeholder="Ceritakan stabilitas koneksi, kebisingan, colokan, atau area duduk terbaik."
                  required
                />
              </label>
              <label className="field">
                <span>Foto ulasan</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleReviewImageChange}
                />
              </label>
              {reviewForm.imageUrl ? (
                <img
                  className="review-form__preview"
                  src={reviewForm.imageUrl}
                  alt="Preview foto ulasan"
                />
              ) : null}
              <button
                type="submit"
                className="button button--primary"
                disabled={sendingReview}
              >
                {sendingReview ? "Mengirim..." : "Terbitkan ulasan"}
              </button>
            </form>
          </article>

          <article className="panel">
            <h2>Rekomendasi terdekat</h2>
            <div className="related-list">
              {place.related_places?.map((item) => (
                <Link
                  key={item.id}
                  href={`/places/${item.id}`}
                  className="related-card"
                >
                  <strong>{item.name}</strong>
                  <span>{formatMbps(item.wifi_speed_mbps)} Mbps</span>
                </Link>
              ))}
            </div>
          </article>
        </div>
      </section>
    </main>
  );
}
