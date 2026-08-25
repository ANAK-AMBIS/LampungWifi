import { buildQuery } from "./lib/query";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "/api";

async function request(path, options = {}) {
  const { headers: optHeaders, ...rest } = options;
  const response = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    ...rest,
    headers: {
      "Content-Type": "application/json",
      ...(optHeaders ?? {}),
    },
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const details = payload.details?.map((item) => item.message).join(", ");
    throw new Error(details || payload.error || "Permintaan gagal");
  }

  return payload;
}

export function getPlaces(filters) {
  const { signal, ...queryFilters } = filters ?? {};
  return request(`/places${buildQuery(queryFilters)}`, { signal });
}

export function getPlace(placeId) {
  return request(`/places/${placeId}`);
}

export function createPlace(body) {
  return request("/places", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function createReview(body) {
  return request("/reviews", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

function adminHeaders(token) {
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}

export function getAdminSubmissions(token = "") {
  return request("/admin/submissions", {
    headers: adminHeaders(token),
  });
}

export function updateSubmissionStatus(placeId, status, token = "") {
  return request(`/admin/submissions/${placeId}`, {
    method: "PATCH",
    headers: adminHeaders(token),
    body: JSON.stringify({ status }),
  });
}

export function getWifiCredentials(placeId, params = {}) {
  return request(`/places/${placeId}/wifi${buildQuery(params)}`);
}

export function submitWifiCredential(placeId, body) {
  return request(`/places/${placeId}/wifi`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function rateWifiCredential(credentialId, body) {
  return request(`/wifi/${credentialId}/ratings`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function getAdminWifi(token = "") {
  return request("/admin/wifi", { headers: adminHeaders(token) });
}

export function updateWifiStatus(credentialId, status, token = "") {
  return request(`/admin/wifi/${credentialId}`, {
    method: "PATCH",
    headers: adminHeaders(token),
    body: JSON.stringify({ status }),
  });
}

export function getSpeedHistory(placeId, params = {}) {
  return request(`/places/${placeId}/speedtest${buildQuery(params)}`);
}

export function saveSpeedResult(placeId, body) {
  return request(`/places/${placeId}/speedtest`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}
