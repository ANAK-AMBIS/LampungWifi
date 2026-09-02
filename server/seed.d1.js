import { spawnSync } from "node:child_process";
import { writeFileSync, unlinkSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { seedPlaces, seedReviews, seedUsers } from "./seedData.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const isRemote = process.argv.includes("--remote");
const flag = isRemote ? "--remote" : "--local";

function esc(value) {
  if (value == null) return "NULL";
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "1" : "0";
  return `'${String(value).replace(/'/g, "''")}'`;
}

function boolInt(v) {
  return v ? 1 : 0;
}

let sql = "";
sql += "PRAGMA foreign_keys = OFF;\n";

// users
for (const u of seedUsers) {
  sql += `INSERT INTO users (id, name, email, role, is_trusted, created_at) VALUES (${esc(u.id)}, ${esc(u.name)}, ${esc(u.email)}, ${esc(u.role)}, ${boolInt(u.is_trusted)}, ${esc("2026-05-01T00:00:00.000Z")}) ON CONFLICT(email) DO UPDATE SET name=excluded.name, role=excluded.role;\n`;
}
// backfill contributor emails from places (member)
const distinctEmails = new Set(seedPlaces.map((p) => p.submitter_email).filter(Boolean));
for (const email of distinctEmails) {
  if (!seedUsers.some((u) => u.email === email)) {
    const p = seedPlaces.find((x) => x.submitter_email === email);
    sql += `INSERT INTO users (name, email, role, is_trusted) VALUES (${esc(p?.submitter_name ?? email)}, ${esc(email)}, 'member', 0) ON CONFLICT(email) DO NOTHING;\n`;
  }
}

// places
for (const p of seedPlaces) {
  sql += `INSERT INTO places (id, name, category, address, district, latitude, longitude, wifi_available, wifi_access_type, wifi_password, password_source, access_notes, wifi_speed_mbps, upload_mbps, ping_ms, has_power_outlets, open_24_hours, quiet_zone, ambience_label, map_context, operating_hours, image_tone, image_url, submitter_name, submitter_email, wifi_ssid, wifi_band, is_hype, status, created_at, updated_at) VALUES (${esc(p.id)}, ${esc(p.name)}, ${esc(p.category)}, ${esc(p.address)}, ${esc(p.district)}, ${esc(p.latitude)}, ${esc(p.longitude)}, ${boolInt(p.wifi_available)}, ${esc(p.wifi_access_type)}, ${esc(p.wifi_password)}, ${esc(p.password_source)}, ${esc(p.access_notes)}, ${esc(p.wifi_speed_mbps)}, ${esc(p.upload_mbps)}, ${esc(p.ping_ms)}, ${boolInt(p.has_power_outlets)}, ${boolInt(p.open_24_hours)}, ${boolInt(p.quiet_zone)}, ${esc(p.ambience_label)}, ${esc(p.map_context)}, ${esc(p.operating_hours)}, ${esc(p.image_tone)}, ${esc(p.image_url)}, ${esc(p.submitter_name)}, ${esc(p.submitter_email)}, ${esc(p.wifi_ssid)}, ${esc(p.wifi_band ?? "auto")}, ${boolInt(p.is_hype)}, ${esc(p.status)}, ${esc(p.created_at)}, ${esc(p.updated_at)}) ON CONFLICT(id) DO NOTHING;\n`;
}

// reviews
for (const r of seedReviews) {
  sql += `INSERT INTO reviews (id, place_id, author_name, author_email, review_title, rating_speed, rating_comfort, image_url, comment, created_at) VALUES (${esc(r.id)}, ${esc(r.place_id)}, ${esc(r.author_name)}, ${esc(r.author_email ?? null)}, ${esc(r.review_title ?? "Ulasan pengunjung")}, ${esc(r.rating_speed)}, ${esc(r.rating_comfort)}, ${esc(r.image_url)}, ${esc(r.comment)}, ${esc(r.created_at)}) ON CONFLICT(id) DO NOTHING;\n`;
}

// wifi_credentials from places with ssid/password (as approved)
for (const p of seedPlaces) {
  if (p.wifi_ssid || p.wifi_password) {
    const ssid = p.wifi_ssid ?? p.name.replace(/\s+/g, "-").toLowerCase().slice(0, 20);
    sql += `INSERT INTO wifi_credentials (place_id, ssid, password, band, password_source, submitted_by_name, submitted_by_email, status, avg_rating, rating_count, created_at, updated_at) VALUES (${esc(p.id)}, ${esc(ssid)}, ${esc(p.wifi_password)}, ${esc(p.wifi_band ?? "auto")}, ${esc(p.password_source)}, ${esc(p.submitter_name)}, ${esc(p.submitter_email ?? "admin@balamwifi.id")}, 'approved', 0, 0, ${esc(p.created_at)}, ${esc(p.updated_at)}) ON CONFLICT(id) DO NOTHING;\n`;
  }
}
// extra multi-SSID for demo (place 4) as in memory store
sql += `INSERT INTO wifi_credentials (id, place_id, ssid, password, band, password_source, submitted_by_name, submitted_by_email, status, avg_rating, rating_count, created_at, updated_at) VALUES (100, 4, 'Nuri-5G', 'nuri-5g-fast', '5GHz', 'Verified by staff', 'Adi Darmawan', 'adi@example.com', 'approved', 4.5, 2, '2026-05-04T12:20:00.000Z', '2026-05-04T12:20:00.000Z') ON CONFLICT(id) DO NOTHING;\n`;
sql += `INSERT INTO wifi_credentials (id, place_id, ssid, password, band, password_source, submitted_by_name, submitted_by_email, status, avg_rating, rating_count, created_at, updated_at) VALUES (101, 4, 'Nuri-2.4G', 'nuri-2g-stable', '2.4GHz', 'Displayed on venue signage', 'Rina Lestari', 'rina@example.com', 'approved', 4.0, 1, '2026-05-04T12:20:00.000Z', '2026-05-04T12:20:00.000Z') ON CONFLICT(id) DO NOTHING;\n`;

// place_metrics rebuild
sql += `INSERT INTO place_metrics (place_id, avg_speed_rating, avg_comfort_rating, avg_rating, review_count, updated_at) SELECT p.id AS place_id, COALESCE(AVG(r.rating_speed),0) AS avg_speed_rating, COALESCE(AVG(r.rating_comfort),0) AS avg_comfort_rating, COALESCE(AVG((r.rating_speed + r.rating_comfort)/2.0),0) AS avg_rating, COUNT(r.id) AS review_count, strftime('%Y-%m-%dT%H:%M:%fZ','now') AS updated_at FROM places p LEFT JOIN reviews r ON r.place_id = p.id GROUP BY p.id ON CONFLICT(place_id) DO UPDATE SET avg_speed_rating=excluded.avg_speed_rating, avg_comfort_rating=excluded.avg_comfort_rating, avg_rating=excluded.avg_rating, review_count=excluded.review_count, updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now');\n`;
sql += "PRAGMA foreign_keys = ON;\n";

const tmpPath = path.join(__dirname, "seed.d1.generated.sql");
writeFileSync(tmpPath, sql, "utf8");
console.log(`[seed.d1] generated ${tmpPath} (${seedPlaces.length} places, ${seedReviews.length} reviews) -> executing wrangler d1 execute ${flag}...`);

const result = spawnSync("npx", ["wrangler", "d1", "execute", "balamwifi-prod", flag, "--file", tmpPath], { stdio: "inherit", shell: true });

try {
  unlinkSync(tmpPath);
} catch (_e) { void _e; }
if (result.status !== 0) process.exit(result.status ?? 1);

console.log("[seed.d1] done");
