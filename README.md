# BalamWiFi

BalamWiFi is a public WiFi directory for Bandar Lampung. It lists cafes, libraries, campus lounges, coworking spaces, restaurants, and rest areas with public WiFi details, speed reports, power outlet info, reviews, and moderation flow.

## Stack

- Next.js 16 + React 19 frontend
- **Cloudflare Workers + D1 (SQLite)** via `@opennextjs/cloudflare` (monolitik, `wrangler.jsonc:1`, `server/schema.d1.sql:1`, `server/d1.js:1`) — production target `https://balamwifi.my.id` (vars `CORS_ORIGIN`, `NEXT_PUBLIC_SITE_URL`)
- Express API server (legacy local dev `npm run dev:legacy`, `server/index.js:64`) + Hono Worker API `worker/index.ts:1` (keep `nodejs_compat`, D1 `env.DB`)
- PostgreSQL via `pg` (legacy, `server/db.js:866` dynamic import, optional `DATABASE_URL`)
- Zod request validation
- In-memory seed data fallback when `DATABASE_URL` is not set
- Google ID token verification for community submissions and reviews

## Requirements

- Node.js 22 or newer
- npm
- PostgreSQL database for production or persistent local data

## Setup

```bash
npm install
cp .env.example .env
npm run dev
```

Frontend runs on `http://localhost:3000`.
API runs on `http://localhost:8787`.

## Environment

```env
PORT=8787
CORS_ORIGIN=http://localhost:3000
DATABASE_URL=postgresql://username:password@host.neon.tech/balamwifi?sslmode=require
DB_SCHEMA_SYNC=true
ADMIN_TOKEN=change-this-admin-token
GOOGLE_CLIENT_ID=your-google-oauth-client-id.apps.googleusercontent.com
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your-google-oauth-client-id.apps.googleusercontent.com
NEXT_PUBLIC_API_BASE=/api
API_SERVER_URL=http://localhost:8787
NEXT_IMAGE_REMOTE_HOSTS=i.ibb.co,images.unsplash.com,lh3.googleusercontent.com
```

`DATABASE_URL` is optional for development. Without it, server uses seed data in memory.

Set `DB_SCHEMA_SYNC=false` in production after migrations are applied if you do not want the API server to run schema DDL and metrics backfill on every startup.

`ADMIN_TOKEN` protects moderation endpoints. In development, admin endpoints remain open if `ADMIN_TOKEN` is empty. In production, empty `ADMIN_TOKEN` disables admin access with `503`.

`API_SERVER_URL` is used by Next route handlers to proxy `/api/*` requests to the Express API server.

`GOOGLE_CLIENT_ID` is used by the API to verify Google ID tokens. `NEXT_PUBLIC_GOOGLE_CLIENT_ID` enables the browser login prompt. Use the same OAuth client ID unless you intentionally split clients.

`NEXT_IMAGE_REMOTE_HOSTS` is a comma-separated allowlist for `next/image` remote optimization. Add trusted image hosts here before accepting URLs from a new provider.

Use admin token with:

```http
Authorization: Bearer change-this-admin-token
```

## Scripts

```bash
npm run dev          # Run API and Next dev server
npm run dev:client   # Run Next only
npm run dev:api      # Run API only
npm run dev:server   # Alias for dev:api
npm run build        # Build Next app
npm run preview      # Start built Next app and API
npm run start        # Start built Next app and API
npm run start:next   # Start built Next app only
npm run start:api    # Start API only
npm run db:seed      # Seed PostgreSQL data
npm run lint         # Run ESLint
```

## API

```http
GET /api/health
GET /api/places
GET /api/places/:id
POST /api/places
POST /api/reviews
GET /api/admin/submissions
PATCH /api/admin/submissions/:id
```

Supported place filters:

- `q`: text search by name, address, district, or category
- `category`: exact category
- `accessType`: exact WiFi access type
- `speed`: `steady`, `fast`, or `ultra`
- `outlets`: `true` or `false`
- `open24`: `true` or `false`
- `wifi`: `true` or `false`
- `status`: `approved`, `pending`, `rejected`, or `all`
- `limit`: 1-100, default 100

## Database

Schema lives in `server/schema.sql` and is applied when PostgreSQL store initializes.
Place rating metrics are stored in `place_metrics` and updated incrementally for the changed place after review/submission writes.

Seed data:

```bash
npm run db:seed
```

## Security Notes

- Only list public WiFi or owner-approved access.
- Password entries require source proof before approval.
- `POST /api/places` and `POST /api/reviews` require a valid Google ID token in `Authorization: Bearer <token>`.
- Do not deploy admin moderation without `ADMIN_TOKEN`.
- Set `CORS_ORIGIN` in production. Without it, production denies browser origins by default.

## Deploy (Cloudflare Workers + D1 — Opsi A Monolitik)

Domain prod: `https://balamwifi.my.id` (`wrangler.jsonc:18` vars, `CORS_ORIGIN=https://balamwifi.my.id,https://www.balamwifi.my.id`).

### Lokal D1

```bash
npm install
cp .env.example .env          # isi ADMIN_TOKEN, GOOGLE_CLIENT_ID/SECRET
# .dev.vars otomatis copy dari .env (untuk wrangler dev local)
npm run d1:schema:local       # wrangler d1 execute --local --file=./server/schema.d1.sql
npm run d1:seed:local         # seed 9 places/8 reviews -> D1 local
npm run dev:worker            # opennextjs-cloudflare dev (Workers + D1 local, http://localhost:8787)
# atau legacy: npm run dev:legacy  (Express 8787 + Next 3000, pakai pg/DATABASE_URL)
```

- `app/api/[...path]/route.js:27` proxy otomatis pakai D1 langsung di Workers (`getCloudflareContext` -> `createStore(env.DB)`) dan fallback ke `API_SERVER_URL=http://localhost:8787` untuk `npm run dev:legacy`.
- Hono API standalone `worker/index.ts:1` (keep `nodejs_compat`) untuk tes D1 langsung tanpa Next.

### Produksi

```bash
npx wrangler d1 create balamwifi-prod --location apac   # catat database_id -> update wrangler.jsonc
npx wrangler secret put ADMIN_TOKEN
npx wrangler secret put SESSION_SECRET
npx wrangler secret put GOOGLE_CLIENT_ID
npx wrangler secret put GOOGLE_CLIENT_SECRET
# NEXT_PUBLIC_* di wrangler.jsonc vars
npm run d1:schema:remote
npm run d1:seed:remote    # optional, first deploy
npm run build:worker      # opennextjs-cloudflare build (patched symlink junction for Windows)
npm run deploy            # opennextjs-cloudflare deploy -> https://balamwifi.my.id
# Set custom domain di Cloudflare Dashboard: Workers -> balamwifi -> Custom Domain -> balamwifi.my.id
```

Update Google Cloud Console: Authorized redirect `https://balamwifi.my.id/api/auth/google/callback`.

### Legacy (Neon Postgres)

For Neon PostgreSQL, use pooled connection string in `DATABASE_URL` + `npm run dev:legacy` / `npm run db:seed`.

## Panduan Kerjasama (Branch & Kolaborasi)

Panduan ini wajib diikuti semua kontributor agar riwayat git tetap rapi dan review mudah.

### 1. Format Branch

```
<type>/<nama>/<pekerjaan>
```

| Bagian       | Aturan                                                                 | Contoh                  |
| ------------ | ---------------------------------------------------------------------- | ----------------------- |
| `<type>`     | Jenis pekerjaan. Pilih salah satu di bawah                             | `feat`, `fix`, `chore`  |
| `<nama>`     | Nama panggilan / username GitHub, huruf kecil, tanpa spasi, kebab-case | `jeremi`, `budi`        |
| `<pekerjaan>`| Deskripsi singkat pekerjaan, kebab-case, 2–4 kata, tanpa spasi         | `filter-kategori`, `perbaiki-proxy-api` |

**Daftar `<type>` yang diizinkan:**

- `feat` / `feature` — fitur baru
- `fix` — perbaikan bug
- `chore` — tooling, deps, config, build
- `docs` — dokumentasi
- `refactor` — refactor tanpa ubah behavior
- `style` — styling/UI saja
- `test` — tambah/perbaiki test

**Contoh benar:**

```
feat/jeremi/filter-kategori
feat/budi/tambah-rating
fix/andi/proxy-api-error
chore/jeremi/update-deps
docs/sinta/panduan-branch
refactor/budi/optimasi-query
```

**Contoh salah:**

```
Feat/Jeremi/Filter Kategori   # jangan pakai huruf besar & spasi
feature-jeremi-filter         # harus pakai slash /
feat/jeremi/                  # pekerjaan tidak boleh kosong
```

### 2. Alur Kerja (Workflow)

```bash
# 1. Sync main terbaru
git checkout main
git pull origin main

# 2. Buat branch baru sesuai format
git checkout -b feat/jeremi/nama-pekerjaan

# 3. Kerjakan, lalu commit dengan pesan jelas
git add .
git commit -m "feat: tambah filter kategori wifi"

# 4. Push branch ke remote
git push -u origin feat/jeremi/nama-pekerjaan

# 5. Buka Pull Request (PR) di GitHub: base = main, compare = branch kamu
# 6. Tunggu CI lolos (lint, test, build) dan minta 1 review
# 7. Setelah di-approve -> Squash and merge -> hapus branch
```

**Aturan penting:**

- Selalu branch dari `main` terbaru. Jangan branch dari branch orang lain tanpa koordinasi.
- Satu branch = satu pekerjaan/fitur. Jangan campur banyak fitur dalam satu branch.
- Jangan push langsung ke `main`. Semua perubahan wajib lewat PR.
- Selalu `git pull --rebase origin main` jika `main` sudah maju saat kamu masih mengerjakan branch.
- Hapus branch setelah PR di-merge (`git branch -d feat/jeremi/nama-pekerjaan`).

### 3. Aturan Commit & Pull Request

**Commit message (disarankan Conventional Commits):**

```
feat: tambah filter kategori wifi
fix: perbaiki proxy /api di production
chore: update deps Next 16
docs: tambah panduan kerjasama di README
```

**Judul PR:** jelas dan pakai prefix yang sama, contoh `feat(jeremi): filter kategori wifi`

**Deskripsi PR wajib isi:**

- Apa yang diubah (what)
- Kenapa diubah (why)
- Cara test manual (jika perlu)
- Screenshot (untuk perubahan UI)

**Checklist sebelum minta review:**

- [ ] `npm run lint` lolos
- [ ] `npm run test` lolos (jika ada test)
- [ ] `npm run build` berhasil
- [ ] Tidak ada `console.log` tertinggal
- [ ] Sudah test manual di `http://localhost:3000`

### 4. Review & Merge

- Minimal 1 approval sebelum merge.
- CI di `.github/workflows/ci.yml` wajib hijau (lint, test, build).
- Merge strategy: **Squash and merge** agar riwayat `main` tetap bersih.
- Konflik? Rebase dari `main` dulu, jangan merge `main` ke branch kamu.

### 5. Penamaan Lain

- Issue branch opsional: boleh tambah nomor issue di pekerjaan, contoh `feat/jeremi/12-filter-kategori` jika pakai GitHub Issues.
- Hotfix urgent: `fix/nama/hotfix-nama-bug` lalu PR langsung dengan label `urgent`.
