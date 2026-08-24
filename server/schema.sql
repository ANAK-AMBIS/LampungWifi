CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL DEFAULT 'member',
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS places (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  address TEXT NOT NULL,
  district TEXT NOT NULL,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  wifi_available BOOLEAN NOT NULL DEFAULT FALSE,
  wifi_access_type TEXT,
  wifi_password TEXT,
  password_source TEXT,
  access_notes TEXT,
  wifi_speed_mbps NUMERIC(8, 2),
  upload_mbps NUMERIC(8, 2),
  ping_ms INTEGER,
  has_power_outlets BOOLEAN NOT NULL DEFAULT FALSE,
  open_24_hours BOOLEAN NOT NULL DEFAULT FALSE,
  quiet_zone BOOLEAN NOT NULL DEFAULT FALSE,
  ambience_label TEXT,
  map_context TEXT,
  operating_hours TEXT,
  image_tone TEXT NOT NULL DEFAULT 'lagoon',
  image_url TEXT,
  submitter_name TEXT,
  submitter_email TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT places_status_check CHECK (status IN ('approved', 'pending', 'rejected')),
  CONSTRAINT places_password_source_check CHECK (
    wifi_password IS NULL OR CHAR_LENGTH(TRIM(COALESCE(password_source, ''))) > 0
  )
);

CREATE INDEX IF NOT EXISTS idx_places_status ON places(status);
CREATE INDEX IF NOT EXISTS idx_places_category ON places(category);
CREATE INDEX IF NOT EXISTS idx_places_status_created_at ON places(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_places_public_filters ON places(status, wifi_available, category, wifi_access_type);
CREATE INDEX IF NOT EXISTS idx_places_public_speed ON places(status, wifi_available, wifi_speed_mbps DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_places_search ON places USING GIN (
  to_tsvector('simple', COALESCE(name, '') || ' ' || COALESCE(address, '') || ' ' || COALESCE(district, '') || ' ' || COALESCE(category, ''))
);

ALTER TABLE places ADD COLUMN IF NOT EXISTS image_url TEXT;

CREATE TABLE IF NOT EXISTS reviews (
  id SERIAL PRIMARY KEY,
  place_id INTEGER NOT NULL REFERENCES places(id) ON DELETE CASCADE,
  author_name TEXT NOT NULL,
  author_email TEXT,
  review_title TEXT NOT NULL DEFAULT 'Ulasan pengunjung',
  rating_speed INTEGER NOT NULL CHECK (rating_speed BETWEEN 1 AND 5),
  rating_comfort INTEGER NOT NULL CHECK (rating_comfort BETWEEN 1 AND 5),
  image_url TEXT,
  comment TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reviews_place_id ON reviews(place_id);
CREATE INDEX IF NOT EXISTS idx_reviews_place_created_at ON reviews(place_id, created_at DESC);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_matviews
    WHERE schemaname = CURRENT_SCHEMA()
      AND matviewname = 'place_metrics'
  ) THEN
    DROP MATERIALIZED VIEW place_metrics;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS place_metrics (
  place_id INTEGER PRIMARY KEY REFERENCES places(id) ON DELETE CASCADE,
  avg_speed_rating NUMERIC(10, 2) NOT NULL DEFAULT 0,
  avg_comfort_rating NUMERIC(10, 2) NOT NULL DEFAULT 0,
  avg_rating NUMERIC(10, 2) NOT NULL DEFAULT 0,
  review_count INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_place_metrics_featured ON place_metrics(avg_rating DESC, review_count DESC, place_id);

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

ALTER TABLE reviews ADD COLUMN IF NOT EXISTS review_title TEXT NOT NULL DEFAULT 'Ulasan pengunjung';
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS author_email TEXT;

ALTER TABLE places ADD COLUMN IF NOT EXISTS wifi_ssid TEXT;
ALTER TABLE places ADD COLUMN IF NOT EXISTS wifi_band TEXT;
ALTER TABLE places ADD COLUMN IF NOT EXISTS is_hype BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS wifi_credentials (
  id SERIAL PRIMARY KEY,
  place_id INTEGER NOT NULL REFERENCES places(id) ON DELETE CASCADE,
  ssid TEXT NOT NULL,
  password TEXT,
  band TEXT NOT NULL DEFAULT 'auto' CHECK (band IN ('2.4GHz', '5GHz', '6GHz', 'auto')),
  password_source TEXT,
  submitted_by_name TEXT NOT NULL,
  submitted_by_email TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  avg_rating NUMERIC(3, 2) NOT NULL DEFAULT 0,
  rating_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT wifi_credentials_password_source_check CHECK (
    password IS NULL OR CHAR_LENGTH(TRIM(COALESCE(password_source, ''))) > 0
  )
);

CREATE INDEX IF NOT EXISTS idx_wifi_credentials_place ON wifi_credentials(place_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wifi_credentials_status ON wifi_credentials(status);

CREATE TABLE IF NOT EXISTS wifi_credential_ratings (
  id SERIAL PRIMARY KEY,
  credential_id INTEGER NOT NULL REFERENCES wifi_credentials(id) ON DELETE CASCADE,
  rater_name TEXT NOT NULL,
  rater_email TEXT NOT NULL,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(credential_id, rater_email)
);

CREATE INDEX IF NOT EXISTS idx_wifi_ratings_credential ON wifi_credential_ratings(credential_id);

