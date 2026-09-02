import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { seedPlaces, seedReviews, seedUsers } from "./seedData.js";

const searchableFields = ["name", "address", "district", "category"];

function sanitizeText(value) {
  if (typeof value !== "string") {
    return null;
  }

  const sanitized = value.trim().replace(/\s+/g, " ");
  return sanitized.length ? sanitized : null;
}

function round(value) {
  return Math.round(value * 10) / 10;
}

// ---- user-badge enrichment (shared helpers) ----
// Admin is_trusted is always treated as false (badge Admin shown instead).
function badgeForUserStore(usersByEmail, email) {
  if (!usersByEmail) return { role: "member", isTrusted: false };
  const u = usersByEmail.get(String(email ?? "").toLowerCase());
  if (!u) return { role: "member", isTrusted: false };
  return { role: u.role, isTrusted: u.role === "admin" ? false : Boolean(u.is_trusted) };
}

function withSubmitterBadge(place, usersByEmail) {
  const b = badgeForUserStore(usersByEmail, place.submitter_email);
  return { ...place, submitter_role: b.role, submitter_is_trusted: b.isTrusted };
}
function withAuthorBadge(review, usersByEmail) {
  const b = badgeForUserStore(usersByEmail, review.author_email);
  const base = { ...review, author_role: b.role, author_is_trusted: b.isTrusted };
  return base;
}
function withWifiSubmitterBadge(cred, usersByEmail) {
  const b = badgeForUserStore(usersByEmail, cred.submitted_by_email);
  return { ...cred, submitted_by_role: b.role, submitted_by_is_trusted: b.isTrusted };
}
function withRaterBadge(rating, usersByEmail) {
  const b = badgeForUserStore(usersByEmail, rating.rater_email);
  return { ...rating, rater_role: b.role, rater_is_trusted: b.isTrusted };
}
function withTesterBadge(test, usersByEmail) {
  const b = badgeForUserStore(usersByEmail, test.tested_by_email);
  return { ...test, tested_by_role: b.role, tested_by_is_trusted: b.isTrusted };
}
function mapRatingRow(row) {
  const role = row.rater_role ?? "member";
  return { ...row, rater_role: role, rater_is_trusted: role === "admin" ? false : Boolean(row.rater_is_trusted) };
}

function buildMetricsMap(reviewList) {
  const grouped = new Map();

  for (const review of reviewList) {
    const placeId = Number(review.place_id);
    const existing = grouped.get(placeId) ?? { count: 0, speed: 0, comfort: 0 };
    existing.count += 1;
    existing.speed += Number(review.rating_speed);
    existing.comfort += Number(review.rating_comfort);
    grouped.set(placeId, existing);
  }

  const metrics = new Map();
  for (const [placeId, item] of grouped) {
    const avgSpeed = item.speed / item.count;
    const avgComfort = item.comfort / item.count;
    metrics.set(placeId, {
      avg_speed_rating: round(avgSpeed),
      avg_comfort_rating: round(avgComfort),
      avg_rating: round((avgSpeed + avgComfort) / 2),
      review_count: item.count,
    });
  }

  return metrics;
}

function metricsFor(metricsMap, placeId) {
  return (
    metricsMap.get(Number(placeId)) ?? {
      avg_rating: 0,
      avg_speed_rating: 0,
      avg_comfort_rating: 0,
      review_count: 0,
    }
  );
}

function withMetricsMap(place, metricsMap) {
  return {
    ...place,
    ...metricsFor(metricsMap, place.id),
  };
}

function sortFeatured(left, right) {
  if (right.avg_rating !== left.avg_rating) {
    return right.avg_rating - left.avg_rating;
  }

  if ((right.wifi_speed_mbps ?? 0) !== (left.wifi_speed_mbps ?? 0)) {
    return (right.wifi_speed_mbps ?? 0) - (left.wifi_speed_mbps ?? 0);
  }

  return right.review_count - left.review_count;
}

function applyFilters(list, filters) {
  const query = sanitizeText(filters.q)?.toLowerCase();
  const category = sanitizeText(filters.category);
  const accessType = sanitizeText(filters.accessType);
  const speed = sanitizeText(filters.speed);
  const requireOutlets = Boolean(filters.outlets);
  const requireOpen24 = Boolean(filters.open24);
  const requireWifi = filters.wifiAvailable !== false;
  const status = sanitizeText(filters.status) ?? "approved";

  return list.filter((place) => {
    if (status !== "all" && place.status !== status) {
      return false;
    }

    if (query) {
      const haystack = searchableFields
        .map((field) => place[field])
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      if (!haystack.includes(query)) {
        return false;
      }
    }

    if (
      category &&
      category !== "All" &&
      category !== "all" &&
      place.category !== category
    ) {
      return false;
    }

    if (
      accessType &&
      accessType !== "all" &&
      place.wifi_access_type !== accessType
    ) {
      return false;
    }

    if (requireWifi && !place.wifi_available) {
      return false;
    }

    if (speed === "fast" && Number(place.wifi_speed_mbps ?? 0) < 50) {
      return false;
    }

    if (speed === "ultra" && Number(place.wifi_speed_mbps ?? 0) < 100) {
      return false;
    }

    if (speed === "steady" && Number(place.wifi_speed_mbps ?? 0) < 20) {
      return false;
    }

    if (requireOutlets && !place.has_power_outlets) {
      return false;
    }

    if (requireOpen24 && !place.open_24_hours) {
      return false;
    }

    return true;
  });
}

function normalizePlacePayload(payload) {
  return {
    name: sanitizeText(payload.name),
    category: sanitizeText(payload.category),
    address: sanitizeText(payload.address),
    district: sanitizeText(payload.district),
    latitude: payload.latitude ?? null,
    longitude: payload.longitude ?? null,
    wifi_available: Boolean(payload.wifiAvailable),
    wifi_access_type: sanitizeText(payload.wifiAccessType),
    wifi_password: sanitizeText(payload.wifiPassword),
    password_source: sanitizeText(payload.passwordSource),
    access_notes: sanitizeText(payload.accessNotes),
    wifi_speed_mbps: payload.wifiSpeedMbps ?? null,
    upload_mbps: payload.uploadMbps ?? null,
    ping_ms: payload.pingMs ?? null,
    has_power_outlets: Boolean(payload.hasPowerOutlets),
    open_24_hours: Boolean(payload.open24Hours),
    quiet_zone: Boolean(payload.quietZone),
    ambience_label: sanitizeText(payload.ambienceLabel),
    map_context: sanitizeText(payload.mapContext),
    operating_hours: sanitizeText(payload.operatingHours),
    image_tone: sanitizeText(payload.imageTone) ?? "lagoon",
    image_url: sanitizeText(payload.imageUrl),
    submitter_name: sanitizeText(payload.submitterName),
    submitter_email: sanitizeText(payload.submitterEmail),
    wifi_ssid: sanitizeText(payload.wifiSsid),
    wifi_band: sanitizeText(payload.wifiBand) ?? "auto",
    is_hype: Boolean(payload.isHype),
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

function computeSpeedStats(list) {
  if (!list.length) return { count: 0, avg_download: null, avg_upload: null, avg_ping: null, avg_jitter: null };
  const dl = list.map((r) => r.download_mbps).filter((v) => v != null);
  const ul = list.map((r) => r.upload_mbps).filter((v) => v != null);
  const ping = list.map((r) => r.ping_ms).filter((v) => v != null);
  const jitter = list.map((r) => r.jitter_ms).filter((v) => v != null);
  const avg = (arr) => (arr.length ? Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10 : null);
  return { count: list.length, avg_download: avg(dl), avg_upload: avg(ul), avg_ping: avg(ping), avg_jitter: avg(jitter) };
}

function createMemoryStore() {
  const places = structuredClone(seedPlaces);
  const reviews = structuredClone(seedReviews);
  const users = structuredClone(seedUsers);
  const usersByEmail = new Map(
    users.map((u) => [String(u.email ?? "").toLowerCase(), u]),
  );
  // seed wifi credentials
  const wifiCredentials = [];
  const wifiRatings = [];
  const speedTests = [];
  let nextSpeedId = 1;
  // init from places with wifi_password/ssid as approved creds
  for (const p of places) {
    if (p.wifi_password || p.wifi_ssid) {
      wifiCredentials.push({
        id: wifiCredentials.length + 1,
        place_id: p.id,
        ssid: p.wifi_ssid || p.name.replace(/\s+/g, "-").toLowerCase().slice(0, 20),
        password: p.wifi_password,
        band: p.wifi_band || "auto",
        password_source: p.password_source,
        submitted_by_name: p.submitter_name,
        submitted_by_email: p.submitter_email || "admin@balamwifi.id",
        status: "approved",
        avg_rating: 0,
        rating_count: 0,
        created_at: p.created_at,
        updated_at: p.updated_at,
      });
    }
  }
  // add extra multi-SSID examples for hype/5GHz demo (place 2 & 4)
  wifiCredentials.push({
    id: wifiCredentials.length + 1,
    place_id: 4,
    ssid: "Nuri-5G",
    password: "nuri-5g-fast",
    band: "5GHz",
    password_source: "Verified by staff",
    submitted_by_name: "Adi Darmawan",
    submitted_by_email: "adi@example.com",
    status: "approved",
    avg_rating: 4.5,
    rating_count: 2,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
  wifiCredentials.push({
    id: wifiCredentials.length + 1,
    place_id: 4,
    ssid: "Nuri-2.4G",
    password: "nuri-2g-stable",
    band: "2.4GHz",
    password_source: "Displayed on venue signage",
    submitted_by_name: "Rina Lestari",
    submitted_by_email: "rina@example.com",
    status: "approved",
    avg_rating: 4.0,
    rating_count: 1,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
  let nextWifiId = Math.max(...wifiCredentials.map((c) => c.id), 0) + 1;
  let nextWifiRatingId = 1;
  let nextPlaceId = Math.max(...places.map((item) => item.id)) + 1;
  let nextReviewId = Math.max(...reviews.map((item) => item.id)) + 1;

  return {
    mode: "memory",
    async initialize() {},
    async getUserByEmail(email) {
      return usersByEmail.get(String(email ?? "").toLowerCase()) ?? null;
    },
    async upsertUser(payload) {
      const email = String(payload.email ?? "").toLowerCase();
      const existing = usersByEmail.get(email);
      if (!existing) {
        const record = {
          id: users.length + 1,
          name: payload.name,
          email: payload.email,
          role: "member",
          is_trusted: false,
          picture: payload.picture ?? null,
          created_at: new Date().toISOString(),
        };
        users.push(record);
        usersByEmail.set(email, record);
        return record;
      }
      existing.name = payload.name ?? existing.name;
      if (payload.picture) existing.picture = payload.picture;
      return existing;
    },
    async listUsers() {
      return users.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        is_trusted: Boolean(u.is_trusted),
        picture: u.picture ?? null,
        created_at: u.created_at,
      }));
    },
    async updateUser(id, patch) {
      const user = users.find((u) => Number(u.id) === Number(id));
      if (!user) return null;
      if (patch.role !== undefined) user.role = patch.role;
      if (user.role === "admin") {
        user.is_trusted = false;
      } else if (patch.isTrusted !== undefined) {
        user.is_trusted = patch.isTrusted;
      }
      usersByEmail.set(String(user.email).toLowerCase(), user);
      return {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        is_trusted: Boolean(user.is_trusted),
        picture: user.picture ?? null,
        created_at: user.created_at,
      };
    },
    async listPlaces(filters = {}) {
      const metricsMap = buildMetricsMap(reviews);
      const withBadge = places.map((place) =>
        withSubmitterBadge(withMetricsMap(place, metricsMap), usersByEmail),
      );
      const filtered = applyFilters(withBadge, filters).sort(sortFeatured);

      const total = filtered.length;
      const limit = Number(filters.limit ?? 100);
      const offset = Number(filters.offset ?? 0);
      return {
        places: filtered.slice(offset, offset + limit),
        total,
      };
    },
    async getPlaceById(placeId, opts = {}) {
      const place = places.find((item) => Number(item.id) === Number(placeId));
      const metricsMap = buildMetricsMap(reviews);

      if (!place) {
        return null;
      }

      const placeReviews = reviews
        .filter((item) => Number(item.place_id) === Number(placeId))
        .sort(
          (left, right) =>
            new Date(right.created_at) - new Date(left.created_at),
        );

      const isAuth = Boolean(opts.isAuthenticated);
      const maskedPlace = applyHypeMask(withSubmitterBadge(withMetricsMap(place, metricsMap), usersByEmail), isAuth);
      const allCreds = wifiCredentials
        .filter((c) => Number(c.place_id) === Number(placeId) && c.status === "approved")
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      const allCredsWithBadge = allCreds.map((c) => withWifiSubmitterBadge(c, usersByEmail));
      const visibleCreds = maskWifiCredentials(allCredsWithBadge, Boolean(place.is_hype), isAuth);
      // attach ratings per cred
      const credsWithRatings = visibleCreds.map((c) => ({
        ...c,
        ratings: wifiRatings
          .filter((r) => Number(r.credential_id) === Number(c.id))
          .map((r) => withRaterBadge(r, usersByEmail))
          .sort((a, b) => new Date(b.created_at) - new Date(a.created_at)),
      }));

      // speed tests 30d stats
      const placeSpeedTests = speedTests
        .filter((s) => Number(s.place_id) === Number(placeId))
        .map((s) => withTesterBadge(s, usersByEmail));
      const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
      const recent30 = placeSpeedTests.filter((s) => new Date(s.created_at).getTime() > thirtyDaysAgo);
      const speedStats = { ...computeSpeedStats(recent30), total: placeSpeedTests.length, last_test_at: placeSpeedTests[0]?.created_at ?? null };
      const recentSpeedTests = placeSpeedTests.slice(0, 5);

      return {
        ...maskedPlace,
        reviews: placeReviews.map((r) => withAuthorBadge(r, usersByEmail)),
        wifi_credentials: credsWithRatings,
        wifi_credentials_total: allCreds.length,
        speed_tests: recentSpeedTests,
        speed_stats: speedStats,
        related_places: places
          .filter((item) => item.status === "approved" && item.id !== place.id)
          .map((item) => withSubmitterBadge(withMetricsMap(item, metricsMap), usersByEmail))
          .sort(sortFeatured)
          .slice(0, 3),
      };
    },
    async createPlaceSubmission(payload) {
      const normalized = normalizePlacePayload(payload);
      const timestamp = new Date().toISOString();
      const record = {
        id: nextPlaceId,
        ...normalized,
        status: "pending",
        created_at: timestamp,
        updated_at: timestamp,
      };

      nextPlaceId += 1;
      places.unshift(record);

      return withMetricsMap(record, buildMetricsMap(reviews));
    },
    async createReview(payload) {
      const normalized = normalizeReviewPayload(payload);
      const place = places.find(
        (item) => Number(item.id) === normalized.place_id,
      );

      if (!place || place.status !== "approved") {
        throw new Error("Review can only be added to approved places");
      }

      const record = {
        id: nextReviewId,
        ...normalized,
        created_at: new Date().toISOString(),
      };

      nextReviewId += 1;
      reviews.unshift(record);

      return record;
    },
    async listAdminSubmissions() {
      const metricsMap = buildMetricsMap(reviews);
      const submissions = places
        .filter((item) => item.status !== "approved")
        .map((item) => withSubmitterBadge(withMetricsMap(item, metricsMap), usersByEmail))
        .sort(
          (left, right) =>
            new Date(right.created_at) - new Date(left.created_at),
        );

      return {
        stats: {
          total_spots: places.filter((item) => item.status === "approved")
            .length,
          pending_submissions: places.filter(
            (item) => item.status === "pending",
          ).length,
          rejected_submissions: places.filter(
            (item) => item.status === "rejected",
          ).length,
          community_reviews: reviews.length,
          active_contributors: new Set([
            ...users.map((item) => item.email),
            ...places.map((item) => item.submitter_email).filter(Boolean),
            ...reviews.map((item) => item.author_email ?? item.author_name),
          ]).size,
        },
        submissions,
      };
    },
    async updateSubmissionStatus(placeId, status) {
      const place = places.find((item) => Number(item.id) === Number(placeId));

      if (!place) {
        return null;
      }

      place.status = status;
      place.updated_at = new Date().toISOString();

      return withSubmitterBadge(withMetricsMap(place, buildMetricsMap(reviews)), usersByEmail);
    },
    async listUserSubmissions(email) {
      return places
        .filter((p) => p.submitter_email === email)
        .map((p) => withSubmitterBadge(p, usersByEmail))
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    },
    async listUserReviews(email) {
      return reviews
        .filter((r) => r.author_email === email)
        .map((r) => withAuthorBadge(r, usersByEmail))
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    },
    async listWifiCredentials(placeId, opts = {}) {
      const place = places.find((p) => Number(p.id) === Number(placeId));
      const isAuth = Boolean(opts.isAuthenticated);
      const limit = Number(opts.limit ?? 50);
      const offset = Number(opts.offset ?? 0);
      const filtered = wifiCredentials
        .filter((c) => Number(c.place_id) === Number(placeId))
        .filter((c) => opts.includePending ? true : c.status === "approved")
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      const total = filtered.length;
      const slice = filtered.slice(offset, offset + limit).map((c) => ({
        ...withWifiSubmitterBadge(c, usersByEmail),
        ratings: wifiRatings
          .filter((r) => Number(r.credential_id) === Number(c.id))
          .map((r) => withRaterBadge(r, usersByEmail)),
      }));
      const masked = maskWifiCredentials(slice, Boolean(place?.is_hype), isAuth);
      return { data: masked, total };
    },
    async createWifiCredential(payload) {
      const normalized = normalizeWifiPayload(payload);
      if (!normalized.ssid) throw new Error("SSID wajib diisi");
      const place = places.find((p) => Number(p.id) === Number(normalized.place_id));
      if (!place || place.status !== "approved") throw new Error("Place not found or not approved");
      if (normalized.password && !normalized.password_source) throw new Error("password_source wajib saat password diisi");
      const record = {
        id: nextWifiId++,
        place_id: normalized.place_id,
        ssid: normalized.ssid,
        password: normalized.password,
        band: ["2.4GHz", "5GHz", "6GHz", "auto"].includes(normalized.band) ? normalized.band : "auto",
        password_source: normalized.password_source,
        submitted_by_name: normalized.submitted_by_name,
        submitted_by_email: normalized.submitted_by_email,
        status: "pending",
        avg_rating: 0,
        rating_count: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      wifiCredentials.unshift(record);
      return withWifiSubmitterBadge(record, usersByEmail);
    },
    async rateWifiCredential(credentialId, payload) {
      const cred = wifiCredentials.find((c) => Number(c.id) === Number(credentialId));
      if (!cred || cred.status !== "approved") throw new Error("Credential not found or not approved");
      const existing = wifiRatings.find((r) => Number(r.credential_id) === Number(credentialId) && r.rater_email === payload.raterEmail);
      if (existing) throw new Error("Kamu sudah memberi rating untuk kredensial ini");
      const record = {
        id: nextWifiRatingId++,
        credential_id: Number(credentialId),
        rater_name: payload.raterName,
        rater_email: payload.raterEmail,
        rating: Number(payload.rating),
        comment: payload.comment ? String(payload.comment).trim() : null,
        created_at: new Date().toISOString(),
      };
      wifiRatings.unshift(record);
      // recalc
      const related = wifiRatings.filter((r) => Number(r.credential_id) === Number(credentialId));
      const avg = related.reduce((s, r) => s + Number(r.rating), 0) / related.length;
      cred.avg_rating = Math.round(avg * 10) / 10;
      cred.rating_count = related.length;
      cred.updated_at = new Date().toISOString();
      return withRaterBadge(record, usersByEmail);
    },
    async listAdminWifiCredentials() {
      const pending = wifiCredentials
        .filter((c) => c.status === "pending")
        .map((c) => withWifiSubmitterBadge(c, usersByEmail))
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      return pending;
    },
    async updateWifiCredentialStatus(credentialId, status) {
      const cred = wifiCredentials.find((c) => Number(c.id) === Number(credentialId));
      if (!cred) return null;
      cred.status = status;
      cred.updated_at = new Date().toISOString();
      if (status === "approved") {
        const place = places.find((p) => Number(p.id) === Number(cred.place_id));
        if (place) {
          place.wifi_ssid = cred.ssid;
          place.wifi_password = cred.password;
          place.password_source = cred.password_source;
          place.wifi_band = cred.band;
          place.updated_at = new Date().toISOString();
        }
      }
      return cred;
    },
    async createSpeedTest(payload, meta = {}) {
      const normalized = normalizeSpeedPayload(payload);
      if (!normalized.place_id || !Number.isFinite(normalized.place_id)) throw new Error("placeId wajib");
      const place = places.find((p) => Number(p.id) === Number(normalized.place_id));
      if (!place || place.status !== "approved") throw new Error("Place not found or not approved");
      if (normalized.download_mbps == null || !Number.isFinite(normalized.download_mbps)) throw new Error("downloadMbps wajib");
      // rate limit 3/jam per user per place
      const effectiveEmail = normalized.tested_by_email || meta.testerEmail;
      if (!effectiveEmail) throw new Error("tester email wajib");
      const oneHourAgo = Date.now() - 60 * 60 * 1000;
      const recent = speedTests.filter((s) => Number(s.place_id) === Number(normalized.place_id) && s.tested_by_email === effectiveEmail && new Date(s.created_at).getTime() > oneHourAgo);
      if (recent.length >= 3) throw new Error("Batas 3 tes per jam per lokasi tercapai");
      const record = {
        id: nextSpeedId++,
        place_id: normalized.place_id,
        download_mbps: normalized.download_mbps,
        upload_mbps: normalized.upload_mbps,
        ping_ms: normalized.ping_ms,
        jitter_ms: normalized.jitter_ms,
        loaded_latency_ms: normalized.loaded_latency_ms,
        packet_loss: normalized.packet_loss,
        duration_ms: normalized.duration_ms,
        raw_summary: normalized.raw_summary,
        tested_by_name: normalized.tested_by_name || meta.testerName || "Anon",
        tested_by_email: normalized.tested_by_email || meta.testerEmail,
        ip_hash: meta.ipHash ?? normalized.ip_hash ?? null,
        claimed_ssid: normalized.claimed_ssid ?? null,
        user_latitude: normalized.user_latitude ?? null,
        user_longitude: normalized.user_longitude ?? null,
        accuracy_m: normalized.accuracy_m ?? null,
        distance_m: normalized.distance_m ?? null,
        verified_via: normalized.verified_via ?? "claim",
        created_at: new Date().toISOString(),
      };
      speedTests.unshift(record);
      return withTesterBadge(record, usersByEmail);
    },
    async listSpeedTests(placeId, opts = {}) {
      const limit = Number(opts.limit ?? 20);
      const offset = Number(opts.offset ?? 0);
      const filtered = speedTests
        .filter((s) => Number(s.place_id) === Number(placeId))
        .map((s) => withTesterBadge(s, usersByEmail))
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      const total = filtered.length;
      const slice = filtered.slice(offset, offset + limit);
      // 30-day stats
      const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
      const recent30 = filtered.filter((s) => new Date(s.created_at).getTime() > thirtyDaysAgo);
      const stats = { ...computeSpeedStats(recent30), total, last_test_at: filtered[0]?.created_at ?? null };
      const overall = computeSpeedStats(filtered);
      return { data: slice, total, stats, overall };
    },
    async getSpeedStats(placeId) {
      const filtered = speedTests.filter((s) => Number(s.place_id) === Number(placeId));
      const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
      const recent30 = filtered.filter((s) => new Date(s.created_at).getTime() > thirtyDaysAgo);
      return { ...computeSpeedStats(recent30), total: filtered.length, recent30Count: recent30.length, last_test_at: filtered[0]?.created_at ?? null };
    },
  };
}

function buildWhereClause(filters, params, alias = "p") {
  const where = [];
  const query = sanitizeText(filters.q);
  const category = sanitizeText(filters.category);
  const accessType = sanitizeText(filters.accessType);
  const status = sanitizeText(filters.status) ?? "approved";

  if (status !== "all") {
    params.push(status);
    where.push(`${alias}.status = $${params.length}`);
  }

  if (query) {
    params.push(query);
    const slot = `$${params.length}`;
    where.push(
      `to_tsvector('simple', COALESCE(${alias}.name, '') || ' ' || COALESCE(${alias}.address, '') || ' ' || COALESCE(${alias}.district, '') || ' ' || COALESCE(${alias}.category, '')) @@ plainto_tsquery('simple', ${slot})`,
    );
  }

  if (category && category !== "all" && category !== "All") {
    params.push(category);
    where.push(`${alias}.category = $${params.length}`);
  }

  if (accessType && accessType !== "all") {
    params.push(accessType);
    where.push(`${alias}.wifi_access_type = $${params.length}`);
  }

  if (filters.wifiAvailable !== false) {
    where.push(`${alias}.wifi_available = TRUE`);
  }

  if (filters.speed === "fast") {
    params.push(50);
    where.push(`${alias}.wifi_speed_mbps >= $${params.length}`);
  }

  if (filters.speed === "ultra") {
    params.push(100);
    where.push(`${alias}.wifi_speed_mbps >= $${params.length}`);
  }

  if (filters.speed === "steady") {
    params.push(20);
    where.push(`${alias}.wifi_speed_mbps >= $${params.length}`);
  }

  if (filters.outlets) {
    where.push(`${alias}.has_power_outlets = TRUE`);
  }

  if (filters.open24) {
    where.push(`${alias}.open_24_hours = TRUE`);
  }

  return where.length ? `WHERE ${where.join(" AND ")}` : "";
}

function mapRow(row) {
  const role = row.submitter_role ?? "member";
  return {
    ...row,
    submitter_role: role,
    submitter_is_trusted: role === "admin" ? false : Boolean(row.submitter_is_trusted),
    wifi_available: row.wifi_available,
    has_power_outlets: row.has_power_outlets,
    open_24_hours: row.open_24_hours,
    quiet_zone: row.quiet_zone,
    is_hype: Boolean(row.is_hype),
    wifi_speed_mbps:
      row.wifi_speed_mbps === null ? null : Number(row.wifi_speed_mbps),
    upload_mbps: row.upload_mbps === null ? null : Number(row.upload_mbps),
    ping_ms: row.ping_ms === null ? null : Number(row.ping_ms),
    avg_rating: row.avg_rating === null ? 0 : Number(row.avg_rating),
    avg_speed_rating:
      row.avg_speed_rating === null ? 0 : Number(row.avg_speed_rating),
    avg_comfort_rating:
      row.avg_comfort_rating === null ? 0 : Number(row.avg_comfort_rating),
    review_count: row.review_count === null ? 0 : Number(row.review_count),
  };
}

function mapWifiRow(row) {
  const role = row.submitted_by_role ?? "member";
  return {
    ...row,
    submitted_by_role: role,
    submitted_by_is_trusted:
      role === "admin" ? false : Boolean(row.submitted_by_is_trusted),
    avg_rating: row.avg_rating === null ? 0 : Number(row.avg_rating),
    rating_count: row.rating_count === null ? 0 : Number(row.rating_count),
  };
}

const placeListColumns = `
  p.id,
  p.name,
  p.category,
  p.address,
  p.district,
  p.wifi_available,
  p.wifi_access_type,
  p.wifi_speed_mbps,
  p.wifi_ssid,
  p.wifi_band,
  p.is_hype,
  p.image_tone,
  p.image_url,
  p.submitter_name,
  p.status,
  p.created_at,
  p.updated_at,
  u_sub.role AS submitter_role,
  u_sub.is_trusted AS submitter_is_trusted
`;

async function createPostgresStore() {
  const { default: pg } = await import("pg");
  const { Pool } = pg;
  const connectionString = process.env.DATABASE_URL;
  const requiresSsl = !/(localhost|127\.0\.0\.1)/i.test(connectionString);
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const schemaSql = readFileSync(path.join(__dirname, "schema.sql"), "utf8");
  const pool = new Pool({
    connectionString,
    ssl: requiresSsl ? { rejectUnauthorized: false } : false,
  });

  async function refreshPlaceMetrics(placeId) {
    await pool.query(
      `
        INSERT INTO place_metrics (
          place_id,
          avg_speed_rating,
          avg_comfort_rating,
          avg_rating,
          review_count,
          updated_at
        )
        SELECT
          p.id AS place_id,
          COALESCE(AVG(r.rating_speed), 0)::numeric(10, 2) AS avg_speed_rating,
          COALESCE(AVG(r.rating_comfort), 0)::numeric(10, 2) AS avg_comfort_rating,
          COALESCE(AVG((r.rating_speed + r.rating_comfort) / 2.0), 0)::numeric(10, 2) AS avg_rating,
          COUNT(r.id)::int AS review_count,
          NOW() AS updated_at
        FROM places p
        LEFT JOIN reviews r ON r.place_id = p.id
        WHERE p.id = $1
        GROUP BY p.id
        ON CONFLICT (place_id) DO UPDATE
        SET
          avg_speed_rating = EXCLUDED.avg_speed_rating,
          avg_comfort_rating = EXCLUDED.avg_comfort_rating,
          avg_rating = EXCLUDED.avg_rating,
          review_count = EXCLUDED.review_count,
          updated_at = NOW()
      `,
      [placeId],
    );
  }

  async function aggregatePlace(whereSql, params, limit, offset = 0) {
    const boundedParams = [...params];
    boundedParams.push(limit);
    boundedParams.push(offset);

    const result = await pool.query(
      `
        SELECT
          ${placeListColumns},
          COALESCE(m.avg_speed_rating, 0)::numeric(10, 2) AS avg_speed_rating,
          COALESCE(m.avg_comfort_rating, 0)::numeric(10, 2) AS avg_comfort_rating,
          COALESCE(m.avg_rating, 0)::numeric(10, 2) AS avg_rating,
          COALESCE(m.review_count, 0)::int AS review_count
        FROM places p
           LEFT JOIN place_metrics m ON m.place_id = p.id
           LEFT JOIN users u_sub ON u_sub.email = p.submitter_email
         ${whereSql}
        ORDER BY COALESCE(m.avg_rating, 0) DESC, p.wifi_speed_mbps DESC NULLS LAST, COALESCE(m.review_count, 0) DESC, p.created_at DESC
        LIMIT $${boundedParams.length - 1} OFFSET $${boundedParams.length}
      `,
      boundedParams,
    );

    return result.rows.map(mapRow);
  }

  return {
    mode: "postgres",
    async initialize() {
      if (process.env.DB_SCHEMA_SYNC === "false") {
        return;
      }
      try {
        await pool.query(schemaSql);
        await pool
          .query(
            `INSERT INTO users (name, email, role)
             SELECT DISTINCT
               COALESCE(p.submitter_name, p.submitter_email),
               p.submitter_email,
               'member'
             FROM places p
             WHERE p.submitter_email IS NOT NULL
               AND NOT EXISTS (SELECT 1 FROM users WHERE users.email = p.submitter_email)`,
          )
          .catch(() => {});
      } catch (e) {
        console.error("[db] schema sync failed:", e.message, "- continuing");
      }
    },
    async getUserByEmail(email) {
      const result = await pool.query(`SELECT * FROM users WHERE email = $1`, [email]);
      return result.rows[0] ?? null;
    },
    async upsertUser(payload) {
      const result = await pool.query(
        `INSERT INTO users (name, email, picture, role, is_trusted)
         VALUES ($1, $2, $3, 'member', FALSE)
         ON CONFLICT (email) DO UPDATE
           SET name = EXCLUDED.name,
               picture = COALESCE(EXCLUDED.picture, users.picture)
         RETURNING *`,
        [payload.name, payload.email, payload.picture ?? null],
      );
      return result.rows[0];
    },
    async listUsers() {
      const result = await pool.query(
        `SELECT id, name, email, role, is_trusted, picture, created_at FROM users ORDER BY created_at DESC`,
      );
      return result.rows;
    },
    async updateUser(id, patch) {
      const existing = await pool.query(`SELECT * FROM users WHERE id = $1`, [id]);
      if (!existing.rows.length) return null;
      const prev = existing.rows[0];
      let isTrusted = typeof prev.is_trusted === "boolean" ? prev.is_trusted : false;
      let role = prev.role ?? "member";
      if (patch.role !== undefined) role = patch.role;
      if (role === "admin") {
        isTrusted = false;
      } else if (patch.isTrusted !== undefined) {
        isTrusted = patch.isTrusted;
      }
      const result = await pool.query(
        `UPDATE users SET role = $2, is_trusted = $3 WHERE id = $1 RETURNING id, name, email, role, is_trusted, picture, created_at`,
        [id, role, isTrusted],
      );
      return result.rows[0];
    },
    async listPlaces(filters = {}) {
      const params = [];
      const whereSql = buildWhereClause(filters, params);
      const limit = Number(filters.limit ?? 100);
      const offset = Number(filters.offset ?? 0);

      const [placesResult, countResult] = await Promise.all([
        aggregatePlace(whereSql, params, limit, offset),
        pool.query(
          `SELECT COUNT(*)::int AS total FROM places p ${whereSql}`,
          params,
        ),
      ]);

      return {
        places: placesResult,
        total: countResult.rows[0]?.total ?? 0,
      };
    },
    async getPlaceById(placeId, opts = {}) {
      const placeResult = await pool.query(
        `
          SELECT
            p.*,
            COALESCE(m.avg_speed_rating, 0)::numeric(10, 2) AS avg_speed_rating,
            COALESCE(m.avg_comfort_rating, 0)::numeric(10, 2) AS avg_comfort_rating,
            COALESCE(m.avg_rating, 0)::numeric(10, 2) AS avg_rating,
            COALESCE(m.review_count, 0)::int AS review_count
          FROM places p
          LEFT JOIN place_metrics m ON m.place_id = p.id
          LEFT JOIN users u_sub ON u_sub.email = p.submitter_email
          WHERE p.id = $1
        `,
        [placeId],
      );

      if (!placeResult.rows.length) {
        return null;
      }

      const isAuth = Boolean(opts.isAuthenticated);
      const basePlace = mapRow(placeResult.rows[0]);
      const maskedPlace = applyHypeMask(basePlace, isAuth);

      const reviewsResult = await pool.query(
        `
            SELECT
              r.id, r.place_id, r.author_name, r.author_email, r.review_title,
              r.rating_speed, r.rating_comfort, r.image_url, r.comment, r.created_at,
              u_author.role AS author_role,
              u_author.is_trusted AS author_is_trusted
            FROM reviews r
            LEFT JOIN users u_author ON u_author.email = r.author_email
            WHERE r.place_id = $1
            ORDER BY r.created_at DESC
          `,
        [placeId],
      ).catch(() => ({ rows: [] }));

      let relatedRows;
      try {
        const relatedResult = await pool.query(
          `
            SELECT
              ${placeListColumns},
              COALESCE(m.avg_speed_rating, 0)::numeric(10, 2) AS avg_speed_rating,
              COALESCE(m.avg_comfort_rating, 0)::numeric(10, 2) AS avg_comfort_rating,
              COALESCE(m.avg_rating, 0)::numeric(10, 2) AS avg_rating,
              COALESCE(m.review_count, 0)::int AS review_count
            FROM places p
            LEFT JOIN place_metrics m ON m.place_id = p.id
            LEFT JOIN users u_sub ON u_sub.email = p.submitter_email
            WHERE p.status = 'approved' AND p.id <> $1
            ORDER BY COALESCE(m.avg_rating, 0) DESC, p.wifi_speed_mbps DESC NULLS LAST
            LIMIT 3
          `,
          [placeId],
        );
        relatedRows = relatedResult.rows.map(mapRow);
      } catch (e) {
        console.error("[db] related_places fallback:", e.message);
        // fallback without new columns
        const fallback = await pool.query(
          `SELECT p.id, p.name, p.wifi_speed_mbps, p.image_tone, p.image_url, p.submitter_name, p.status, p.created_at, p.updated_at,
              COALESCE(m.avg_rating,0)::numeric(10,2) as avg_rating, COALESCE(m.review_count,0)::int as review_count,
              COALESCE(m.avg_speed_rating,0)::numeric(10,2) as avg_speed_rating, COALESCE(m.avg_comfort_rating,0)::numeric(10,2) as avg_comfort_rating
           FROM places p LEFT JOIN place_metrics m ON m.place_id=p.id WHERE p.status='approved' AND p.id<>$1 ORDER BY COALESCE(m.avg_rating,0) DESC LIMIT 3`,
          [placeId],
        ).catch(() => ({ rows: [] }));
        relatedRows = fallback.rows.map(mapRow);
      }

      let wifiCredsRaw;
      let wifiResult;
      try {
        wifiResult = await pool.query(
          `SELECT
             wc.*,
             u_sub.role AS submitted_by_role,
             u_sub.is_trusted AS submitted_by_is_trusted
           FROM wifi_credentials wc
           LEFT JOIN users u_sub ON u_sub.email = wc.submitted_by_email
           WHERE wc.place_id = $1 AND wc.status = 'approved'
           ORDER BY wc.created_at DESC`,
          [placeId],
        );
        wifiCredsRaw = wifiResult.rows.map(mapWifiRow);
      } catch (e) {
        console.error("[db] wifi_credentials fallback:", e.message);
        wifiCredsRaw = [];
      }
      const wifiCredsMasked = maskWifiCredentials(wifiCredsRaw, Boolean(basePlace.is_hype), isAuth);
      // attach ratings for each cred (limit per cred 5 latest)
      const credsWithRatings = await Promise.all(
        wifiCredsMasked.map(async (c) => {
          try {
             const r = await pool.query(
               `SELECT
                  wr.*,
                  u_rater.role AS rater_role,
                  u_rater.is_trusted AS rater_is_trusted
                FROM wifi_credential_ratings wr
                LEFT JOIN users u_rater ON u_rater.email = wr.rater_email
                WHERE wr.credential_id = $1 ORDER BY wr.created_at DESC LIMIT 20`,
               [c.id],
             );
             return { ...c, ratings: r.rows.map(mapRatingRow) };
          } catch {
            return { ...c, ratings: [] };
          }
        }),
      );

      // speed tests - 30d stats + recent 5
      let speedTestsRaw = [];
      let speedStats = { count: 0, avg_download: null, avg_upload: null, avg_ping: null, avg_jitter: null, total: 0, last_test_at: null };
      try {
         const stRes = await pool.query(
           `SELECT
              st.*,
              u_tester.role AS tested_by_role,
              u_tester.is_trusted AS tested_by_is_trusted
            FROM speed_tests st
            LEFT JOIN users u_tester ON u_tester.email = st.tested_by_email
            WHERE st.place_id = $1
            ORDER BY st.created_at DESC LIMIT 5`,
           [placeId],
         );
        speedTestsRaw = stRes.rows.map(mapSpeedRow);
        const statsRes = await pool.query(
          `SELECT COUNT(*)::int as count, ROUND(AVG(download_mbps)::numeric,1) as avg_download, ROUND(AVG(upload_mbps)::numeric,1) as avg_upload, ROUND(AVG(ping_ms)::numeric,1) as avg_ping, ROUND(AVG(jitter_ms)::numeric,1) as avg_jitter FROM speed_tests WHERE place_id = $1 AND created_at > NOW() - INTERVAL '30 days'`,
          [placeId],
        );
        const totalRes = await pool.query(`SELECT COUNT(*)::int as total, MAX(created_at) as last_test_at FROM speed_tests WHERE place_id = $1`, [placeId]);
        speedStats = {
          count: Number(statsRes.rows[0]?.count ?? 0),
          avg_download: statsRes.rows[0]?.avg_download != null ? Number(statsRes.rows[0].avg_download) : null,
          avg_upload: statsRes.rows[0]?.avg_upload != null ? Number(statsRes.rows[0].avg_upload) : null,
          avg_ping: statsRes.rows[0]?.avg_ping != null ? Number(statsRes.rows[0].avg_ping) : null,
          avg_jitter: statsRes.rows[0]?.avg_jitter != null ? Number(statsRes.rows[0].avg_jitter) : null,
          total: Number(totalRes.rows[0]?.total ?? 0),
          last_test_at: totalRes.rows[0]?.last_test_at ?? null,
        };
      } catch (e) {
        console.error("[db] speed_tests fallback:", e.message);
      }

      return {
        ...maskedPlace,
        reviews: reviewsResult.rows,
        wifi_credentials: credsWithRatings,
        wifi_credentials_total: wifiCredsRaw.length,
        speed_tests: speedTestsRaw,
        speed_stats: speedStats,
        related_places: relatedRows,
      };
    },
    async createPlaceSubmission(payload) {
      const normalized = normalizePlacePayload(payload);
      const result = await pool.query(
        `
          INSERT INTO places (
            name, category, address, district, latitude, longitude, wifi_available,
            wifi_access_type, wifi_password, password_source, access_notes, wifi_speed_mbps,
            upload_mbps, ping_ms, has_power_outlets, open_24_hours, quiet_zone,
            ambience_label, map_context, operating_hours, image_tone, image_url,
            submitter_name, submitter_email, wifi_ssid, wifi_band, is_hype, status
          )
          VALUES (
            $1, $2, $3, $4, $5, $6, $7,
            $8, $9, $10, $11, $12,
            $13, $14, $15, $16, $17,
            $18, $19, $20, $21, $22,
            $23, $24, $25, $26, $27, 'pending'
          )
          RETURNING *
        `,
        [
          normalized.name,
          normalized.category,
          normalized.address,
          normalized.district,
          normalized.latitude,
          normalized.longitude,
          normalized.wifi_available,
          normalized.wifi_access_type,
          normalized.wifi_password,
          normalized.password_source,
          normalized.access_notes,
          normalized.wifi_speed_mbps,
          normalized.upload_mbps,
          normalized.ping_ms,
          normalized.has_power_outlets,
          normalized.open_24_hours,
          normalized.quiet_zone,
          normalized.ambience_label,
          normalized.map_context,
          normalized.operating_hours,
          normalized.image_tone,
          normalized.image_url,
          normalized.submitter_name,
          normalized.submitter_email,
          normalized.wifi_ssid,
          normalized.wifi_band,
          normalized.is_hype,
        ],
      );
      await refreshPlaceMetrics(result.rows[0].id);

      return mapRow({
        ...result.rows[0],
        avg_rating: 0,
        avg_speed_rating: 0,
        avg_comfort_rating: 0,
        review_count: 0,
      });
    },
    async createReview(payload) {
      const normalized = normalizeReviewPayload(payload);
      const placeCheck = await pool.query(
        "SELECT status FROM places WHERE id = $1",
        [normalized.place_id],
      );

      if (!placeCheck.rows.length || placeCheck.rows[0].status !== "approved") {
        throw new Error("Review can only be added to approved places");
      }

      const result = await pool.query(
        `
          INSERT INTO reviews (place_id, author_name, author_email, review_title, rating_speed, rating_comfort, image_url, comment)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          RETURNING id, place_id, author_name, author_email, review_title, rating_speed, rating_comfort, image_url, comment, created_at
        `,
        [
          normalized.place_id,
          normalized.author_name,
          normalized.author_email,
          normalized.review_title,
          normalized.rating_speed,
          normalized.rating_comfort,
          normalized.image_url,
          normalized.comment,
        ],
      );
      await refreshPlaceMetrics(normalized.place_id);

      return result.rows[0];
    },
    async listAdminSubmissions() {
      const statsResult = await pool.query(
        `
          SELECT
            (SELECT COUNT(*)::int FROM places WHERE status = 'approved') AS total_spots,
            (SELECT COUNT(*)::int FROM places WHERE status = 'pending') AS pending_submissions,
            (SELECT COUNT(*)::int FROM places WHERE status = 'rejected') AS rejected_submissions,
            (SELECT COUNT(*)::int FROM reviews) AS community_reviews,
            (
              SELECT COUNT(*)::int
              FROM (
                SELECT DISTINCT COALESCE(submitter_email, submitter_name) AS contributor
                FROM places
                WHERE COALESCE(submitter_email, submitter_name) IS NOT NULL
                UNION
                SELECT DISTINCT COALESCE(author_email, author_name) AS contributor
                FROM reviews
              ) contributors
            ) AS active_contributors
        `,
      );

      const submissionsResult = await pool.query(
        `
          SELECT
            p.*,
            COALESCE(m.avg_speed_rating, 0)::numeric(10, 2) AS avg_speed_rating,
            COALESCE(m.avg_comfort_rating, 0)::numeric(10, 2) AS avg_comfort_rating,
            COALESCE(m.avg_rating, 0)::numeric(10, 2) AS avg_rating,
            COALESCE(m.review_count, 0)::int AS review_count
          FROM places p
          LEFT JOIN place_metrics m ON m.place_id = p.id
          LEFT JOIN users u_sub ON u_sub.email = p.submitter_email
          WHERE p.status <> 'approved'
          ORDER BY p.created_at DESC
        `,
      );

      return {
        stats: statsResult.rows[0],
        submissions: submissionsResult.rows.map(mapRow),
      };
    },
    async updateSubmissionStatus(placeId, status) {
      const result = await pool.query(
        `
          UPDATE places
          SET status = $2, updated_at = NOW()
          WHERE id = $1
          RETURNING *
        `,
        [placeId, status],
      );
      if (!result.rows.length) {
        return null;
      }

      await refreshPlaceMetrics(placeId);

      return mapRow({
        ...result.rows[0],
        avg_rating: 0,
        avg_speed_rating: 0,
        avg_comfort_rating: 0,
        review_count: 0,
      });
    },
    async listUserSubmissions(email) {
      const result = await pool.query(
        `SELECT
           p.*,
           u_sub.role AS submitter_role,
           u_sub.is_trusted AS submitter_is_trusted
         FROM places p
         LEFT JOIN users u_sub ON u_sub.email = p.submitter_email
         WHERE p.submitter_email = $1
         ORDER BY p.created_at DESC`,
        [email],
      );
      return result.rows;
    },
    async listUserReviews(email) {
      const result = await pool.query(
        `SELECT
           r.*,
           u_author.role AS author_role,
           u_author.is_trusted AS author_is_trusted
         FROM reviews r
         LEFT JOIN users u_author ON u_author.email = r.author_email
         WHERE r.author_email = $1
         ORDER BY r.created_at DESC`,
        [email],
      );
      return result.rows;
    },
    async listWifiCredentials(placeId, opts = {}) {
      try {
        const placeRes = await pool.query(`SELECT is_hype FROM places WHERE id = $1`, [placeId]);
        const isHype = Boolean(placeRes.rows[0]?.is_hype);
        const isAuth = Boolean(opts.isAuthenticated);
        const limit = Number(opts.limit ?? 50);
        const offset = Number(opts.offset ?? 0);
        const statusFilter = opts.includePending ? "" : "AND status = 'approved'";
        const result = await pool.query(
          `SELECT
             wc.*,
             u_sub.role AS submitted_by_role,
             u_sub.is_trusted AS submitted_by_is_trusted
           FROM wifi_credentials wc
           LEFT JOIN users u_sub ON u_sub.email = wc.submitted_by_email
           WHERE wc.place_id = $1 ${statusFilter}
           ORDER BY wc.created_at DESC LIMIT $2 OFFSET $3`,
          [placeId, limit, offset],
        );
        const countRes = await pool.query(
          `SELECT COUNT(*)::int as total FROM wifi_credentials WHERE place_id = $1 ${statusFilter}`,
          [placeId],
        );
        const rows = result.rows.map(mapWifiRow);
        const masked = maskWifiCredentials(rows, isHype, isAuth);
        const withRatings = await Promise.all(
          masked.map(async (c) => {
            try {
              const r = await pool.query(`SELECT * FROM wifi_credential_ratings WHERE credential_id = $1 ORDER BY created_at DESC`, [c.id]);
              return { ...c, ratings: r.rows };
            } catch { return { ...c, ratings: [] }; }
          }),
        );
        return { data: withRatings, total: countRes.rows[0].total };
      } catch (e) {
        console.error("[db] listWifiCredentials fallback:", e.message);
        return { data: [], total: 0 };
      }
    },
    async createWifiCredential(payload) {
      const normalized = normalizeWifiPayload(payload);
      if (!normalized.ssid) throw new Error("SSID wajib diisi");
      const placeCheck = await pool.query(`SELECT status, is_hype FROM places WHERE id = $1`, [normalized.place_id]);
      if (!placeCheck.rows.length || placeCheck.rows[0].status !== "approved") throw new Error("Place not found or not approved");
      if (normalized.password && !normalized.password_source) throw new Error("password_source wajib saat password diisi");
      const band = ["2.4GHz", "5GHz", "6GHz", "auto"].includes(normalized.band) ? normalized.band : "auto";
      const result = await pool.query(
        `INSERT INTO wifi_credentials (place_id, ssid, password, band, password_source, submitted_by_name, submitted_by_email, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,'pending') RETURNING *`,
        [normalized.place_id, normalized.ssid, normalized.password, band, normalized.password_source, normalized.submitted_by_name, normalized.submitted_by_email],
      );
      return mapWifiRow(result.rows[0]);
    },
    async rateWifiCredential(credentialId, payload) {
      const credRes = await pool.query(`SELECT * FROM wifi_credentials WHERE id = $1`, [credentialId]);
      if (!credRes.rows.length || credRes.rows[0].status !== "approved") throw new Error("Credential not found or not approved");
      try {
        const result = await pool.query(
          `INSERT INTO wifi_credential_ratings (credential_id, rater_name, rater_email, rating, comment)
           VALUES ($1,$2,$3,$4,$5) RETURNING *`,
          [credentialId, payload.raterName, payload.raterEmail, Number(payload.rating), payload.comment || null],
        );
        await pool.query(
          `UPDATE wifi_credentials SET avg_rating = (SELECT ROUND(AVG(rating)::numeric,1) FROM wifi_credential_ratings WHERE credential_id = $1), rating_count = (SELECT COUNT(*) FROM wifi_credential_ratings WHERE credential_id = $1), updated_at = NOW() WHERE id = $1`,
          [credentialId],
        );
        return result.rows[0];
      } catch (e) {
        if (e.code === "23505") throw new Error("Kamu sudah memberi rating untuk kredensial ini", { cause: e });
        throw e;
      }
    },
    async listAdminWifiCredentials() {
      try {
        const result = await pool.query(
          `SELECT
             wc.*,
             u_sub.role AS submitted_by_role,
             u_sub.is_trusted AS submitted_by_is_trusted
           FROM wifi_credentials wc
           LEFT JOIN users u_sub ON u_sub.email = wc.submitted_by_email
           WHERE wc.status = 'pending'
           ORDER BY wc.created_at DESC`,
        );
        return result.rows.map(mapWifiRow);
      } catch (e) {
        console.error("[db] listAdminWifi fallback:", e.message);
        return [];
      }
    },
    async updateWifiCredentialStatus(credentialId, status) {
      const result = await pool.query(`UPDATE wifi_credentials SET status = $2, updated_at = NOW() WHERE id = $1 RETURNING *`, [credentialId, status]);
      if (!result.rows.length) return null;
      if (status === "approved") {
        const cred = result.rows[0];
        await pool.query(`UPDATE places SET wifi_ssid = $2, wifi_password = $3, password_source = $4, wifi_band = $5, updated_at = NOW() WHERE id = $1`, [cred.place_id, cred.ssid, cred.password, cred.password_source, cred.band]);
      }
      return mapWifiRow(result.rows[0]);
    },
    async createSpeedTest(payload, meta = {}) {
      const normalized = normalizeSpeedPayload(payload);
      if (!normalized.place_id || !Number.isFinite(normalized.place_id)) throw new Error("placeId wajib");
      const placeCheck = await pool.query(`SELECT status FROM places WHERE id = $1`, [normalized.place_id]);
      if (!placeCheck.rows.length || placeCheck.rows[0].status !== "approved") throw new Error("Place not found or not approved");
      if (normalized.download_mbps == null || !Number.isFinite(normalized.download_mbps)) throw new Error("downloadMbps wajib");
      // rate limit 3/jam
      const effectiveEmailPg = normalized.tested_by_email || meta.testerEmail;
      if (!effectiveEmailPg) throw new Error("tester email wajib");
      try {
        const recentRes = await pool.query(`SELECT COUNT(*)::int as cnt FROM speed_tests WHERE place_id = $1 AND tested_by_email = $2 AND created_at > NOW() - INTERVAL '1 hour'`, [normalized.place_id, effectiveEmailPg]);
        if ((recentRes.rows[0]?.cnt ?? 0) >= 3) throw new Error("Batas 3 tes per jam per lokasi tercapai");
      } catch (e) {
        if (e.message.includes("Batas 3 tes")) throw e;
        // ignore if table not exists yet
      }
      const result = await pool.query(
        `INSERT INTO speed_tests (place_id, download_mbps, upload_mbps, ping_ms, jitter_ms, loaded_latency_ms, packet_loss, duration_ms, raw_summary, tested_by_name, tested_by_email, ip_hash, claimed_ssid, user_latitude, user_longitude, accuracy_m, distance_m, verified_via)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18) RETURNING *`,
        [normalized.place_id, normalized.download_mbps, normalized.upload_mbps, normalized.ping_ms, normalized.jitter_ms, normalized.loaded_latency_ms, normalized.packet_loss, normalized.duration_ms, normalized.raw_summary ? JSON.stringify(normalized.raw_summary) : null, normalized.tested_by_name || meta.testerName || "Anon", normalized.tested_by_email || meta.testerEmail, meta.ipHash ?? normalized.ip_hash ?? null, normalized.claimed_ssid ?? null, normalized.user_latitude ?? null, normalized.user_longitude ?? null, normalized.accuracy_m ?? null, normalized.distance_m ?? null, normalized.verified_via ?? "claim"],
      ).catch(async (e) => {
        // fallback for DB without new columns (old schema)
        if (e.message?.includes("claimed_ssid") || e.message?.includes("column")) {
          console.warn("[db] speed_tests new cols missing, fallback insert:", e.message);
          const fb = await pool.query(
            `INSERT INTO speed_tests (place_id, download_mbps, upload_mbps, ping_ms, jitter_ms, loaded_latency_ms, packet_loss, duration_ms, raw_summary, tested_by_name, tested_by_email, ip_hash) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
            [normalized.place_id, normalized.download_mbps, normalized.upload_mbps, normalized.ping_ms, normalized.jitter_ms, normalized.loaded_latency_ms, normalized.packet_loss, normalized.duration_ms, normalized.raw_summary ? JSON.stringify(normalized.raw_summary) : null, normalized.tested_by_name || meta.testerName || "Anon", normalized.tested_by_email || meta.testerEmail, meta.ipHash ?? normalized.ip_hash ?? null],
          );
          return fb;
        }
        throw e;
      });
      return mapSpeedRow(result.rows[0]);
    },
    async listSpeedTests(placeId, opts = {}) {
      try {
        const limit = Number(opts.limit ?? 20);
        const offset = Number(opts.offset ?? 0);
        const result = await pool.query(
          `SELECT
             st.*,
             u_tester.role AS tested_by_role,
             u_tester.is_trusted AS tested_by_is_trusted
           FROM speed_tests st
           LEFT JOIN users u_tester ON u_tester.email = st.tested_by_email
           WHERE st.place_id = $1
           ORDER BY st.created_at DESC LIMIT $2 OFFSET $3`,
          [placeId, limit, offset],
        );
        const countRes = await pool.query(`SELECT COUNT(*)::int as total FROM speed_tests WHERE place_id = $1`, [placeId]);
        const data = result.rows.map(mapSpeedRow);
        // 30d stats
        const statsRes = await pool.query(
          `SELECT COUNT(*)::int as count, ROUND(AVG(download_mbps)::numeric,1) as avg_download, ROUND(AVG(upload_mbps)::numeric,1) as avg_upload, ROUND(AVG(ping_ms)::numeric,1) as avg_ping, ROUND(AVG(jitter_ms)::numeric,1) as avg_jitter FROM speed_tests WHERE place_id = $1 AND created_at > NOW() - INTERVAL '30 days'`,
          [placeId],
        );
        const overallRes = await pool.query(
          `SELECT COUNT(*)::int as count, ROUND(AVG(download_mbps)::numeric,1) as avg_download, ROUND(AVG(upload_mbps)::numeric,1) as avg_upload, ROUND(AVG(ping_ms)::numeric,1) as avg_ping, ROUND(AVG(jitter_ms)::numeric,1) as avg_jitter, MAX(created_at) as last_test_at FROM speed_tests WHERE place_id = $1`,
          [placeId],
        );
        const stats = {
          count: Number(statsRes.rows[0]?.count ?? 0),
          avg_download: statsRes.rows[0]?.avg_download != null ? Number(statsRes.rows[0].avg_download) : null,
          avg_upload: statsRes.rows[0]?.avg_upload != null ? Number(statsRes.rows[0].avg_upload) : null,
          avg_ping: statsRes.rows[0]?.avg_ping != null ? Number(statsRes.rows[0].avg_ping) : null,
          avg_jitter: statsRes.rows[0]?.avg_jitter != null ? Number(statsRes.rows[0].avg_jitter) : null,
          total: Number(countRes.rows[0]?.total ?? 0),
          last_test_at: overallRes.rows[0]?.last_test_at ?? null,
        };
        return { data, total: Number(countRes.rows[0]?.total ?? 0), stats };
      } catch (e) {
        console.error("[db] listSpeedTests fallback:", e.message);
        return { data: [], total: 0, stats: { count: 0, avg_download: null, avg_upload: null, avg_ping: null, avg_jitter: null } };
      }
    },
    async getSpeedStats(placeId) {
      try {
        const statsRes = await pool.query(
          `SELECT COUNT(*)::int as count, ROUND(AVG(download_mbps)::numeric,1) as avg_download, ROUND(AVG(upload_mbps)::numeric,1) as avg_upload, ROUND(AVG(ping_ms)::numeric,1) as avg_ping, ROUND(AVG(jitter_ms)::numeric,1) as avg_jitter FROM speed_tests WHERE place_id = $1 AND created_at > NOW() - INTERVAL '30 days'`,
          [placeId],
        );
        const overallRes = await pool.query(`SELECT COUNT(*)::int as total, MAX(created_at) as last_test_at FROM speed_tests WHERE place_id = $1`, [placeId]);
        return {
          count: Number(statsRes.rows[0]?.count ?? 0),
          avg_download: statsRes.rows[0]?.avg_download != null ? Number(statsRes.rows[0].avg_download) : null,
          avg_upload: statsRes.rows[0]?.avg_upload != null ? Number(statsRes.rows[0].avg_upload) : null,
          avg_ping: statsRes.rows[0]?.avg_ping != null ? Number(statsRes.rows[0].avg_ping) : null,
          avg_jitter: statsRes.rows[0]?.avg_jitter != null ? Number(statsRes.rows[0].avg_jitter) : null,
          total: Number(overallRes.rows[0]?.total ?? 0),
          last_test_at: overallRes.rows[0]?.last_test_at ?? null,
        };
      } catch (e) {
        console.error("[db] getSpeedStats fallback:", e.message);
        return { count: 0, avg_download: null, avg_upload: null, avg_ping: null, avg_jitter: null, total: 0, last_test_at: null };
      }
    },
  };
}

export async function createStore(env) {
  // D1 binding takes precedence (Cloudflare Workers)
  const d1Binding = env?.DB ?? globalThis.DB;
  if (d1Binding) {
    try {
      const { createD1Store } = await import("./d1.js");
      const d1Store = createD1Store(d1Binding);
      await d1Store.initialize();
      return d1Store;
    } catch (e) {
      console.error("[db] d1 failed, fallback:", e.message);
    }
  }
  if (!process.env.DATABASE_URL) {
    const m = createMemoryStore();
    await m.initialize();
    return m;
  }
  // in test, force memory if DATABASE_URL was explicitly cleared to "" then re-injected
  if (process.env.NODE_ENV === "test" && !String(process.env.DATABASE_URL).includes("postgres")) {
    const m = createMemoryStore();
    await m.initialize();
    return m;
  }
  try {
    const pgStore = await createPostgresStore();
    await pgStore.initialize();
    return pgStore;
  } catch (e) {
    console.error("[db] postgres failed, fallback to memory:", e.message);
    const m = createMemoryStore();
    await m.initialize();
    m.mode = "memory-fallback";
    return m;
  }
}
