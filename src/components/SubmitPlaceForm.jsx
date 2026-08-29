"use client";

import { useState } from "react";
import { createPlace } from "../api";
import {
  accessTypeOptions,
  bandOptions,
  categoryOptions,
  defaultSubmissionForm,
  imageToneOptions,
  imageToneLabels,
  localizeLabel,
  passwordSourceOptions,
} from "../lib/constants";
import { InfoBanner, SectionHeader } from "./ui";
import { SelectField } from "./FormControls";
import { LocationPicker } from "./LocationPicker";
import { compressReviewImage } from "../lib/browserImage";
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

  function handleLocationPick({ latitude, longitude, district, address }) {
    setForm((current) => ({
      ...current,
      latitude: String(latitude),
      longitude: String(longitude),
      district: district || current.district,
      address: address || current.address,
    }));
  }

  async function handleImageChange(event) {
    const file = event.target.files?.[0];
    if (!file) {
      setForm((current) => ({ ...current, imageUrl: "" }));
      return;
    }
    if (!file.type.startsWith("image/")) {
      setStatus({ tone: "danger", text: "File harus berupa gambar." });
      event.target.value = "";
      return;
    }
    try {
      const imageUrl = await compressReviewImage(file);
      if (imageUrl.length > 900_000) {
        setStatus({ tone: "danger", text: "Foto terlalu besar setelah dikompresi, coba foto lain." });
        setForm((current) => ({ ...current, imageUrl: "" }));
        event.target.value = "";
        return;
      }
      setStatus({ tone: "", text: "" });
      setForm((current) => ({ ...current, imageUrl }));
    } catch (error) {
      setStatus({ tone: "danger", text: error.message });
    }
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
      <form className="submit-form" onSubmit={handleSubmit}>
        {/* Section 1: Informasi Utama */}
        <div className="form-section">
          <div className="form-section-header">
            <h3 className="form-section-title">Informasi Utama</h3>
            <p className="form-section-description">Cari lokasi di peta atau gunakan lokasi kamu — kecamatan, alamat, dan koordinat terisi otomatis.</p>
          </div>
          <LocationPicker onPick={handleLocationPick} />
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
            <div className="field">
              <span>Kategori</span>
              <SelectField
                name="category"
                value={form.category}
                onChange={updateField}
                options={categoryOptions.map((item) => ({
                  value: item,
                  label: localizeLabel(item),
                }))}
              />
            </div>
            <div className="field">
              <span>Jenis akses</span>
              <SelectField
                name="wifiAccessType"
                value={form.wifiAccessType}
                onChange={updateField}
                options={accessTypeOptions.map((item) => ({
                  value: item,
                  label: localizeLabel(item),
                }))}
              />
            </div>
          </div>

          <div className="submit-form__grid">
            <label className="field">
              <span>Lintang</span>
              <input
                name="latitude"
                value={form.latitude}
                onChange={updateField}
                placeholder="-5.38"
                readOnly
                title="Terisi otomatis dari peta"
              />
            </label>
            <label className="field">
              <span>Bujur</span>
              <input
                name="longitude"
                value={form.longitude}
                onChange={updateField}
                placeholder="105.25"
                readOnly
                title="Terisi otomatis dari peta"
              />
            </label>
          </div>
        </div>

        {/* Section 2: Ketersediaan & Fasilitas */}
        <div className="form-section">
          <div className="form-section-header">
            <h3 className="form-section-title">Ketersediaan & Fasilitas</h3>
            <p className="form-section-description">Centang opsi fasilitas yang tersedia di lokasi ini.</p>
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
        </div>

        {/* Section 3: Detail Koneksi WiFi */}
        <div className="form-section">
          <div className="form-section-header">
            <h3 className="form-section-title">Detail Koneksi WiFi</h3>
            <p className="form-section-description">SSID, jenis band, password WiFi, serta sumber password.</p>
          </div>
          <div className="submit-form__grid submit-form__grid--triple">
            <label className="field">
              <span>SSID</span>
              <input
                name="wifiSsid"
                value={form.wifiSsid}
                onChange={updateField}
                placeholder="Contoh: CafeWiFi-5G"
                maxLength={32}
              />
            </label>
            <div className="field">
              <span>Band</span>
              <SelectField
                name="wifiBand"
                value={form.wifiBand}
                onChange={updateField}
                options={bandOptions.map((b) => ({ value: b, label: b }))}
              />
            </div>
            <label className="field">
              <span>Password WiFi publik</span>
              <input
                name="wifiPassword"
                value={form.wifiPassword}
                onChange={updateField}
                placeholder="Hanya jika terpampang"
              />
            </label>
          </div>
          <div className="submit-form__grid">
            <div className="field">
              <span>Sumber password</span>
              <SelectField
                name="passwordSource"
                value={form.passwordSource}
                onChange={updateField}
                placeholder="Pilih sumber"
                allowEmpty
                options={passwordSourceOptions.map((item) => ({
                  value: item,
                  label: localizeLabel(item),
                }))}
              />
            </div>
            <label className="toggle-card" style={{ alignSelf: "end" }}>
              <input type="checkbox" name="isHype" checked={form.isHype} onChange={updateField} />
              <div><strong>Tempat hype</strong><span>Password hanya tampil jika login.</span></div>
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
        </div>

        {/* Section 4: Kinerja Awal WiFi */}
        <div className="form-section">
          <div className="form-section-header">
            <h3 className="form-section-title">Kinerja Awal WiFi</h3>
            <p className="form-section-description">Laporan hasil uji kecepatan internet di lokasi jika ada.</p>
          </div>
          <div className="submit-form__grid submit-form__grid--triple">
            <label className="field">
              <span>Unduh Mbps</span>
              <input
                name="wifiSpeedMbps"
                value={form.wifiSpeedMbps}
                onChange={updateField}
                placeholder="Contoh: 45"
              />
            </label>
            <label className="field">
              <span>Unggah Mbps</span>
              <input
                name="uploadMbps"
                value={form.uploadMbps}
                onChange={updateField}
                placeholder="Contoh: 20"
              />
            </label>
            <label className="field">
              <span>Ping ms</span>
              <input
                name="pingMs"
                value={form.pingMs}
                onChange={updateField}
                placeholder="Contoh: 12"
              />
            </label>
          </div>
        </div>

        {/* Section 5: Operasional & Media */}
        <div className="form-section">
          <div className="form-section-header">
            <h3 className="form-section-title">Operasional & Media</h3>
            <p className="form-section-description">Jam buka operasional, suasana tempat, serta foto pendukung.</p>
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

          <div className="submit-form__grid">
            <div className="field">
              <span>Warna tema gambar</span>
              <SelectField
                name="imageTone"
                value={form.imageTone}
                onChange={updateField}
                options={imageToneOptions.map((tone) => ({
                  value: tone,
                  label: imageToneLabels[tone] || tone,
                }))}
              />
            </div>
            <label className="field">
              <span>Foto tempat</span>
              <input type="file" accept="image/*" onChange={handleImageChange} />
            </label>
          </div>
          {form.imageUrl ? (
            <img
              className="submit-form__preview"
              src={form.imageUrl}
              alt="Preview foto tempat"
            />
          ) : null}
        </div>

        <button
          type="submit"
          className="button button--primary"
          disabled={submitting}
          style={{ marginTop: "8px" }}
        >
          {submitting ? "Mengirim..." : "Kirim tempat untuk ditinjau"}
        </button>
      </form>
    </div>
  );
}
