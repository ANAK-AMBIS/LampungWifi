import cookieParser from "cookie-parser";
import cors from "cors";
import crypto from "node:crypto";
import dotenv from "dotenv";
import express from "express";
import rateLimit from "express-rate-limit";
import { OAuth2Client } from "google-auth-library";
import { z } from "zod";
import { createStore } from "./db.js";

dotenv.config();

const isProduction = process.env.NODE_ENV === "production";

function validateEnv() {
  const warnings = [];
  const errors = [];

  if (!process.env.ADMIN_TOKEN?.trim()) {
    if (isProduction) {
      errors.push(
        "ADMIN_TOKEN tidak diset — admin akan nonaktif di production",
      );
    } else {
      warnings.push(
        "ADMIN_TOKEN tidak diset — endpoint admin terbuka di development",
      );
    }
  }

  if (
    !process.env.GOOGLE_CLIENT_ID?.trim() &&
    !process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID?.trim()
  ) {
    warnings.push("GOOGLE_CLIENT_ID tidak diset — login Google akan nonaktif");
  }

  if (isProduction && !process.env.DATABASE_URL) {
    warnings.push(
      "DATABASE_URL tidak diset — pakai in-memory store (data tidak persisten)",
    );
  }

  if (process.env.CORS_ORIGIN === "true" && isProduction) {
    warnings.push("CORS_ORIGIN=true di production — semua origin diizinkan");
  }

  if (warnings.length) {
    console.warn("[env]", warnings.join("; "));
  }
  if (errors.length) {
    console.error("[env]", errors.join("; "));
  }
}

validateEnv();

const app = express();
const store = await createStore();
const port = Number(process.env.PORT ?? 8787);
const adminToken = process.env.ADMIN_TOKEN?.trim();
const googleClientId =
  process.env.GOOGLE_CLIENT_ID?.trim() ||
  process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID?.trim();
const defaultCorsOrigin = isProduction ? false : true;

// ── Session helpers ───────────────────────────────
const sessionSecret = `${googleClientId ?? "balamwifi"}.${process.env.ADMIN_TOKEN ?? "session"}`;

function createSession(user) {
  const header = Buffer.from(
    JSON.stringify({ alg: "HS256", typ: "JWT" }),
  ).toString("base64url");
  const payload = Buffer.from(
    JSON.stringify({
      sub: user.email,
      name: user.name,
      email: user.email,
      picture: user.picture ?? "",
      iat: Math.floor(Date.now() / 1000),
    }),
  ).toString("base64url");
  const signature = crypto
    .createHmac("sha256", sessionSecret)
    .update(`${header}.${payload}`)
    .digest("base64url");
  return `${header}.${payload}.${signature}`;
}

function readSession(request) {
  const token = request.cookies?.session ?? "";
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [header, payload, signature] = parts;
  const expectedSig = crypto
    .createHmac("sha256", sessionSecret)
    .update(`${header}.${payload}`)
    .digest("base64url");
  if (signature !== expectedSig) return null;
  try {
    return JSON.parse(Buffer.from(payload, "base64url").toString());
  } catch {
    return null;
  }
}

// ── OAuth client ──────────────────────────────────
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
const oauthClient =
  googleClientId && process.env.GOOGLE_CLIENT_SECRET
    ? new OAuth2Client(
        googleClientId,
        process.env.GOOGLE_CLIENT_SECRET,
        `${siteUrl}/api/auth/google/callback`,
      )
    : null;

const categoryOptions = [
  "Cafe / Coffee Shop",
  "Coworking Space",
  "Library",
  "Campus Lounge",
  "Restaurant",
  "Rest Area",
];

const bandOptions = ["2.4GHz", "5GHz", "6GHz", "auto"] ;

const placeSubmissionSchema = z
  .object({
    name: z.string().min(3).max(120),
    category: z.enum(categoryOptions),
    address: z.string().min(6).max(180),
    district: z.string().min(2).max(80),
    latitude: z.number().min(-90).max(90).nullable().optional(),
    longitude: z.number().min(-180).max(180).nullable().optional(),
    wifiAvailable: z.boolean().default(true),
    wifiAccessType: z.string().max(80).optional().nullable(),
    wifiPassword: z.string().max(80).optional().nullable(),
    wifiSsid: z.string().max(32).optional().nullable(),
    wifiBand: z.enum(bandOptions).optional().nullable(),
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
    imageUrl: z
      .union([z.string().url().max(500), z.literal(""), z.null()])
      .optional(),
    submitterName: z.string().min(2).max(80),
    submitterEmail: z
      .union([z.string().email().max(120), z.literal(""), z.null()])
      .optional(),
  })
  .superRefine((value, ctx) => {
    if (value.wifiPassword && !value.passwordSource) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "password_source wajib saat password WiFi diisi",
        path: ["passwordSource"],
      });
    }
  });

const reviewSchema = z.object({
  placeId: z.number().int().positive(),
  authorName: z.string().min(2).max(80),
  authorEmail: z.string().email().max(120),
  reviewTitle: z.string().min(4).max(100),
  ratingSpeed: z.number().int().min(1).max(5),
  ratingComfort: z.number().int().min(1).max(5),
  imageUrl: z
    .union([
      z.string().url().max(500),
      z.string().startsWith("data:image/").max(900_000),
      z.literal(""),
      z.null(),
    ])
    .optional(),
  comment: z.string().min(12).max(400),
});

const moderationSchema = z.object({
  status: z.enum(["approved", "rejected"]),
});

const wifiCredentialSchema = z
  .object({
    placeId: z.number().int().positive(),
    ssid: z.string().min(1).max(32),
    password: z.string().max(80).optional().nullable(),
    band: z.enum(bandOptions).optional().nullable(),
    passwordSource: z.string().max(80).optional().nullable(),
  })
  .superRefine((value, ctx) => {
    if (value.password && !value.passwordSource) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "password_source wajib saat password diisi",
        path: ["passwordSource"],
      });
    }
  });

const wifiRatingSchema = z.object({
  credentialId: z.number().int().positive(),
  rating: z.number().int().min(1).max(5),
  comment: z.string().min(12).max(400).optional().nullable(),
});

const speedTestSchema = z.object({
  downloadMbps: z.number().min(0).max(1000),
  uploadMbps: z.number().min(0).max(1000).nullable().optional(),
  pingMs: z.number().int().min(0).max(1000).nullable().optional(),
  jitterMs: z.number().min(0).max(1000).nullable().optional(),
  loadedLatencyMs: z.number().int().min(0).max(1000).nullable().optional(),
  packetLoss: z.number().min(0).max(1).nullable().optional(),
  durationMs: z.number().int().min(100).max(120000).nullable().optional(),
  rawSummary: z.any().nullable().optional(),
});

function parseBoolean(value, defaultValue = false) {
  if (value === undefined) {
    return defaultValue;
  }

  if (typeof value === "boolean") {
    return value;
  }

  return String(value).toLowerCase() === "true";
}

function cleanNullableString(value) {
  if (typeof value !== "string") {
    return value ?? null;
  }

  const cleaned = value.trim().replace(/\s+/g, " ");
  return cleaned.length ? cleaned : null;
}

function parseJson(schema, body) {
  return schema.parse({
    ...body,
    wifiPassword: cleanNullableString(body.wifiPassword),
    wifiSsid: cleanNullableString(body.wifiSsid),
    wifiBand: cleanNullableString(body.wifiBand),
    passwordSource: cleanNullableString(body.passwordSource),
    wifiAccessType: cleanNullableString(body.wifiAccessType),
    accessNotes: cleanNullableString(body.accessNotes),
    ambienceLabel: cleanNullableString(body.ambienceLabel),
    mapContext: cleanNullableString(body.mapContext),
    operatingHours: cleanNullableString(body.operatingHours),
    imageTone: cleanNullableString(body.imageTone),
    imageUrl: cleanNullableString(body.imageUrl),
    submitterEmail: cleanNullableString(body.submitterEmail),
    ssid: cleanNullableString(body.ssid),
    password: cleanNullableString(body.password),
    band: cleanNullableString(body.band),
    comment: cleanNullableString(body.comment),
  });
}

function parseLimit(value, defaultValue = 100) {
  if (value === undefined) {
    return defaultValue;
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return defaultValue;
  }

  return Math.min(Math.max(Math.trunc(parsed), 1), 100);
}

function parseOffset(value, defaultValue = 0) {
  if (value === undefined) {
    return defaultValue;
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed < 0) {
    return defaultValue;
  }

  return Math.trunc(parsed);
}

function requireAdmin(request, response, next) {
  if (!adminToken) {
    if (isProduction) {
      response.status(503).json({ error: "Admin access is not configured" });
      return;
    }

    next();
    return;
  }

  // Check httpOnly cookie first, then Authorization header
  const cookieToken = request.cookies?.admin_session ?? "";
  const authHeader = request.get("authorization") ?? "";
  const headerToken = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7).trim()
    : "";
  const token = cookieToken || headerToken;

  if (token !== adminToken) {
    response.status(401).json({ error: "Unauthorized" });
    return;
  }

  next();
}

async function requireGoogleUser(request, response, next) {
  const user = readSession(request);
  if (!user) {
    response.status(401).json({ error: "Login required" });
    return;
  }
  request.googleUser = {
    name: user.name,
    email: user.email,
    picture: user.picture,
  };
  next();
}

app.use(
  cors({
    origin: process.env.CORS_ORIGIN
      ? process.env.CORS_ORIGIN.split(",")
      : defaultCorsOrigin,
  }),
);
app.use(express.json({ limit: "2mb" }));

// Request logging
app.use((request, response, next) => {
  const start = Date.now();
  response.on("finish", () => {
    const duration = Date.now() - start;
    if (request.method !== "OPTIONS") {
      console.log(
        `${request.method} ${request.originalUrl} ${response.statusCode} ${duration}ms`,
      );
    }
  });
  next();
});

// CSRF protection for state-changing endpoints
function csrfCheck(request, response, next) {
  if (["GET", "HEAD", "OPTIONS"].includes(request.method)) {
    next();
    return;
  }

  if (!isProduction) {
    next();
    return;
  }

  const origin = request.get("origin") ?? "";
  const xRequestedWith = request.get("x-requested-with") ?? "";

  if (!origin && !xRequestedWith && request.is("application/json")) {
    next();
    return;
  }

  if (origin || xRequestedWith) {
    next();
    return;
  }

  response.status(403).json({ error: "CSRF check failed" });
}

const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please try again later" },
});

const mutationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many submissions, please try again later" },
});

app.use(generalLimiter);
app.use(cookieParser());

app.get("/api/health", async (_request, response) => {
  response.json({
    status: "ok",
    mode: store.mode,
    timestamp: new Date().toISOString(),
  });
});

app.post("/api/admin/login", csrfCheck, (request, response) => {
  if (!adminToken) {
    response.status(503).json({ error: "Admin access is not configured" });
    return;
  }

  const { token } = request.body ?? {};

  if (!token || token !== adminToken) {
    response.status(401).json({ error: "Invalid admin token" });
    return;
  }

  response.cookie("admin_session", token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    maxAge: 24 * 60 * 60 * 1000,
    path: "/",
  });

  response.json({ message: "Admin session created" });
});

// ── OAuth 2.0 ─────────────────────────────────────
app.get("/api/auth/google", (_request, response) => {
  if (!oauthClient) {
    response.status(503).json({ error: "OAuth tidak dikonfigurasi" });
    return;
  }
  const url = oauthClient.generateAuthUrl({
    scope: ["openid", "email", "profile"],
    prompt: "select_account",
    redirect_uri: `${siteUrl}/api/auth/google/callback`,
  });
  response.redirect(url);
});

app.get("/api/auth/google/callback", async (request, response, next) => {
  try {
    if (!oauthClient) {
      response.status(503).json({ error: "OAuth tidak dikonfigurasi" });
      return;
    }
    const { code } = request.query;
    if (!code) {
      response.status(400).json({ error: "Missing authorization code" });
      return;
    }
    const { tokens } = await oauthClient.getToken(code);
    const ticket = await oauthClient.verifyIdToken({
      idToken: tokens.id_token,
      audience: googleClientId,
    });
    const payload = ticket.getPayload();
    if (!payload?.email) {
      response.status(401).json({ error: "Email tidak terverifikasi" });
      return;
    }
    const session = createSession({
      name: payload.name ?? payload.email,
      email: payload.email,
      picture: payload.picture ?? "",
    });
    response.cookie("session", session, {
      httpOnly: true,
      secure: isProduction,
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: "/",
    });
    response.redirect("/dashboard");
  } catch (error) {
    console.error("[oauth] callback error:", error.message);
    next(error);
  }
});

app.get("/api/auth/me", (request, response) => {
  const user = readSession(request);
  if (!user) {
    response.json({ user: null });
    return;
  }
  response.json({
    user: { name: user.name, email: user.email, picture: user.picture },
  });
});

app.post("/api/auth/logout", (_request, response) => {
  response.clearCookie("session", { path: "/" });
  response.json({ ok: true });
});

app.get(
  "/api/auth/me/submissions",
  requireGoogleUser,
  async (request, response, next) => {
    try {
      const submissions = await store.listUserSubmissions(
        request.googleUser.email,
      );
      response.json({ data: submissions });
    } catch (error) {
      next(error);
    }
  },
);

app.get(
  "/api/auth/me/reviews",
  requireGoogleUser,
  async (request, response, next) => {
    try {
      const reviews = await store.listUserReviews(request.googleUser.email);
      response.json({ data: reviews });
    } catch (error) {
      next(error);
    }
  },
);

app.get("/api/places", async (request, response, next) => {
  try {
    const filters = {
      q: request.query.q,
      category: request.query.category,
      accessType: request.query.accessType,
      speed: request.query.speed,
      outlets: parseBoolean(request.query.outlets),
      open24: parseBoolean(request.query.open24),
      wifiAvailable: parseBoolean(request.query.wifi, true),
      status: request.query.status,
      limit: parseLimit(request.query.limit),
      offset: parseOffset(request.query.offset),
    };

    const result = await store.listPlaces(filters);
    response.json({
      data: result.places,
      meta: {
        source: store.mode,
        count: result.places.length,
        total: result.total,
      },
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/places/:id", async (request, response, next) => {
  try {
    const isAuth = Boolean(readSession(request));
    const place = await store.getPlaceById(Number(request.params.id), { isAuthenticated: isAuth });

    if (!place) {
      response.status(404).json({ error: "Place not found" });
      return;
    }

    response.json({
      data: place,
      meta: {
        source: store.mode,
      },
    });
  } catch (error) {
    next(error);
  }
});

// ── Wifi credentials per place ─────────────────────
app.get("/api/places/:id/wifi", async (request, response, next) => {
  try {
    const placeId = Number(request.params.id);
    const place = await store.getPlaceById(placeId, { isAuthenticated: Boolean(readSession(request)) });
    if (!place) {
      response.status(404).json({ error: "Place not found" });
      return;
    }
    const isAuth = Boolean(readSession(request));
    const result = await store.listWifiCredentials(placeId, {
      isAuthenticated: isAuth,
      limit: parseLimit(request.query.limit, 50),
      offset: parseOffset(request.query.offset, 0),
    });
    response.json({ data: result.data, meta: { source: store.mode, total: result.total } });
  } catch (error) {
    next(error);
  }
});

app.post("/api/places/:id/wifi", mutationLimiter, requireGoogleUser, async (request, response, next) => {
  try {
    const placeId = Number(request.params.id);
    const parsed = parseJson(wifiCredentialSchema, { ...request.body, placeId });
    const cred = await store.createWifiCredential({
      placeId,
      ssid: parsed.ssid,
      password: parsed.password,
      band: parsed.band,
      passwordSource: parsed.passwordSource,
      submittedByName: request.googleUser.name,
      submittedByEmail: request.googleUser.email,
    });
    response.status(201).json({ data: cred, message: "WiFi submitted for moderation" });
  } catch (error) {
    next(error);
  }
});

app.post("/api/wifi/:credId/ratings", mutationLimiter, requireGoogleUser, async (request, response, next) => {
  try {
    const parsed = parseJson(wifiRatingSchema, { ...request.body, credentialId: Number(request.params.credId) });
    const rating = await store.rateWifiCredential(parsed.credentialId, {
      raterName: request.googleUser.name,
      raterEmail: request.googleUser.email,
      rating: parsed.rating,
      comment: parsed.comment,
    });
    response.status(201).json({ data: rating, message: "Rating published" });
  } catch (error) {
    // friendly duplicate message
    if (error.message?.includes("sudah memberi rating")) {
      response.status(409).json({ error: error.message });
      return;
    }
    next(error);
  }
});

// ── Speedtest (Cloudflare) ───────────────────────
app.get("/api/places/:id/speedtest", async (request, response, next) => {
  try {
    const placeId = Number(request.params.id);
    if (!Number.isFinite(placeId) || placeId <= 0) {
      response.status(400).json({ error: "Invalid place id" });
      return;
    }
    // verify place exists
    const place = await store.getPlaceById(placeId, { isAuthenticated: Boolean(readSession(request)) });
    if (!place) {
      response.status(404).json({ error: "Place not found" });
      return;
    }
    const result = await store.listSpeedTests(placeId, {
      limit: parseLimit(request.query.limit, 20),
      offset: parseOffset(request.query.offset, 0),
    });
    response.json({ data: result.data, meta: { source: store.mode, total: result.total, stats: result.stats } });
  } catch (error) {
    next(error);
  }
});

app.post("/api/places/:id/speedtest", mutationLimiter, requireGoogleUser, async (request, response, next) => {
  try {
    const placeId = Number(request.params.id);
    if (!Number.isFinite(placeId) || placeId <= 0) {
      response.status(400).json({ error: "Invalid place id" });
      return;
    }
    const parsed = speedTestSchema.parse({
      downloadMbps: request.body.downloadMbps ?? request.body.download_mbps,
      uploadMbps: request.body.uploadMbps ?? request.body.upload_mbps,
      pingMs: request.body.pingMs ?? request.body.ping_ms,
      jitterMs: request.body.jitterMs ?? request.body.jitter_ms,
      loadedLatencyMs: request.body.loadedLatencyMs ?? request.body.loaded_latency_ms,
      packetLoss: request.body.packetLoss ?? request.body.packet_loss,
      durationMs: request.body.durationMs ?? request.body.duration_ms,
      rawSummary: request.body.rawSummary ?? request.body.raw_summary ?? null,
    });
    const ipRaw = request.ip ?? request.headers["x-forwarded-for"] ?? "";
    const ipHash = ipRaw ? crypto.createHash("sha256").update(String(ipRaw)).digest("hex").slice(0, 16) : null;
    const record = await store.createSpeedTest(
      {
        placeId,
        downloadMbps: parsed.downloadMbps,
        uploadMbps: parsed.uploadMbps,
        pingMs: parsed.pingMs,
        jitterMs: parsed.jitterMs,
        loadedLatencyMs: parsed.loadedLatencyMs,
        packetLoss: parsed.packetLoss,
        durationMs: parsed.durationMs,
        rawSummary: parsed.rawSummary,
        testedByName: request.googleUser.name,
        testedByEmail: request.googleUser.email,
      },
      { testerName: request.googleUser.name, testerEmail: request.googleUser.email, ipHash },
    );
    response.status(201).json({ data: record, message: "Speedtest tercatat" });
  } catch (error) {
    if (error.message?.includes("Batas 3 tes")) {
      response.status(429).json({ error: error.message });
      return;
    }
    next(error);
  }
});

app.post(
  "/api/places",
  mutationLimiter,
  requireGoogleUser,
  async (request, response, next) => {
    try {
      const parsed = parseJson(placeSubmissionSchema, {
        ...request.body,
        submitterName: request.googleUser.name,
        submitterEmail: request.googleUser.email,
      });
      const submission = await store.createPlaceSubmission(parsed);

      response.status(201).json({
        data: submission,
        message: "Spot submitted for moderation",
      });
    } catch (error) {
      next(error);
    }
  },
);

app.post(
  "/api/reviews",
  mutationLimiter,
  requireGoogleUser,
  async (request, response, next) => {
    try {
      const parsed = reviewSchema.parse({
        ...request.body,
        authorName: request.googleUser.name,
        authorEmail: request.googleUser.email,
      });
      const review = await store.createReview(parsed);

      response.status(201).json({
        data: review,
        message: "Review published",
      });
    } catch (error) {
      next(error);
    }
  },
);

app.get(
  "/api/admin/submissions",
  requireAdmin,
  async (_request, response, next) => {
    try {
      const data = await store.listAdminSubmissions();
      response.json({
        data,
        meta: {
          source: store.mode,
        },
      });
    } catch (error) {
      next(error);
    }
  },
);

app.get("/api/admin/wifi", requireAdmin, async (_request, response, next) => {
  try {
    const data = await store.listAdminWifiCredentials();
    response.json({ data, meta: { source: store.mode } });
  } catch (error) {
    next(error);
  }
});

app.patch("/api/admin/wifi/:id", csrfCheck, requireAdmin, async (request, response, next) => {
  try {
    const parsed = moderationSchema.parse(request.body);
    const updated = await store.updateWifiCredentialStatus(Number(request.params.id), parsed.status);
    if (!updated) {
      response.status(404).json({ error: "Credential not found" });
      return;
    }
    response.json({ data: updated, message: `WiFi ${parsed.status}` });
  } catch (error) {
    next(error);
  }
});

app.patch(
  "/api/admin/submissions/:id",
  csrfCheck,
  requireAdmin,
  async (request, response, next) => {
    try {
      const parsed = moderationSchema.parse(request.body);
      const updated = await store.updateSubmissionStatus(
        Number(request.params.id),
        parsed.status,
      );

      if (!updated) {
        response.status(404).json({ error: "Submission not found" });
        return;
      }

      response.json({
        data: updated,
        message: `Submission ${parsed.status}`,
      });
    } catch (error) {
      next(error);
    }
  },
);

app.use((error, _request, response, next) => {
  void next;

  if (error instanceof z.ZodError) {
    response.status(400).json({
      error: "Validation failed",
      details: error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    });
    return;
  }

  console.error(error);
  response.status(500).json({ error: "Internal server error" });
});

export default app;

if (process.env.NODE_ENV !== "test") {
  app.listen(port, () => {
    console.log(
      `BalamWiFi API running on http://localhost:${port} (${store.mode})`,
    );
  });
}
