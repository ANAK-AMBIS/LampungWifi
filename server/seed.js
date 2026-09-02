import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import pg from "pg";
import { seedPlaces, seedReviews, seedUsers } from "./seedData.js";

dotenv.config();

const { Pool } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL missing. Add it to .env before seeding.");
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function seedUsersTable(client) {
  // backfill pre-existing contributor emails into users table (idempotent)
  await client.query(`
    INSERT INTO users (name, email, role)
    SELECT DISTINCT
      TRIM(COALESCE(p.submitter_name, p.submitter_email, 'Guest')),
      p.submitter_email,
      'member'
    FROM places p
    WHERE p.submitter_email IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM users WHERE users.email = p.submitter_email)
  `).catch(() => {});
  for (const user of seedUsers) {
    await client.query(
      `
        INSERT INTO users (id, name, email, role, is_trusted, created_at)
        VALUES ($1, $2, $3, $4, $5, NOW())
        ON CONFLICT (email) DO UPDATE
        SET
          name = EXCLUDED.name,
          role = EXCLUDED.role
      `,
      [user.id, user.name, user.email, user.role, user.is_trusted],
    );
  }
}

async function seedPlacesTable(client) {
  for (const place of seedPlaces) {
    await client.query(
      `
        INSERT INTO places (
          id, name, category, address, district, latitude, longitude, wifi_available,
          wifi_access_type, wifi_password, password_source, access_notes, wifi_speed_mbps,
          upload_mbps, ping_ms, has_power_outlets, open_24_hours, quiet_zone,
          ambience_label, map_context, operating_hours, image_tone, image_url,
          submitter_name, submitter_email, status, created_at, updated_at
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8,
          $9, $10, $11, $12, $13,
          $14, $15, $16, $17, $18,
          $19, $20, $21, $22, $23,
          $24, $25, $26, $27, $28
        )
        ON CONFLICT (id) DO NOTHING
      `,
      [
        place.id,
        place.name,
        place.category,
        place.address,
        place.district,
        place.latitude,
        place.longitude,
        place.wifi_available,
        place.wifi_access_type,
        place.wifi_password,
        place.password_source,
        place.access_notes,
        place.wifi_speed_mbps,
        place.upload_mbps,
        place.ping_ms,
        place.has_power_outlets,
        place.open_24_hours,
        place.quiet_zone,
        place.ambience_label,
        place.map_context,
        place.operating_hours,
        place.image_tone,
        place.image_url ?? null,
        place.submitter_name,
        place.submitter_email,
        place.status,
        place.created_at,
        place.updated_at,
      ],
    );
  }
}

async function seedReviewsTable(client) {
  for (const review of seedReviews) {
    await client.query(
      `
        INSERT INTO reviews (
          id, place_id, author_name, review_title, rating_speed, rating_comfort, image_url, comment, created_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (id) DO NOTHING
      `,
      [
        review.id,
        review.place_id,
        review.author_name,
        review.review_title ?? "Ulasan pengunjung",
        review.rating_speed,
        review.rating_comfort,
        review.image_url ?? null,
        review.comment,
        review.created_at,
      ],
    );
  }
}

async function syncSequences(client) {
  await client.query(`
    SELECT setval('users_id_seq', COALESCE((SELECT MAX(id) FROM users), 1), true);
    SELECT setval('places_id_seq', COALESCE((SELECT MAX(id) FROM places), 1), true);
    SELECT setval('reviews_id_seq', COALESCE((SELECT MAX(id) FROM reviews), 1), true);
  `);
}

async function rebuildPlaceMetrics(client) {
  await client.query(`
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
    GROUP BY p.id
    ON CONFLICT (place_id) DO UPDATE
    SET
      avg_speed_rating = EXCLUDED.avg_speed_rating,
      avg_comfort_rating = EXCLUDED.avg_comfort_rating,
      avg_rating = EXCLUDED.avg_rating,
      review_count = EXCLUDED.review_count,
      updated_at = NOW();
  `);
}

async function main() {
  const client = await pool.connect();
  const schemaSql = readFileSync(path.join(__dirname, "schema.sql"), "utf8");

  try {
    await client.query("BEGIN");
    await client.query(schemaSql);
    await seedUsersTable(client);
    await seedPlacesTable(client);
    await seedReviewsTable(client);
    await syncSequences(client);
    await rebuildPlaceMetrics(client);

    const summary = await client.query(`
      SELECT
        (SELECT COUNT(*)::int FROM users) AS users_count,
        (SELECT COUNT(*)::int FROM places) AS places_count,
        (SELECT COUNT(*)::int FROM reviews) AS reviews_count
    `);

    await client.query("COMMIT");
    console.log("Seed complete:", summary.rows[0]);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

await main();
