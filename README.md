# Cllarif

Web upscale gambar berbasis AI yang terintegrasi dengan Wink AI (Meitu).

## Apa Itu Cllarif?

Clarif adalah aplikasi web sederhana untuk **memperbesar dan meningkatkan kualitas gambar** menggunakan layanan AI dari Wink AI. Pengguna cukup upload gambar, pilih mode, dan hasil upscale bisa langsung diunduh.

Dibuat oleh **Hanzz Forum Grupp**.

## Fitur

- Upload gambar via drag & drop atau klik
- 3 mode upscale: **HD**, **Ultra**, **UHD AI**
- Opsi **pertahankan ukuran asli** (resize balik ke dimensi semula)
- Auto registrasi akun Wink AI (email temporary + captcha OCR)
- Post-processing otomatis: crop, resize, fix rasio aspek
- Hasil di-upload ke hoster publik, dapat URL langsung
- UI dark theme dengan **bento grid design**
- Responsive untuk mobile

## Teknologi

- **Next.js 14** (App Router)
- **TypeScript**
- **React 18**
- **@napi-rs/canvas** (image processing)
- **axios + form-data** (HTTP client)
- **ddddocr** (fallback captcha OCR, opsional)

## Struktur Proyek

```
cllarif/
├── app/
│   ├── layout.tsx
│   ├── globals.css
│   ├── page.tsx
│   └── api/
│       └── upscale/
│           └── route.ts
├── lib/
│   └── wink.ts
├── next.config.js
├── package.json
├── tsconfig.json
├── vercel.json
├── .vercelignore
├── .gitignore
└── README.md
```

### Penjelasan Tiap File

| File | Fungsi |
|------|--------|
| `app/layout.tsx` | Wrapper HTML, set `<title>` dan metadata |
| `app/globals.css` | Semua styling: bento grid, kartu, tombol, animasi spinner |
| `app/page.tsx` | Komponen client: state upload, mode selector, preview, hasil |
| `app/api/upscale/route.ts` | Handler POST: terima file, panggil `upscale()`, return JSON |
| `lib/wink.ts` | Logic inti: `createSession()`, `uploadImage()`, `upscale()` |
| `next.config.js` | Whitelist native module `@napi-rs/canvas` & `form-data` |
| `tsconfig.json` | Path alias `@/*` → root, strict mode aktif |
| `vercel.json` | Konfigurasi maxDuration & memory untuk Vercel |

### Alur Data

```
User upload gambar
      │
      ▼
app/page.tsx (FormData)
      │
      ▼
POST /api/upscale (route.ts)
      │
      ▼
lib/wink.ts → upscale()
      │
      ├─► createSession()      → daftar akun Wink AI
      ├─► uploadImage()        → upload ke storage Wink (Qiniu)
      ├─► delivery.json        → mulai task upscale
      ├─► query_batch.json     → polling hasil
      └─► adjustImage() + uploadDirect() → post-process + re-upload
      │
      ▼
JSON { success, data: { url, width, height, ... } }
      │
      ▼
app/page.tsx render hasil + tombol download
```

## Menjalankan Lokal

```bash
npm install
npm run dev
```

Buka [http://localhost:3000](http://localhost:3000).

## Deploy ke Vercel

1. Push ke GitHub
2. Import repo di [vercel.com/new](https://vercel.com/new)
3. Set **Node.js Version** ke **20.x** di Project Settings
4. Deploy

### Batasan Vercel

| Batasan | Dampak |
|---------|--------|
| Timeout Hobby 10s | Upscale gagal |
| Timeout Pro 60s | HD/Ultra bisa jalan, UHD AI sering timeout |
| Ukuran body 4.5MB | Gambar > 4.5MB ditolak |
| Python runtime | ddddocr tidak tersedia |

Untuk produksi stabil, gunakan VPS (Railway, Fly.io, Render, DigitalOcean).

## Lisensi

MIT — dibuat oleh **Hanzz Forum Grupp**.