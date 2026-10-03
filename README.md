# BalamWiFi

BalamWiFi is a public WiFi directory for Bandar Lampung. It lists cafes, libraries, campus lounges, coworking spaces, restaurants, and rest areas with public WiFi details, speed reports, power outlet info, reviews, and a moderation flow.

Production: <https://balamwifi.my.id>

## Table of Contents

- [Tech Stack](#tech-stack)
- [Requirements](#requirements)
- [Quick Start](#quick-start)
- [Environment Variables](#environment-variables)
- [Scripts](#scripts)
- [API](#api)
- [Database](#database)
- [Security Notes](#security-notes)
- [Deploy](#deploy-cloudflare-workers--d1)
- [Panduan Kerjasama](#panduan-kerjasama-branch--kolaborasi)

## Tech Stack

| Layer | Teknologi | Referensi |
|---|---|---|
| Frontend | Next.js 16 + React 19 | |
| Production runtime | Cloudflare Workers + D1 (SQLite) via `@opennextjs/cloudflare` (monolitik) | `wrangler.jsonc:1`, `server/schema.d1.sql:1`, `server/d1.js:1` |
| Worker API | Hono, standalone (keep `nodejs_compat`, D1 `env.DB`) | `worker/index.ts:1` |
| Legacy API | Express, untuk local dev (`npm run dev:legacy`) | `server/index.js:64` |
| Legacy database | PostgreSQL via `pg`, optional `DATABASE_URL` | `server/db.js:866` (dynamic import) |
| Validation | Zod | |
| Auth | Google ID token verification untuk community submissions dan reviews | |
| Fallback | In-memory seed data bila `DATABASE_URL` tidak di-set | |

Production vars: `CORS_ORIGIN`, `NEXT_PUBLIC_SITE_URL`.

## Requirements

- Node.js 22 or newer
- npm
- PostgreSQL database (hanya untuk mode legacy dengan data persisten)

## Quick Start

```bash
npm install
cp .env.example .env
npm run dev
```

| Service | URL |
|---|---|
| Frontend | `http://localhost:3000` |
| API | `http://localhost:8787` |

Untuk menjalankan dengan Cloudflare Workers + D1 lokal, lihat [Lokal D1](#lokal-d1).

## Environment Variables

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

| Variable | Keterangan |
|---|---|
| `DATABASE_URL` | Optional untuk development. Tanpa ini, server memakai seed data di memori. |
| `DB_SCHEMA_SYNC` | Set `false` di production setelah migrasi diterapkan, agar API server tidak menjalankan schema DDL dan metrics backfill di setiap startup. |
| `ADMIN_TOKEN` | Melindungi endpoint moderasi. Di development, endpoint admin tetap terbuka jika kosong. Di production, kosong berarti akses admin dinonaktifkan dengan status `503`. |
| `API_SERVER_URL` | Dipakai Next route handlers untuk mem-proxy request `/api/*` ke Express API server. |
| `GOOGLE_CLIENT_ID` | Dipakai API untuk memverifikasi Google ID token. |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | Mengaktifkan prompt login di browser. Gunakan OAuth client ID yang sama kecuali memang sengaja dipisah. |
| `NEXT_IMAGE_REMOTE_HOSTS` | Allowlist (dipisah koma) untuk optimasi remote `next/image`. Tambahkan host tepercaya sebelum menerima URL dari provider baru. |

Autentikasi admin memakai header:

```http
Authorization: Bearer change-this-admin-token
```

## Scripts

| Perintah | Fungsi |
|---|---|
| `npm run dev` | Jalankan API dan Next dev server |
| `npm run dev:client` | Jalankan Next saja |
| `npm run dev:api` | Jalankan API saja |
| `npm run dev:server` | Alias untuk `dev:api` |
| `npm run build` | Build Next app |
| `npm run preview` | Start built Next app dan API |
| `npm run start` | Start built Next app dan API |
| `npm run start:next` | Start built Next app saja |
| `npm run start:api` | Start API saja |
| `npm run db:seed` | Seed data PostgreSQL |
| `npm run lint` | Jalankan ESLint |

## API

| Method | Endpoint |
|---|---|
| `GET` | `/api/health` |
| `GET` | `/api/places` |
| `GET` | `/api/places/:id` |
| `POST` | `/api/places` |
| `POST` | `/api/reviews` |
| `GET` | `/api/admin/submissions` |
| `PATCH` | `/api/admin/submissions/:id` |

### Filter Places

| Parameter | Nilai |
|---|---|
| `q` | Pencarian teks berdasarkan nama, alamat, kecamatan, atau kategori |
| `category` | Kategori (exact match) |
| `accessType` | Tipe akses WiFi (exact match) |
| `speed` | `steady`, `fast`, atau `ultra` |
| `outlets` | `true` atau `false` |
| `open24` | `true` atau `false` |
| `wifi` | `true` atau `false` |
| `status` | `approved`, `pending`, `rejected`, atau `all` |
| `limit` | 1 sampai 100, default 100 |

## Database

Schema ada di `server/schema.sql` dan diterapkan saat PostgreSQL store diinisialisasi. Metrik rating tempat disimpan di `place_metrics` dan diperbarui secara incremental untuk tempat yang berubah setelah penulisan review atau submission.

Seed data:

```bash
npm run db:seed
```

## Security Notes

- Hanya daftarkan WiFi publik atau akses yang disetujui pemiliknya.
- Entri dengan password wajib menyertakan bukti sumber sebelum disetujui.
- `POST /api/places` dan `POST /api/reviews` membutuhkan Google ID token valid di `Authorization: Bearer <token>`.
- Jangan deploy moderasi admin tanpa `ADMIN_TOKEN`.
- Set `CORS_ORIGIN` di production. Tanpa ini, production menolak semua browser origin secara default.

## Deploy (Cloudflare Workers + D1)

Opsi A, monolitik. Domain production: `https://balamwifi.my.id` (vars di `wrangler.jsonc:18`, `CORS_ORIGIN=https://balamwifi.my.id,https://www.balamwifi.my.id`).

### Lokal D1

```bash
npm install
cp .env.example .env          # isi ADMIN_TOKEN, GOOGLE_CLIENT_ID/SECRET
# .dev.vars otomatis di-copy dari .env (untuk wrangler dev lokal)
npm run d1:schema:local       # wrangler d1 execute --local --file=./server/schema.d1.sql
npm run d1:seed:local         # seed 9 places / 8 reviews ke D1 lokal
npm run dev:worker            # opennextjs-cloudflare dev (Workers + D1 lokal, http://localhost:8787)
# atau legacy: npm run dev:legacy  (Express 8787 + Next 3000, pakai pg/DATABASE_URL)
```

- Proxy di `app/api/[...path]/route.js:27` otomatis memakai D1 langsung di Workers (`getCloudflareContext` lalu `createStore(env.DB)`), dan fallback ke `API_SERVER_URL=http://localhost:8787` untuk `npm run dev:legacy`.
- Hono API standalone di `worker/index.ts:1` (keep `nodejs_compat`) berguna untuk tes D1 langsung tanpa Next.

### Produksi

```bash
npx wrangler d1 create balamwifi-prod --location apac   # catat database_id, update wrangler.jsonc
npx wrangler secret put ADMIN_TOKEN
npx wrangler secret put SESSION_SECRET
npx wrangler secret put GOOGLE_CLIENT_ID
npx wrangler secret put GOOGLE_CLIENT_SECRET
# NEXT_PUBLIC_* diisi di wrangler.jsonc vars
npm run d1:schema:remote
npm run d1:seed:remote    # optional, untuk first deploy
npm run build:worker      # opennextjs-cloudflare build (patched symlink junction untuk Windows)
npm run deploy            # opennextjs-cloudflare deploy ke https://balamwifi.my.id
```

Setelah deploy:

1. Set custom domain di Cloudflare Dashboard: **Workers → balamwifi → Custom Domain → `balamwifi.my.id`**.
2. Update Google Cloud Console dengan Authorized redirect: `https://balamwifi.my.id/api/auth/google/callback`.

### Legacy (Neon Postgres)

Untuk Neon PostgreSQL, gunakan pooled connection string di `DATABASE_URL`, lalu jalankan `npm run dev:legacy` dan `npm run db:seed`.

## Panduan Kerjasama (Branch & Kolaborasi)

Panduan ini wajib diikuti semua kontributor agar riwayat git tetap rapi dan review mudah.

### 1. Format Branch

```
<type>/<nama>/<pekerjaan>
```

| Bagian | Aturan | Contoh |
|---|---|---|
| `<type>` | Jenis pekerjaan, pilih dari daftar di bawah | `feat`, `fix`, `chore` |
| `<nama>` | Nama panggilan atau username GitHub, huruf kecil, tanpa spasi, kebab-case | `jeremi`, `budi` |
| `<pekerjaan>` | Deskripsi singkat, kebab-case, 2 sampai 4 kata, tanpa spasi | `filter-kategori`, `perbaiki-proxy-api` |

**Daftar `<type>` yang diizinkan:**

| Type | Kegunaan |
|---|---|
| `feat` / `feature` | Fitur baru |
| `fix` | Perbaikan bug |
| `chore` | Tooling, deps, config, build |
| `docs` | Dokumentasi |
| `refactor` | Refactor tanpa mengubah behavior |
| `style` | Styling/UI saja |
| `test` | Tambah atau perbaiki test |

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
Feat/Jeremi/Filter Kategori   # jangan pakai huruf besar dan spasi
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
```

Lanjutkan di GitHub:

1. Buka Pull Request: base = `main`, compare = branch kamu.
2. Tunggu CI lolos (lint, test, build) dan minta 1 review.
3. Setelah di-approve, gunakan **Squash and merge**, lalu hapus branch.

**Aturan penting:**

- Selalu branch dari `main` terbaru. Jangan branch dari branch orang lain tanpa koordinasi.
- Satu branch = satu pekerjaan/fitur. Jangan campur banyak fitur dalam satu branch.
- Jangan push langsung ke `main`. Semua perubahan wajib lewat PR.
- Jalankan `git pull --rebase origin main` jika `main` sudah maju saat kamu masih mengerjakan branch.
- Hapus branch setelah PR di-merge (`git branch -d feat/jeremi/nama-pekerjaan`).

### 3. Aturan Commit & Pull Request

**Commit message** (disarankan Conventional Commits):

```
feat: tambah filter kategori wifi
fix: perbaiki proxy /api di production
chore: update deps Next 16
docs: tambah panduan kerjasama di README
```

**Judul PR:** jelas dan memakai prefix yang sama, contoh `feat(jeremi): filter kategori wifi`.

**Deskripsi PR wajib berisi:**

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

- **Issue branch (opsional):** boleh menambahkan nomor issue di bagian pekerjaan jika memakai GitHub Issues, contoh `feat/jeremi/12-filter-kategori`.
- **Hotfix urgent:** `fix/nama/hotfix-nama-bug`, lalu buka PR langsung dengan label `urgent`.
