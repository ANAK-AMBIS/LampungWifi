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
  MetricRow,
  MetricTile,
  ReviewCard,
  SectionHeader,
  StarMeter,
  StatusPill,
} from "../components/ui";
import { LoginGate } from "../components/LoginGate";
import { UserBadge } from "../components/UserBadge";
import dynamic from "next/dynamic";
import { compressReviewImage } from "../lib/browserImage";

const SpeedTestWidget = dynamic(
  () => import("../components/SpeedTestWidget").then((m) => m.SpeedTestWidget),
  { ssr: false, loading: () => <LoadingGrid /> },
);

const ratingOptions = [1, 2, 3, 4, 5];
const maxReviewImageBytes = 350 * 1024;

const emptyPlaceState = {
  loading: true,
  error: "",
  place: null,
  source: "",
};

function BandBadge({ band }) {
  const tone = band === "5GHz" ? "info" : band === "2.4GHz" ? "success" : band === "6GHz" ? "warning" : "muted";
  return <StatusPill tone={tone}>{band || "auto"}</StatusPill>;
}

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
  const [wifiForm, setWifiForm] = useState({ ssid: "", band: "auto", password: "", passwordSource: "", accessNotes: "" });
  const [wifiMessage, setWifiMessage] = useState({ tone: "", text: "" });
  const [sendingWifi, setSendingWifi] = useState(false);
  const [showAllWifi, setShowAllWifi] = useState(false);
  const [wifiRaters, setWifiRaters] = useState({}); // credId -> { rating, comment }
  const [wifiRateMsg, setWifiRateMsg] = useState({ tone: "", text: "" });

  async function refreshPlace() {
    const refreshed = await getPlace(placeId);
    setState((current) => ({
      ...current,
      place: refreshed.data,
      source: refreshed.meta.source,
    }));
  }

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
      await refreshPlace();
      setReviewForm({ authorName: "", reviewTitle: "", ratingSpeed: 5, ratingComfort: 5, imageUrl: "", comment: "" });
      setReviewMessage({ tone: "success", text: "Ulasan terkirim dan tampil di halaman." });
    } catch (error) {
      setReviewMessage({ tone: "danger", text: error.message });
    } finally {
      setSendingReview(false);
    }
  }

  async function handleReviewImageChange(event) {
    const file = event.target.files?.[0];
    if (!file) { setReviewForm((c) => ({ ...c, imageUrl: "" })); return; }
    if (!file.type.startsWith("image/")) { setReviewMessage({ tone: "danger", text: "File harus berupa gambar." }); event.target.value = ""; return; }
    if (file.size > maxReviewImageBytes) { setReviewMessage({ tone: "danger", text: "Ukuran foto maksimal 350 KB." }); event.target.value = ""; return; }
    try {
      const imageUrl = await compressReviewImage(file);
      setReviewMessage({ tone: "", text: "" });
      setReviewForm((c) => ({ ...c, imageUrl }));
    } catch (error) { setReviewMessage({ tone: "danger", text: error.message }); }
  }

  async function handleWifiSubmit(event) {
    event.preventDefault();
    if (!auth.user) { setWifiMessage({ tone: "danger", text: "Login Google diperlukan sebelum mengirim WiFi." }); return; }
    if (!wifiForm.ssid.trim()) { setWifiMessage({ tone: "danger", text: "SSID wajib diisi." }); return; }
    if (wifiForm.password && !wifiForm.passwordSource) { setWifiMessage({ tone: "danger", text: "Sumber password wajib saat password diisi." }); return; }
    setSendingWifi(true); setWifiMessage({ tone: "", text: "" });
    try {
      await submitWifiCredential(placeId, {
        ssid: wifiForm.ssid.trim(),
        band: wifiForm.band,
        password: wifiForm.password || null,
        passwordSource: wifiForm.passwordSource || null,
      });
      await refreshPlace();
      setWifiForm({ ssid: "", band: "auto", password: "", passwordSource: "", accessNotes: "" });
      setWifiMessage({ tone: "success", text: "WiFi terkirim, menunggu moderasi admin." });
    } catch (error) { setWifiMessage({ tone: "danger", text: error.message }); } finally { setSendingWifi(false); }
  }

  async function handleWifiRating(credId) {
    const draft = wifiRaters[credId] || { rating: 5, comment: "" };
    if (!auth.user) { setWifiRateMsg({ tone: "danger", text: "Login diperlukan untuk rating WiFi." }); return; }
    if (draft.comment && draft.comment.length > 0 && draft.comment.length < 12) { setWifiRateMsg({ tone: "danger", text: "Komentar rating minimal 12 karakter." }); return; }
    try {
      await rateWifiCredential(credId, { rating: Number(draft.rating), comment: draft.comment || null });
      await refreshPlace();
      setWifiRateMsg({ tone: "success", text: "Rating WiFi terkirim!" });
      setWifiRaters((c) => ({ ...c, [credId]: { rating: 5, comment: "" } }));
    } catch (error) { setWifiRateMsg({ tone: "danger", text: error.message }); }
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
              {place.image_url ? <Image src={place.image_url} alt="" width={960} height={620} sizes="(max-width: 900px) 100vw, 760px" priority /> : null}
            </div>
            <div className="detail-hero__content">
              <h1>{place.name} {isHype ? <StatusPill tone="warning">HYPE — Login untuk password</StatusPill> : null}</h1>
              <p>{place.address}</p>
              <p className="detail-hero__hours">{place.operating_hours || "Jam operasional belum tersedia."}</p>
              <div className="detail-hero__meta">
                <StatusPill tone="muted">{place.district}</StatusPill>
                <StatusPill tone="warning">{place.avg_rating.toFixed(1)} / 5</StatusPill>
                <StatusPill tone="muted">{place.review_count} ulasan</StatusPill>
                {place.wifi_ssid ? <StatusPill tone="info">{place.wifi_ssid}</StatusPill> : null}
              </div>
              {place.submitter_name ? (
                <p className="contributor-credit">
                  Dikontribusikan oleh {place.submitter_name}
                  <UserBadge role={place.submitter_role} isTrusted={place.submitter_is_trusted} />
                </p>
              ) : null}
              <p className="detail-hero__context">{place.map_context || "Catatan lokasi dari kontributor belum ada."}</p>
              <div className="detail-hero__location">
                <div className="map-card__visual"><div className="map-pin" /></div>
                <div><h2>Konteks lokasi</h2><p>{place.map_context || "Catatan peta belum ada."}</p><a href={buildMapsUrl(place)} target="_blank" rel="noreferrer" className="button button--ghost">Lihat di peta</a></div>
              </div>
            </div>
          </div>

          <div className="detail-grid">
            <article className="panel">
              <SectionHeader title="Akses WiFi" description={isHype ? "Tempat hype — password hanya untuk user login." : "Menampilkan SSID & password terverifikasi."} />
              <div className="metric-stack">
                <MetricRow label="Metode akses" value={localizeLabel(place.wifi_access_type) || "Perlu update"} />
                {/* legacy single password (masked if hype) */}
                <MetricRow label="SSID utama" value={needsLoginForPw ? "Login untuk lihat SSID" : (place.wifi_ssid || "Belum ada SSID")} />
                <MetricRow label="Password utama" value={needsLoginForPw ? "Login diperlukan" : (place.wifi_password || "Tidak ada password publik")} note="Ditampilkan hanya untuk akses publik, disetujui pemilik, atau dikonfirmasi staf." />
                <MetricRow label="Sumber password" value={localizeLabel(place.password_source) || "Tidak ada password publik"} />
                <MetricRow label="Catatan" value={place.access_notes || "Tidak ada catatan tambahan"} />
              </div>
              {needsLoginForPw ? <InfoBanner tone="warning">Tempat ini hype — login Google untuk melihat SSID & password WiFi.</InfoBanner> : null}
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
            {needsLoginForPw ? <InfoBanner tone="warning">Login untuk melihat SSID & password lengkap.</InfoBanner> : null}
            {wifiCreds.length ? (
              <>
                <div className="wifi-cred-list">
                  {visibleWifi.map((cred) => (
                    <div key={cred.id} className="wifi-cred-card">
                      <div className="wifi-cred-card__head">
                        <strong>{cred.ssid}</strong>
                        <BandBadge band={cred.band} />
                        {cred.avg_rating ? <StatusPill tone="info">{Number(cred.avg_rating).toFixed(1)} / 5 ({cred.rating_count})</StatusPill> : <StatusPill tone="muted">Belum dirating</StatusPill>}
                      </div>
                      <div className="wifi-cred-card__body">
                        <MetricRow label="Password" value={needsLoginForPw ? "•••• (login)" : (cred.password || "Open network")} />
                        <MetricRow label="Sumber" value={localizeLabel(cred.password_source) || "-"} />
                        <p className="wifi-cred-card__meta">
                          Oleh {cred.submitted_by_name}
                          <UserBadge role={cred.submitted_by_role} isTrusted={cred.submitted_by_is_trusted} />
                          {" — "}{formatDate(cred.created_at)}
                        </p>
                        {cred.ratings?.length ? (
                          <div className="wifi-cred-card__ratings">
                            {cred.ratings.slice(0,3).map((r) => (
                              <div key={r.id} className="wifi-rating-mini">
                                                                 <strong>{r.rater_name}</strong>
                                 <UserBadge role={r.rater_role} isTrusted={r.rater_is_trusted} />
                                 {" "}<span>{r.rating}/5</span> — <span>{r.comment || ""}</span> <small>{formatDate(r.created_at)}</small>
                              </div>
                            ))}
                            {cred.ratings.length > 3 ? <small>+{cred.ratings.length - 3} rating lain</small> : null}
                          </div>
                        ) : null}
                        <div className="wifi-rating-form">
                          <label className="field field--inline">
                            <span>Rating</span>
                            <select value={(wifiRaters[cred.id]?.rating) ?? 5} onChange={(e) => setWifiRaters((c) => ({ ...c, [cred.id]: { ... (c[cred.id] || { rating: 5, comment: "" }), rating: Number(e.target.value) } }))}>
                              {ratingOptions.map((v) => <option key={v} value={v}>{v}</option>)}
                            </select>
                          </label>
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
                {wifiRateMsg.text ? <InfoBanner tone={wifiRateMsg.tone} style={{ marginTop: 12 }}>{wifiRateMsg.text}</InfoBanner> : null}
              </>
            ) : (
              <EmptyState title="Belum ada SSID terverifikasi." description="Jadilah yang pertama menambahkan SSID + password untuk lokasi ini." />
            )}

            <div style={{ marginTop: 24 }}>
              <SectionHeader title="Tambah SSID / Password" description="SSIDs bisa multi (2.4GHz/5GHz). Password butuh sumber. Masuk moderasi sebelum tampil publik." />
              {wifiMessage.text ? <InfoBanner tone={wifiMessage.tone}>{wifiMessage.text}</InfoBanner> : null}
              <LoginGate {...auth} />
              <form className="wifi-form" onSubmit={handleWifiSubmit} style={{ display: "grid", gap: 12, marginTop: 12 }}>
                <div className="submit-form__grid">
                  <label className="field"><span>SSID *</span><input value={wifiForm.ssid} onChange={(e) => setWifiForm((c) => ({ ...c, ssid: e.target.value }))} placeholder="contoh: KopiJiwa-5G" required maxLength={32} /></label>
                  <label className="field"><span>Band</span><select value={wifiForm.band} onChange={(e) => setWifiForm((c) => ({ ...c, band: e.target.value }))}>{bandOptions.map((b) => <option key={b} value={b}>{b}</option>)}</select></label>
                </div>
                <div className="submit-form__grid">
                  <label className="field"><span>Password (kosongkan jika open)</span><input value={wifiForm.password} onChange={(e) => setWifiForm((c) => ({ ...c, password: e.target.value }))} placeholder="Hanya jika publik / disetujui" /></label>
                  <label className="field"><span>Sumber password * jika ada password</span><select value={wifiForm.passwordSource} onChange={(e) => setWifiForm((c) => ({ ...c, passwordSource: e.target.value }))}><option value="">Pilih sumber</option>{passwordSourceOptions.map((o) => <option key={o} value={o}>{localizeLabel(o)}</option>)}</select></label>
                </div>
                <button type="submit" className="button button--primary" disabled={sendingWifi}>{sendingWifi ? "Mengirim..." : "Kirim WiFi untuk moderasi"}</button>
              </form>
            </div>
          </article>

          <article className="panel">
            <SectionHeader title="Kata Pengunjung" description="Rating kecepatan dan kenyamanan dipisah agar tempat cepat tapi ramai tetap terlihat jujur." />
            <div className="review-list">
              {place.reviews?.length ? place.reviews.map((review) => <ReviewCard key={review.id} review={review} />) : <EmptyState title="Belum ada ulasan." description="Ulasan pertama membantu pengunjung berikutnya." />}
            </div>
          </article>

          <article className="panel">
            <SectionHeader title="Tambahkan laporan kecepatan dan kenyamanan" description="Rating harus antara 1 sampai 5. Tulis komentar yang praktis dan spesifik." />
            {reviewMessage.text ? <InfoBanner tone={reviewMessage.tone}>{reviewMessage.text}</InfoBanner> : null}
            <LoginGate {...auth} />
            <form className="review-form" onSubmit={handleReviewSubmit}>
              <label className="field"><span>Judul ulasan</span><input value={reviewForm.reviewTitle} onChange={(e) => setReviewForm((c) => ({ ...c, reviewTitle: e.target.value }))} placeholder="Contoh: WiFi kencang buat deadline" required /></label>
              <div className="review-form__grid">
                <label className="field"><span>Rating kecepatan</span><select value={reviewForm.ratingSpeed} onChange={(e) => setReviewForm((c) => ({ ...c, ratingSpeed: Number(e.target.value) }))}>{ratingOptions.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
                <label className="field"><span>Rating kenyamanan</span><select value={reviewForm.ratingComfort} onChange={(e) => setReviewForm((c) => ({ ...c, ratingComfort: Number(e.target.value) }))}>{ratingOptions.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
              </div>
              <label className="field"><span>Komentar</span><textarea value={reviewForm.comment} onChange={(e) => setReviewForm((c) => ({ ...c, comment: e.target.value }))} placeholder="Ceritakan stabilitas koneksi, kebisingan, colokan, atau area duduk terbaik." required /></label>
              <label className="field"><span>Foto ulasan</span><input type="file" accept="image/*" onChange={handleReviewImageChange} /></label>
              {reviewForm.imageUrl ? <img className="review-form__preview" src={reviewForm.imageUrl} alt="Preview foto ulasan" /> : null}
              <button type="submit" className="button button--primary" disabled={sendingReview}>{sendingReview ? "Mengirim..." : "Terbitkan ulasan"}</button>
            </form>
          </article>

          <article className="panel">
            <h2>Rekomendasi terdekat</h2>
            <div className="related-list">
              {place.related_places?.map((item) => <Link key={item.id} href={`/places/${item.id}`} className="related-card"><strong>{item.name}</strong><span>{formatMbps(item.wifi_speed_mbps)} Mbps</span></Link>)}
            </div>
          </article>
        </div>
      </section>
    </main>
  );
}
