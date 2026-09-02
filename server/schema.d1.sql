-- BalamWiFi D1 (SQLite) schema
-- Transpiled from server/schema.sql (Postgres) for Cloudflare D1
-- Usage: wrangler d1 execute balamwifi-prod --local --file=./server/schema.d1.sql

PRAGMA foreign_keys = ON;

-- ── users ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  is_trusted INTEGER NOT NULL DEFAULT 0,
  picture TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- ── places ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS places (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  address TEXT NOT NULL,
  district TEXT NOT NULL,
  latitude REAL,
  longitude REAL,
  wifi_available INTEGER NOT NULL DEFAULT 0,
  wifi_access_type TEXT,
  wifi_password TEXT,
  password_source TEXT,
  access_notes TEXT,
  wifi_speed_mbps REAL,
  upload_mbps REAL,
  ping_ms INTEGER,
  has_power_outlets INTEGER NOT NULL DEFAULT 0,
  open_24_hours INTEGER NOT NULL DEFAULT 0,
  quiet_zone INTEGER NOT NULL DEFAULT 0,
  ambience_label TEXT,
  map_context TEXT,
  operating_hours TEXT,
  image_tone TEXT NOT NULL DEFAULT 'lagoon',
  image_url TEXT,
  submitter_name TEXT,
  submitter_email TEXT,
  wifi_ssid TEXT,
  wifi_band TEXT,
  is_hype INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('approved', 'pending', 'rejected')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  CHECK (wifi_password IS NULL OR length(trim(COALESCE(password_source, ''))) > 0)
);

CREATE INDEX IF NOT EXISTS idx_places_status ON places(status);
CREATE INDEX IF NOT EXISTS idx_places_category ON places(category);
CREATE INDEX IF NOT EXISTS idx_places_status_created_at ON places(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_places_public_filters ON places(status, wifi_available, category, wifi_access_type);
CREATE INDEX IF NOT EXISTS idx_places_public_speed ON places(status, wifi_available, wifi_speed_mbps DESC);
-- FTS GIN (Postgres) replaced by LIKE / FTS5. For v1 we rely on LIKE lower-case search.
-- Optional FTS5 virtual table for future (uncomment if needed):
-- CREATE VIRTUAL TABLE IF NOT EXISTS places_fts USING fts5(name, address, district, category, content='places', content_rowid='id');

-- ── reviews ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  place_id INTEGER NOT NULL REFERENCES places(id) ON DELETE CASCADE,
  author_name TEXT NOT NULL,
  author_email TEXT,
  review_title TEXT NOT NULL DEFAULT 'Ulasan pengunjung',
  rating_speed INTEGER NOT NULL CHECK (rating_speed BETWEEN 1 AND 5),
  rating_comfort INTEGER NOT NULL CHECK (rating_comfort BETWEEN 1 AND 5),
  image_url TEXT,
  comment TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_reviews_place_id ON reviews(place_id);
CREATE INDEX IF NOT EXISTS idx_reviews_place_created_at ON reviews(place_id, created_at DESC);

-- ── place_metrics ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS place_metrics (
  place_id INTEGER PRIMARY KEY REFERENCES places(id) ON DELETE CASCADE,
  avg_speed_rating REAL NOT NULL DEFAULT 0,
  avg_comfort_rating REAL NOT NULL DEFAULT 0,
  avg_rating REAL NOT NULL DEFAULT 0,
  review_count INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_place_metrics_featured ON place_metrics(avg_rating DESC, review_count DESC, place_id);

-- ── wifi_credentials ───────────────────────────────────
CREATE TABLE IF NOT EXISTS wifi_credentials (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  place_id INTEGER NOT NULL REFERENCES places(id) ON DELETE CASCADE,
  ssid TEXT NOT NULL,
  password TEXT,
  band TEXT NOT NULL DEFAULT 'auto' CHECK (band IN ('2.4GHz', '5GHz', '6GHz', 'auto')),
  password_source TEXT,
  submitted_by_name TEXT NOT NULL,
  submitted_by_email TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  avg_rating REAL NOT NULL DEFAULT 0,
  rating_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  CHECK (password IS NULL OR length(trim(COALESCE(password_source, ''))) > 0)
);

CREATE INDEX IF NOT EXISTS idx_wifi_credentials_place ON wifi_credentials(place_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wifi_credentials_status ON wifi_credentials(status);

-- ── wifi_credential_ratings ──────────────────────────────
CREATE TABLE IF NOT EXISTS wifi_credential_ratings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  credential_id INTEGER NOT NULL REFERENCES wifi_credentials(id) ON DELETE CASCADE,
  rater_name TEXT NOT NULL,
  rater_email TEXT NOT NULL,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE(credential_id, rater_email)
);

CREATE INDEX IF NOT EXISTS idx_wifi_ratings_credential ON wifi_credential_ratings(credential_id);

-- ── speed_tests ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS speed_tests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  place_id INTEGER NOT NULL REFERENCES places(id) ON DELETE CASCADE,
  download_mbps REAL,
  upload_mbps REAL,
  ping_ms INTEGER,
  jitter_ms REAL,
  loaded_latency_ms INTEGER,
  packet_loss REAL,
  duration_ms INTEGER,
  raw_summary TEXT,
  tested_by_name TEXT NOT NULL,
  tested_by_email TEXT NOT NULL,
  ip_hash TEXT,
  claimed_ssid TEXT,
  distance_m INTEGER,
  accuracy_m INTEGER,
  verified_via TEXT DEFAULT 'claim',
  user_latitude REAL,
  user_longitude REAL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_speed_tests_place ON speed_tests(place_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_speed_tests_email ON speed_tests(tested_by_email);
CREATE INDEX IF NOT EXISTS idx_speed_tests_created_at ON speed_tests(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_speed_tests_claimed_ssid ON speed_tests(claimed_ssid);
