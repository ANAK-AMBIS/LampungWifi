"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { getSpeedHistory, saveSpeedResult } from "../api";
import { useAuth } from "../lib/useAuth";
import { formatDate, formatMbps } from "../lib/format";
import { InfoBanner, SectionHeader, StatusPill, MetricTile } from "./ui";
import { LoginGate } from "./LoginGate";

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

export function SpeedTestWidget({ placeId, initialStats, initialTests, onSaved }) {
  const auth = useAuth();
  const engineRef = useRef(null);
  const [status, setStatus] = useState("idle"); // idle | running | paused | finished | error | saving
  const [live, setLive] = useState({ dl: null, ul: null, ping: null, jitter: null, progress: 0, phase: "" });
  const [history, setHistory] = useState(initialTests || []);
  const [stats, setStats] = useState(initialStats || null);
  const [msg, setMsg] = useState({ tone: "", text: "" });
  const [showAll, setShowAll] = useState(false);

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

  async function startTest() {
    if (!auth.user) {
      setMsg({ tone: "danger", text: "Login Google diperlukan untuk menyimpan hasil speedtest." });
      return;
    }
    setMsg({ tone: "", text: "" });
    setStatus("running");
    setLive({ dl: null, ul: null, ping: null, jitter: null, progress: 0, phase: "Memulai..." });

    try {
      const { default: SpeedTest } = await import("@cloudflare/speedtest");
      // clean previous
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
        // estimate progress by duration vs expected ~25s
        // use getDownloadBandwidthPoints + getUploadBandwidthPoints count as heuristic
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
          // summary fields: download, upload, latency, jitter, etc (bps)
          const dlMbps = summary.download ? summary.download / 1e6 : results.getDownloadBandwidth() ? results.getDownloadBandwidth() / 1e6 : 0;
          const ulMbps = summary.upload ? summary.upload / 1e6 : results.getUploadBandwidth() ? results.getUploadBandwidth() / 1e6 : null;
          const pingMs = summary.latency ?? results.getUnloadedLatency() ?? null;
          const jitterMs = summary.jitter ?? results.getUnloadedJitter?.() ?? null;
          const durationMs = results.getTotalDurationMs?.() ?? null;

          setLive((c) => ({ ...c, dl: dlMbps, ul: ulMbps, ping: pingMs, jitter: jitterMs, progress: 100, phase: "Selesai" }));
          setStatus("saving");
          setMsg({ tone: "muted", text: "Menyimpan hasil ke sistem..." });

          await saveSpeedResult(placeId, {
            downloadMbps: Math.round(dlMbps * 10) / 10,
            uploadMbps: ulMbps != null ? Math.round(ulMbps * 10) / 10 : null,
            pingMs: pingMs != null ? Math.round(pingMs) : null,
            jitterMs: jitterMs != null ? Math.round(jitterMs * 10) / 10 : null,
            durationMs: durationMs != null ? Math.round(durationMs) : null,
            rawSummary: summary,
          });

          setStatus("finished");
          setMsg({ tone: "success", text: `Hasil tersimpan: ${dlMbps.toFixed(1)} Mbps ↓ / ${ulMbps ? ulMbps.toFixed(1) + " Mbps ↑" : "-"} — ping ${pingMs ? Math.round(pingMs) + " ms" : "-"}` });
          await fetchHistory();
          if (onSaved) onSaved();
        } catch (err) {
          if (err.message?.includes("Batas 3 tes")) {
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
    startTest();
  }

  const isRunning = status === "running" || status === "paused" || status === "saving";
  const dlDisplay = live.dl != null ? `${formatMbps(live.dl)} Mbps` : "—";
  const ulDisplay = live.ul != null ? `${formatMbps(live.ul)} Mbps` : "—";
  const pingDisplay = live.ping != null ? `${Math.round(live.ping)} ms` : "—";
  const jitterDisplay = live.jitter != null ? `${Number(live.jitter).toFixed(1)} ms` : "—";

  return (
    <article className="panel">
      <SectionHeader
        title="Speedtest Cloudflare"
        description="Uji kecepatan WiFi langsung dari browser ke edge Cloudflare terdekat (kuota ringkas ~40 MB). Hasil otomatis kecatet & masuk avg 30 hari."
        action={stats ? <StatusPill tone="muted">{stats.count ?? 0} tes (30h)</StatusPill> : null}
      />

      {/* Live gauge */}
      <div className="quality-grid" style={{ marginBottom: 12 }}>
        <MetricTile label="Download" value={dlDisplay} />
        <MetricTile label="Upload" value={ulDisplay} />
        <MetricTile label="Ping" value={pingDisplay} />
        <MetricTile label="Jitter" value={jitterDisplay} />
      </div>

      {/* Progress */}
      {status !== "idle" ? (
        <div style={{ marginBottom: 12 }}>
          <div style={{ height: 8, background: "#e5e7eb", borderRadius: 999, overflow: "hidden" }}>
            <div style={{ width: `${live.progress}%`, height: "100%", background: status === "error" ? "#ef4444" : status === "finished" ? "#10b981" : "#3b82f6", transition: "width 0.4s" }} />
          </div>
          <small style={{ color: "#6b7280" }}>{live.phase} {isRunning ? `${live.progress}%` : ""} {status === "paused" ? "— dijeda" : ""}</small>
        </div>
      ) : null}

      {/* 30d avg */}
      {stats ? (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
          <StatusPill tone="info">Avg 30h: {stats.avg_download != null ? `${formatMbps(stats.avg_download)} ↓` : "—"} </StatusPill>
          <StatusPill tone="info">{stats.avg_upload != null ? `${formatMbps(stats.avg_upload)} ↑` : "— up"}</StatusPill>
          <StatusPill tone="muted">{stats.avg_ping != null ? `${Math.round(stats.avg_ping)} ms` : "— ping"}</StatusPill>
          <small style={{ color: "#6b7280", alignSelf: "center" }}>{stats.total != null ? `${stats.total} total` : ""} {stats.last_test_at ? `• terakhir ${formatDate(stats.last_test_at)}` : ""}</small>
        </div>
      ) : null}

      {msg.text ? <InfoBanner tone={msg.tone} style={{ marginBottom: 12 }}>{msg.text}</InfoBanner> : null}
      <LoginGate {...auth} />

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
        {status === "idle" || status === "finished" || status === "error" ? (
          <button type="button" className="button button--primary" onClick={startTest} disabled={isRunning && status !== "error" && status !== "finished"}>
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
      <small style={{ color: "#6b7280" }}>Tes butuh ~25 detik & ~40 MB. Hasil dikirim ke Cloudflare untuk agregasi (sesuai TOS Cloudflare) dan disimpan di BalamWiFi. Batas 3 tes/jam/lokasi.</small>

      {/* History */}
      <div style={{ marginTop: 16 }}>
        <h4 style={{ margin: "0 0 8px", fontSize: 14 }}>Riwayat tes lokasi ini</h4>
        {history.length ? (
          <>
            <div style={{ display: "grid", gap: 8 }}>
              {history.map((t) => (
                <div key={t.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 10px", border: "1px solid #e5e7eb", borderRadius: 8, background: "#f9fafb" }}>
                  <div>
                    <strong>{formatMbps(t.download_mbps)} ↓</strong> <span style={{ color: "#6b7280" }}>/ {t.upload_mbps != null ? `${formatMbps(t.upload_mbps)} ↑` : "—"}</span> <StatusPill tone="muted">{t.ping_ms != null ? `${t.ping_ms} ms` : "—"}</StatusPill> {t.jitter_ms != null ? <StatusPill tone="muted">±{Number(t.jitter_ms).toFixed(1)} ms</StatusPill> : null}
                    <div style={{ fontSize: 12, color: "#6b7280" }}>{t.tested_by_name} • {formatDate(t.created_at)} {t.duration_ms ? `• ${Math.round(t.duration_ms / 1000)}s` : ""}</div>
                  </div>
                  <small style={{ color: "#9ca3af" }}>#{t.id}</small>
                </div>
              ))}
            </div>
            {stats && stats.total > 5 ? (
              <button type="button" className="button button--ghost button--small" style={{ marginTop: 8 }} onClick={() => setShowAll((v) => !v)}>
                {showAll ? "Tampilkan 5 saja" : `Lihat semua (${stats.total})`}
              </button>
            ) : null}
          </>
        ) : (
          <p style={{ color: "#6b7280", fontSize: 13 }}>Belum ada tes. Jadilah yang pertama!</p>
        )}
      </div>
    </article>
  );
}
