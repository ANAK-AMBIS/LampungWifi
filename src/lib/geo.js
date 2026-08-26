/**
 * Haversine distance in meters between two WGS84 points.
 */
export function haversineMeters(lat1, lng1, lat2, lng2) {
  const toRad = (d) => (d * Math.PI) / 180;
  const R = 6371000; // earth radius meters
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function formatDistance(meters) {
  if (meters == null || !Number.isFinite(meters)) return "—";
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

/**
 * Promise wrapper for navigator.geolocation.getCurrentPosition
 * @param {PositionOptions} opts
 * @returns {Promise<GeolocationPosition>}
 */
export function getCurrentPosition(opts = {}) {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation tidak didukung browser ini"));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, (err) => {
      // normalize message Indonesia
      let msg = err.message || "Gagal mendapatkan lokasi";
      if (err.code === 1) msg = "Izin lokasi ditolak. Aktifkan izin lokasi untuk speedtest.";
      if (err.code === 2) msg = "Lokasi tidak tersedia. Coba di luar ruangan / dekat jendela.";
      if (err.code === 3) msg = "Timeout mendapatkan lokasi. Coba lagi.";
      const e = new Error(msg);
      e.code = err.code;
      e.original = err;
      reject(e);
    }, opts);
  });
}
