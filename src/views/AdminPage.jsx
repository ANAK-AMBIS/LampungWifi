"use client";

import { useEffect, useState } from "react";
import { getAdminSubmissions, updateSubmissionStatus, getAdminWifi, updateWifiStatus } from "../api";
import { localizeLabel } from "../lib/constants";
import { formatDate, formatMbps } from "../lib/format";
import {
  InfoBanner,
  LoadingGrid,
  MetricTile,
  SectionHeader,
  StatusPill,
} from "../components/ui";
import { localizeStatus } from "../lib/pageLabels";

export function AdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [state, setState] = useState({
    loading: true,
    error: "",
    source: "",
    stats: null,
    submissions: [],
  });
  const [wifiQueue, setWifiQueue] = useState([]);
  const [busyId, setBusyId] = useState(null);
  const [busyWifiId, setBusyWifiId] = useState(null);

  useEffect(() => {
    let active = true;

    async function loadQueue() {
      try {
        setState((current) => ({ ...current, loading: true, error: "" }));
        const [response, wifiRes] = await Promise.all([
          getAdminSubmissions(),
          getAdminWifi().catch(() => ({ data: [] })),
        ]);

        if (!active) {
          return;
        }

        setState({
          loading: false,
          error: "",
          source: response.meta.source,
          stats: response.data.stats,
          submissions: response.data.submissions,
        });
        setWifiQueue(Array.isArray(wifiRes.data) ? wifiRes.data : wifiRes.data || []);
      } catch (error) {
        if (!active) {
          return;
        }

        setState({
          loading: false,
          error: error.message,
          source: "",
          stats: null,
          submissions: [],
        });
      }
    }

    loadQueue();
    return () => {
      active = false;
    };
  }, [isAuthenticated]);

  async function handleLogin(event) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const token = String(formData.get("adminToken") ?? "").trim();

    if (!token) {
      setLoginError("Token tidak boleh kosong");
      return;
    }

    setLoginError("");

    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        setLoginError(payload.error || "Token tidak valid");
        return;
      }

      setIsAuthenticated(true);
    } catch (error) {
      setLoginError(error.message);
    }
  }

  async function moderate(placeId, status) {
    setBusyId(placeId);
    try {
      await updateSubmissionStatus(placeId, status);
      const refreshed = await getAdminSubmissions();
      setState({
        loading: false,
        error: "",
        source: refreshed.meta.source,
        stats: refreshed.data.stats,
        submissions: refreshed.data.submissions,
      });
    } catch (error) {
      setState((current) => ({ ...current, error: error.message }));
    } finally {
      setBusyId(null);
    }
  }

  async function moderateWifi(credId, status) {
    setBusyWifiId(credId);
    try {
      await updateWifiStatus(credId, status);
      const wifiRes = await getAdminWifi();
      setWifiQueue(Array.isArray(wifiRes.data) ? wifiRes.data : []);
    } catch (error) {
      setState((current) => ({ ...current, error: error.message }));
    } finally {
      setBusyWifiId(null);
    }
  }

  return (
    <main className="page">
      <section className="section">
        <SectionHeader
          title="Menunggu persetujuan"
          description="Antrean admin menjaga aturan password legal dan memblokir data WiFi pribadi yang belum terverifikasi."
          action={
            <StatusPill tone="muted">
              Sumber: {state.source || "memuat"}
            </StatusPill>
          }
        />

        {state.error ? (
          <InfoBanner tone="danger">{state.error}</InfoBanner>
        ) : null}
        {loginError ? (
          <InfoBanner tone="danger">{loginError}</InfoBanner>
        ) : null}
        <form className="admin-token-form" onSubmit={handleLogin}>
          <label className="field">
            <span>Token admin</span>
            <input
              name="adminToken"
              type="password"
              placeholder="Tempel ADMIN_TOKEN untuk moderasi terlindungi"
            />
          </label>
          <button type="submit" className="button button--primary">
            Login admin
          </button>
        </form>
        {state.loading ? (
          <LoadingGrid />
        ) : (
          <>
            <div className="admin-metrics">
              <MetricTile
                label="Tempat disetujui"
                value={String(state.stats?.total_spots ?? 0)}
              />
              <MetricTile
                label="Menunggu tinjauan"
                value={String(state.stats?.pending_submissions ?? 0)}
              />
              <MetricTile
                label="Ditolak"
                value={String(state.stats?.rejected_submissions ?? 0)}
              />
              <MetricTile
                label="Kontributor aktif"
                value={String(state.stats?.active_contributors ?? 0)}
              />
            </div>

            <div className="admin-queue" style={{ marginBottom: 24 }}>
              <SectionHeader title="Antrean WiFi (SSID/Password)" description="Setiap SSID baru butuh approve. Tampil 2 default di halaman detail." />
              {wifiQueue.length ? wifiQueue.map((c) => (
                <article key={c.id} className="submission-card">
                  <div className="submission-card__copy">
                    <div className="submission-card__head"><div><h3>{c.ssid} <StatusPill tone="info">{c.band}</StatusPill></h3><p>Place #{c.place_id} — {c.password || "Open"}</p></div><StatusPill tone="warning">{localizeStatus(c.status)}</StatusPill></div>
                    <div className="submission-card__meta"><StatusPill tone="muted">{c.submitted_by_name}</StatusPill><StatusPill tone="muted">{c.submitted_by_email}</StatusPill><StatusPill tone="muted">{localizeLabel(c.password_source) || "tanpa sumber"}</StatusPill></div>
                    <small>Dibuat {formatDate(c.created_at)}</small>
                  </div>
                  <div className="submission-card__actions">
                    <button type="button" className="button button--primary" disabled={busyWifiId === c.id} onClick={() => moderateWifi(c.id, "approved")}>Setujui WiFi</button>
                    <button type="button" className="button button--ghost" disabled={busyWifiId === c.id} onClick={() => moderateWifi(c.id, "rejected")}>Tolak</button>
                  </div>
                </article>
              )) : <p style={{ color: "#6b7280" }}>Tidak ada pengajuan WiFi pending.</p>}
            </div>

            <div className="admin-queue">
              {state.submissions.map((submission) => (
                <article key={submission.id} className="submission-card">
                  <div className="submission-card__copy">
                    <div className="submission-card__head">
                      <div>
                        <h3>{submission.name}</h3>
                        <p>{submission.address}</p>
                      </div>
                      <StatusPill
                        tone={
                          submission.status === "pending" ? "warning" : "danger"
                        }
                      >
                        {localizeStatus(submission.status)}
                      </StatusPill>
                    </div>
                    <div className="submission-card__meta">
                      <StatusPill tone="muted">
                        {localizeLabel(submission.category)}
                      </StatusPill>
                      <StatusPill tone="muted">
                        {submission.submitter_name ||
                          "Pengirim tidak diketahui"}
                      </StatusPill>
                      <StatusPill tone="info">
                        {submission.wifi_speed_mbps
                          ? `${formatMbps(submission.wifi_speed_mbps)} Mbps`
                          : "Kecepatan menunggu"}
                      </StatusPill>
                      {submission.is_hype ? <StatusPill tone="warning">HYPE</StatusPill> : null}
                    </div>
                    <p>
                      {submission.access_notes || "Belum ada catatan akses."}
                    </p>
                    <small>
                      Dibuat {formatDate(submission.created_at)}. Sumber
                      password:{" "}
                      {localizeLabel(submission.password_source) ||
                        "belum diisi"}
                      {submission.wifi_ssid ? ` — SSID: ${submission.wifi_ssid} (${submission.wifi_band})` : ""}
                    </small>
                  </div>
                  <div className="submission-card__actions">
                    <button
                      type="button"
                      className="button button--primary"
                      disabled={busyId === submission.id}
                      onClick={() => moderate(submission.id, "approved")}
                    >
                      Setujui
                    </button>
                    <button
                      type="button"
                      className="button button--ghost"
                      disabled={busyId === submission.id}
                      onClick={() => moderate(submission.id, "rejected")}
                    >
                      Tolak
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </>
        )}
      </section>
    </main>
  );
}
