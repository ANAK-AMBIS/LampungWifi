"use client";

import { useEffect, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";

const NOMINATIM = "https://nominatim.openstreetmap.org";

// Batas area sekitar Bandar Lampung agar hasil pencarian tidak global
// format: minlon,minlat,maxlon,maxlat
const BL_BOUNDS = "105.08,-5.60,105.42,-5.30";

// Lokasi awal peta: pusat Bandar Lampung (kalau belum ada tempat terpilih)
const BL_CENTER = [-5.427, 105.2615];
const BL_ZOOM = 13;

// Ikon marker default Leaflet memakai PNG relatif dari CSS yang sering
// gagal di bundler — pakai URL CDN agar pasti tampil.
const MARKER_ICON = {
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
};

function pickDistrict(address = {}) {
  return (
    address.district ||
    address.county ||
    address.city ||
    address.town ||
    address.suburb ||
    address.municipality ||
    address.state ||
    ""
  );
}

/**
 * Pencari lokasi berbasis peta: cari alamat (Nominatim/OSM), pakai geolokasi
 * perangkat, atau klik langsung di peta Leaflet. Hasilnya mengisi kecamatan,
 * alamat, lintang, bujur lewat callback onPick({ latitude, longitude, district, address }).
 */
export function LocationPicker({ onPick }) {
  const [search, setSearch] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState("");
  const [picked, setPicked] = useState(null);
  const [noResults, setNoResults] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const debounceRef = useRef(null);
  const requestSeq = useRef(0);
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const LRef = useRef(null);

  // Inisialisasi peta Leaflet sekali. JS-nya di-import dinamis supaya aman
  // dari "window is not defined" saat SSR/prerender.
  useEffect(() => {
    let disposed = false;
    let L = null;

    async function initMap() {
      if (!containerRef.current || disposed) return;
      try {
        L = await import("leaflet");
        if (disposed || !containerRef.current) return;

        const map = L.map(containerRef.current, {
          center: BL_CENTER,
          zoom: BL_ZOOM,
          scrollWheelZoom: false,
        });
        mapRef.current = map;
        LRef.current = L;

        L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        }).addTo(map);

        map.on("click", (event) => {
          const { lat, lng } = event.latlng;
          // Klik peta → set marker langsung, lalu cari alamat via reverse geocode.
          const rounded = {
            latitude: Number(lat.toFixed(6)),
            longitude: Number(lng.toFixed(6)),
          };
          const icon = L.icon(MARKER_ICON);
          if (markerRef.current) {
            markerRef.current.setLatLng([lat, lng]);
          } else {
            markerRef.current = L.marker([lat, lng], { icon }).addTo(map);
          }
          setPicked({ ...rounded });
          setError("");
          reverseGeocode(lat, lng).then((geo) => {
            if (onPick) {
              onPick({
                ...rounded,
                district: geo.district ?? "",
                address: geo.address ?? "",
              });
            }
          });
        });

        setMapReady(true);
      } catch {
        setError(
          "Peta gagal dimuat. Kamu tetap bisa pakai pencarian lokasi di atas."
        );
      }
    }

    initMap();

    return () => {
      disposed = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        markerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sinkronkan peta saat `picked` berubah (dari pencarian / geolokasi).
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !picked) return;
    const lat = Number(picked.latitude);
    const lng = Number(picked.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

    map.setView([lat, lng], Math.max(map.getZoom(), 16));
    if (markerRef.current) {
      markerRef.current.setLatLng([lat, lng]);
    } else if (LRef.current) {
      markerRef.current = LRef.current.marker([lat, lng], {
        icon: LRef.current.icon(MARKER_ICON),
      }).addTo(mapRef.current);
    }
  }, [picked]);

  // Pencarian lokasi dengan debounce
  function handleSearchChange(e) {
    const next = e.target.value;
    setSearch(next);
    if (next.trim().length < 3) {
      setResults([]);
      setSearching(false);
      setNoResults(false);
    } else {
      setSearching(true);
      setNoResults(false);
    }
  }

  useEffect(() => {
    if (search.trim().length < 3) return undefined;
    const seq = ++requestSeq.current;
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const q = encodeURIComponent(search.trim());
        const res = await fetch(
          `${NOMINATIM}/search?format=jsonv2&q=${q}&limit=6&accept-language=id&countrycodes=id&bounded=1&viewbox=${BL_BOUNDS}`
        );
        const data = await res.json();
        if (seq !== requestSeq.current) return;
        const list = Array.isArray(data) ? data : [];
        setResults(list);
        setNoResults(list.length === 0);
      } catch {
        if (seq !== requestSeq.current) return;
        setResults([]);
        setNoResults(true);
      } finally {
        if (seq === requestSeq.current) setSearching(false);
      }
    }, 400);
    return () => clearTimeout(debounceRef.current);
  }, [search]);

  async function reverseGeocode(lat, lng) {
    try {
      const res = await fetch(
        `${NOMINATIM}/reverse?format=jsonv2&lat=${lat}&lon=${lng}&accept-language=id`
      );
      const data = await res.json();
      return {
        district: pickDistrict(data.address),
        address: data.display_name || "",
      };
    } catch {
      return { district: "", address: "" };
    }
  }

  function applyPick(lat, lng, extra = {}) {
    const rounded = {
      latitude: Number(lat.toFixed(6)),
      longitude: Number(lng.toFixed(6)),
    };
    setPicked({ ...rounded, ...extra });
    setError("");
    if (onPick) {
      onPick({
        ...rounded,
        district: extra.district ?? "",
        address: extra.address ?? "",
      });
    }
  }

  function handleSearchResult(item) {
    const lat = Number(item.lat);
    const lng = Number(item.lon);
    setSearch("");
    setResults([]);
    setNoResults(false);
    applyPick(lat, lng, {
      district: pickDistrict(item.address),
      address: item.display_name || "",
    });
  }

  function handleUseMyLocation() {
    setError("");
    if (!("geolocation" in navigator)) {
      setError("Browser kamu tidak mendukung geolokasi. Gunakan pencarian lokasi.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        const geo = await reverseGeocode(latitude, longitude);
        applyPick(latitude, longitude, {
          district: geo.district,
          address: geo.address,
        });
        setLocating(false);
      },
      (err) => {
        setLocating(false);
        if (err.code === 1) {
          setError("Izin lokasi ditolak. Gunakan pencarian lokasi di atas.");
        } else if (err.code === 2) {
          setError("Posisi tidak tersedia saat ini. Coba lagi atau cari manual.");
        } else {
          setError("Gagal mengambil lokasi. Coba lagi.");
        }
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 }
    );
  }

  return (
    <div className="location-picker">
      <div className="location-picker__input-row">
        <input
          type="text"
          className="location-picker__input"
          value={search}
          onChange={handleSearchChange}
          placeholder="Cari tempat di Bandar Lampung…"
        />
        <button
          type="button"
          className="button button--ghost location-picker__locate"
          onClick={handleUseMyLocation}
          disabled={locating}
        >
          {locating ? "Mencari…" : "Gunakan lokasi saya"}
        </button>
      </div>

      {searching ? <small className="location-picker__hint">Mencari…</small> : null}

      {results.length ? (
        <div className="location-picker__results">
          {results.map((item) => (
            <button
              type="button"
              key={item.place_id}
              className="location-picker__result"
              onClick={() => handleSearchResult(item)}
            >
              <span className="location-picker__result-title">
                {item.display_name.split(",")[0]}
              </span>
              <span className="location-picker__result-sub">
                {item.display_name}
              </span>
            </button>
          ))}
        </div>
      ) : null}

      {noResults ? (
        <div className="location-picker__empty">
          <p>Tidak ditemukan di sekitar Bandar Lampung.</p>
          <span>
            Data peta (OpenStreetMap) bisa ketinggalan dari Google Maps. Coba cari nama
            jalan atau patokan terdekat, atau tekan "Gunakan lokasi saya" jika kamu
            sedang berada di lokasi.
          </span>
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(search.trim() + " Bandar Lampung")}`}
            target="_blank"
            rel="noreferrer"
            className="button button--ghost button--small"
          >
            Buka di Google Maps
          </a>
        </div>
      ) : null}

      {error ? <small className="location-picker__error">{error}</small> : null}

      <div className="location-picker__map">
        <div
          ref={containerRef}
          className="location-picker__map-canvas"
          aria-label="Peta OpenStreetMap — klik untuk memilih lokasi"
        />
        {!mapReady ? (
          <div className="location-picker__placeholder">
            <i className="hgi-stroke hgi-map-pin location-picker__pin" aria-hidden="true" />
            <p>
              Cari lokasi di atas, tekan "Gunakan lokasi saya", atau klik peta —
              kecamatan, alamat, dan koordinat akan terisi otomatis.
            </p>
          </div>
        ) : null}
      </div>

      {picked ? (
        <div className="location-picker__coords">
          <strong>
            {picked.latitude.toFixed(6)}, {picked.longitude.toFixed(6)}
          </strong>
          <span>Koordinat terisi otomatis dari peta.</span>
        </div>
      ) : null}
    </div>
  );
}
