"use client";

import { useAuth } from "../../src/lib/useAuth";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Clock,
  FileText,
  LayoutDashboard,
  LogOut,
  MapPin,
  MessageSquare,
  Plus,
  Search,
  Star,
} from "lucide-react";
import { SubmitPlaceForm } from "../../src/components/SubmitPlaceForm";

export default function DashboardPage() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const [submissions, setSubmissions] = useState(null);
  const [reviews, setReviews] = useState(null);
  const [tab, setTab] = useState("overview");

  useEffect(() => {
    if (user === null) {
      router.replace("/api/auth/google");
      return;
    }
    if (!user) return;

    fetch("/api/auth/me/submissions")
      .then((r) => r.json())
      .then((d) => setSubmissions(d.data ?? []))
      .catch(() => setSubmissions([]));

    fetch("/api/auth/me/reviews")
      .then((r) => r.json())
      .then((d) => setReviews(d.data ?? []))
      .catch(() => setReviews([]));
  }, [user, router]);

  if (!user) {
    return (
      <main className="static-page">
        <section className="static-card">
          <p>Memeriksa sesi…</p>
        </section>
      </main>
    );
  }

  const isLoaded = submissions !== null && reviews !== null;

  return (
    <main className="static-page">
      {/* Profile */}
      <section
        className="static-card static-card--hero"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        {user.picture ? (
          <img
            src={user.picture}
            alt=""
            style={{ width: 56, height: 56, borderRadius: "50%" }}
          />
        ) : (
          <span
            style={{
              width: 56,
              height: 56,
              borderRadius: "50%",
              background: "#e5efe5",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "1.5rem",
              fontWeight: 700,
              color: "#245f3c",
            }}
          >
            {user.name?.charAt(0) ?? "?"}
          </span>
        )}
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: "clamp(1.4rem, 3vw, 2rem)", margin: 0 }}>
            Hai, {user.name?.split(" ")[0]}!
          </h1>
          <p style={{ margin: "4px 0 0", color: "#5f584d" }}>{user.email}</p>
        </div>
        <button
          type="button"
          className="button button--ghost"
          onClick={signOut}
        >
          <LogOut size={16} />
          Keluar
        </button>
      </section>

      {/* Tab Navigation */}
      <section
        className="static-card"
        style={{ padding: "clamp(12px, 3vw, 24px)" }}
      >
        <div className="dashboard-tabs">
          <button
            type="button"
            className={`dashboard-tab ${tab === "overview" ? "dashboard-tab--active" : ""}`}
            onClick={() => setTab("overview")}
          >
            <LayoutDashboard size={16} />
            Ringkasan
          </button>
          <button
            type="button"
            className={`dashboard-tab ${tab === "submit" ? "dashboard-tab--active" : ""}`}
            onClick={() => setTab("submit")}
          >
            <Plus size={16} />
            Tambah Tempat
          </button>
        </div>
      </section>

      {/* Tab Content */}
      {tab === "overview" ? (
        !isLoaded ? (
          <section className="static-card">
            <p>Memuat data…</p>
          </section>
        ) : (
          <>
            {/* Stats */}
            <section className="static-card">
              <div className="dashboard-stats">
                <div className="dashboard-stat">
                  <FileText size={20} />
                  <strong>{submissions.length}</strong>
                  <span>Tempat dikirim</span>
                </div>
                <div className="dashboard-stat">
                  <MessageSquare size={20} />
                  <strong>{reviews.length}</strong>
                  <span>Ulasan ditulis</span>
                </div>
                <div className="dashboard-stat">
                  <Star size={20} />
                  <strong>
                    {submissions.filter((s) => s.status === "approved").length}
                  </strong>
                  <span>Disetujui</span>
                </div>
              </div>
            </section>

            {/* Submissions */}
            <section className="static-card">
              <h2>
                <MapPin size={20} />
                Tempat yang Kamu Kirim
              </h2>
              {submissions.length === 0 ? (
                <p style={{ color: "#5f584d" }}>
                  Belum ada tempat yang dikirim.{" "}
                  <button
                    type="button"
                    onClick={() => setTab("submit")}
                    style={{
                      background: "none",
                      border: "none",
                      color: "#245f3c",
                      cursor: "pointer",
                      fontWeight: 600,
                      padding: 0,
                      font: "inherit",
                      textDecoration: "underline",
                    }}
                  >
                    Kirim tempat pertama!
                  </button>
                </p>
              ) : (
                <div className="dashboard-list">
                  {submissions.map((item) => (
                    <article key={item.id} className="dashboard-item">
                      <div>
                        <strong>{item.name}</strong>
                        <span>{item.category}</span>
                      </div>
                      <div className="dashboard-item__meta">
                        <span
                          className={`status-pill status-pill--${
                            item.status === "approved"
                              ? "success"
                              : item.status === "rejected"
                                ? "danger"
                                : "warning"
                          }`}
                        >
                          {item.status === "approved"
                            ? "Disetujui"
                            : item.status === "rejected"
                              ? "Ditolak"
                              : "Menunggu"}
                        </span>
                        <span className="dashboard-item__date">
                          <Clock size={12} />
                          {formatDate(item.created_at)}
                        </span>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>

            {/* Reviews */}
            <section className="static-card">
              <h2>
                <MessageSquare size={20} />
                Ulasan Kamu
              </h2>
              {reviews.length === 0 ? (
                <p style={{ color: "#5f584d" }}>
                  Belum ada ulasan.{" "}
                  <Link href="/places">Cari tempat dan beri ulasan!</Link>
                </p>
              ) : (
                <div className="dashboard-list">
                  {reviews.map((item) => (
                    <article key={item.id} className="dashboard-item">
                      <div>
                        <strong>{item.review_title || "Tanpa judul"}</strong>
                        <span>
                          {item.comment?.slice(0, 80)}
                          {(item.comment?.length ?? 0) > 80 ? "…" : ""}
                        </span>
                      </div>
                      <div className="dashboard-item__meta">
                        <span>
                          ⚡ {item.rating_speed}/5 · 🪑 {item.rating_comfort}/5
                        </span>
                        <span className="dashboard-item__date">
                          <Clock size={12} />
                          {formatDate(item.created_at)}
                        </span>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </>
        )
      ) : (
        <section className="static-card">
          <SubmitPlaceForm />
        </section>
      )}
    </main>
  );
}

function formatDate(dateString) {
  if (!dateString) return "";
  const date = new Date(dateString);
  const now = new Date();
  const diff = now - date;
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days === 0) return "Hari ini";
  if (days === 1) return "Kemarin";
  if (days < 7) return `${days} hari lalu`;
  if (days < 30) return `${Math.floor(days / 7)} minggu lalu`;
  return date.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
