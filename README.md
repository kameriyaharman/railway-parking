# BKSC Parking — Attendant app + Admin panel

Railway parking management for **Nikita Agencies · Bokaro Steel City (BKSC)**.

**Live:** https://bksc-parking-production.up.railway.app
- Attendant app (Android): `/app`
- Admin panel: `/admin`

## What's inside
| Path | What |
|---|---|
| `server/index.ts` | Bun API server + Postgres schema, railway tariff engine, auth, reports |
| `server/assets.ts` | Serves web pages, generates app icons, PWA manifest + service worker |
| `web/app.html` | Attendant mobile app (installable on Android) |
| `web/admin.html` | Owner / admin panel |

### Attendant app
Login (mobile + 4-digit PIN, choose stand) · one-tap Vehicle IN / OUT · Parking & Pick&Drop · 5 vehicle types · helmet ·
token with QR · Bluetooth thermal printing (RawBT app, BLE direct, or Android print; 58/80 mm) · scan QR / type token at exit ·
auto charge from railway tariff (slabs, 24h+ per-day, P&D free 15 min / ₹ for 15–30 / parking rate after 30, helmet, lost token) ·
Cash / UPI (UPI QR) · WhatsApp slip · vehicles-inside list with running charge · shift close with cash handover & mismatch check.

### Admin panel
Dashboard (today / yesterday / month, hourly chart, by type, attendants on duty, >24h vehicles, stand occupancy) ·
Vehicles inside · Day-wise records (filters, Excel/CSV, print/PDF) · Monthly reports + downloads · Monthly passes
(pass vehicles exit free automatically) · Staff (add attendant, PIN, stand, shift, ID notes) · Shift cash check ·
Stands · Tariff editor (updates all phones instantly) · Settings (slip header, GSTIN, UPI ID, password) ·
Token edit/delete by admin only, every change in Change log.

## Run locally
```
DATABASE_URL=postgres://... ADMIN_MOBILE=... ADMIN_PASSWORD=... bun server/index.ts
```
First start creates tables, the 3 stands, the default BKSC tariff, the admin user and a demo attendant (9999999999 / 1234).

## Deploy on Railway
Easiest: connect this repo to a Railway service (Dockerfile included) + add Postgres, set
`DATABASE_URL=${{Postgres.DATABASE_URL}}`, `ADMIN_MOBILE`, `ADMIN_PASSWORD`, `APP_SECRET`.

(The current live deployment is a Railway Function running `server/` with the two HTML pages passed in
`ADMIN_1/2`, `APP_1/2` env vars — see `scripts/railway-env.ts`.)

## Android APK
The attendant app is a PWA: open `/app` in Chrome on Android → ⋮ → **Install app**.
For a Play-Store style APK, put the live `/app` URL into https://www.pwabuilder.com → Package → Android (Trusted Web Activity).
Printing uses the free **RawBT** app for classic Bluetooth thermal printers.
