"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { getSpeedHistory, saveSpeedResult } from "../api";
import { useAuth } from "../lib/useAuth";
import { formatDate, formatMbps } from "../lib/format";
import { haversineMeters, formatDistance, getCurrentPosition } from "../lib/geo";
import { InfoBanner, SectionHeader, MetricTile, EmptyState } from "./ui";
import { SelectField } from "./FormControls";

// kuota ringkas ~35-45MB, tanpa packetLoss & tanpa 100MB+ chunks
const COMPACT_MEASUREMENTS = [
  { type: "latency", numPackets: 1 },
  { type: "download", bytes: 1e5, count: 1, bypassMinDuration: true },
  { type: "latency", numPackets: 10 },
  { type: "download", bytes: 1e5, count: 5 },
  { type: "download", bytes: 1e6, count: 4 },
  { type: "upload", bytes: 1e5, count: 4 },
  { type: "upload", bytes: 1e6, count: 3 },
  { type: "download", bytes: 1e7, count: 3 },
  { type: "upload", bytes: 1e7, count: 2 },
];

const MAX_DISTANCE_M = Number(process.env.NEXT_PUBLIC_SPEEDTEST_MAX_DISTANCE_M ?? 150);

export function SpeedTestWidget({ place, placeId: placeIdProp, initialStats, initialTests, approvedSsids: approvedSsidsProp, onSaved }) {
  const auth = useAuth();
  const engineRef = useRef(null);
  const [status, setStatus] = useState("idle"); // idle | checking | running | paused | finished | error | saving
  const [live, setLive] = useState({ dl: null, ul: null, ping: null, jitter: null, progress: 0, phase: "" });
  const [history, setHistory] = useState(initialTests || []);
  const [stats, setStats] = useState(initialStats || null);
  const [msg, setMsg] = useState({ tone: "", text: "" });
  const [showAll, setShowAll] = useState(false);

  // Geofence + SSID strict
  const placeId = place?.id ?? placeIdProp;
  const placeLat = place?.latitude ?? null;
  const placeLng = place?.longitude ?? null;
  const hasCoords = placeLat != null && placeLng != null && Number.isFinite(Number(placeLat)) && Number.isFinite(Number(placeLng));
  // approvedSsids: dari props atau dari place.wifi_credentials
  // eslint-disable-next-line react-hooks/preserve-manual-memoization -- stabilize SSID list identity, deps are exact fields
  const effectiveSsids = useMemo(() => {
    const raw = approvedSsidsProp ?? place?.wifi_credentials ?? [];
    const list = Array.isArray(raw) ? raw.map((c) => (typeof c === "string" ? c : c.ssid)).filter(Boolean) : [];
    return list.length ? list : (place?.wifi_ssid ? [place.wifi_ssid] : []);
  }, [approvedSsidsProp, place?.wifi_credentials, place?.wifi_ssid]);

  const [selectedSsid, setSelectedSsid] = useState("");
  const [confirmConnected, setConfirmConnected] = useState(false);
  const [geo, setGeo] = useState({ status: "idle", distance: null, accuracy: null, lat: null, lng: null, error: "" });
  const [checkingGeo, setCheckingGeo] = useState(false);

  // auto-select first ssid when list loads
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- auto-select single verified SSID on load
    if (!selectedSsid && effectiveSsids.length === 1) setSelectedSsid(effectiveSsids[0]);
  }, [effectiveSsids, selectedSsid]);

  const fetchHistory = useCallback(async () => {
    try {
      const res = await getSpeedHistory(placeId, { limit: showAll ? 20 : 5 });
      setHistory(res.data || []);
      if (res.meta?.stats) setStats(res.meta.stats);
    } catch {
      // ignore - widget tetap jalan tanpa history
    }
  }, [placeId, showAll]);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!initialTests || initialTests.length === 0) {
        if (active) await fetchHistory();
      } else {
        if (active) {
          if (initialStats) setStats(initialStats);
          setHistory(initialTests);
        }
      }
    })();
    return () => { active = false; };
  }, [fetchHistory, initialTests, initialStats]);

  async function checkLocation() {
    if (!hasCoords) {
      setGeo({ status: "error", distance: null, accuracy: null, lat: null, lng: null, error: "Koordinat tempat belum diatur — hubungi admin." });
      return null;
    }
    setCheckingGeo(true);
    setGeo((c) => ({ ...c, status: "checking", error: "" }));
    setMsg({ tone: "", text: "" });
    try {
      const pos = await getCurrentPosition({ enableHighAccuracy: true, timeout: 12000, maximumAge: 0 });
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      const accuracy = pos.coords.accuracy ?? null;
      const dist = haversineMeters(Number(placeLat), Number(placeLng), lat, lng);
      const ok = dist <= MAX_DISTANCE_M;
      setGeo({ status: ok ? "ok" : "out", distance: dist, accuracy, lat, lng, error: ok ? "" : `Di luar jangkauan (${formatDistance(dist)} > ${formatDistance(MAX_DISTANCE_M)}). Mendekat ke lokasi.` });
      if (!ok) {
        setMsg({ tone: "danger", text: `Kamu ${formatDistance(dist)} dari ${place?.name ?? "lokasi"} (±${accuracy ? Math.round(accuracy) + "m" : "?"}). Mendekat dalam ${formatDistance(MAX_DISTANCE_M)} untuk speedtest.` });
      } else {
        setMsg({ tone: "success", text: `Lokasi terverifikasi: ${formatDistance(dist)} dari ${place?.name ?? "lokasi"} (±${accuracy ? Math.round(accuracy) + "m" : "?"}).` });
      }
      return { lat, lng, accuracy, dist, ok };
    } catch (e) {
      const text = e.message || "Gagal mendapatkan lokasi";
      setGeo({ status: "error", distance: null, accuracy: null, lat: null, lng: null, error: text });
      setMsg({ tone: "danger", text });
      return null;
    } finally {
      setCheckingGeo(false);
    }
  }

  async function startTest() {
    if (!auth.user) {
      setMsg({ tone: "danger", text: "Login Google diperlukan untuk menyimpan hasil speedtest." });
      return;
    }
    // SSID strict gate
    if (!effectiveSsids.length) {
      setMsg({ tone: "danger", text: "Tempat ini belum punya SSID terverifikasi — speedtest diblok. Admin perlu approve SSID dulu." });
      return;
    }
    if (!selectedSsid) {
      setMsg({ tone: "danger", text: "Pilih SSID yang kamu pakai sekarang." });
      return;
    }
    if (!effectiveSsids.includes(selectedSsid)) {
      setMsg({ tone: "danger", text: `SSID tidak terdaftar untuk lokasi ini. Pilih: ${effectiveSsids.join(", ")}` });
      return;
    }
    if (!confirmConnected) {
      setMsg({ tone: "danger", text: "Centang konfirmasi bahwa kamu terhubung ke SSID tersebut sekarang." });
      return;
    }
    if (!hasCoords) {
      setMsg({ tone: "danger", text: "Koordinat tempat belum diatur — speedtest diblok. Hubungi admin." });
      return;
    }
    // Geofence gate — always re-check fresh location before running
    setStatus("checking");
    setMsg({ tone: "muted", text: "Memeriksa lokasi..." });
    const loc = await checkLocation();
    if (!loc || !loc.ok) {
      setStatus("error");
      if (loc && !loc.ok) {
        // msg already set
      } else if (!loc) {
        // error already set
      }
      return;
    }

    setMsg({ tone: "", text: "" });
    setStatus("running");
    setLive({ dl: null, ul: null, ping: null, jitter: null, progress: 0, phase: "Memulai..." });

    try {
      const { default: SpeedTest } = await import("@cloudflare/speedtest");
      if (engineRef.current) {
        try { engineRef.current.pause(); } catch { void 0; }
      }
      const engine = new SpeedTest({
        autoStart: false,
        measurements: COMPACT_MEASUREMENTS,
        measureDownloadLoadedLatency: true,
        measureUploadLoadedLatency: true,
      });
      engineRef.current = engine;

      engine.onRunningChange = (running) => {
        if (engine.isFinished) return;
        setStatus(running ? "running" : "paused");
      };

      engine.onResultsChange = () => {
        const dlBps = engine.results.getDownloadBandwidth();
        const ulBps = engine.results.getUploadBandwidth();
        const ping = engine.results.getUnloadedLatency();
        const jitter = engine.results.getUnloadedJitter?.();
        let phase = "Mengukur...";
        try {
          const dlPoints = engine.results.getDownloadBandwidthPoints?.() || [];
          const ulPoints = engine.results.getUploadBandwidthPoints?.() || [];
          const totalSteps = COMPACT_MEASUREMENTS.reduce((s, m) => s + (m.count || 0), 0);
          const doneSteps = dlPoints.length + ulPoints.length;
          const pct = Math.min(95, Math.round((doneSteps / totalSteps) * 100));
          if (dlBps && !ulBps) phase = "Download...";
          else if (ulBps) phase = "Upload...";
          else if (ping) phase = "Ping...";
          setLive({
            dl: dlBps ? dlBps / 1e6 : null,
            ul: ulBps ? ulBps / 1e6 : null,
            ping: ping ?? null,
            jitter: jitter ?? null,
            progress: pct,
            phase,
          });
        } catch { setLive((c) => ({ ...c, dl: dlBps ? dlBps / 1e6 : c.dl, ul: ulBps ? ulBps / 1e6 : c.ul, ping: ping ?? c.ping, jitter: jitter ?? c.jitter })); }
      };

      engine.onFinish = async (results) => {
        try {
          const summary = results.getSummary();
          const dlMbps = summary.download ? summary.download / 1e6 : results.getDownloadBandwidth() ? results.getDownloadBandwidth() / 1e6 : 0;
          const ulMbps = summary.upload ? summary.upload / 1e6 : results.getUploadBandwidth() ? results.getUploadBandwidth() / 1e6 : null;
          const pingMs = summary.latency ?? results.getUnloadedLatency() ?? null;
          const jitterMs = summary.jitter ?? results.getUnloadedJitter?.() ?? null;
          const durationMs = results.getTotalDurationMs?.() ?? null;

          setLive((c) => ({ ...c, dl: dlMbps, ul: ulMbps, ping: pingMs, jitter: jitterMs, progress: 100, phase: "Selesai" }));
          setStatus("saving");
          setMsg({ tone: "muted", text: "Menyimpan hasil ke sistem..." });

          let safeRaw = summary;
          try {
            const serialized = JSON.stringify(summary);
            if (serialized.length > 400_000) {
              safeRaw = {
                download: summary.download ?? null,
                upload: summary.upload ?? null,
                latency: summary.latency ?? null,
                jitter: summary.jitter ?? null,
                packetLoss: summary.packetLoss ?? null,
                latencyPoints: Array.isArray(summary.latencyPoints) ? summary.latencyPoints.slice(0, 20) : undefined,
              };
              if (JSON.stringify(safeRaw).length > 400_000) safeRaw = null;
            }
          } catch {
            safeRaw = null;
          }

          await saveSpeedResult(placeId, {
            downloadMbps: Math.round(dlMbps * 10) / 10,
            uploadMbps: ulMbps != null ? Math.round(ulMbps * 10) / 10 : null,
            pingMs: pingMs != null ? Math.round(pingMs) : null,
            jitterMs: jitterMs != null ? Math.round(jitterMs * 10) / 10 : null,
            durationMs: durationMs != null ? Math.round(durationMs) : null,
            rawSummary: safeRaw,
            claimedSsid: selectedSsid,
            userLatitude: loc.lat,
            userLongitude: loc.lng,
            accuracyM: loc.accuracy != null ? Math.round(loc.accuracy) : null,
          });

          setStatus("finished");
          setMsg({ tone: "success", text: `Hasil tersimpan: ${dlMbps.toFixed(1)} Mbps ↓ / ${ulMbps ? ulMbps.toFixed(1) + " Mbps ↑" : "-"} — ping ${pingMs ? Math.round(pingMs) + " ms" : "-"} — SSID ${selectedSsid} — ${formatDistance(loc.dist)}` });
          await fetchHistory();
          if (onSaved) onSaved();
        } catch (err) {
          if (err.message?.includes("Batas 3 tes")) {
            setMsg({ tone: "danger", text: err.message });
            setStatus("error");
          } else if (err.message?.includes("SSID") || err.message?.includes("jangkauan") || err.message?.includes("Koordinat")) {
            setMsg({ tone: "danger", text: err.message });
            setStatus("error");
          } else {
            setMsg({ tone: "danger", text: err.message || "Gagal menyimpan hasil" });
            setStatus("error");
          }
        }
      };

      engine.onError = (e) => {
        setMsg({ tone: "danger", text: String(e) || "Speedtest error" });
        setStatus("error");
      };

      engine.play();
    } catch (e) {
      setMsg({ tone: "danger", text: e.message || "Gagal memulai speedtest" });
      setStatus("error");
    }
  }

  function handlePause() {
    if (!engineRef.current) return;
    if (status === "running") {
      engineRef.current.pause();
      setStatus("paused");
    } else if (status === "paused") {
      engineRef.current.play();
      setStatus("running");
    }
  }

  function handleRestart() {
    if (engineRef.current) {
      try { engineRef.current.restart(); engineRef.current.pause(); } catch { void 0; }
    }
    setStatus("idle");
    setLive({ dl: null, ul: null, ping: null, jitter: null, progress: 0, phase: "" });
    setMsg({ tone: "", text: "" });
    // keep geo verification but allow re-check
  }

  const isRunning = status === "running" || status === "paused" || status === "saving" || status === "checking";
  const dlDisplay = live.dl != null ? `${formatMbps(live.dl)} Mbps` : "—";
  const ulDisplay = live.ul != null ? `${formatMbps(live.ul)} Mbps` : "—";
  const pingDisplay = live.ping != null ? `${Math.round(live.ping)} ms` : "—";
  const jitterDisplay = live.jitter != null ? `${Number(live.jitter).toFixed(1)} ms` : "—";

  const ssidGateOk = effectiveSsids.length > 0 && selectedSsid && effectiveSsids.includes(selectedSsid) && confirmConnected;
  const geoOk = geo.status === "ok" && geo.distance != null && geo.distance <= MAX_DISTANCE_M;
  const canStart = auth.user && ssidGateOk && hasCoords && effectiveSsids.length > 0 && !isRunning;

  return (
    <article className="panel">
      <SectionHeader
        title="Speedtest Cloudflare"
        description={`Hanya bisa di ${formatDistance(MAX_DISTANCE_M)} dari lokasi & harus terhubung ke SSID terverifikasi. Kuota ~40 MB. Hasil masuk avg 30 hari.`}
        action={
          stats ? (
            <span className="section-header__meta">
              {stats.count ?? 0} tes (30h)
            </span>
          ) : null
        }
      />

      {/* SSID + Geofence hygiene */}
      <div className="speedtest-gate">
        <div className="speedtest-gate__title">Verifikasi lokasi & WiFi (wajib)</div>

        {!hasCoords ? (
          <InfoBanner tone="danger">Koordinat tempat belum diatur — speedtest diblok. Admin perlu isi latitude/longitude.</InfoBanner>
        ) : null}

        {effectiveSsids.length === 0 ? (
          <EmptyState title="Belum ada SSID terverifikasi." description="Jadilah yang pertama menambahkan SSID + password untuk lokasi ini." />
        ) : (
          <>
            <div className="field">
              <span>SSID yang kamu pakai sekarang *</span>
              <SelectField
                name="ssid"
                value={selectedSsid}
                onChange={(e) => setSelectedSsid(e.target.value)}
                placeholder="— Pilih SSID —"
                allowEmpty
                options={effectiveSsids.map((s) => ({ value: s, label: s }))}
              />
              <small className="speedtest-gate__hint">Hanya SSID terverifikasi untuk {place?.name ?? "lokasi ini"}: {effectiveSsids.join(", ")}</small>
            </div>
            <label className="speedtest-gate__check">
              <input type="checkbox" checked={confirmConnected} onChange={(e) => setConfirmConnected(e.target.checked)} />
              <span>Saya terhubung ke <strong>{selectedSsid || "SSID terpilih"}</strong> sekarang</span>
            </label>
          </>
        )}

        <div className="speedtest-gate__row">
          <button type="button" className="button button--ghost button--small" onClick={checkLocation} disabled={checkingGeo || !hasCoords || !auth.user}>
            {checkingGeo ? "Memeriksa..." : geo.status === "ok" ? "Cek ulang lokasi" : "Cek lokasi"}
          </button>
          {geo.status !== "idle" ? (
            <small className={`speedtest-gate__status ${geo.status === "ok" ? "speedtest-gate__status--ok" : geo.status === "out" || geo.status === "error" ? "speedtest-gate__status--bad" : ""}`}>
              {geo.status === "checking" ? "Memeriksa lokasi..." : null}
              {geo.status === "ok" ? `✓ ${formatDistance(geo.distance)} dari lokasi (±${geo.accuracy != null ? Math.round(geo.accuracy) + "m" : "?"})` : null}
              {geo.status === "out" ? `✗ ${formatDistance(geo.distance)} — di luar ${formatDistance(MAX_DISTANCE_M)}` : null}
              {geo.status === "error" ? `✗ ${geo.error}` : null}
            </small>
          ) : <small className="speedtest-gate__status">Wajib dalam {formatDistance(MAX_DISTANCE_M)} dari lokasi. Aktifkan GPS & izin lokasi.</small>}
        </div>
        {geo.accuracy != null && geo.accuracy > 80 ? <small className="speedtest-gate__status speedtest-gate__status--warn">Akurasi rendah (±{Math.round(geo.accuracy)}m). Coba di luar ruangan / dekat jendela untuk hasil akurat.</small> : null}
      </div>

      {/* Live gauge */}
      <div className="quality-grid speedtest-gauge">
        <MetricTile label="Download" value={dlDisplay} />
        <MetricTile label="Upload" value={ulDisplay} />
        <MetricTile label="Ping" value={pingDisplay} />
        <MetricTile label="Jitter" value={jitterDisplay} />
      </div>

      {/* Progress */}
      {status !== "idle" ? (
        <div className="speedtest-progress">
          <div className="speedtest-progress__track">
            <div
              className={`speedtest-progress__bar ${status === "error" ? "speedtest-progress__bar--error" : status === "finished" ? "speedtest-progress__bar--done" : ""}`}
              style={{ width: `${live.progress}%` }}
            />
          </div>
          <small className="speedtest-progress__label">{live.phase} {isRunning ? `${live.progress}%` : ""} {status === "paused" ? "— dijeda" : ""} {status === "checking" ? "— memeriksa lokasi" : ""}</small>
        </div>
      ) : null}

      {/* 30d avg */}
      {stats ? (
        <div className="speedtest-stats">
          <span className="speedtest-stats__item speedtest-stats__item--dl">Avg 30h: {stats.avg_download != null ? `${formatMbps(stats.avg_download)} ↓` : "—"}</span>
          <span className="speedtest-stats__item speedtest-stats__item--ul">{stats.avg_upload != null ? `${formatMbps(stats.avg_upload)} ↑` : "— up"}</span>
          <span className="speedtest-stats__item">{stats.avg_ping != null ? `${Math.round(stats.avg_ping)} ms` : "— ping"}</span>
          <small className="speedtest-stats__meta">{stats.total != null ? `${stats.total} total` : ""} {stats.last_test_at ? `• terakhir ${formatDate(stats.last_test_at)}` : ""}</small>
        </div>
      ) : null}

      {msg.text ? <InfoBanner tone={msg.tone} style={{ marginBottom: 12 }}>{msg.text}</InfoBanner> : null}

      <div className="speedtest-actions">
        {status === "idle" || status === "finished" || status === "error" || status === "checking" ? (
          <button
            type="button"
            className="button button--primary"
            onClick={startTest}
            disabled={!canStart || checkingGeo}
            title={!auth.user ? "Login dulu" : !ssidGateOk ? "Pilih SSID & centang konfirmasi" : !geoOk ? "Cek lokasi dulu (harus dalam 150m)" : ""}
          >
            {status === "finished" ? "Tes Lagi" : status === "error" ? "Coba Lagi" : "Mulai Tes (~40 MB)"}
          </button>
        ) : null}
        {status === "running" || status === "paused" ? (
          <>
            <button type="button" className="button button--ghost" onClick={handlePause}>{status === "paused" ? "Lanjutkan" : "Jeda"}</button>
            <button type="button" className="button button--ghost" onClick={handleRestart}>Ulangi</button>
          </>
        ) : null}
        {status === "finished" ? <button type="button" className="button button--ghost" onClick={handleRestart}>Tes Ulang</button> : null}
      </div>
      <small className="speedtest-note">Tes butuh ~25 detik & ~40 MB. Hasil dikirim ke Cloudflare untuk agregasi (sesuai TOS Cloudflare) dan disimpan di BalamWiFi. Batas 3 tes/jam/lokasi. Lokasi & SSID diverifikasi & disimpan untuk audit.</small>

      {/* History */}
      <div className="speedtest-history">
        <h4 className="speedtest-history__head">Riwayat tes lokasi ini</h4>
        {history.length ? (
          <>
            <div className="speedtest-history__list">
              {history.map((t) => (
                <div key={t.id} className="speedtest-history__row">
                  <div className="speedtest-history__values">
                    <strong>{formatMbps(t.download_mbps)} ↓</strong>
                    <span>/ {t.upload_mbps != null ? `${formatMbps(t.upload_mbps)} ↑` : "—"}</span>
                    <span>{t.ping_ms != null ? `${t.ping_ms} ms` : "—"}</span>
                    {t.jitter_ms != null ? <span>±{Number(t.jitter_ms).toFixed(1)} ms</span> : null}
                    {t.claimed_ssid ? <span className="speedtest-history__ssid">{t.claimed_ssid}</span> : null}
                    {t.distance_m != null ? <span>{formatDistance(t.distance_m)}</span> : null}
                    <div className="speedtest-history__meta">{t.tested_by_name} • {formatDate(t.created_at)} {t.duration_ms ? `• ${Math.round(t.duration_ms / 1000)}s` : ""}</div>
                  </div>
                  <small className="speedtest-history__id">#{t.id}</small>
                </div>
              ))}
            </div>
            {stats && stats.total > 5 ? (
              <button type="button" className="button button--ghost button--small speedtest-history__toggle" onClick={() => setShowAll((v) => !v)}>
                {showAll ? "Tampilkan 5 saja" : `Lihat semua (${stats.total})`}
              </button>
            ) : null}
          </>
        ) : (
          <p className="speedtest-empty">Belum ada tes. Jadilah yang pertama!</p>
        )}
      </div>
    </article>
  );
}
