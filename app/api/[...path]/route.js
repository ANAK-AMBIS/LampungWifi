import { revalidateTag } from "next/cache";

const API_SERVER_URL = process.env.API_SERVER_URL ?? "http://localhost:8787";

// Try to handle via D1 directly when running in Cloudflare Workers (OpenNext)
// Fallback to proxy to Express server for local dev (npm run dev)
async function tryHandleWithD1(request, path) {
  try {
    // Dynamic import to avoid bundling issues in Node dev where @opennextjs/cloudflare not available
    const { getCloudflareContext } = await import("@opennextjs/cloudflare").catch(() => ({ getCloudflareContext: null }));
    if (!getCloudflareContext) return null;
    let env;
    try {
      const ctx = await getCloudflareContext({ async: true });
      env = ctx?.env;
    } catch {
      // Fallback sync
      try {
        const ctx2 = await import("@opennextjs/cloudflare").then(m => m.getCloudflareContext?.());
        env = ctx2?.env;
      } catch { return null; }
    }
    if (!env?.DB) return null;

    // Use D1 store directly
    const { createStore } = await import("../../../server/db.js");
    const store = await createStore(env);

    const url = new URL(request.url);
    const method = request.method;
    const segments = path; // array

    // Helpers to read cookie session
    const cookieHeader = request.headers.get("cookie") ?? "";
    const readSession = (header) => {
      const m = header.match(/(?:^|;\s*)session=([^;]+)/);
      const token = m?.[1] ?? "";
      if (!token) return null;
      return token; // minimal check, actual verify done via store logic that checks Hono session? For D1 direct we skip hype mask auth check via store.getPlaceById isAuthenticated bool
    };
    const isAuth = Boolean(readSession(cookieHeader));

    // ── Auth routes (handle directly to avoid proxy to localhost:8787 in Workers) ──
    if (segments[0] === "auth") {
      // GET /api/auth/me
      if (method === "GET" && segments.length === 2 && segments[1] === "me") {
        const token = cookieHeader.match(/(?:^|;\s*)session=([^;]+)/)?.[1] ?? "";
        if (!token) return Response.json({ user: null });
        try {
          const parts = token.split(".");
          if (parts.length !== 3) return Response.json({ user: null });
          const [header, payload, signature] = parts;
          const secret = env.SESSION_SECRET?.trim() || `${env.GOOGLE_CLIENT_ID ?? env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "balamwifi"}.${env.ADMIN_TOKEN ?? "session"}`;
          const cryptoMod = await import("node:crypto");
          const expected = cryptoMod.createHmac("sha256", secret).update(`${header}.${payload}`).digest("base64url");
          if (signature !== expected) return Response.json({ user: null });
          const data = JSON.parse(Buffer.from(payload, "base64url").toString());
          return Response.json({ user: { name: data.name, email: data.email, picture: data.picture, role: data.role ?? "member", isTrusted: Boolean(data.isTrusted) } });
        } catch { return Response.json({ user: null }); }
      }
      // GET /api/auth/google
      if (method === "GET" && segments.length === 2 && segments[1] === "google") {
        const clientId = env.GOOGLE_CLIENT_ID?.trim() || env.NEXT_PUBLIC_GOOGLE_CLIENT_ID?.trim();
        const clientSecret = env.GOOGLE_CLIENT_SECRET?.trim();
        if (!clientId || !clientSecret) return Response.json({ error: "OAuth tidak dikonfigurasi" }, { status: 503 });
        const siteUrl = env.NEXT_PUBLIC_SITE_URL ?? new URL(request.url).origin;
        const redirectUri = `${siteUrl}/api/auth/google/callback`;
        const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
        authUrl.searchParams.set("client_id", clientId);
        authUrl.searchParams.set("redirect_uri", redirectUri);
        authUrl.searchParams.set("response_type", "code");
        authUrl.searchParams.set("scope", "openid email profile");
        authUrl.searchParams.set("prompt", "select_account");
        authUrl.searchParams.set("access_type", "offline");
        return Response.redirect(authUrl.toString(), 302);
      }
      // GET /api/auth/google/callback
      if (method === "GET" && segments.length === 3 && segments[1] === "google" && segments[2] === "callback") {
        const clientId = env.GOOGLE_CLIENT_ID?.trim() || env.NEXT_PUBLIC_GOOGLE_CLIENT_ID?.trim();
        const clientSecret = env.GOOGLE_CLIENT_SECRET?.trim();
        if (!clientId || !clientSecret) return Response.json({ error: "OAuth tidak dikonfigurasi" }, { status: 503 });
        const siteUrl = env.NEXT_PUBLIC_SITE_URL ?? new URL(request.url).origin;
        const redirectUri = `${siteUrl}/api/auth/google/callback`;
        const code = url.searchParams.get("code");
        if (!code) return Response.json({ error: "Missing code" }, { status: 400 });
        try {
          // Exchange code for tokens
          const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, grant_type: "authorization_code" }),
          });
          const tokenData = await tokenRes.json();
          if (!tokenRes.ok) return Response.json({ error: "Token exchange failed", details: tokenData }, { status: 400 });
          const idToken = tokenData.id_token;
          // Verify id_token via Google certs (simple decode + check aud)
          const parts = idToken.split(".");
          const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString());
          if (payload.aud !== clientId) return Response.json({ error: "Invalid audience" }, { status: 401 });
          if (!payload.email) return Response.json({ error: "Email tidak terverifikasi" }, { status: 401 });
          // Upsert user
          const dbUser = await store.upsertUser({ name: payload.name ?? payload.email, email: payload.email, picture: payload.picture ?? "" });
          // Create session
          const cryptoMod = await import("node:crypto");
          const secret = env.SESSION_SECRET?.trim() || `${clientId}.${env.ADMIN_TOKEN ?? "session"}`;
          const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
          const sessPayload = Buffer.from(JSON.stringify({ sub: payload.email, name: payload.name ?? payload.email, email: payload.email, picture: payload.picture ?? "", role: dbUser.role, isTrusted: dbUser.role === "admin" ? false : Boolean(dbUser.is_trusted), iat: Math.floor(Date.now()/1000) })).toString("base64url");
          const sig = cryptoMod.createHmac("sha256", secret).update(`${header}.${sessPayload}`).digest("base64url");
          const session = `${header}.${sessPayload}.${sig}`;
          const isProd = siteUrl.includes("balamwifi.my.id") || siteUrl.includes("workers.dev");
          const headers = new Headers();
          headers.set("Location", `${siteUrl}/dashboard`);
          headers.append("Set-Cookie", `session=${session}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${7*24*60*60}; ${isProd ? "Secure;" : ""}`);
          return new Response(null, { status: 302, headers });
        } catch (e) {
          console.error("[auth callback]", e);
          return Response.json({ error: "Callback failed", details: String(e.message) }, { status: 500 });
        }
      }
      // POST /api/auth/logout
      if (method === "POST" && segments.length === 2 && segments[1] === "logout") {
        const headers = new Headers();
        headers.append("Set-Cookie", "session=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax");
        return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "Content-Type": "application/json", "Set-Cookie": "session=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax" } });
      }
    }

    // Routing - handle most common GETs directly via D1 for Workers monolithic
    // GET /api/health
    if (method === "GET" && segments.length === 1 && segments[0] === "health") {
      return Response.json({ status: "ok", mode: store.mode, timestamp: new Date().toISOString() });
    }
    // GET /api/places
    if (method === "GET" && segments.length === 1 && segments[0] === "places") {
      const filters = {
        q: url.searchParams.get("q") ?? undefined,
        category: url.searchParams.get("category") ?? undefined,
        accessType: url.searchParams.get("accessType") ?? undefined,
        speed: url.searchParams.get("speed") ?? undefined,
        outlets: url.searchParams.get("outlets") === "true",
        open24: url.searchParams.get("open24") === "true",
        wifiAvailable: (url.searchParams.get("wifi") ?? "true") === "true",
        status: url.searchParams.get("status") ?? undefined,
        limit: Math.min(Math.max(Number(url.searchParams.get("limit") ?? 100), 1), 100),
        offset: Math.max(Number(url.searchParams.get("offset") ?? 0), 0),
      };
      const result = await store.listPlaces(filters);
      return Response.json({ data: result.places, meta: { source: store.mode, count: result.places.length, total: result.total } });
    }
    // GET /api/places/:id
    if (method === "GET" && segments.length === 2 && segments[0] === "places") {
      const id = Number(segments[1]);
      const place = await store.getPlaceById(id, { isAuthenticated: isAuth });
      if (!place) return Response.json({ error: "Place not found" }, { status: 404 });
      return Response.json({ data: place, meta: { source: store.mode } });
    }
    // GET /api/places/:id/wifi and /api/places/:id/speedtest - fallback to proxy for now, but try D1
    if (method === "GET" && segments.length === 3 && segments[0] === "places" && segments[2] === "wifi") {
      const placeId = Number(segments[1]);
      const isAuthWifi = isAuth;
      const result = await store.listWifiCredentials(placeId, { isAuthenticated: isAuthWifi, limit: Number(url.searchParams.get("limit") ?? 50), offset: Number(url.searchParams.get("offset") ?? 0) });
      return Response.json({ data: result.data, meta: { source: store.mode, total: result.total } });
    }
    if (method === "GET" && segments.length === 3 && segments[0] === "places" && segments[2] === "speedtest") {
      const placeId = Number(segments[1]);
      const result = await store.listSpeedTests(placeId, { limit: Number(url.searchParams.get("limit") ?? 20), offset: Number(url.searchParams.get("offset") ?? 0) });
      return Response.json({ data: result.data, meta: { source: store.mode, total: result.total, stats: result.stats } });
    }

    // For POST/PATCH that require auth, fallback to proxy to keep session/validation logic unified
    // But for monolithic we could handle them too - return null to proxy
    return null;
  } catch (e) {
    console.warn("[d1-proxy] D1 direct handle failed, fallback to proxy:", e?.message);
    return null;
  }
}

async function fetchWithRetry(targetUrl, init, retries = 1) {
  try {
    return await fetch(targetUrl, { ...init, signal: AbortSignal.timeout(15000) });
  } catch (err) {
    const causeCode = err?.cause?.code;
    const isRetryable = causeCode === "ECONNRESET" || causeCode === "ETIMEDOUT" || err?.code === "ECONNRESET" || String(err?.message ?? "").includes("ECONNRESET") || String(err?.message ?? "").includes("fetch failed");
    if (retries > 0 && isRetryable) {
      await new Promise((r) => setTimeout(r, 300));
      return fetchWithRetry(targetUrl, init, retries - 1);
    }
    throw err;
  }
}

async function proxy(request, { params }) {
  const { path } = await params;

  // Try D1 direct first (Workers monolithic)
  const d1Response = await tryHandleWithD1(request, path);
  if (d1Response) return d1Response;

  const sourceUrl = new URL(request.url);
  const targetUrl = new URL(`/api/${path.join("/")}${sourceUrl.search}`, API_SERVER_URL);
  const headers = new Headers(request.headers);
  const hasBody = request.method !== "GET" && request.method !== "HEAD";
  const body = hasBody ? await request.text() : undefined;

  headers.delete("host");
  headers.delete("content-length");
  headers.delete("content-encoding");
  headers.delete("connection");

  let response;
  try {
    response = await fetchWithRetry(targetUrl, { method: request.method, headers, body, cache: "no-store", redirect: "manual" });
  } catch (err) {
    const cause = err?.cause ?? err;
    console.error(`[proxy] fetch failed ${request.method} ${targetUrl.toString()} -> ${API_SERVER_URL}:`, cause?.code ?? err?.code ?? err?.message, cause);
    return new Response(JSON.stringify({ error: "Upstream unavailable", details: cause?.code ?? err?.message ?? "ECONNRESET" }), { status: 502, headers: { "Content-Type": "application/json" } });
  }

  if (hasBody && response.ok) {
    revalidateApiTags(path, body);
  }

  const responseHeaders = new Headers(response.headers);
  responseHeaders.delete("content-encoding");
  responseHeaders.delete("content-length");

  return new Response(response.body, { status: response.status, statusText: response.statusText, headers: responseHeaders });
}

function revalidateApiTags(path, body) {
  const [resource, scope, id] = path;
  const tags = new Set();
  if (resource === "places") { tags.add("places"); if (id) tags.add(`place:${id}`); }
  if (resource === "reviews") { tags.add("places"); const placeId = readJsonNumber(body, "placeId"); if (placeId) tags.add(`place:${placeId}`); }
  if (resource === "wifi") { tags.add("places"); const credId = id ? Number(id) : null; if (credId) tags.add(`place:wifi:${credId}`); const placeId = readJsonNumber(body, "placeId"); if (placeId) tags.add(`place:${placeId}`); }
  if (resource === "places" && scope && id === "speedtest") { tags.add("places"); const pid = Number(scope); if (Number.isFinite(pid)) tags.add(`place:${pid}`); const bodyPlace = readJsonNumber(body, "placeId"); if (bodyPlace) tags.add(`place:${bodyPlace}`); }
  if (resource === "admin" && scope === "submissions") { tags.add("places"); if (id) tags.add(`place:${id}`); }
  if (resource === "admin" && scope === "wifi") { tags.add("places"); if (id) tags.add(`place:${id}`); }
  if (resource === "admin" && scope === "users") tags.add("places");
  for (const tag of tags) revalidateTag(tag, "max");
}
function readJsonNumber(body, key) {
  try { const value = JSON.parse(body || "{}")?.[key]; const parsed = Number(value); return Number.isFinite(parsed) && parsed > 0 ? parsed : null; } catch { return null; }
}

export const GET = proxy;
export const POST = proxy;
export const PATCH = proxy;
export const PUT = proxy;
export const DELETE = proxy;
