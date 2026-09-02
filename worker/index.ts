// @ts-nocheck
import { Hono } from "hono";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import { secureHeaders } from "hono/secure-headers";
import crypto from "node:crypto";
import { z } from "zod";
import { createStore } from "../server/db.js";

// Env type for D1 + vars
type Env = {
  DB: D1Database;
  ASSETS: Fetcher;
  ADMIN_TOKEN?: string;
  SESSION_SECRET?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  NEXT_PUBLIC_GOOGLE_CLIENT_ID?: string;
  NEXT_PUBLIC_SITE_URL?: string;
  CORS_ORIGIN?: string;
  SPEEDTEST_MAX_DISTANCE_M?: string;
};

const app = new Hono<{ Bindings: Env }>();

// ── helpers copied from server/index.js ─────────────────
const categoryOptions = [
  "Cafe / Coffee Shop",
  "Coworking Space",
  "Library",
  "Campus Lounge",
  "Restaurant",
  "Rest Area",
] as const;
const bandOptions = ["2.4GHz", "5GHz", "6GHz", "auto"] as const;

const placeSubmissionSchema = z
  .object({
    name: z.string().min(3).max(120),
    category: z.enum(categoryOptions as unknown as [string, ...string[]]),
    address: z.string().min(6).max(180),
    district: z.string().min(2).max(80),
    latitude: z.number().min(-90).max(90).nullable().optional(),
    longitude: z.number().min(-180).max(180).nullable().optional(),
    wifiAvailable: z.boolean().default(true),
    wifiAccessType: z.string().max(80).optional().nullable(),
    wifiPassword: z.string().max(80).optional().nullable(),
    wifiSsid: z.string().max(32).optional().nullable(),
    wifiBand: z.enum(bandOptions as unknown as [string, ...string[]]).optional().nullable(),
    isHype: z.boolean().optional(),
    passwordSource: z.string().max(80).optional().nullable(),
    accessNotes: z.string().max(220).optional().nullable(),
    wifiSpeedMbps: z.number().min(0).max(1000).nullable().optional(),
    uploadMbps: z.number().min(0).max(1000).nullable().optional(),
    pingMs: z.number().int().min(0).max(1000).nullable().optional(),
    hasPowerOutlets: z.boolean().default(false),
    open24Hours: z.boolean().default(false),
    quietZone: z.boolean().default(false),
    ambienceLabel: z.string().max(40).optional().nullable(),
    mapContext: z.string().max(180).optional().nullable(),
    operatingHours: z.string().max(180).optional().nullable(),
    imageTone: z.string().max(40).optional().nullable(),
    imageUrl: z.union([z.string().url().max(500), z.string().startsWith("data:image/").max(900_000), z.literal(""), z.null()]).optional(),
    submitterName: z.string().min(2).max(80),
    submitterEmail: z.union([z.string().email().max(120), z.literal(""), z.null()]).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.wifiPassword && !value.passwordSource) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "password_source wajib saat password WiFi diisi", path: ["passwordSource"] });
    }
  });

const reviewSchema = z.object({
  placeId: z.number().int().positive(),
  authorName: z.string().min(2).max(80),
  authorEmail: z.string().email().max(120),
  reviewTitle: z.string().min(4).max(100),
  ratingSpeed: z.number().int().min(1).max(5),
  ratingComfort: z.number().int().min(1).max(5),
  imageUrl: z.union([z.string().url().max(500), z.string().startsWith("data:image/").max(900_000), z.literal(""), z.null()]).optional(),
  comment: z.string().min(12).max(400),
});
const moderationSchema = z.object({ status: z.enum(["approved", "rejected"]) });
const userUpdateSchema = z.object({ role: z.enum(["admin", "member"]).optional(), isTrusted: z.boolean().optional() }).superRefine((value, ctx) => {
  if (value.role === "admin" && value.isTrusted === true) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Admin tidak perlu di-flag trusted", path: ["isTrusted"] });
});
const wifiCredentialSchema = z.object({ placeId: z.number().int().positive(), ssid: z.string().min(1).max(32), password: z.string().max(80).optional().nullable(), band: z.enum(bandOptions as unknown as [string, ...string[]]).optional().nullable(), passwordSource: z.string().max(80).optional().nullable() }).superRefine((v, ctx) => { if (v.password && !v.passwordSource) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "password_source wajib saat password diisi", path: ["passwordSource"] }); });
const wifiRatingSchema = z.object({ credentialId: z.number().int().positive(), rating: z.number().int().min(1).max(5), comment: z.string().min(12).max(400).optional().nullable() });
const speedTestSchema = z.object({ downloadMbps: z.number().min(0).max(1000), uploadMbps: z.number().min(0).max(1000).nullable().optional(), pingMs: z.number().int().min(0).max(1000).nullable().optional(), jitterMs: z.number().min(0).max(1000).nullable().optional(), loadedLatencyMs: z.number().int().min(0).max(1000).nullable().optional(), packetLoss: z.number().min(0).max(1).nullable().optional(), durationMs: z.number().int().min(100).max(120000).nullable().optional(), rawSummary: z.any().nullable().optional(), claimedSsid: z.string().min(1).max(32), userLatitude: z.number().min(-90).max(90), userLongitude: z.number().min(-180).max(180), accuracyM: z.number().min(0).max(10000).nullable().optional(), verifyToken: z.string().max(500).nullable().optional() });

function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number) {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}
function parseBoolean(value: unknown, defaultValue=false) {
  if (value===undefined) return defaultValue;
  if (typeof value==="boolean") return value;
  return String(value).toLowerCase()==="true";
}
function cleanNullableString(value: unknown) {
  if (typeof value !== "string") return value ?? null;
  const cleaned = String(value).trim().replace(/\s+/g, " ");
  return cleaned.length ? cleaned : null;
}
function parseJson(schema: z.ZodSchema, body: Record<string, unknown>) {
  return schema.parse({ ...body, wifiPassword: cleanNullableString(body.wifiPassword), wifiSsid: cleanNullableString(body.wifiSsid), wifiBand: cleanNullableString(body.wifiBand), passwordSource: cleanNullableString(body.passwordSource), wifiAccessType: cleanNullableString(body.wifiAccessType), accessNotes: cleanNullableString(body.accessNotes), ambienceLabel: cleanNullableString(body.ambienceLabel), mapContext: cleanNullableString(body.mapContext), operatingHours: cleanNullableString(body.operatingHours), imageTone: cleanNullableString(body.imageTone), imageUrl: cleanNullableString(body.imageUrl), submitterEmail: cleanNullableString(body.submitterEmail), ssid: cleanNullableString(body.ssid), password: cleanNullableString(body.password), band: cleanNullableString(body.band), comment: cleanNullableString(body.comment) });
}
function parseLimit(value: unknown, defaultValue=100) {
  if (value===undefined) return defaultValue;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return defaultValue;
  return Math.min(Math.max(Math.trunc(parsed),1),100);
}
function parseOffset(value: unknown, defaultValue=0) {
  if (value===undefined) return defaultValue;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed<0) return defaultValue;
  return Math.trunc(parsed);
}

// ── session helpers (node:crypto, keep nodejs_compat) ──
function getSessionSecret(env: Env) {
  return env.SESSION_SECRET?.trim() || `${env.GOOGLE_CLIENT_ID ?? env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "balamwifi"}.${env.ADMIN_TOKEN ?? "session"}`;
}
function createSession(env: Env, user: { name: string; email: string; picture?: string; role?: string; isTrusted?: boolean }) {
  const secret = getSessionSecret(env);
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify({ sub: user.email, name: user.name, email: user.email, picture: user.picture ?? "", role: user.role ?? "member", isTrusted: user.role === "admin" ? false : Boolean(user.isTrusted), iat: Math.floor(Date.now()/1000) })).toString("base64url");
  const signature = crypto.createHmac("sha256", secret).update(`${header}.${payload}`).digest("base64url");
  return `${header}.${payload}.${signature}`;
}
function readSession(env: Env, cookieHeader: string | undefined) {
  const token = cookieHeader ? (cookieHeader.match(/(?:^|;\s*)session=([^;]+)/)?.[1] ?? "") : "";
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length!==3) return null;
  const [header, payload, signature] = parts;
  const secret = getSessionSecret(env);
  const expected = crypto.createHmac("sha256", secret).update(`${header}.${payload}`).digest("base64url");
  if (signature !== expected) return null;
  try { return JSON.parse(Buffer.from(payload, "base64url").toString()); } catch { return null; }
}

// ── middleware ──
app.use(secureHeaders());
app.use(async (c, next) => {
  // CORS
  const env = c.env;
  const origin = c.req.header("origin") ?? "";
  const corsOrigin = env.CORS_ORIGIN ?? process.env.CORS_ORIGIN ?? "";
  const allowed = corsOrigin ? corsOrigin.split(",").map(s=>s.trim()).filter(Boolean) : [];
  const isProduction = env.NEXT_PUBLIC_SITE_URL?.includes("balamwifi.my.id") || process.env.NODE_ENV === "production";
  if (origin && allowed.length && !allowed.includes(origin) && isProduction) {
    return c.json({ error: "CORS origin not allowed" }, 403);
  }
  // cors header
  if (origin && (allowed.includes(origin) || !isProduction)) {
    c.header("Access-Control-Allow-Origin", origin);
    c.header("Access-Control-Allow-Credentials", "true");
  }
  if (c.req.method === "OPTIONS") {
    c.header("Access-Control-Allow-Methods", "GET,POST,PATCH,PUT,DELETE,OPTIONS");
    c.header("Access-Control-Allow-Headers", "Content-Type,Authorization,X-Requested-With");
    return c.body(null, 204);
  }
  await next();
});

// simple in-memory rate limit (per isolate, ok for D1 local)
const rateMap = new Map<string, { count: number; reset: number }>();
function rateLimit(max: number, windowMs: number) {
  return async (c: { req: { header: (k:string)=>string|undefined } }, next: () => Promise<void>) => {
    const ip = c.req.header("cf-connecting-ip") ?? c.req.header("x-forwarded-for") ?? "anon";
    const key = `${ip}:${c.req.header("x-forwarded-for") ?? ""}`;
    const now = Date.now();
    const entry = rateMap.get(key);
    if (!entry || now > entry.reset) {
      rateMap.set(key, { count: 1, reset: now + windowMs });
    } else {
      entry.count++;
      if (entry.count > max) return (c as unknown as { json: (o:unknown,s:number)=>Response }).json({ error: "Too many requests" }, 429);
    }
    await next();
  };
}

// store helper per request
async function getStore(c: { env: Env }) {
  // cast to any because createStore expects env with DB
  const store = await createStore(c.env as unknown as Record<string, unknown>);
  return store;
}
function getIsAuthenticated(c: { req: { header: (k:string)=>string|undefined }, env: Env }) {
  const cookie = c.req.header("cookie") ?? "";
  const sess = readSession(c.env, cookie);
  return Boolean(sess);
}

// ── routes ──
app.get("/api/health", async (c) => {
  const store = await getStore(c);
  return c.json({ status: "ok", mode: store.mode, timestamp: new Date().toISOString() });
});

// auth
app.get("/api/auth/me", (c) => {
  const sess = readSession(c.env, c.req.header("cookie") ?? "");
  if (!sess) return c.json({ user: null });
  return c.json({ user: { name: sess.name, email: sess.email, picture: sess.picture, role: sess.role ?? "member", isTrusted: Boolean(sess.isTrusted) } });
});
app.post("/api/auth/logout", (c) => {
  deleteCookie(c, "session", { path: "/" });
  return c.json({ ok: true });
});
app.post("/api/admin/login", async (c) => {
  const env = c.env;
  const adminToken = env.ADMIN_TOKEN?.trim() ?? process.env.ADMIN_TOKEN?.trim() ?? "";
  if (!adminToken) return c.json({ error: "Admin access is not configured" }, 503);
  const body = await c.req.json().catch(()=> ({})) as { token?: string };
  if (!body.token || body.token !== adminToken) return c.json({ error: "Invalid admin token" }, 401);
  const isProd = env.NEXT_PUBLIC_SITE_URL?.includes("balamwifi.my.id");
  setCookie(c, "admin_session", body.token, { httpOnly: true, secure: Boolean(isProd), sameSite: "Lax", maxAge: 24*60*60, path: "/" });
  return c.json({ message: "Admin session created" });
});

app.get("/api/places", async (c) => {
  const url = new URL(c.req.url);
  const filters = {
    q: url.searchParams.get("q") ?? undefined,
    category: url.searchParams.get("category") ?? undefined,
    accessType: url.searchParams.get("accessType") ?? undefined,
    speed: url.searchParams.get("speed") ?? undefined,
    outlets: parseBoolean(url.searchParams.get("outlets") ?? undefined),
    open24: parseBoolean(url.searchParams.get("open24") ?? undefined),
    wifiAvailable: parseBoolean(url.searchParams.get("wifi") ?? "true", true),
    status: url.searchParams.get("status") ?? undefined,
    limit: parseLimit(url.searchParams.get("limit") ?? undefined),
    offset: parseOffset(url.searchParams.get("offset") ?? undefined),
  };
  const store = await getStore(c);
  const result = await store.listPlaces(filters);
  return c.json({ data: result.places, meta: { source: store.mode, count: result.places.length, total: result.total } });
});

app.get("/api/places/:id", async (c) => {
  const id = Number(c.req.param("id"));
  const isAuth = getIsAuthenticated(c);
  const store = await getStore(c);
  const place = await store.getPlaceById(id, { isAuthenticated: isAuth });
  if (!place) return c.json({ error: "Place not found" }, 404);
  return c.json({ data: place, meta: { source: store.mode } });
});

app.get("/api/places/:id/wifi", async (c) => {
  const placeId = Number(c.req.param("id"));
  const store = await getStore(c);
  const isAuth = getIsAuthenticated(c);
  // verify place exists
  const place = await store.getPlaceById(placeId, { isAuthenticated: isAuth });
  if (!place) return c.json({ error: "Place not found" }, 404);
  const url = new URL(c.req.url);
  const result = await store.listWifiCredentials(placeId, { isAuthenticated: isAuth, limit: parseLimit(url.searchParams.get("limit") ?? undefined, 50), offset: parseOffset(url.searchParams.get("offset") ?? undefined, 0) });
  return c.json({ data: result.data, meta: { source: store.mode, total: result.total } });
});

app.post("/api/places/:id/wifi", async (c) => {
  const sess = readSession(c.env, c.req.header("cookie") ?? "");
  if (!sess) return c.json({ error: "Login required" }, 401);
  const placeId = Number(c.req.param("id"));
  const body = await c.req.json().catch(()=> ({})) as Record<string, unknown>;
  let parsed: { ssid: string; password: string | null; band: string | null; passwordSource: string | null };
  try { parsed = parseJson(wifiCredentialSchema, { ...body, placeId }) as unknown as typeof parsed; } catch (e) { if (e instanceof z.ZodError) return c.json({ error: "Validation failed", details: e.issues }, 400); throw e; }
  const store = await getStore(c);
  try {
    const cred = await store.createWifiCredential({ placeId, ssid: parsed.ssid, password: parsed.password, band: parsed.band, passwordSource: parsed.passwordSource, submittedByName: sess.name, submittedByEmail: sess.email });
    return c.json({ data: cred, message: "WiFi submitted for moderation" }, 201);
  } catch (e) { const msg = (e as Error).message; return c.json({ error: msg }, 400); }
});

app.post("/api/wifi/:credId/ratings", async (c) => {
  const sess = readSession(c.env, c.req.header("cookie") ?? "");
  if (!sess) return c.json({ error: "Login required" }, 401);
  const credId = Number(c.req.param("credId"));
  const body = await c.req.json().catch(()=> ({})) as Record<string, unknown>;
  let parsed: { credentialId: number; rating: number; comment?: string | null };
  try { parsed = parseJson(wifiRatingSchema, { ...body, credentialId: credId }) as unknown as typeof parsed; } catch (e) { if (e instanceof z.ZodError) return c.json({ error: "Validation failed", details: e.issues }, 400); throw e; }
  const store = await getStore(c);
  try {
    const rating = await store.rateWifiCredential(parsed.credentialId, { raterName: sess.name, raterEmail: sess.email, rating: parsed.rating, comment: parsed.comment });
    return c.json({ data: rating, message: "Rating published" }, 201);
  } catch (e) {
    const msg = (e as Error).message;
    if (msg.includes("sudah memberi rating")) return c.json({ error: msg }, 409);
    return c.json({ error: msg }, 400);
  }
});

app.get("/api/places/:id/speedtest", async (c) => {
  const placeId = Number(c.req.param("id"));
  if (!Number.isFinite(placeId) || placeId <= 0) return c.json({ error: "Invalid place id" }, 400);
  const store = await getStore(c);
  const isAuth = getIsAuthenticated(c);
  const place = await store.getPlaceById(placeId, { isAuthenticated: isAuth });
  if (!place) return c.json({ error: "Place not found" }, 404);
  const url = new URL(c.req.url);
  const result = await store.listSpeedTests(placeId, { limit: parseLimit(url.searchParams.get("limit") ?? undefined, 20), offset: parseOffset(url.searchParams.get("offset") ?? undefined, 0) });
  return c.json({ data: result.data, meta: { source: store.mode, total: result.total, stats: result.stats } });
});

app.post("/api/places/:id/speedtest", async (c) => {
  const sess = readSession(c.env, c.req.header("cookie") ?? "");
  if (!sess) return c.json({ error: "Login required" }, 401);
  const placeId = Number(c.req.param("id"));
  const body = await c.req.json().catch(()=> ({})) as Record<string, unknown>;
  let parsed: z.infer<typeof speedTestSchema>;
  try {
    parsed = speedTestSchema.parse({ downloadMbps: body.downloadMbps ?? body.download_mbps, uploadMbps: body.uploadMbps ?? body.upload_mbps, pingMs: body.pingMs ?? body.ping_ms, jitterMs: body.jitterMs ?? body.jitter_ms, loadedLatencyMs: body.loadedLatencyMs ?? body.loaded_latency_ms, packetLoss: body.packetLoss ?? body.packet_loss, durationMs: body.durationMs ?? body.duration_ms, rawSummary: body.rawSummary ?? body.raw_summary ?? null, claimedSsid: body.claimedSsid ?? body.claimed_ssid, userLatitude: body.userLatitude ?? body.user_latitude, userLongitude: body.userLongitude ?? body.user_longitude, accuracyM: body.accuracyM ?? body.accuracy_m, verifyToken: body.verifyToken ?? body.verify_token ?? null });
  } catch (e) { if (e instanceof z.ZodError) return c.json({ error: "Validation failed", details: e.issues }, 400); throw e; }
  const store = await getStore(c);
  const placeForCheck = await store.getPlaceById(placeId, { isAuthenticated: true });
  if (!placeForCheck) return c.json({ error: "Place not found" }, 404);
  if (placeForCheck.latitude == null || placeForCheck.longitude == null) return c.json({ error: "Koordinat tempat belum diatur — speedtest diblok. Hubungi admin." }, 403);
  // SSID check
  let approvedSsids: string[] = [];
  try {
    const creds = await store.listWifiCredentials(placeId, { isAuthenticated: true, limit: 100 });
    approvedSsids = (creds?.data ?? []).map((cc: { ssid: string }) => cc.ssid).filter(Boolean);
    if (!approvedSsids.length && placeForCheck.wifi_ssid) approvedSsids = [placeForCheck.wifi_ssid];
  } catch { if (placeForCheck.wifi_ssid) approvedSsids = [placeForCheck.wifi_ssid]; }
  if (!approvedSsids.length) return c.json({ error: "Tempat ini belum punya SSID terverifikasi — speedtest diblok. Admin perlu approve SSID dulu." }, 403);
  if (!parsed.claimedSsid || !approvedSsids.includes(parsed.claimedSsid)) return c.json({ error: `SSID tidak terdaftar untuk lokasi ini. Pilih salah satu: ${approvedSsids.join(", ")}` }, 403);
  const maxDist = Number(c.env.SPEEDTEST_MAX_DISTANCE_M ?? process.env.SPEEDTEST_MAX_DISTANCE_M ?? 150);
  const distM = haversineMeters(Number(placeForCheck.latitude), Number(placeForCheck.longitude), Number(parsed.userLatitude), Number(parsed.userLongitude));
  if (!Number.isFinite(distM)) return c.json({ error: "Koordinat user tidak valid" }, 400);
  if (distM > maxDist) return c.json({ error: `Di luar jangkauan (${Math.round(distM)}m > ${maxDist}m). Mendekat ke lokasi untuk speedtest.`, distance: Math.round(distM), maxDistance: maxDist }, 403);
  const ipRaw = c.req.header("cf-connecting-ip") ?? c.req.header("x-forwarded-for") ?? "";
  const ipHash = ipRaw ? crypto.createHash("sha256").update(String(ipRaw)).digest("hex").slice(0,16) : null;
  try {
    const record = await store.createSpeedTest({ placeId, downloadMbps: parsed.downloadMbps, uploadMbps: parsed.uploadMbps, pingMs: parsed.pingMs, jitterMs: parsed.jitterMs, loadedLatencyMs: parsed.loadedLatencyMs, packetLoss: parsed.packetLoss, durationMs: parsed.durationMs, rawSummary: parsed.rawSummary, testedByName: sess.name, testedByEmail: sess.email, claimedSsid: parsed.claimedSsid, userLatitude: parsed.userLatitude, userLongitude: parsed.userLongitude, accuracyM: parsed.accuracyM ?? null, distanceM: Math.round(distM) }, { testerName: sess.name, testerEmail: sess.email, ipHash });
    return c.json({ data: record, message: "Speedtest tercatat" }, 201);
  } catch (e) {
    const msg = (e as Error).message;
    if (msg.includes("Batas 3 tes")) return c.json({ error: msg }, 429);
    return c.json({ error: msg }, 400);
  }
});

app.post("/api/places", async (c) => {
  const sess = readSession(c.env, c.req.header("cookie") ?? "");
  if (!sess) return c.json({ error: "Login required" }, 401);
  const body = await c.req.json().catch(()=> ({})) as Record<string, unknown>;
  let parsed;
  try { parsed = parseJson(placeSubmissionSchema, { ...body, submitterName: sess.name, submitterEmail: sess.email }); } catch (e) { if (e instanceof z.ZodError) return c.json({ error: "Validation failed", details: e.issues }, 400); throw e; }
  const store = await getStore(c);
  try {
    const sub = await store.createPlaceSubmission(parsed);
    return c.json({ data: sub, message: "Spot submitted for moderation" }, 201);
  } catch (e) { return c.json({ error: (e as Error).message }, 400); }
});

app.post("/api/reviews", async (c) => {
  const sess = readSession(c.env, c.req.header("cookie") ?? "");
  if (!sess) return c.json({ error: "Login required" }, 401);
  const body = await c.req.json().catch(()=> ({})) as Record<string, unknown>;
  let parsed;
  try { parsed = reviewSchema.parse({ ...body, authorName: sess.name, authorEmail: sess.email }); } catch (e) { if (e instanceof z.ZodError) return c.json({ error: "Validation failed", details: e.issues }, 400); throw e; }
  const store = await getStore(c);
  try {
    const rev = await store.createReview(parsed);
    return c.json({ data: rev, message: "Review published" }, 201);
  } catch (e) { return c.json({ error: (e as Error).message }, 400); }
});

// admin helpers
function requireAdmin(c: { env: Env; req: { header: (k:string)=>string|undefined } }, next: () => Promise<void>) {
  const adminToken = c.env.ADMIN_TOKEN?.trim() ?? process.env.ADMIN_TOKEN?.trim() ?? "";
  const isProd = c.env.NEXT_PUBLIC_SITE_URL?.includes("balamwifi.my.id") || process.env.NODE_ENV === "production";
  if (!adminToken) {
    if (isProd) return (c as unknown as { json: (o:unknown,s:number)=>Response }).json({ error: "Admin access is not configured" }, 503);
    return next();
  }
  const cookieToken = getCookie(c as unknown as { req: { header: (k:string)=>string|undefined } }, "admin_session") ?? "";
  const authHeader = c.req.header("authorization") ?? "";
  const headerToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  const token = cookieToken || headerToken;
  if (token !== adminToken) return (c as unknown as { json: (o:unknown,s:number)=>Response }).json({ error: "Unauthorized" }, 401);
  return next();
}

app.get("/api/admin/submissions", async (c) => {
  const adminCheck = await new Promise<Response|void>((resolve)=>{
    const r = requireAdmin(c as unknown as { env: Env; req: { header:(k:string)=>string|undefined } }, async()=> resolve());
    if (r instanceof Response) resolve(r);
  });
  if (adminCheck instanceof Response) return adminCheck;
  const store = await getStore(c);
  const data = await store.listAdminSubmissions();
  return c.json({ data, meta: { source: store.mode } });
});
app.get("/api/admin/wifi", async (c) => {
  const adminCheck = await new Promise<Response|void>((resolve)=>{
    const r = requireAdmin(c as unknown as { env: Env; req: { header:(k:string)=>string|undefined } }, async()=> resolve());
    if (r instanceof Response) resolve(r);
  });
  if (adminCheck instanceof Response) return adminCheck;
  const store = await getStore(c);
  const data = await store.listAdminWifiCredentials();
  return c.json({ data, meta: { source: store.mode } });
});
app.patch("/api/admin/wifi/:id", async (c) => {
  const adminCheck = await new Promise<Response|void>((resolve)=>{
    const r = requireAdmin(c as unknown as { env: Env; req: { header:(k:string)=>string|undefined } }, async()=> resolve());
    if (r instanceof Response) resolve(r);
  });
  if (adminCheck instanceof Response) return adminCheck;
  const body = await c.req.json().catch(()=> ({})) as Record<string, unknown>;
  const parsed = moderationSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: "Validation failed", details: parsed.error.issues }, 400);
  const store = await getStore(c);
  const updated = await store.updateWifiCredentialStatus(Number(c.req.param("id")), parsed.data.status);
  if (!updated) return c.json({ error: "Credential not found" }, 404);
  return c.json({ data: updated, message: `WiFi ${parsed.data.status}` });
});
app.patch("/api/admin/submissions/:id", async (c) => {
  const adminCheck = await new Promise<Response|void>((resolve)=>{
    const r = requireAdmin(c as unknown as { env: Env; req: { header:(k:string)=>string|undefined } }, async()=> resolve());
    if (r instanceof Response) resolve(r);
  });
  if (adminCheck instanceof Response) return adminCheck;
  const body = await c.req.json().catch(()=> ({})) as Record<string, unknown>;
  const parsed = moderationSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: "Validation failed", details: parsed.error.issues }, 400);
  const store = await getStore(c);
  const updated = await store.updateSubmissionStatus(Number(c.req.param("id")), parsed.data.status);
  if (!updated) return c.json({ error: "Submission not found" }, 404);
  return c.json({ data: updated, message: `Submission ${parsed.data.status}` });
});
app.get("/api/admin/users", async (c) => {
  const adminCheck = await new Promise<Response|void>((resolve)=>{
    const r = requireAdmin(c as unknown as { env: Env; req: { header:(k:string)=>string|undefined } }, async()=> resolve());
    if (r instanceof Response) resolve(r);
  });
  if (adminCheck instanceof Response) return adminCheck;
  const store = await getStore(c);
  const data = await store.listUsers();
  return c.json({ data, meta: { source: store.mode } });
});
app.patch("/api/admin/users/:id", async (c) => {
  const adminCheck = await new Promise<Response|void>((resolve)=>{
    const r = requireAdmin(c as unknown as { env: Env; req: { header:(k:string)=>string|undefined } }, async()=> resolve());
    if (r instanceof Response) resolve(r);
  });
  if (adminCheck instanceof Response) return adminCheck;
  const body = await c.req.json().catch(()=> ({})) as Record<string, unknown>;
  const parsed = userUpdateSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: "Validation failed", details: parsed.error.issues }, 400);
  const store = await getStore(c);
  const updated = await store.updateUser(Number(c.req.param("id")), { role: parsed.data.role, isTrusted: parsed.data.isTrusted });
  if (!updated) return c.json({ error: "User not found" }, 404);
  return c.json({ data: updated, message: "User updated" });
});

// catch-all for Next assets fallback (when used as monolithic with OpenNext, assets handled by OpenNext)
// For standalone API worker, return 404 for non-api
app.all("*", (c) => c.json({ error: "Not found" }, 404));

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    // In wrangler dev, env contains DB binding; pass to Hono
    return app.fetch(request, env, ctx);
  },
} satisfies ExportedHandler<Env>;
