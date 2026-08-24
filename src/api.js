import { buildQuery } from "./lib/query";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "/api";

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
    ...options,
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
  return bearerHeaders(token);
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
