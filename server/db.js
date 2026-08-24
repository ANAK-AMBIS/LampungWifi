import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { seedPlaces, seedReviews, seedUsers } from "./seedData.js";

const { Pool } = pg;

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

function createMemoryStore() {
  const places = structuredClone(seedPlaces);
  const reviews = structuredClone(seedReviews);
  const users = structuredClone(seedUsers);
  let nextPlaceId = Math.max(...places.map((item) => item.id)) + 1;
  let nextReviewId = Math.max(...reviews.map((item) => item.id)) + 1;

  return {
    mode: "memory",
    async initialize() {},
    async listPlaces(filters = {}) {
      const metricsMap = buildMetricsMap(reviews);
      const filtered = applyFilters(
        places.map((place) => withMetricsMap(place, metricsMap)),
        filters,
      ).sort(sortFeatured);

      const total = filtered.length;
      const limit = Number(filters.limit ?? 100);
      const offset = Number(filters.offset ?? 0);
      return {
        places: filtered.slice(offset, offset + limit),
        total,
      };
    },
    async getPlaceById(placeId) {
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

      return {
        ...withMetricsMap(place, metricsMap),
        reviews: placeReviews,
        related_places: places
          .filter((item) => item.status === "approved" && item.id !== place.id)
          .map((item) => withMetricsMap(item, metricsMap))
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
        .map((item) => withMetricsMap(item, metricsMap))
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

      return withMetricsMap(place, buildMetricsMap(reviews));
    },
    async listUserSubmissions(email) {
      return places
        .filter((p) => p.submitter_email === email)
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    },
    async listUserReviews(email) {
      return reviews
        .filter((r) => r.author_email === email)
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
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
  return {
    ...row,
    wifi_available: row.wifi_available,
    has_power_outlets: row.has_power_outlets,
    open_24_hours: row.open_24_hours,
    quiet_zone: row.quiet_zone,
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

const placeListColumns = `
  p.id,
  p.name,
  p.category,
  p.address,
  p.district,
  p.wifi_available,
  p.wifi_access_type,
  p.wifi_speed_mbps,
  p.image_tone,
  p.image_url,
  p.submitter_name,
  p.status,
  p.created_at,
  p.updated_at
`;

function createPostgresStore() {
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

      await pool.query(schemaSql);
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
    async getPlaceById(placeId) {
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
          WHERE p.id = $1
        `,
        [placeId],
      );

      if (!placeResult.rows.length) {
        return null;
      }

      const [reviewsResult, relatedResult] = await Promise.all([
        pool.query(
          `
            SELECT id, place_id, author_name, author_email, review_title, rating_speed, rating_comfort, image_url, comment, created_at
            FROM reviews
            WHERE place_id = $1
            ORDER BY created_at DESC
          `,
          [placeId],
        ),
        pool.query(
          `
            SELECT
              ${placeListColumns},
              COALESCE(m.avg_speed_rating, 0)::numeric(10, 2) AS avg_speed_rating,
              COALESCE(m.avg_comfort_rating, 0)::numeric(10, 2) AS avg_comfort_rating,
              COALESCE(m.avg_rating, 0)::numeric(10, 2) AS avg_rating,
              COALESCE(m.review_count, 0)::int AS review_count
            FROM places p
            LEFT JOIN place_metrics m ON m.place_id = p.id
            WHERE p.status = 'approved' AND p.id <> $1
            ORDER BY COALESCE(m.avg_rating, 0) DESC, p.wifi_speed_mbps DESC NULLS LAST
            LIMIT 3
          `,
          [placeId],
        ),
      ]);

      return {
        ...mapRow(placeResult.rows[0]),
        reviews: reviewsResult.rows,
        related_places: relatedResult.rows.map(mapRow),
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
            submitter_name, submitter_email, status
          )
          VALUES (
            $1, $2, $3, $4, $5, $6, $7,
            $8, $9, $10, $11, $12,
            $13, $14, $15, $16, $17,
            $18, $19, $20, $21, $22,
            $23, $24, 'pending'
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
        `SELECT * FROM places WHERE submitter_email = $1 ORDER BY created_at DESC`,
        [email],
      );
      return result.rows;
    },
    async listUserReviews(email) {
      const result = await pool.query(
        `SELECT * FROM reviews WHERE author_email = $1 ORDER BY created_at DESC`,
        [email],
      );
      return result.rows;
    },
  };
}

export async function createStore() {
  const store = process.env.DATABASE_URL
    ? createPostgresStore()
    : createMemoryStore();
  await store.initialize();
  return store;
}
