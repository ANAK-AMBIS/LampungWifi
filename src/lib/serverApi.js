import { buildQuery } from "./query";

const API_SERVER_URL = process.env.API_SERVER_URL ?? "http://localhost:8787";
const publicDataRevalidateSeconds = 60;

async function request(path, params, tags = []) {
  const response = await fetch(
    new URL(`/api${path}${buildQuery(params)}`, API_SERVER_URL),
    {
      next: {
        revalidate: publicDataRevalidateSeconds,
        tags,
      },
    },
  );
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const details = payload.details?.map((item) => item.message).join(", ");
    throw new Error(details || payload.error || "Permintaan gagal");
  }

  return payload;
}

export function getPlacesServer(filters) {
  return request("/places", filters, ["places"]);
}

export function getPlaceServer(placeId) {
  return request(`/places/${placeId}`, undefined, [
    "places",
    `place:${placeId}`,
  ]);
}

export async function placesState(filters) {
  try {
    const response = await getPlacesServer(filters);
    return {
      loading: false,
      error: "",
      source: response.meta.source,
      items: response.data,
      total: response.meta.total ?? response.data.length,
    };
  } catch (error) {
    return {
      loading: false,
      error: error.message,
      source: "",
      items: [],
      total: 0,
    };
  }
}

export async function placeState(placeId) {
  try {
    const response = await getPlaceServer(placeId);
    return {
      loading: false,
      error: "",
      source: response.meta.source,
      place: response.data,
    };
  } catch (error) {
    return {
      loading: false,
      error: error.message,
      source: "",
      place: null,
    };
  }
}
