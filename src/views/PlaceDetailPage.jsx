"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { createReview, getPlace, submitWifiCredential, rateWifiCredential } from "../api";
import { bandOptions, localizeLabel, passwordSourceOptions } from "../lib/constants";
import { buildMapsUrl, formatDate, formatMbps } from "../lib/format";
import { useAuth } from "../lib/useAuth";
import {
  EmptyState,
  InfoBanner,
  LoadingGrid,
  LockGate,
  MetricRow,
  MetricTile,
  ReviewCard,
  SectionHeader,
  StarMeter,
} from "../components/ui";
import { SpeedTestWidget } from "../components/SpeedTestWidget";
import { SelectField } from "../components/FormControls";
import { useToast } from "../components/Toast";
import { compressReviewImage } from "../lib/browserImage";

const ratingOptions = [1, 2, 3, 4, 5];
const maxReviewImageBytes = 350 * 1024;

function StarRatingInput({ label, value, onChange }) {
  const [hover, setHover] = useState(null);
  return (
    <label className="field star-input">
      <span>{label}</span>
      <span className="star-input__stars" onMouseLeave={() => setHover(null)}>
        {ratingOptions.map((n) => (
          <button
            key={n}
            type="button"
            className={`star-input__star${(hover ?? value) >= n ? " is-filled" : ""}`}
            onMouseEnter={() => setHover(n)}
            onClick={() => onChange(n)}
            aria-label={`${label}: ${n} dari 5`}
          >
            ★
          </button>
        ))}
      </span>
    </label>
  );
}

const emptyPlaceState = {
  loading: true,
  error: "",
  place: null,
  source: "",
};

export function PlaceDetailPage({ placeId, initialState = emptyPlaceState }) {
  const auth = useAuth();
  const toast = useToast();
  const [state, setState] = useState(initialState);
  const [reviewForm, setReviewForm] = useState({
    authorName: "",
    reviewTitle: "",
    ratingSpeed: 5,
    ratingComfort: 5,
    imageUrl: "",
    comment: "",
  });
  const [sendingReview, setSendingReview] = useState(false);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [wifiForm, setWifiForm] = useState({ ssid: "", band: "auto", password: "", passwordSource: "", accessNotes: "" });
  const [sendingWifi, setSendingWifi] = useState(false);
  const [showAllWifi, setShowAllWifi] = useState(false);
  const [wifiRaters, setWifiRaters] = useState({}); // credId -> { rating, comment }
  const [showWifiForm, setShowWifiForm] = useState(false);
  const [showReviewForm, setShowReviewForm] = useState(false);

  async function refreshPlace() {
    const refreshed = await getPlace(placeId);
    setState((current) => ({
      ...current,
      place: refreshed.data,
      source: refreshed.meta.source,
    }));
  }

  function handleReviewSubmit(event) {
    event.preventDefault();
    if (!auth.user) {
      toast.error("Login Google diperlukan sebelum mengirim ulasan.");
      return;
    }
    setShowRatingModal(true);
  }

  async function confirmReview() {
    setSendingReview(true);
    try {
      await createReview({
        placeId: Number(placeId),
        reviewTitle: reviewForm.reviewTitle || "Ulasan pengunjung",
        ratingSpeed: Number(reviewForm.ratingSpeed),
        ratingComfort: Number(reviewForm.ratingComfort),
        imageUrl: reviewForm.imageUrl,
        comment: reviewForm.comment,
      });
      await refreshPlace();
      setReviewForm({ authorName: "", reviewTitle: "", ratingSpeed: 5, ratingComfort: 5, imageUrl: "", comment: "" });
      setShowRatingModal(false);
      toast.success("Ulasan terkirim dan tampil di halaman.");
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSendingReview(false);
    }
  }

  async function handleReviewImageChange(event) {
    const file = event.target.files?.[0];
    if (!file) { setReviewForm((c) => ({ ...c, imageUrl: "" })); return; }
    if (!file.type.startsWith("image/")) { toast.error("File harus berupa gambar."); event.target.value = ""; return; }
    if (file.size > maxReviewImageBytes) { toast.error("Ukuran foto maksimal 350 KB."); event.target.value = ""; return; }
    try {
      const imageUrl = await compressReviewImage(file);
      setReviewForm((c) => ({ ...c, imageUrl }));
    } catch (error) { toast.error(error.message); }
  }

  async function handleWifiSubmit(event) {
    event.preventDefault();
    if (!auth.user) { toast.error("Login Google diperlukan sebelum mengirim WiFi."); return; }
    if (!wifiForm.ssid.trim()) { toast.error("SSID wajib diisi."); return; }
    if (wifiForm.password && !wifiForm.passwordSource) { toast.error("Sumber password wajib saat password diisi."); return; }
    setSendingWifi(true);
    try {
      await submitWifiCredential(placeId, {
        ssid: wifiForm.ssid.trim(),
        band: wifiForm.band,
        password: wifiForm.password || null,
        passwordSource: wifiForm.passwordSource || null,
      });
      await refreshPlace();
      setWifiForm({ ssid: "", band: "auto", password: "", passwordSource: "", accessNotes: "" });
      toast.success("WiFi terkirim, menunggu moderasi admin.");
    } catch (error) { toast.error(error.message); } finally { setSendingWifi(false); }
  }

  async function handleWifiRating(credId) {
    const draft = wifiRaters[credId] || { rating: 5, comment: "" };
    if (!auth.user) { toast.error("Login diperlukan untuk rating WiFi."); return; }
    if (draft.comment && draft.comment.length > 0 && draft.comment.length < 12) { toast.error("Komentar rating minimal 12 karakter."); return; }
    try {
      await rateWifiCredential(credId, { rating: Number(draft.rating), comment: draft.comment || null });
      await refreshPlace();
      toast.success("Rating WiFi terkirim!");
      setWifiRaters((c) => ({ ...c, [credId]: { rating: 5, comment: "" } }));
    } catch (error) { toast.error(error.message); }
  }

  useEffect(() => {
    if (!state.error || state.place) return;
    let active = true;
    (async () => {
      try {
        const refreshed = await getPlace(placeId);
        if (!active) return;
        setState({ loading: false, error: "", place: refreshed.data, source: refreshed.meta.source });
      } catch { if (!active) return; }
    })();
    return () => { active = false; };
  }, [state.error, state.place, placeId]);

  useEffect(() => {
    if (!showRatingModal) return;
    function onKeyDown(event) {
      if (event.key === "Escape") setShowRatingModal(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [showRatingModal]);

  if (state.loading) {
    return <main className="page"><section className="section"><LoadingGrid /></section></main>;
  }
  if (state.error || !state.place) {
    return (
      <main className="page">
        <section className="section">
          <InfoBanner tone="danger">{state.error || "Tempat tidak ditemukan"}</InfoBanner>
          <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
            <button className="button button--primary" onClick={async () => {
              try {
                setState((c) => ({ ...c, loading: true, error: "" }));
                const r = await getPlace(placeId);
                setState({ loading: false, error: "", place: r.data, source: r.meta.source });
              } catch (e) { setState((c) => ({ ...c, loading: false, error: e.message })); }
            }}>Coba lagi</button>
            <Link href="/places" className="button button--ghost">Kembali ke daftar</Link>
          </div>
        </section>
      </main>
    );
  }

  const place = state.place;
  const isHype = Boolean(place.is_hype);
  const wifiCreds = place.wifi_credentials || [];
  const visibleWifi = showAllWifi ? wifiCreds : wifiCreds.slice(0, 2);
  const needsLoginForPw = isHype && !auth.user;

  return (
    <main className="page">
      <section className="section detail-page">
        <div className="detail-page__main">
          <div className={`detail-hero tone--${place.image_tone || "lagoon"}`}>
            <div className="detail-hero__media">
              {place.image_url?.startsWith('http') ? <Image src={place.image_url} alt="" width={960} height={620} sizes="(max-width: 900px) 100vw, 760px" priority /> : place.image_url ? <img src={place.image_url} alt="" /> : null}
            </div>
            <div className="detail-hero__content">
              <h1>{place.name}</h1>
              <div className="detail-hero__grid">
                <div className="detail-hero__grid-left">
                  <p>{place.address}</p>
                  {isHype ? (
                    <div><strong>Tempat hype</strong><span> (password hanya tampil jika login).</span></div>
                  ) : null}
                  <p className="detail-hero__hours">{place.operating_hours || "Jam operasional belum tersedia."}</p>
                </div>
                <div className="detail-hero__grid-right">
                  <div className="detail-hero__meta">
                    <span>{place.district}</span>
                    <span className="detail-hero__meta-dot" aria-hidden="true">·</span>
                    <span className="detail-hero__meta-rating">★ {place.avg_rating.toFixed(1)}</span>
                    <span className="detail-hero__meta-dot" aria-hidden="true">·</span>
                    <span>{place.review_count} ulasan</span>
                    {place.wifi_ssid ? (
                      <>
                        <span className="detail-hero__meta-dot" aria-hidden="true">·</span>
                        <span>SSID {place.wifi_ssid}</span>
                      </>
                    ) : null}
                  </div>
                  {place.submitter_name ? <p className="contributor-credit">Dikontribusikan oleh {place.submitter_name}</p> : null}
                </div>
              </div>
              <p className="detail-hero__context">{place.map_context || "Catatan lokasi dari kontributor belum ada."}</p>
              <div className="detail-hero__location">
                <div className="map-card__visual"><div className="map-pin" /></div>
                <div><h2>Konteks lokasi</h2><p>{place.map_context || "Catatan peta belum ada."}</p><a href={buildMapsUrl(place)} target="_blank" rel="noreferrer" className="button button--ghost">Lihat di peta</a></div>
              </div>
            </div>
          </div>

          <div className="detail-grid">
            <article className="panel">
              <SectionHeader title="Akses WiFi" description={isHype ? "Tempat hype (password hanya untuk user login)." : "Menampilkan SSID & password terverifikasi."} />
              <div className="metric-stack">
                <MetricRow label="Metode akses" value={localizeLabel(place.wifi_access_type) || "Perlu update"} />
                {needsLoginForPw ? (
                  <LockGate
                    rows={[
                      { label: "SSID utama", value: "••••••••••" },
                      { label: "Password utama", value: "••••••••••" },
                    ]}
                    description="Masuk untuk melihat SSID & password WiFi."
                  />
                ) : (
                  <>
                    {/* legacy single password (masked if hype) */}
                    <MetricRow label="SSID utama" value={place.wifi_ssid || "Belum ada SSID"} />
                    <MetricRow label="Password utama" value={place.wifi_password || "Tidak ada password publik"} note="Ditampilkan hanya untuk akses publik, disetujui pemilik, atau dikonfirmasi staf." />
                  </>
                )}
                <MetricRow label="Sumber password" value={localizeLabel(place.password_source) || "Tidak ada password publik"} />
                <MetricRow label="Catatan" value={place.access_notes || "Tidak ada catatan tambahan"} />
              </div>
            </article>

            <article className="panel">
              <h2>Suasana dan kualitas</h2>
              <div className="quality-grid">
                <MetricTile label="Unduh" value={place.wifi_speed_mbps ? `${formatMbps(place.wifi_speed_mbps)} Mbps` : "Menunggu"} />
                <MetricTile label="Unggah" value={place.upload_mbps ? `${formatMbps(place.upload_mbps)} Mbps` : "Menunggu"} />
                <MetricTile label="Ping" value={place.ping_ms ? `${place.ping_ms} ms` : "Menunggu"} />
                <MetricTile label="Suasana" value={localizeLabel(place.ambience_label) || "Menunggu"} />
              </div>
              <div className="quality-grid">
                <StarMeter label="Rating kecepatan" value={place.avg_speed_rating} />
                <StarMeter label="Rating kenyamanan" value={place.avg_comfort_rating} />
              </div>
            </article>
          </div>

          <SpeedTestWidget
            place={place}
            placeId={place.id}
            initialStats={place.speed_stats}
            initialTests={place.speed_tests}
            approvedSsids={wifiCreds}
            onSaved={refreshPlace}
          />

          {/* WiFi credentials multi-SSID */}
          <article className="panel">
            <SectionHeader title="Kredensial WiFi" description="Tampil 2 SSID terbaru. Tiap SSID bisa di-rating 1-5 + review. Isi form di bawah untuk menambah SSID baru (butuh moderasi)." />
            {wifiCreds.length ? (
              needsLoginForPw ? (
                <LockGate
                  rows={visibleWifi.map((cred) => ({
                    label: cred.band ? `SSID ${cred.band}` : "SSID",
                    value: "••••••••••",
                  }))}
                  description="Masuk untuk melihat SSID & password lengkap."
                />
              ) : (
                <>
                  <div className="wifi-cred-list">
                    {visibleWifi.map((cred) => (
                      <div key={cred.id} className="wifi-cred-card">
                        <div className="wifi-cred-card__head">
                          <strong>{cred.ssid}</strong>
                          <span className="wifi-cred-card__band">{cred.band || "auto"}</span>
                          <span className="wifi-cred-card__rating">
                            {cred.avg_rating
                              ? `★ ${Number(cred.avg_rating).toFixed(1)} / 5 (${cred.rating_count} rating)`
                              : "Belum dirating"}
                          </span>
                        </div>
                        <div className="wifi-cred-card__body">
                          <MetricRow label="Password" value={cred.password || "Open network"} />
                          <MetricRow label="Sumber" value={localizeLabel(cred.password_source) || "-"} />
                          <p className="wifi-cred-card__meta">Oleh {cred.submitted_by_name} — {formatDate(cred.created_at)}</p>
                          {cred.ratings?.length ? (
                            <div className="wifi-cred-card__ratings">
                              {cred.ratings.slice(0,3).map((r) => (
                                <div key={r.id} className="wifi-rating-mini">
                                  <strong>{r.rater_name}</strong> <span>{r.rating}/5</span> — <span>{r.comment || ""}</span> <small>{formatDate(r.created_at)}</small>
                                </div>
                              ))}
                              {cred.ratings.length > 3 ? <small>+{cred.ratings.length - 3} rating lain</small> : null}
                            </div>
                          ) : null}
                          <div className="wifi-rating-form">
                            <StarRatingInput
                              label="Rating"
                              value={(wifiRaters[cred.id]?.rating) ?? 5}
                              onChange={(n) => setWifiRaters((c) => ({ ...c, [cred.id]: { ...(c[cred.id] || { rating: 5, comment: "" }), rating: n } }))}
                            />
                            <label className="field field--inline">
                              <span>Komentar (opsional, min 12)</span>
                              <input value={(wifiRaters[cred.id]?.comment) ?? ""} onChange={(e) => setWifiRaters((c) => ({ ...c, [cred.id]: { ... (c[cred.id] || { rating: 5, comment: "" }), comment: e.target.value } }))} placeholder="WiFi kencang / sering putus..." />
                            </label>
                            <button type="button" className="button button--ghost button--small" onClick={() => handleWifiRating(cred.id)}>Beri rating</button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  {wifiCreds.length > 2 ? (
                    <button type="button" className="button button--ghost button--small" onClick={() => setShowAllWifi((v) => !v)} style={{ marginTop: 12 }}>
                      {showAllWifi ? "Tampilkan 2 saja" : `Lihat ${wifiCreds.length - 2} lainnya (${wifiCreds.length} total)`}
                    </button>
                  ) : null}
                </>
              )
            ) : (
              <EmptyState title="Belum ada SSID terverifikasi." description="Jadilah yang pertama menambahkan SSID + password untuk lokasi ini." />
            )}

            <div style={{ marginTop: 24 }}>
              {!showWifiForm ? (
                <button
                  type="button"
                  className="button button--ghost"
                  onClick={() => setShowWifiForm(true)}
                  style={{ width: "100%" }}
                >
                  Tambah SSID / Password Baru
                </button>
              ) : (
                <>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <SectionHeader title="Tambah SSID / Password" description="SSIDs bisa multi (2.4GHz/5GHz). Password butuh sumber. Masuk moderasi sebelum tampil publik." />
                    <button
                      type="button"
                      className="button button--ghost button--small"
                      onClick={() => setShowWifiForm(false)}
                    >
                      Tutup
                    </button>
                  </div>
                  <form className="wifi-form" onSubmit={handleWifiSubmit} style={{ display: "grid", gap: 12, marginTop: 12 }}>
                    <div className="submit-form__grid">
                      <div className="field"><span>SSID *</span><input value={wifiForm.ssid} onChange={(e) => setWifiForm((c) => ({ ...c, ssid: e.target.value }))} placeholder="contoh: KopiJiwa-5G" required maxLength={32} /></div>
                      <div className="field"><span>Band</span><SelectField name="band" value={wifiForm.band} onChange={(e) => setWifiForm((c) => ({ ...c, band: e.target.value }))} options={bandOptions.map((b) => ({ value: b, label: b }))} /></div>
                    </div>
                    <div className="submit-form__grid">
                      <div className="field"><span>Password (kosongkan jika open)</span><input value={wifiForm.password} onChange={(e) => setWifiForm((c) => ({ ...c, password: e.target.value }))} placeholder="Hanya jika publik / disetujui" /></div>
                      <div className="field"><span>Sumber password * jika ada password</span><SelectField name="passwordSource" value={wifiForm.passwordSource} onChange={(e) => setWifiForm((c) => ({ ...c, passwordSource: e.target.value }))} placeholder="Pilih sumber" allowEmpty options={passwordSourceOptions.map((o) => ({ value: o, label: localizeLabel(o) }))} /></div>
                    </div>
                    <button type="submit" className="button button--primary" disabled={sendingWifi}>{sendingWifi ? "Mengirim..." : "Kirim WiFi untuk moderasi"}</button>
                  </form>
                </>
              )}
            </div>
          </article>

          <article className="panel">
            <SectionHeader
              title="Ulasan Pengunjung"
              description="Rating kecepatan dan kenyamanan dipisah agar tempat cepat tapi ramai tetap terlihat jujur."
            />

            <div className="review-list">
              {place.reviews?.length ? place.reviews.map((review) => <ReviewCard key={review.id} review={review} />) : <EmptyState title="Belum ada ulasan." description="Ulasan pertama membantu pengunjung berikutnya." />}
            </div>

            {showReviewForm ? (
              <div style={{ marginTop: 24, paddingTop: 24, borderTop: "1px solid var(--border-color)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <h3 style={{ margin: 0, fontSize: "1.1rem" }}>Tambahkan laporan kecepatan dan kenyamanan</h3>
                  <button
                    type="button"
                    className="button button--ghost button--small"
                    onClick={() => setShowReviewForm(false)}
                  >
                    Batal
                  </button>
                </div>
                <form className="review-form" onSubmit={handleReviewSubmit}>
                  <label className="field"><span>Komentar</span><textarea value={reviewForm.comment} onChange={(e) => setReviewForm((c) => ({ ...c, comment: e.target.value }))} placeholder="Ceritakan stabilitas koneksi, kebisingan, colokan, atau area duduk terbaik." required /></label>
                  <label className="field"><span>Foto ulasan</span><input type="file" accept="image/*" onChange={handleReviewImageChange} /></label>
                  {reviewForm.imageUrl ? <img className="review-form__preview" src={reviewForm.imageUrl} alt="Preview foto ulasan" /> : null}
                  <button type="submit" className="button button--primary" disabled={sendingReview}>{sendingReview ? "Mengirim..." : "Terbitkan ulasan"}</button>
                </form>
              </div>
            ) : (
              <div style={{ marginTop: 20, display: "flex", justifyContent: "center" }}>
                <button
                  type="button"
                  className="button button--primary"
                  onClick={() => setShowReviewForm(true)}
                  style={{ width: "100%", maxWidth: "320px" }}
                >
                  Tulis Ulasan & Laporan
                </button>
              </div>
            )}
          </article>

          <article className="panel">
            <h2>Rekomendasi terdekat</h2>
            <div className="related-list">
              {place.related_places?.map((item) => <Link key={item.id} href={`/places/${item.id}`} className="related-card"><strong>{item.name}</strong><span>{formatMbps(item.wifi_speed_mbps)} Mbps</span></Link>)}
            </div>
          </article>
        </div>
      </section>

      {showRatingModal ? (
        <div
          className="review-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="review-rating-title"
          onClick={(event) => {
            if (event.target === event.currentTarget) setShowRatingModal(false);
          }}
        >
          <div className="review-modal__card">
            <h2 id="review-rating-title">Beri rating dulu</h2>
            <p>Pilih bintang kecepatan dan kenyamanan sebelum ulasan terbit.</p>
            <StarRatingInput
              label="Rating kecepatan"
              value={reviewForm.ratingSpeed}
              onChange={(n) => setReviewForm((c) => ({ ...c, ratingSpeed: n }))}
            />
            <StarRatingInput
              label="Rating kenyamanan"
              value={reviewForm.ratingComfort}
              onChange={(n) => setReviewForm((c) => ({ ...c, ratingComfort: n }))}
            />
            <div className="review-modal__actions">
              <button type="button" className="button button--ghost" onClick={() => setShowRatingModal(false)}>Batal</button>
              <button type="button" className="button button--primary" disabled={sendingReview} onClick={confirmReview}>{sendingReview ? "Mengirim..." : "Terbitkan ulasan"}</button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
