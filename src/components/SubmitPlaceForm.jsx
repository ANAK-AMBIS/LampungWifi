"use client";

import { useState } from "react";
import { createPlace } from "../api";
import {
  accessTypeOptions,
  categoryOptions,
  defaultSubmissionForm,
  imageToneOptions,
  imageToneLabels,
  localizeLabel,
  passwordSourceOptions,
} from "../lib/constants";
import { InfoBanner, SectionHeader } from "./ui";
import { LoginGate } from "./LoginGate";
import { useAuth } from "../lib/useAuth";

export function SubmitPlaceForm() {
  const auth = useAuth();
  const [form, setForm] = useState(defaultSubmissionForm);
  const [status, setStatus] = useState({ tone: "", text: "" });
  const [submitting, setSubmitting] = useState(false);

  function updateField(event) {
    const { name, value, type, checked } = event.target;
    setForm((current) => ({
      ...current,
      [name]: type === "checkbox" ? checked : value,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!auth.user) {
      setStatus({
        tone: "danger",
        text: "Login Google diperlukan sebelum mengirim tempat.",
      });
      return;
    }
    setSubmitting(true);
    setStatus({ tone: "", text: "" });

    try {
      await createPlace({
        ...form,
        latitude: form.latitude ? Number(form.latitude) : null,
        longitude: form.longitude ? Number(form.longitude) : null,
        wifiSpeedMbps: form.wifiSpeedMbps ? Number(form.wifiSpeedMbps) : null,
        uploadMbps: form.uploadMbps ? Number(form.uploadMbps) : null,
        pingMs: form.pingMs ? Number(form.pingMs) : null,
      });

      setForm(defaultSubmissionForm);
      setStatus({
        tone: "success",
        text: "Tempat terkirim ke antrean moderasi. Admin harus meninjau sebelum tampil publik.",
      });
    } catch (error) {
      setStatus({ tone: "danger", text: error.message });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <SectionHeader
        title="Detail tempat dan laporan kualitas awal"
        description="Password tetap opsional, tapi sumber wajib diisi saat password dibagikan."
      />
      {status.text ? (
        <InfoBanner tone={status.tone}>{status.text}</InfoBanner>
      ) : null}
      <LoginGate {...auth} />
      <form className="submit-form" onSubmit={handleSubmit}>
        <div className="submit-form__grid">
          <label className="field">
            <span>Nama tempat</span>
            <input
              name="name"
              value={form.name}
              onChange={updateField}
              required
            />
          </label>
          <label className="field">
            <span>Kecamatan</span>
            <input
              name="district"
              value={form.district}
              onChange={updateField}
              required
            />
          </label>
        </div>

        <label className="field">
          <span>Alamat</span>
          <input
            name="address"
            value={form.address}
            onChange={updateField}
            required
          />
        </label>

        <div className="submit-form__grid">
          <label className="field">
            <span>Kategori</span>
            <select
              name="category"
              value={form.category}
              onChange={updateField}
            >
              {categoryOptions.map((item) => (
                <option key={item} value={item}>
                  {localizeLabel(item)}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Jenis akses</span>
            <select
              name="wifiAccessType"
              value={form.wifiAccessType}
              onChange={updateField}
            >
              {accessTypeOptions.map((item) => (
                <option key={item} value={item}>
                  {localizeLabel(item)}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="submit-form__grid">
          <label className="field">
            <span>Lintang</span>
            <input
              name="latitude"
              value={form.latitude}
              onChange={updateField}
              placeholder="-5.38"
            />
          </label>
          <label className="field">
            <span>Bujur</span>
            <input
              name="longitude"
              value={form.longitude}
              onChange={updateField}
              placeholder="105.25"
            />
          </label>
        </div>

        <div className="toggle-grid">
          <label className="toggle-card">
            <input
              type="checkbox"
              name="wifiAvailable"
              checked={form.wifiAvailable}
              onChange={updateField}
            />
            <div>
              <strong>WiFi tersedia</strong>
              <span>
                Matikan jika tempat ini sedang tidak punya koneksi aktif.
              </span>
            </div>
          </label>
          <label className="toggle-card">
            <input
              type="checkbox"
              name="hasPowerOutlets"
              checked={form.hasPowerOutlets}
              onChange={updateField}
            />
            <div>
              <strong>Colokan listrik</strong>
              <span>Penting untuk sesi kerja lebih dari satu jam.</span>
            </div>
          </label>
          <label className="toggle-card">
            <input
              type="checkbox"
              name="quietZone"
              checked={form.quietZone}
              onChange={updateField}
            />
            <div>
              <strong>Area tenang</strong>
              <span>
                Tandai hanya jika panggilan dan kerja fokus masih realistis.
              </span>
            </div>
          </label>
          <label className="toggle-card">
            <input
              type="checkbox"
              name="open24Hours"
              checked={form.open24Hours}
              onChange={updateField}
            />
            <div>
              <strong>Buka 24 jam</strong>
              <span>Berguna untuk kerja malam atau perjalanan.</span>
            </div>
          </label>
        </div>

        <div className="submit-form__grid">
          <label className="field">
            <span>Password WiFi publik</span>
            <input
              name="wifiPassword"
              value={form.wifiPassword}
              onChange={updateField}
              placeholder="Hanya jika terpampang publik atau disetujui pemilik"
            />
          </label>
          <label className="field">
            <span>Sumber password</span>
            <select
              name="passwordSource"
              value={form.passwordSource}
              onChange={updateField}
            >
              <option value="">Pilih sumber</option>
              {passwordSourceOptions.map((item) => (
                <option key={item} value={item}>
                  {localizeLabel(item)}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="field">
          <span>Catatan akses</span>
          <textarea
            name="accessNotes"
            value={form.accessNotes}
            onChange={updateField}
            placeholder="Contoh: tanya kasir setelah pesan, atau pakai portal setelah check-in."
          />
        </label>

        <div className="submit-form__grid submit-form__grid--triple">
          <label className="field">
            <span>Unduh Mbps</span>
            <input
              name="wifiSpeedMbps"
              value={form.wifiSpeedMbps}
              onChange={updateField}
            />
          </label>
          <label className="field">
            <span>Unggah Mbps</span>
            <input
              name="uploadMbps"
              value={form.uploadMbps}
              onChange={updateField}
            />
          </label>
          <label className="field">
            <span>Ping ms</span>
            <input
              name="pingMs"
              value={form.pingMs}
              onChange={updateField}
            />
          </label>
        </div>

        <div className="submit-form__grid">
          <label className="field">
            <span>Jam operasional</span>
            <input
              name="operatingHours"
              value={form.operatingHours}
              onChange={updateField}
              placeholder="Mon-Fri 08:00-22:00"
            />
          </label>
          <label className="field">
            <span>Label suasana</span>
            <input
              name="ambienceLabel"
              value={form.ambienceLabel}
              onChange={updateField}
              placeholder="Area tenang / pusat kerja / pilihan singgah"
            />
          </label>
        </div>

        <label className="field">
          <span>Catatan peta atau konteks</span>
          <textarea
            name="mapContext"
            value={form.mapContext}
            onChange={updateField}
            placeholder="Patokan, lantai, area duduk terbaik, atau kampus/bisnis terdekat."
          />
        </label>

        <label className="field">
          <span>Warna tema gambar</span>
          <select
            name="imageTone"
            value={form.imageTone}
            onChange={updateField}
          >
            {imageToneOptions.map((tone) => (
              <option key={tone} value={tone}>
                {imageToneLabels[tone] || tone}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>URL gambar</span>
          <input
            type="url"
            name="imageUrl"
            value={form.imageUrl}
            onChange={updateField}
            placeholder="https://i.ibb.co/.../workspace-lampung.jpg"
          />
        </label>

        <button
          type="submit"
          className="button button--primary"
          disabled={submitting}
        >
          {submitting ? "Mengirim..." : "Kirim tempat untuk ditinjau"}
        </button>
      </form>
    </div>
  );
}
