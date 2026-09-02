// Cloudflare D1 (SQLite) adapter - mirrors pg/memory store signature
// Env binding: env.DB (D1Database)

function sanitizeText(value) {
  if (typeof value !== "string") return null;
  const sanitized = value.trim().replace(/\s+/g, " ");
  return sanitized.length ? sanitized : null;
}
function round(value) {
  return Math.round(value * 10) / 10;
}
function badgeForUserStore(usersByEmail, email) {
  if (!usersByEmail) return { role: "member", isTrusted: false };
  const u = usersByEmail.get(String(email ?? "").toLowerCase());
  if (!u) return { role: "member", isTrusted: false };
  return { role: u.role, isTrusted: u.role === "admin" ? false : Boolean(u.is_trusted) };
}
function withAuthorBadge(review, usersByEmail) {
  const b = badgeForUserStore(usersByEmail, review.author_email);
  return { ...review, author_role: b.role, author_is_trusted: b.isTrusted };
}
function mapRatingRow(row) {
  const role = row.rater_role ?? "member";
  return { ...row, rater_role: role, rater_is_trusted: role === "admin" ? false : Boolean(row.rater_is_trusted) };
}
function applyHypeMask(place, isAuthenticated) {
  if (!place) return place;
  if (place.is_hype && !isAuthenticated) {
    return { ...place, wifi_password: null, wifi_ssid: place.wifi_ssid ? "•••• Login untuk lihat" : null };
  }
  return place;
}
function maskWifiCredentials(list, isHype, isAuthenticated) {
  if (!isHype || isAuthenticated) return list;
  return list.map((c) => ({ ...c, password: null, ssid: c.ssid ? "••••" : c.ssid }));
}
function mapSpeedRow(row) {
  const role = row.tested_by_role ?? "member";
  return {
    ...row,
    tested_by_role: role,
    tested_by_is_trusted: role === "admin" ? false : Boolean(row.tested_by_is_trusted),
    download_mbps: row.download_mbps == null ? null : Number(row.download_mbps),
    upload_mbps: row.upload_mbps == null ? null : Number(row.upload_mbps),
    ping_ms: row.ping_ms == null ? null : Number(row.ping_ms),
    jitter_ms: row.jitter_ms == null ? null : Number(row.jitter_ms),
    loaded_latency_ms: row.loaded_latency_ms == null ? null : Number(row.loaded_latency_ms),
    packet_loss: row.packet_loss == null ? null : Number(row.packet_loss),
    duration_ms: row.duration_ms == null ? null : Number(row.duration_ms),
    claimed_ssid: row.claimed_ssid ?? null,
    user_latitude: row.user_latitude == null ? null : Number(row.user_latitude),
    user_longitude: row.user_longitude == null ? null : Number(row.user_longitude),
    accuracy_m: row.accuracy_m == null ? null : Number(row.accuracy_m),
    distance_m: row.distance_m == null ? null : Number(row.distance_m),
    verified_via: row.verified_via ?? "claim",
  };
}
function normalizePlacePayload(payload) {
  return {
    name: sanitizeText(payload.name),
    category: sanitizeText(payload.category),
    address: sanitizeText(payload.address),
    district: sanitizeText(payload.district),
    latitude: payload.latitude ?? null,
    longitude: payload.longitude ?? null,
    wifi_available: payload.wifiAvailable ? 1 : 0,
    wifi_access_type: sanitizeText(payload.wifiAccessType),
    wifi_password: sanitizeText(payload.wifiPassword),
    password_source: sanitizeText(payload.passwordSource),
    access_notes: sanitizeText(payload.accessNotes),
    wifi_speed_mbps: payload.wifiSpeedMbps ?? null,
    upload_mbps: payload.uploadMbps ?? null,
    ping_ms: payload.pingMs ?? null,
    has_power_outlets: payload.hasPowerOutlets ? 1 : 0,
    open_24_hours: payload.open24Hours ? 1 : 0,
    quiet_zone: payload.quietZone ? 1 : 0,
    ambience_label: sanitizeText(payload.ambienceLabel),
    map_context: sanitizeText(payload.mapContext),
    operating_hours: sanitizeText(payload.operatingHours),
    image_tone: sanitizeText(payload.imageTone) ?? "lagoon",
    image_url: sanitizeText(payload.imageUrl),
    submitter_name: sanitizeText(payload.submitterName),
    submitter_email: sanitizeText(payload.submitterEmail),
    wifi_ssid: sanitizeText(payload.wifiSsid),
    wifi_band: sanitizeText(payload.wifiBand) ?? "auto",
    is_hype: payload.isHype ? 1 : 0,
  };
}
function normalizeReviewPayload(payload) {
  return {
    place_id: Number(payload.placeId),
    author_name: sanitizeText(payload.authorName),
    author_email: sanitizeText(payload.authorEmail),
    review_title: sanitizeText(payload.reviewTitle),
    rating_speed: Number(payload.ratingSpeed),
    rating_comfort: Number(payload.ratingComfort),
    image_url: sanitizeText(payload.imageUrl),
    comment: sanitizeText(payload.comment),
  };
}
function normalizeWifiPayload(payload) {
  return {
    place_id: Number(payload.placeId),
    ssid: sanitizeText(payload.ssid),
    password: sanitizeText(payload.password),
    band: sanitizeText(payload.band) ?? "auto",
    password_source: sanitizeText(payload.passwordSource),
    submitted_by_name: sanitizeText(payload.submittedByName),
    submitted_by_email: sanitizeText(payload.submittedByEmail),
  };
}
function normalizeSpeedPayload(payload) {
  return {
    place_id: Number(payload.placeId),
    download_mbps: payload.downloadMbps != null ? Number(payload.downloadMbps) : null,
    upload_mbps: payload.uploadMbps != null ? Number(payload.uploadMbps) : null,
    ping_ms: payload.pingMs != null ? Number(payload.pingMs) : null,
    jitter_ms: payload.jitterMs != null ? Number(payload.jitterMs) : null,
    loaded_latency_ms: payload.loadedLatencyMs != null ? Number(payload.loadedLatencyMs) : null,
    packet_loss: payload.packetLoss != null ? Number(payload.packetLoss) : null,
    duration_ms: payload.durationMs != null ? Number(payload.durationMs) : null,
    raw_summary: payload.rawSummary ?? null,
    tested_by_name: sanitizeText(payload.testedByName),
    tested_by_email: sanitizeText(payload.testedByEmail),
    ip_hash: payload.ipHash ?? null,
    claimed_ssid: sanitizeText(payload.claimedSsid),
    user_latitude: payload.userLatitude != null ? Number(payload.userLatitude) : null,
    user_longitude: payload.userLongitude != null ? Number(payload.userLongitude) : null,
    accuracy_m: payload.accuracyM != null ? Number(payload.accuracyM) : null,
    distance_m: payload.distanceM != null ? Number(payload.distanceM) : null,
    verified_via: payload.verifiedVia ?? "claim",
  };
}
function mapRow(row) {
  if (!row) return row;
  const role = row.submitter_role ?? "member";
  return {
    ...row,
    submitter_role: role,
    submitter_is_trusted: role === "admin" ? false : Boolean(row.submitter_is_trusted),
    wifi_available: Boolean(row.wifi_available),
    has_power_outlets: Boolean(row.has_power_outlets),
    open_24_hours: Boolean(row.open_24_hours),
    quiet_zone: Boolean(row.quiet_zone),
    is_hype: Boolean(row.is_hype),
    wifi_speed_mbps: row.wifi_speed_mbps === null ? null : Number(row.wifi_speed_mbps),
    upload_mbps: row.upload_mbps === null ? null : Number(row.upload_mbps),
    ping_ms: row.ping_ms === null ? null : Number(row.ping_ms),
    avg_rating: row.avg_rating === null ? 0 : Number(row.avg_rating),
    avg_speed_rating: row.avg_speed_rating === null ? 0 : Number(row.avg_speed_rating),
    avg_comfort_rating: row.avg_comfort_rating === null ? 0 : Number(row.avg_comfort_rating),
    review_count: row.review_count === null ? 0 : Number(row.review_count),
  };
}
function mapWifiRow(row) {
  const role = row.submitted_by_role ?? "member";
  return {
    ...row,
    submitted_by_role: role,
    submitted_by_is_trusted: role === "admin" ? false : Boolean(row.submitted_by_is_trusted),
    avg_rating: row.avg_rating === null ? 0 : Number(row.avg_rating),
    rating_count: row.rating_count === null ? 0 : Number(row.rating_count),
  };
}

function buildWhereClauseD1(filters, params, alias = "p") {
  const where = [];
  const query = sanitizeText(filters.q);
  const category = sanitizeText(filters.category);
  const accessType = sanitizeText(filters.accessType);
  const status = sanitizeText(filters.status) ?? "approved";
  if (status !== "all") {
    params.push(status);
    where.push(`${alias}.status = ?`);
  }
  if (query) {
    params.push(`%${query.toLowerCase()}%`);
    where.push(`LOWER(COALESCE(${alias}.name,'') || ' ' || COALESCE(${alias}.address,'') || ' ' || COALESCE(${alias}.district,'') || ' ' || COALESCE(${alias}.category,'')) LIKE ?`);
  }
  if (category && category !== "all" && category !== "All") {
    params.push(category);
    where.push(`${alias}.category = ?`);
  }
  if (accessType && accessType !== "all") {
    params.push(accessType);
    where.push(`${alias}.wifi_access_type = ?`);
  }
  if (filters.wifiAvailable !== false) {
    where.push(`${alias}.wifi_available = 1`);
  }
  if (filters.speed === "fast") {
    where.push(`${alias}.wifi_speed_mbps >= 50`);
  }
  if (filters.speed === "ultra") {
    where.push(`${alias}.wifi_speed_mbps >= 100`);
  }
  if (filters.speed === "steady") {
    where.push(`${alias}.wifi_speed_mbps >= 20`);
  }
  if (filters.outlets) {
    where.push(`${alias}.has_power_outlets = 1`);
  }
  if (filters.open24) {
    where.push(`${alias}.open_24_hours = 1`);
  }
  return where.length ? `WHERE ${where.join(" AND ")}` : "";
}

const placeListColumns = `
  p.id,
  p.name,
  p.category,
  p.address,
  p.district,
  p.latitude,
  p.longitude,
  p.wifi_available,
  p.wifi_access_type,
  p.wifi_password,
  p.password_source,
  p.access_notes,
  p.wifi_speed_mbps,
  p.upload_mbps,
  p.ping_ms,
  p.has_power_outlets,
  p.open_24_hours,
  p.quiet_zone,
  p.ambience_label,
  p.map_context,
  p.operating_hours,
  p.image_tone,
  p.image_url,
  p.submitter_name,
  p.submitter_email,
  p.wifi_ssid,
  p.wifi_band,
  p.is_hype,
  p.status,
  p.created_at,
  p.updated_at,
  u_sub.role AS submitter_role,
  u_sub.is_trusted AS submitter_is_trusted
`;

export function createD1Store(d1) {
  if (!d1) throw new Error("D1 binding required");

  async function refreshPlaceMetrics(placeId) {
    await d1
      .prepare(
        `INSERT INTO place_metrics (place_id, avg_speed_rating, avg_comfort_rating, avg_rating, review_count, updated_at)
         SELECT p.id AS place_id, COALESCE(AVG(r.rating_speed),0) AS avg_speed_rating, COALESCE(AVG(r.rating_comfort),0) AS avg_comfort_rating, COALESCE(AVG((r.rating_speed + r.rating_comfort)/2.0),0) AS avg_rating, COUNT(r.id) AS review_count, strftime('%Y-%m-%dT%H:%M:%fZ','now') AS updated_at
         FROM places p LEFT JOIN reviews r ON r.place_id = p.id WHERE p.id = ? GROUP BY p.id
         ON CONFLICT(place_id) DO UPDATE SET avg_speed_rating=excluded.avg_speed_rating, avg_comfort_rating=excluded.avg_comfort_rating, avg_rating=excluded.avg_rating, review_count=excluded.review_count, updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')`
      )
      .bind(placeId)
      .run();
  }

  async function getUsersByEmailMap() {
    try {
      const res = await d1.prepare("SELECT * FROM users").all();
      const map = new Map();
      for (const u of res.results ?? []) map.set(String(u.email ?? "").toLowerCase(), u);
      return map;
    } catch {
      return new Map();
    }
  }

  return {
    mode: "d1",
    async initialize() {
      // schema already executed via wrangler d1 execute; ensure users migrated placeholder
      try {
        await d1
          .prepare(
            `INSERT INTO users (name, email, role) SELECT DISTINCT COALESCE(p.submitter_name, p.submitter_email), p.submitter_email, 'member' FROM places p WHERE p.submitter_email IS NOT NULL AND NOT EXISTS (SELECT 1 FROM users WHERE users.email = p.submitter_email)`
          )
          .run();
      } catch (_e) { void _e; }
    },
    async getUserByEmail(email) {
      const row = await d1.prepare("SELECT * FROM users WHERE email = ?").bind(email).first();
      return row ?? null;
    },
    async upsertUser(payload) {
      const res = await d1
        .prepare(
          `INSERT INTO users (name, email, picture, role, is_trusted) VALUES (?, ?, ?, 'member', 0) ON CONFLICT(email) DO UPDATE SET name=excluded.name, picture=COALESCE(excluded.picture, users.picture) RETURNING *`
        )
        .bind(payload.name, payload.email, payload.picture ?? null)
        .first();
      return res;
    },
    async listUsers() {
      const res = await d1.prepare("SELECT id, name, email, role, is_trusted, picture, created_at FROM users ORDER BY created_at DESC").all();
      return res.results ?? [];
    },
    async updateUser(id, patch) {
      const existing = await d1.prepare("SELECT * FROM users WHERE id = ?").bind(id).first();
      if (!existing) return null;
      let isTrusted = existing.is_trusted ? 1 : 0;
      let role = existing.role ?? "member";
      if (patch.role !== undefined) role = patch.role;
      if (role === "admin") isTrusted = 0;
      else if (patch.isTrusted !== undefined) isTrusted = patch.isTrusted ? 1 : 0;
      const updated = await d1
        .prepare("UPDATE users SET role = ?, is_trusted = ? WHERE id = ? RETURNING id, name, email, role, is_trusted, picture, created_at")
        .bind(role, isTrusted, id)
        .first();
      return updated;
    },
    async listPlaces(filters = {}) {
      const params = [];
      const whereSql = buildWhereClauseD1(filters, params);
      const limit = Math.min(Math.max(Number(filters.limit ?? 100), 1), 100);
      const offset = Math.max(Number(filters.offset ?? 0), 0);
      const countRes = await d1.prepare(`SELECT COUNT(*) as total FROM places p ${whereSql}`).bind(...params).first();
      const total = Number(countRes?.total ?? 0);
      const dataRes = await d1
        .prepare(
          `SELECT ${placeListColumns}, COALESCE(m.avg_speed_rating,0) AS avg_speed_rating, COALESCE(m.avg_comfort_rating,0) AS avg_comfort_rating, COALESCE(m.avg_rating,0) AS avg_rating, COALESCE(m.review_count,0) AS review_count
           FROM places p LEFT JOIN place_metrics m ON m.place_id = p.id LEFT JOIN users u_sub ON u_sub.email = p.submitter_email
           ${whereSql} ORDER BY COALESCE(m.avg_rating,0) DESC, p.wifi_speed_mbps DESC, COALESCE(m.review_count,0) DESC, p.created_at DESC LIMIT ? OFFSET ?`
        )
        .bind(...params, limit, offset)
        .all();
      return { places: (dataRes.results ?? []).map(mapRow), total };
    },
    async getPlaceById(placeId, opts = {}) {
      const placeRow = await d1
        .prepare(
          `SELECT p.*, COALESCE(m.avg_speed_rating,0) AS avg_speed_rating, COALESCE(m.avg_comfort_rating,0) AS avg_comfort_rating, COALESCE(m.avg_rating,0) AS avg_rating, COALESCE(m.review_count,0) AS review_count FROM places p LEFT JOIN place_metrics m ON m.place_id = p.id WHERE p.id = ?`
        )
        .bind(placeId)
        .first();
      if (!placeRow) return null;
      const isAuth = Boolean(opts.isAuthenticated);
      const basePlace = mapRow(placeRow);
      const maskedPlace = applyHypeMask(basePlace, isAuth);
      const usersByEmail = await getUsersByEmailMap();
      // reviews
      let reviewsRes;
      try {
        reviewsRes = await d1
          .prepare(
            `SELECT r.id, r.place_id, r.author_name, r.author_email, r.review_title, r.rating_speed, r.rating_comfort, r.image_url, r.comment, r.created_at, u_author.role AS author_role, u_author.is_trusted AS author_is_trusted FROM reviews r LEFT JOIN users u_author ON u_author.email = r.author_email WHERE r.place_id = ? ORDER BY r.created_at DESC`
          )
          .bind(placeId)
          .all();
      } catch (_e) { void _e; reviewsRes = { results: [] }; }
      // related
      let relatedRes;
      try {
        relatedRes = await d1
          .prepare(
            `SELECT ${placeListColumns}, COALESCE(m.avg_speed_rating,0) AS avg_speed_rating, COALESCE(m.avg_comfort_rating,0) AS avg_comfort_rating, COALESCE(m.avg_rating,0) AS avg_rating, COALESCE(m.review_count,0) AS review_count FROM places p LEFT JOIN place_metrics m ON m.place_id = p.id LEFT JOIN users u_sub ON u_sub.email = p.submitter_email WHERE p.status='approved' AND p.id != ? ORDER BY COALESCE(m.avg_rating,0) DESC, p.wifi_speed_mbps DESC LIMIT 3`
          )
          .bind(placeId)
          .all();
      } catch (_e) { void _e; relatedRes = { results: [] }; }
      // wifi creds
      let wifiCredsRaw = [];
      try {
        const wc = await d1
          .prepare(`SELECT wc.*, u_sub.role AS submitted_by_role, u_sub.is_trusted AS submitted_by_is_trusted FROM wifi_credentials wc LEFT JOIN users u_sub ON u_sub.email = wc.submitted_by_email WHERE wc.place_id = ? AND wc.status='approved' ORDER BY wc.created_at DESC`)
          .bind(placeId)
          .all();
        wifiCredsRaw = (wc.results ?? []).map(mapWifiRow);
      } catch (_e) { void _e; }
      const wifiCredsMasked = maskWifiCredentials(wifiCredsRaw, Boolean(basePlace.is_hype), isAuth);
      const credsWithRatings = await Promise.all(
        wifiCredsMasked.map(async (c) => {
          try {
            const r = await d1
              .prepare(`SELECT wr.*, u_rater.role AS rater_role, u_rater.is_trusted AS rater_is_trusted FROM wifi_credential_ratings wr LEFT JOIN users u_rater ON u_rater.email = wr.rater_email WHERE wr.credential_id = ? ORDER BY wr.created_at DESC LIMIT 20`)
              .bind(c.id)
              .all();
            return { ...c, ratings: (r.results ?? []).map(mapRatingRow) };
          } catch (_e) { void _e; return { ...c, ratings: [] }; }
        })
      );
      // speed tests
      let speedTestsRaw = [];
      let speedStats = { count: 0, avg_download: null, avg_upload: null, avg_ping: null, avg_jitter: null, total: 0, last_test_at: null };
      try {
        const st = await d1
          .prepare(`SELECT st.*, u_tester.role AS tested_by_role, u_tester.is_trusted AS tested_by_is_trusted FROM speed_tests st LEFT JOIN users u_tester ON u_tester.email = st.tested_by_email WHERE st.place_id = ? ORDER BY st.created_at DESC LIMIT 5`)
          .bind(placeId)
          .all();
        speedTestsRaw = (st.results ?? []).map(mapSpeedRow);
        const stats = await d1
          .prepare(`SELECT COUNT(*) as count, AVG(download_mbps) as avg_download, AVG(upload_mbps) as avg_upload, AVG(ping_ms) as avg_ping, AVG(jitter_ms) as avg_jitter FROM speed_tests WHERE place_id = ? AND created_at > datetime('now','-30 days')`)
          .bind(placeId)
          .first();
        const totalRes = await d1.prepare(`SELECT COUNT(*) as total, MAX(created_at) as last_test_at FROM speed_tests WHERE place_id = ?`).bind(placeId).first();
        speedStats = {
          count: Number(stats?.count ?? 0),
          avg_download: stats?.avg_download != null ? round(Number(stats.avg_download)) : null,
          avg_upload: stats?.avg_upload != null ? round(Number(stats.avg_upload)) : null,
          avg_ping: stats?.avg_ping != null ? round(Number(stats.avg_ping)) : null,
          avg_jitter: stats?.avg_jitter != null ? round(Number(stats.avg_jitter)) : null,
          total: Number(totalRes?.total ?? 0),
          last_test_at: totalRes?.last_test_at ?? null,
        };
      } catch (_e) { void _e; }
      return {
        ...maskedPlace,
        reviews: (reviewsRes.results ?? []).map((r) => withAuthorBadge(r, usersByEmail)),
        wifi_credentials: credsWithRatings,
        wifi_credentials_total: wifiCredsRaw.length,
        speed_tests: speedTestsRaw,
        speed_stats: speedStats,
        related_places: (relatedRes.results ?? []).map(mapRow),
      };
    },
    async createPlaceSubmission(payload) {
      const n = normalizePlacePayload(payload);
      const res = await d1
        .prepare(
          `INSERT INTO places (name, category, address, district, latitude, longitude, wifi_available, wifi_access_type, wifi_password, password_source, access_notes, wifi_speed_mbps, upload_mbps, ping_ms, has_power_outlets, open_24_hours, quiet_zone, ambience_label, map_context, operating_hours, image_tone, image_url, submitter_name, submitter_email, wifi_ssid, wifi_band, is_hype, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending') RETURNING *`
        )
        .bind(n.name, n.category, n.address, n.district, n.latitude, n.longitude, n.wifi_available, n.wifi_access_type, n.wifi_password, n.password_source, n.access_notes, n.wifi_speed_mbps, n.upload_mbps, n.ping_ms, n.has_power_outlets, n.open_24_hours, n.quiet_zone, n.ambience_label, n.map_context, n.operating_hours, n.image_tone, n.image_url, n.submitter_name, n.submitter_email, n.wifi_ssid, n.wifi_band, n.is_hype)
        .first();
      await refreshPlaceMetrics(res.id);
      return mapRow({ ...res, avg_rating: 0, avg_speed_rating: 0, avg_comfort_rating: 0, review_count: 0 });
    },
    async createReview(payload) {
      const n = normalizeReviewPayload(payload);
      const placeCheck = await d1.prepare("SELECT status FROM places WHERE id = ?").bind(n.place_id).first();
      if (!placeCheck || placeCheck.status !== "approved") throw new Error("Review can only be added to approved places");
      const res = await d1
        .prepare(`INSERT INTO reviews (place_id, author_name, author_email, review_title, rating_speed, rating_comfort, image_url, comment) VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING *`)
        .bind(n.place_id, n.author_name, n.author_email, n.review_title, n.rating_speed, n.rating_comfort, n.image_url, n.comment)
        .first();
      await refreshPlaceMetrics(n.place_id);
      return res;
    },
    async listAdminSubmissions() {
      const stats = await d1
        .prepare(
          `SELECT (SELECT COUNT(*) FROM places WHERE status='approved') AS total_spots, (SELECT COUNT(*) FROM places WHERE status='pending') AS pending_submissions, (SELECT COUNT(*) FROM places WHERE status='rejected') AS rejected_submissions, (SELECT COUNT(*) FROM reviews) AS community_reviews, (SELECT COUNT(*) FROM (SELECT DISTINCT COALESCE(submitter_email, submitter_name) AS contributor FROM places WHERE COALESCE(submitter_email, submitter_name) IS NOT NULL UNION SELECT DISTINCT COALESCE(author_email, author_name) FROM reviews) ) AS active_contributors`
        )
        .first();
      const subs = await d1
        .prepare(
          `SELECT p.*, COALESCE(m.avg_speed_rating,0) AS avg_speed_rating, COALESCE(m.avg_comfort_rating,0) AS avg_comfort_rating, COALESCE(m.avg_rating,0) AS avg_rating, COALESCE(m.review_count,0) AS review_count FROM places p LEFT JOIN place_metrics m ON m.place_id = p.id WHERE p.status != 'approved' ORDER BY p.created_at DESC`
        )
        .all();
      return { stats, submissions: (subs.results ?? []).map(mapRow) };
    },
    async updateSubmissionStatus(placeId, status) {
      const res = await d1.prepare("UPDATE places SET status = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ? RETURNING *").bind(status, placeId).first();
      if (!res) return null;
      await refreshPlaceMetrics(placeId);
      return mapRow({ ...res, avg_rating: 0, avg_speed_rating: 0, avg_comfort_rating: 0, review_count: 0 });
    },
    async listUserSubmissions(email) {
      const res = await d1
        .prepare(`SELECT p.*, u_sub.role AS submitter_role, u_sub.is_trusted AS submitter_is_trusted FROM places p LEFT JOIN users u_sub ON u_sub.email = p.submitter_email WHERE p.submitter_email = ? ORDER BY p.created_at DESC`)
        .bind(email)
        .all();
      return res.results ?? [];
    },
    async listUserReviews(email) {
      const res = await d1
        .prepare(`SELECT r.*, u_author.role AS author_role, u_author.is_trusted AS author_is_trusted FROM reviews r LEFT JOIN users u_author ON u_author.email = r.author_email WHERE r.author_email = ? ORDER BY r.created_at DESC`)
        .bind(email)
        .all();
      return res.results ?? [];
    },
    async listWifiCredentials(placeId, opts = {}) {
      const isAuth = Boolean(opts.isAuthenticated);
      const limit = Math.min(Math.max(Number(opts.limit ?? 50), 1), 100);
      const offset = Math.max(Number(opts.offset ?? 0), 0);
      const statusFilter = opts.includePending ? "" : "AND status='approved'";
      try {
        const placeRes = await d1.prepare("SELECT is_hype FROM places WHERE id = ?").bind(placeId).first();
        const isHype = Boolean(placeRes?.is_hype);
        const res = await d1
          .prepare(
            `SELECT wc.*, u_sub.role AS submitted_by_role, u_sub.is_trusted AS submitted_by_is_trusted FROM wifi_credentials wc LEFT JOIN users u_sub ON u_sub.email = wc.submitted_by_email WHERE wc.place_id = ? ${statusFilter} ORDER BY wc.created_at DESC LIMIT ? OFFSET ?`
          )
          .bind(placeId, limit, offset)
          .all();
        const countRes = await d1.prepare(`SELECT COUNT(*) as total FROM wifi_credentials WHERE place_id = ? ${statusFilter}`).bind(placeId).first();
        const rows = (res.results ?? []).map(mapWifiRow);
        const masked = maskWifiCredentials(rows, isHype, isAuth);
        const withRatings = await Promise.all(
          masked.map(async (c) => {
            const r = await d1.prepare(`SELECT wr.*, u_rater.role AS rater_role, u_rater.is_trusted AS rater_is_trusted FROM wifi_credential_ratings wr LEFT JOIN users u_rater ON u_rater.email = wr.rater_email WHERE wr.credential_id = ? ORDER BY wr.created_at DESC`).bind(c.id).all();
            return { ...c, ratings: (r.results ?? []).map(mapRatingRow) };
          })
        );
        return { data: withRatings, total: Number(countRes?.total ?? 0) };
      } catch (_e) { void _e;
        return { data: [], total: 0 };
      }
    },
    async createWifiCredential(payload) {
      const n = normalizeWifiPayload(payload);
      if (!n.ssid) throw new Error("SSID wajib diisi");
      const placeCheck = await d1.prepare("SELECT status FROM places WHERE id = ?").bind(n.place_id).first();
      if (!placeCheck || placeCheck.status !== "approved") throw new Error("Place not found or not approved");
      if (n.password && !n.password_source) throw new Error("password_source wajib saat password diisi");
      const band = ["2.4GHz", "5GHz", "6GHz", "auto"].includes(n.band) ? n.band : "auto";
      const res = await d1
        .prepare(`INSERT INTO wifi_credentials (place_id, ssid, password, band, password_source, submitted_by_name, submitted_by_email, status) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending') RETURNING *`)
        .bind(n.place_id, n.ssid, n.password, band, n.password_source, n.submitted_by_name, n.submitted_by_email)
        .first();
      return mapWifiRow(res);
    },
    async rateWifiCredential(credentialId, payload) {
      const cred = await d1.prepare("SELECT * FROM wifi_credentials WHERE id = ?").bind(credentialId).first();
      if (!cred || cred.status !== "approved") throw new Error("Credential not found or not approved");
      try {
        const res = await d1
          .prepare(`INSERT INTO wifi_credential_ratings (credential_id, rater_name, rater_email, rating, comment) VALUES (?, ?, ?, ?, ?) RETURNING *`)
          .bind(credentialId, payload.raterName, payload.raterEmail, Number(payload.rating), payload.comment || null)
          .first();
        await d1
          .prepare(`UPDATE wifi_credentials SET avg_rating = (SELECT ROUND(AVG(rating),1) FROM wifi_credential_ratings WHERE credential_id = ?), rating_count = (SELECT COUNT(*) FROM wifi_credential_ratings WHERE credential_id = ?), updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?`)
          .bind(credentialId, credentialId, credentialId)
          .run();
        return res;
      } catch (e) {
        if (String(e.message).includes("UNIQUE") || String(e.cause?.message).includes("UNIQUE")) throw new Error("Kamu sudah memberi rating untuk kredensial ini", { cause: e });
        throw e;
      }
    },
    async listAdminWifiCredentials() {
      const res = await d1
        .prepare(`SELECT wc.*, u_sub.role AS submitted_by_role, u_sub.is_trusted AS submitted_by_is_trusted FROM wifi_credentials wc LEFT JOIN users u_sub ON u_sub.email = wc.submitted_by_email WHERE wc.status='pending' ORDER BY wc.created_at DESC`)
        .all();
      return (res.results ?? []).map(mapWifiRow);
    },
    async updateWifiCredentialStatus(credentialId, status) {
      const res = await d1.prepare("UPDATE wifi_credentials SET status = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ? RETURNING *").bind(status, credentialId).first();
      if (!res) return null;
      if (status === "approved") {
        await d1
          .prepare(`UPDATE places SET wifi_ssid = ?, wifi_password = ?, password_source = ?, wifi_band = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?`)
          .bind(res.ssid, res.password, res.password_source, res.band, res.place_id)
          .run();
      }
      return mapWifiRow(res);
    },
    async createSpeedTest(payload, meta = {}) {
      const n = normalizeSpeedPayload(payload);
      if (!n.place_id || !Number.isFinite(n.place_id)) throw new Error("placeId wajib");
      const placeCheck = await d1.prepare("SELECT status FROM places WHERE id = ?").bind(n.place_id).first();
      if (!placeCheck || placeCheck.status !== "approved") throw new Error("Place not found or not approved");
      if (n.download_mbps == null || !Number.isFinite(n.download_mbps)) throw new Error("downloadMbps wajib");
      const effectiveEmail = n.tested_by_email || meta.testerEmail;
      if (!effectiveEmail) throw new Error("tester email wajib");
      const recent = await d1.prepare(`SELECT COUNT(*) as cnt FROM speed_tests WHERE place_id = ? AND tested_by_email = ? AND created_at > datetime('now','-1 hour')`).bind(n.place_id, effectiveEmail).first();
      if ((recent?.cnt ?? 0) >= 3) throw new Error("Batas 3 tes per jam per lokasi tercapai");
      const raw = n.raw_summary ? JSON.stringify(n.raw_summary) : null;
      const res = await d1
        .prepare(
          `INSERT INTO speed_tests (place_id, download_mbps, upload_mbps, ping_ms, jitter_ms, loaded_latency_ms, packet_loss, duration_ms, raw_summary, tested_by_name, tested_by_email, ip_hash, claimed_ssid, user_latitude, user_longitude, accuracy_m, distance_m, verified_via) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *`
        )
        .bind(n.place_id, n.download_mbps, n.upload_mbps, n.ping_ms, n.jitter_ms, n.loaded_latency_ms, n.packet_loss, n.duration_ms, raw, n.tested_by_name || meta.testerName || "Anon", n.tested_by_email || meta.testerEmail, meta.ipHash ?? n.ip_hash ?? null, n.claimed_ssid ?? null, n.user_latitude ?? null, n.user_longitude ?? null, n.accuracy_m ?? null, n.distance_m ?? null, n.verified_via ?? "claim")
        .first();
      return mapSpeedRow(res);
    },
    async listSpeedTests(placeId, opts = {}) {
      const limit = Math.min(Math.max(Number(opts.limit ?? 20), 1), 100);
      const offset = Math.max(Number(opts.offset ?? 0), 0);
      try {
        const res = await d1
          .prepare(`SELECT st.*, u_tester.role AS tested_by_role, u_tester.is_trusted AS tested_by_is_trusted FROM speed_tests st LEFT JOIN users u_tester ON u_tester.email = st.tested_by_email WHERE st.place_id = ? ORDER BY st.created_at DESC LIMIT ? OFFSET ?`)
          .bind(placeId, limit, offset)
          .all();
        const countRes = await d1.prepare(`SELECT COUNT(*) as total FROM speed_tests WHERE place_id = ?`).bind(placeId).first();
        const statsRes = await d1.prepare(`SELECT COUNT(*) as count, AVG(download_mbps) as avg_download, AVG(upload_mbps) as avg_upload, AVG(ping_ms) as avg_ping, AVG(jitter_ms) as avg_jitter FROM speed_tests WHERE place_id = ? AND created_at > datetime('now','-30 days')`).bind(placeId).first();
        const overallRes = await d1.prepare(`SELECT MAX(created_at) as last_test_at FROM speed_tests WHERE place_id = ?`).bind(placeId).first();
        const stats = {
          count: Number(statsRes?.count ?? 0),
          avg_download: statsRes?.avg_download != null ? round(Number(statsRes.avg_download)) : null,
          avg_upload: statsRes?.avg_upload != null ? round(Number(statsRes.avg_upload)) : null,
          avg_ping: statsRes?.avg_ping != null ? round(Number(statsRes.avg_ping)) : null,
          avg_jitter: statsRes?.avg_jitter != null ? round(Number(statsRes.avg_jitter)) : null,
          total: Number(countRes?.total ?? 0),
          last_test_at: overallRes?.last_test_at ?? null,
        };
        return { data: (res.results ?? []).map(mapSpeedRow), total: Number(countRes?.total ?? 0), stats };
      } catch (_e) { void _e;
        return { data: [], total: 0, stats: { count: 0, avg_download: null, avg_upload: null, avg_ping: null, avg_jitter: null } };
      }
    },
    async getSpeedStats(placeId) {
      try {
        const statsRes = await d1.prepare(`SELECT COUNT(*) as count, AVG(download_mbps) as avg_download, AVG(upload_mbps) as avg_upload, AVG(ping_ms) as avg_ping, AVG(jitter_ms) as avg_jitter FROM speed_tests WHERE place_id = ? AND created_at > datetime('now','-30 days')`).bind(placeId).first();
        const overallRes = await d1.prepare(`SELECT COUNT(*) as total, MAX(created_at) as last_test_at FROM speed_tests WHERE place_id = ?`).bind(placeId).first();
        return {
          count: Number(statsRes?.count ?? 0),
          avg_download: statsRes?.avg_download != null ? round(Number(statsRes.avg_download)) : null,
          avg_upload: statsRes?.avg_upload != null ? round(Number(statsRes.avg_upload)) : null,
          avg_ping: statsRes?.avg_ping != null ? round(Number(statsRes.avg_ping)) : null,
          avg_jitter: statsRes?.avg_jitter != null ? round(Number(statsRes.avg_jitter)) : null,
          total: Number(overallRes?.total ?? 0),
          last_test_at: overallRes?.last_test_at ?? null,
        };
      } catch (_e) { void _e;
        return { count: 0, avg_download: null, avg_upload: null, avg_ping: null, avg_jitter: null, total: 0, last_test_at: null };
      }
    },
  };
}
