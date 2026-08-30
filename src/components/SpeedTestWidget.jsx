"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { getSpeedHistory, saveSpeedResult } from "../api";
import { useAuth } from "../lib/useAuth";
import { formatDate, formatMbps } from "../lib/format";
import { haversineMeters, formatDistance, getCurrentPosition } from "../lib/geo";

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

const ticks = [
  { val: "0", x: 54, y: 138 },
  { val: "5", x: 41, y: 108 },
  { val: "10", x: 46, y: 75 },
  { val: "50", x: 68, y: 49 },
  { val: "100", x: 100, y: 40 },
  { val: "250", x: 132, y: 49 },
  { val: "500", x: 154, y: 75 },
  { val: "750", x: 159, y: 108 },
  { val: "1000", x: 146, y: 138 },
];

function getGaugePercent(speed) {
  if (speed <= 0) return 0;
  if (speed >= 1000) return 1;
  const tickVals = [0, 5, 10, 50, 100, 250, 500, 750, 1000];
  let i = 0;
  while (i < tickVals.length - 1 && speed > tickVals[i + 1]) {
    i++;
  }
  const basePercent = i / (tickVals.length - 1);
  const rangeVal = tickVals[i + 1] - tickVals[i];
  const progressInTick = (speed - tickVals[i]) / rangeVal;
  const tickWeight = 1 / (tickVals.length - 1);
  return basePercent + progressInTick * tickWeight;
}

export function SpeedTestWidget({ place, placeId: placeIdProp, initialStats, initialTests, approvedSsids: approvedSsidsProp, onSaved }) {
  const auth = useAuth();
  const engineRef = useRef(null);
  
  const [status, setStatus] = useState("idle"); // idle | checking | running | paused | finished | error | saving
  const [live, setLive] = useState({
    dl: null,
    ul: null,
    ping: null,
    jitter: null,
    dlLoaded: null,
    ulLoaded: null,
    progress: 0,
    phase: ""
  });
  
  const [history, setHistory] = useState(initialTests || []);
  const [stats, setStats] = useState(initialStats || null);
  const [msg, setMsg] = useState({ tone: "", text: "" });
  const [showAll, setShowAll] = useState(false);

  const placeId = place?.id ?? placeIdProp;
  const placeLat = place?.latitude ?? null;
  const placeLng = place?.longitude ?? null;
  const hasCoords = placeLat != null && placeLng != null && Number.isFinite(Number(placeLat)) && Number.isFinite(Number(placeLng));

  // eslint-disable-next-line react-hooks/preserve-manual-memoization -- stabilize SSID list identity, deps are exact fields
  const effectiveSsids = useMemo(() => {
    const raw = approvedSsidsProp ?? place?.wifi_credentials ?? [];
    const list = Array.isArray(raw) ? raw.map((c) => (typeof c === "string" ? c : c.ssid)).filter(Boolean) : [];
    return list.length ? list : (place?.wifi_ssid ? [place.wifi_ssid] : []);
  }, [approvedSsidsProp, place?.wifi_credentials, place?.wifi_ssid]);

  const [selectedSsid, setSelectedSsid] = useState("");
  const [checkingGeo, setCheckingGeo] = useState(false);
  const [clientInfo, setClientInfo] = useState({ ip: "...", isp: "Mencari ISP...", city: "Pringsewu" });

  // Auto-select SSID
  useEffect(() => {
    if (!selectedSsid && effectiveSsids.length === 1) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- auto-select single verified SSID on load
      setSelectedSsid(effectiveSsids[0]);
    }
  }, [effectiveSsids, selectedSsid]);

  // Fetch real Client IP / ISP Metadata
  useEffect(() => {
    fetch("https://ipapi.co/json/")
      .then((res) => res.json())
      .then((data) => {
        setClientInfo({
          ip: data.ip || "...",
          isp: data.org || "PT Telekomunikasi Indonesia",
          city: data.city || place?.district || "Pringsewu"
        });
      })
      .catch(() => {
        // Fallback to Cloudflare cdn-cgi/trace
        fetch("https://cloudflare.com/cdn-cgi/trace")
          .then((res) => res.text())
          .then((text) => {
            const ipLine = text.split("\n").find((line) => line.startsWith("ip="));
            const ip = ipLine ? ipLine.split("=")[1] : "...";
            setClientInfo({
              ip,
              isp: "Internet Service Provider",
              city: place?.district || "Pringsewu"
            });
          })
          .catch(() => {});
      });
  }, [place]);

  const fetchHistory = useCallback(async () => {
    try {
      const res = await getSpeedHistory(placeId, { limit: showAll ? 20 : 5 });
      setHistory(res.data || []);
      if (res.meta?.stats) setStats(res.meta.stats);
    } catch {
      // ignore
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
    if (!hasCoords) return null;
    setCheckingGeo(true);
    try {
      const pos = await getCurrentPosition({ enableHighAccuracy: true, timeout: 12000, maximumAge: 0 });
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      const accuracy = pos.coords.accuracy ?? null;
      const dist = haversineMeters(Number(placeLat), Number(placeLng), lat, lng);
      const ok = dist <= MAX_DISTANCE_M;
      return { lat, lng, accuracy, dist, ok };
    } catch {
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
    if (!selectedSsid) {
      setMsg({ tone: "danger", text: "Silakan pilih SSID WiFi terlebih dahulu." });
      return;
    }
    if (!effectiveSsids.includes(selectedSsid)) {
      setMsg({ tone: "danger", text: `SSID tidak terdaftar untuk lokasi ini. Pilih: ${effectiveSsids.join(", ")}` });
      return;
    }
    if (!hasCoords) {
      setMsg({ tone: "danger", text: "Koordinat lokasi tempat belum diatur oleh admin." });
      return;
    }

    setStatus("checking");
    setMsg({ tone: "muted", text: "Memeriksa lokasi GPS Anda..." });
    
    const loc = await checkLocation();
    if (!loc || !loc.ok) {
      setStatus("error");
      setMsg({
        tone: "danger",
        text: loc ? `Anda di luar batas radius lokasi (${formatDistance(loc.dist)} dari ${place?.name || "tempat"}). Silakan mendekat.` : "Gagal memverifikasi lokasi. Pastikan GPS aktif dan izin lokasi diberikan."
      });
      return;
    }

    setMsg({ tone: "", text: "" });
    setStatus("running");
    setLive({
      dl: null,
      ul: null,
      ping: null,
      jitter: null,
      dlLoaded: null,
      ulLoaded: null,
      progress: 0,
      phase: "Menghubungkan..."
    });

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
        const dlLoaded = engine.results.getDownloadLoadedLatency?.();
        const ulLoaded = engine.results.getUploadLoadedLatency?.();
        
        let phase = "Mengukur...";
        try {
          const dlPoints = engine.results.getDownloadBandwidthPoints?.() || [];
          const ulPoints = engine.results.getUploadBandwidthPoints?.() || [];
          const totalSteps = COMPACT_MEASUREMENTS.reduce((s, m) => s + (m.count || 0), 0);
          const doneSteps = dlPoints.length + ulPoints.length;
          const pct = Math.min(95, Math.round((doneSteps / totalSteps) * 100));
          
          if (dlBps && !ulBps) phase = "Mengunduh...";
          else if (ulBps) phase = "Mengunggah...";
          else if (ping) phase = "Menguji Ping...";
          
          setLive({
            dl: dlBps ? dlBps / 1e6 : null,
            ul: ulBps ? ulBps / 1e6 : null,
            ping: ping ?? null,
            jitter: jitter ?? null,
            dlLoaded: dlLoaded ?? null,
            ulLoaded: ulLoaded ?? null,
            progress: pct,
            phase,
          });
        } catch {
          setLive((c) => ({
            ...c,
            dl: dlBps ? dlBps / 1e6 : c.dl,
            ul: ulBps ? ulBps / 1e6 : c.ul,
            ping: ping ?? c.ping,
            jitter: jitter ?? c.jitter,
            dlLoaded: dlLoaded ?? c.dlLoaded,
            ulLoaded: ulLoaded ?? c.ulLoaded
          }));
        }
      };

      engine.onFinish = async (results) => {
        try {
          const summary = results.getSummary();
          const dlMbps = summary.download ? summary.download / 1e6 : results.getDownloadBandwidth() ? results.getDownloadBandwidth() / 1e6 : 0;
          const ulMbps = summary.upload ? summary.upload / 1e6 : results.getUploadBandwidth() ? results.getUploadBandwidth() / 1e6 : null;
          const pingMs = summary.latency ?? results.getUnloadedLatency() ?? null;
          const jitterMs = summary.jitter ?? results.getUnloadedJitter?.() ?? null;
          const dlLoadedMs = summary.downLoadedLatency ?? results.getDownloadLoadedLatency?.() ?? null;
          const ulLoadedMs = summary.upLoadedLatency ?? results.getUploadLoadedLatency?.() ?? null;
          const durationMs = results.getTotalDurationMs?.() ?? null;

          setLive({
            dl: dlMbps,
            ul: ulMbps,
            ping: pingMs,
            jitter: jitterMs,
            dlLoaded: dlLoadedMs,
            ulLoaded: ulLoadedMs,
            progress: 100,
            phase: "Selesai"
          });
          
          setStatus("saving");
          setMsg({ tone: "muted", text: "Menyimpan hasil tes..." });

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
          setMsg({ tone: "success", text: `Hasil tersimpan! Kecepatan Unduh: ${dlMbps.toFixed(1)} Mbps.` });
          await fetchHistory();
          if (onSaved) onSaved();
        } catch (err) {
          setMsg({ tone: "danger", text: err.message || "Gagal menyimpan hasil speedtest" });
          setStatus("error");
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

  // Active speeds helpers
  const currentSpeed = useMemo(() => {
    if (status === "running") {
      if (live.phase.includes("Mengunggah")) return live.ul ?? 0;
      return live.dl ?? 0;
    }
    if (status === "finished") return live.dl ?? 0;
    return 0;
  }, [status, live]);

  const speedType = useMemo(() => {
    if (status === "running" && live.phase.includes("Mengunggah")) return "upload";
    return "download";
  }, [status, live.phase]);

  const percent = getGaugePercent(currentSpeed);
  const isRunning = status === "running" || status === "paused" || status === "saving" || status === "checking";

  return (
    <article className="cf-speedtest">
      {/* Styles Injection */}
      <style>{`
        .cf-speedtest {
          background-color: var(--bg-secondary);
          color: var(--text-primary);
          border-radius: var(--radius-lg);
          padding: 24px;
          font-family: inherit;
          box-shadow: var(--shadow-sm);
          border: 1px solid var(--border-color);
          margin-bottom: 30px;
          width: 100%;
        }
        .cf-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          border-bottom: 1px solid var(--border-color);
          padding-bottom: 10px;
          margin-bottom: 18px;
        }
        .cf-title {
          font-size: 1.15rem;
          font-weight: 700;
          letter-spacing: -0.01em;
          color: var(--text-primary);
          margin: 0 0 2px 0;
        }
        .cf-title-sub {
          font-size: 0.78rem;
          color: var(--text-secondary);
        }
        .cf-header-badge {
          font-size: 0.72rem;
          color: var(--text-secondary);
          background: var(--bg-tertiary);
          padding: 2px 8px;
          border-radius: var(--radius-full);
          border: 1px solid var(--border-color);
          font-weight: 600;
          white-space: nowrap;
        }
        .cf-grid {
          display: grid;
          gap: 28px;
          grid-template-columns: 1fr;
        }
        @media (min-width: 768px) {
          .cf-grid {
            grid-template-columns: 1.1fr 0.9fr;
            align-items: start;
          }
        }
        .cf-readouts {
          display: flex;
          justify-content: space-between;
          gap: 20px;
          margin-bottom: 10px;
        }
        .cf-readout {
          flex: 1;
          text-align: center;
        }
        .cf-readout__label {
          font-size: 0.72rem;
          font-weight: 700;
          letter-spacing: 0.05em;
          margin-bottom: 2px;
        }
        .cf-readout__label.dl {
          color: #6e5f54;
        }
        .cf-readout__label.ul {
          color: #B4533C;
        }
        .cf-readout__value {
          font-size: 2.1rem;
          font-weight: 850;
          letter-spacing: -0.02em;
          color: var(--text-primary);
          display: inline-flex;
          align-items: baseline;
        }
        .cf-readout__unit {
          font-size: 0.9rem;
          font-weight: 650;
          color: var(--text-secondary);
          margin-left: 6px;
        }
        .cf-value-placeholder {
          font-weight: 400 !important;
          color: var(--text-muted);
          opacity: 0.5;
        }
        .cf-latency-row {
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 12px;
          margin-bottom: 12px;
          font-size: 0.8rem;
          color: var(--text-secondary);
        }
        .cf-gauge-container {
          display: flex;
          justify-content: center;
          align-items: center;
          position: relative;
          margin: 0 auto 10px auto;
          width: 170px;
          height: 130px;
        }
        .cf-gauge-center {
          position: absolute;
          top: 60%;
          left: 50%;
          transform: translate(-50%, -50%);
          text-align: center;
          width: 100px;
        }
        .cf-gauge-speed {
          font-size: 1.25rem;
          font-weight: 800;
          color: var(--text-primary);
          line-height: 1;
          letter-spacing: -0.02em;
        }
        .cf-gauge-unit {
          font-size: 0.7rem;
          font-weight: 700;
          color: #6e5f54;
          display: inline-flex;
          align-items: center;
          gap: 3px;
          margin-top: 2px;
        }
        .cf-gauge-unit.ul {
          color: #B4533C;
        }
        .cf-info-row {
          text-align: center;
          margin-bottom: 16px;
          font-size: 0.78rem;
          line-height: 1.4;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 2px;
        }
        .cf-info-isp {
          font-weight: 700;
          color: var(--text-primary);
          display: inline-flex;
          align-items: center;
          gap: 4px;
        }
        .cf-info-loc {
          font-size: 0.74rem;
          color: var(--text-secondary);
          display: inline-flex;
          align-items: center;
          gap: 4px;
        }
        .cf-controls {
          margin-bottom: 14px;
        }
        .cf-controls-label {
          font-size: 0.72rem;
          font-weight: 750;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--text-secondary);
          margin-bottom: 5px;
          display: block;
          text-align: center;
        }
        .cf-select {
          background: var(--bg-secondary);
          color: var(--text-primary);
          border: 1px solid var(--border-color);
          padding: 8px 12px;
          border-radius: var(--radius-sm);
          width: 100%;
          font-size: 0.85rem;
          outline: none;
          cursor: pointer;
          transition: border-color 0.2s ease;
          text-align: center;
        }
        .cf-select:focus {
          border-color: var(--border-color-hover);
        }
        .cf-btn-start {
          background: var(--bg-accent);
          color: var(--text-on-accent);
          border: none;
          font-weight: 750;
          font-size: 0.92rem;
          padding: 10px 20px;
          border-radius: var(--radius-sm);
          cursor: pointer;
          width: 100%;
          transition: all 0.2s ease;
          letter-spacing: 0.02em;
        }
        .cf-btn-start:hover:not(:disabled) {
          background: var(--bg-accent-hover);
        }
        .cf-btn-start:disabled {
          background: var(--border-color);
          color: var(--text-muted);
          cursor: not-allowed;
        }
        .cf-msg-banner {
          padding: 8px 12px;
          border-radius: var(--radius-sm);
          font-size: 0.76rem;
          margin-top: 10px;
          line-height: 1.4;
          text-align: center;
        }
        .cf-msg-banner.danger {
          background: #fde8e8;
          color: #9b1c1c;
          border: 1px solid #f8b4b4;
        }
        .cf-msg-banner.success {
          background: #e6fffa;
          color: #0d9488;
          border: 1px solid #99f6e4;
        }
        .cf-msg-banner.muted {
          background: var(--bg-tertiary);
          color: var(--text-secondary);
          border: 1px solid var(--border-color);
        }
        .cf-progress-container {
          margin-top: 8px;
          margin-bottom: 8px;
        }
        .cf-progress-track {
          height: 4px;
          background: var(--bg-tertiary);
          border-radius: 2px;
          overflow: hidden;
        }
        .cf-progress-bar {
          height: 100%;
          background: #6e5f54;
          transition: width 0.3s ease;
        }
        .cf-progress-bar.upload {
          background: #B4533C;
        }
        .cf-progress-label {
          font-size: 0.74rem;
          color: var(--text-secondary);
          text-align: center;
          margin-top: 4px;
        }
        .cf-note-small {
          display: block;
          text-align: center;
          margin-top: 6px;
          color: var(--text-secondary);
          font-size: 0.72rem;
          line-height: 1.35;
        }
        .cf-history-section {
          border-top: 1px solid var(--border-color);
          padding-top: 14px;
          margin-top: 16px;
        }
        .cf-history-header {
          font-size: 0.85rem;
          font-weight: 750;
          color: var(--text-primary);
          margin-bottom: 8px;
        }
        .cf-history-item {
          display: flex;
          justify-content: space-between;
          padding: 6px 10px;
          background: var(--bg-tertiary);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-sm);
          font-size: 0.76rem;
          margin-bottom: 4px;
        }
        .cf-history-val {
          font-weight: 700;
        }
        .cf-history-val-dl {
          color: #6e5f54;
        }
        .cf-history-val-ul {
          color: #B4533C;
        }
        .cf-history-meta {
          color: var(--text-secondary);
          font-size: 0.68rem;
        }
        .cf-login-notice {
          font-size: 0.72rem;
          color: var(--text-secondary);
          text-align: center;
          margin-top: 8px;
          display: block;
        }
        .cf-ssid-status {
          text-align: center;
          margin-bottom: 12px;
          line-height: 1.35;
        }
        .cf-ssid-status__title {
          font-size: 0.78rem;
          font-weight: 700;
          color: var(--rating-amber);
        }
        .cf-ssid-status__desc {
          font-size: 0.72rem;
          color: var(--text-secondary);
          margin-top: 1px;
        }
        @media (max-width: 480px) {
          .cf-readouts {
            gap: 12px;
          }
          .cf-readout__value {
            font-size: 1.65rem;
          }
          .cf-readout__unit {
            font-size: 0.8rem;
            margin-left: 4px;
          }
        }
      `}</style>

      {/* Speedtest Header */}
      <div className="cf-header">
        <div>
          <h3 className="cf-title">Speedtest Cloudflare</h3>
          <span className="cf-title-sub">Uji performa koneksi Anda langsung dari lokasi</span>
        </div>
        {stats && (
          <span className="cf-header-badge">
            {stats.count ?? 0} tes (30h)
          </span>
        )}
      </div>

      <div className="cf-grid">
        {/* Left Column: Visual Speedometer and ISP status */}
        <div className="cf-col-left">
          {/* Speedometer Gauge */}
          <div className="cf-gauge-container">
            <svg viewBox="0 0 200 160" width="100%" height="100%">
              <defs>
                <linearGradient id="downloadGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#a1887f" />
                  <stop offset="100%" stopColor="#6e5f54" />
                </linearGradient>
                <linearGradient id="uploadGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#f97316" />
                  <stop offset="100%" stopColor="#b4533c" />
                </linearGradient>
                <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="2.5" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
              </defs>

              {/* Background Track */}
              <path
                d="M 38.7,151.4 A 80,80 0 1,1 161.3,151.4"
                fill="none"
                stroke="#e6dfd1"
                strokeWidth="9"
                strokeLinecap="round"
              />

              {/* Active Highlight Track */}
              {percent > 0 && (
                <path
                  d="M 38.7,151.4 A 80,80 0 1,1 161.3,151.4"
                  fill="none"
                  stroke={speedType === "upload" ? "url(#uploadGrad)" : "url(#downloadGrad)"}
                  strokeWidth="9"
                  strokeLinecap="round"
                  strokeDasharray="363.03"
                  strokeDashoffset={363.03 - (percent * 363.03)}
                  filter="url(#glow)"
                  style={{ transition: "stroke-dashoffset 0.15s ease" }}
                />
              )}

              {/* Scale Labels */}
              {ticks.map((tick) => (
                <text
                  key={tick.val}
                  x={tick.x}
                  y={tick.y}
                  fill="var(--text-secondary)"
                  fontSize="7"
                  fontWeight="800"
                  textAnchor="middle"
                  dominantBaseline="middle"
                >
                  {tick.val}
                </text>
              ))}

              {/* Needle Pin and Pointer */}
              <g
                style={{
                  transform: `rotate(${-130 + percent * 260}deg)`,
                  transformOrigin: "100px 100px",
                  transition: "transform 0.2s cubic-bezier(0.1, 0.8, 0.3, 1)",
                }}
              >
                <circle cx="100" cy="100" r="4.5" fill="var(--bg-accent)" />
                <polygon points="98.5,100 101.5,100 100,28" fill="var(--bg-accent)" opacity="0.9" />
              </g>
            </svg>

            {/* Speed numbers overlay */}
            <div className="cf-gauge-center">
              <div className="cf-gauge-speed">
                {currentSpeed > 0 ? currentSpeed.toFixed(2) : "0.00"}
              </div>
              <div className={`cf-gauge-unit ${speedType === "upload" ? "ul" : ""}`}>
                {speedType === "upload" ? (
                  <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="3"><path d="M12 19V5M5 12l7-7 7 7" strokeLinecap="round"/></svg>
                ) : (
                  <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="3"><path d="M12 5v14M5 12l7 7 7-7" strokeLinecap="round"/></svg>
                )}
                Mbps
              </div>
            </div>
          </div>

          {/* Dynamic ISP & Location context info */}
          <div className="cf-info-row">
            <div className="cf-info-isp" title={`IP Address: ${clientInfo.ip}`}>
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginRight: "3px" }}><circle cx="12" cy="12" r="10"/><path d="M8 14c1-2 2-3 4-3s3 1 4 3m-4-6a2.5 2.5 0 100-5 2.5 2.5 0 000 5z" strokeLinecap="round"/></svg>
              {clientInfo.isp}
            </div>
            <div className="cf-info-loc">
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginRight: "3px" }}><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" strokeLinecap="round"/><circle cx="12" cy="10" r="3"/></svg>
              {place?.name || "BalamWiFi Server"} · {place?.district || clientInfo.city}
            </div>
          </div>

          {/* Progress Track when running */}
          {isRunning && (
            <div className="cf-progress-container">
              <div className="cf-progress-track">
                <div
                  className={`cf-progress-bar ${speedType}`}
                  style={{ width: `${live.progress}%` }}
                />
              </div>
              <div className="cf-progress-label">
                {live.phase} {live.progress}% {status === "paused" ? "(Dijeda)" : ""}
              </div>
            </div>
          )}

          {/* Message / Error Banner */}
          {msg.text && (
            <div className={`cf-msg-banner ${msg.tone || "muted"}`}>
              {msg.text}
            </div>
          )}
        </div>

        {/* Right Column: Speed Data & Test Trigger controls */}
        <div className="cf-col-right">
          {/* Top Readouts (Download / Upload final values) */}
          <div className="cf-readouts">
            <div className="cf-readout">
              <div className="cf-readout__label dl">↓ DOWNLOAD</div>
              <div className="cf-readout__value dl">
                {live.dl !== null ? (
                  formatMbps(live.dl)
                ) : (
                  <span className="cf-value-placeholder">0.00</span>
                )}
                <span className="cf-readout__unit">Mbps</span>
              </div>
            </div>
            <div className="cf-readout">
              <div className="cf-readout__label ul">↑ UPLOAD</div>
              <div className="cf-readout__value ul">
                {live.ul !== null ? (
                  formatMbps(live.ul)
                ) : (
                  <span className="cf-value-placeholder">0.00</span>
                )}
                <span className="cf-readout__unit">Mbps</span>
              </div>
            </div>
          </div>

          {/* Latency / Jitter row */}
          <div className="cf-latency-row">
            <span>Ping: {live.ping !== null ? `${Math.round(live.ping)} ms` : <span className="cf-value-placeholder">—</span>}</span>
            <span style={{ color: "var(--border-color)" }}>·</span>
            <span>Jitter: {live.jitter !== null ? `${live.jitter.toFixed(1)} ms` : <span className="cf-value-placeholder">—</span>}</span>
          </div>

          {/* Gates / Configuration selection panel */}
          {!isRunning && (
            <div className="cf-controls">
              {effectiveSsids.length === 0 ? (
                <div className="cf-ssid-status">
                  <div className="cf-ssid-status__title">Belum ada WiFi terverifikasi di lokasi ini.</div>
                  <div className="cf-ssid-status__desc">Administrator perlu menambahkan SSID terverifikasi terlebih dahulu.</div>
                </div>
              ) : (
                <>
                  <label className="cf-controls-label">WiFi terverifikasi</label>
                  <select
                    className="cf-select"
                    value={selectedSsid}
                    onChange={(e) => setSelectedSsid(e.target.value)}
                  >
                    <option value="">— Pilih SSID WiFi —</option>
                    {effectiveSsids.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </>
              )}

          {!auth.user ? (
            <span className="cf-login-notice">
              Login Google diperlukan untuk menyimpan hasil.
            </span>
          ) : (
            <>
              <button
                type="button"
                className="cf-btn-start"
                onClick={startTest}
                disabled={effectiveSsids.length === 0 || !selectedSsid || checkingGeo}
              >
                {checkingGeo ? "Memeriksa Geofence..." : "Mulai Speedtest"}
              </button>
              
              <small className="cf-note-small">
                {effectiveSsids.length === 0 
                  ? "WiFi terverifikasi diperlukan untuk memulai tes." 
                  : "Tes butuh ~25 detik & ~40 MB. Hasil disimpan ke BalamWiFi."
                }
              </small>
            </>
          )}
            </div>
          )}

          {/* History panel */}
          {history.length > 0 && (
            <div className="cf-history-section">
              <h4 className="cf-history-header">Riwayat Pengujian</h4>
              <div>
                {history.map((t) => (
                  <div key={t.id} className="cf-history-item">
                    <div>
                      <span className="cf-history-val cf-history-val-dl">{formatMbps(t.download_mbps)} ↓</span>
                      <span style={{ color: "var(--border-color)", margin: "0 6px" }}>/</span>
                      <span className="cf-history-val cf-history-val-ul">{t.upload_mbps != null ? `${formatMbps(t.upload_mbps)} ↑` : "—"}</span>
                      <span style={{ marginLeft: "10px", color: "var(--text-secondary)" }}>{t.ping_ms ? `${Math.round(t.ping_ms)} ms` : "—"}</span>
                      <div className="cf-history-meta">
                        {t.tested_by_name} • SSID: {t.claimed_ssid || "—"}
                      </div>
                    </div>
                    <div style={{ color: "var(--text-secondary)", alignSelf: "center", fontSize: "0.7rem" }}>
                      {formatDate(t.created_at)}
                    </div>
                  </div>
                ))}
              </div>
              {stats && stats.total > 5 && (
                <button
                  type="button"
                  className="cf-btn-abort"
                  style={{ marginTop: "8px", width: "100%", fontSize: "0.75rem", padding: "6px" }}
                  onClick={() => setShowAll((v) => !v)}
                >
                  {showAll ? "Sembunyikan" : `Lihat Semua (${stats.total})`}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
