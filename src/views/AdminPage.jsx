"use client";

import { useEffect, useState } from "react";
import { getAdminSubmissions, updateSubmissionStatus } from "../api";
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
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    let active = true;

    async function loadQueue() {
      try {
        setState((current) => ({ ...current, loading: true, error: "" }));
        const response = await getAdminSubmissions();

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
                    </div>
                    <p>
                      {submission.access_notes || "Belum ada catatan akses."}
                    </p>
                    <small>
                      Dibuat {formatDate(submission.created_at)}. Sumber
                      password:{" "}
                      {localizeLabel(submission.password_source) ||
                        "belum diisi"}
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
