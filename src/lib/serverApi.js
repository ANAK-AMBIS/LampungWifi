import { buildQuery } from "./query";

const API_SERVER_URL = process.env.API_SERVER_URL ?? "http://localhost:8787";
const publicDataRevalidateSeconds = 60;

async function tryD1Direct(path, params) {
  try {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare").catch(() => ({ getCloudflareContext: null }));
    if (!getCloudflareContext) return null;
    let env;
    try {
      const ctx = await getCloudflareContext({ async: true });
      env = ctx?.env;
    } catch {
      return null;
    }
    if (!env?.DB) return null;
    const { createStore } = await import("../../server/db.js");
    const store = await createStore(env);
    // Only handle GET /places and /places/:id for now (placesState)
    if (path === "/places") {
      const filters = {
        q: params?.q,
        category: params?.category,
        accessType: params?.accessType,
        speed: params?.speed,
        outlets: params?.outlets === "true" || params?.outlets === true,
        open24: params?.open24 === "true" || params?.open24 === true,
        wifiAvailable: params?.wifi === "false" ? false : true,
        status: params?.status,
        limit: params?.limit,
        offset: params?.offset,
      };
      const result = await store.listPlaces(filters);
      return { data: result.places, meta: { source: store.mode, count: result.places.length, total: result.total } };
    }
    if (path.startsWith("/places/")) {
      const id = Number(path.split("/")[2]);
      if (Number.isFinite(id)) {
        const place = await store.getPlaceById(id, { isAuthenticated: false });
        if (!place) throw new Error("Place not found");
        return { data: place, meta: { source: store.mode } };
      }
    }
    return null;
  } catch {
    return null;
  }
}

async function request(path, params, tags = []) {
  // Workers D1 direct (monolitik) - bypass HTTP when env.DB available
  const d1Result = await tryD1Direct(path, params);
  if (d1Result) return d1Result;
  try {
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
      throw new Error(details || payload.error || `Gagal fetch ${path}: ${response.status}`);
    }

    return payload;
  } catch (e) {
    // surface fetch/network errors with URL hint
    if (e.message?.includes("fetch failed") || e.message?.includes("ECONNREFUSED")) {
      throw new Error(`API tidak terjangkau (${API_SERVER_URL}${path}) - pastikan server nyala (npm run dev). Detail: ${e.message}`, { cause: e });
    }
    throw e;
  }
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
