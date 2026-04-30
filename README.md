# tca-signup

Reusable slot-signup web app for Trinity Classical Academy events. Built on Cloudflare Pages + Functions + KV. No framework, no build step.

## Live URLs

- Public sign-up: `https://tca-signup.pages.dev/<event-id>`
- Admin view: `https://tca-signup.pages.dev/<event-id>/admin?token=<admin-token>`
- Create new event: `https://tca-signup.pages.dev/admin/new`

## Features

- **Per-event sign-up pages** — share-friendly URL per event, e.g. `/video-shoot-2026`
- **Multi-capacity slots** — each slot can accept 1+ claimants (volunteer shifts)
- **Privacy** — claimant names are stored privately. The public bookings list only exposes claim counts; only the booker's own browser shows their name (via localStorage)
- **Cancel-my-booking** — release a slot you claimed; localStorage holds the cancellation token
- **Calendar download (.ics)** — confirmation banner includes an "Add to calendar" link, time-zoned to America/Chicago
- **Email notifications (Resend)** — organizer gets notified on each signup; attendees get a confirmation with .ics attached when they provide email
- **Admin dashboard** — booking list with names + emails, CSV export, QR code for the public URL
- **Self-service event creation** — form-based event creation at `/admin/new`
- **Eventual-consistency aware** — optimistic UI so user-perceived latency isn't dragged by Cloudflare KV's ~60s global propagation

## Routes

### Public

- `GET  /<event-id>` — sign-up page
- `GET  /api/events/:id` — event config (admin token stripped)
- `GET  /api/events/:id/bookings` — slot claim counts (no names)
- `POST /api/events/:id/book` — `{ date, time, name, email? }` → 201 `{ bookingId, icsUrl }`
- `POST /api/events/:id/unbook` — `{ date, time, bookingId }` → 200
- `GET  /api/events/:id/ics?date=&time=&bookingId=` — calendar invite

### Admin (per-event token)

- `GET  /<event-id>/admin?token=<adminToken>` — admin UI
- `GET  /api/events/:id/admin?token=` — JSON dump of bookings
- `GET  /api/events/:id/admin/export-csv?token=` — CSV export

### Master admin (master token)

- `GET  /admin/new` — event creation form
- `POST /api/events` — `Authorization: Bearer <ADMIN_TOKEN>` required

## Setup

```sh
npm install -g wrangler
wrangler login

# 1. Generate the master admin token and set it as a Pages secret.
ADMIN_TOKEN=$(node -e "console.log(require('crypto').randomBytes(24).toString('hex'))")
echo $ADMIN_TOKEN | CLOUDFLARE_ACCOUNT_ID=... wrangler pages secret put ADMIN_TOKEN --project-name=tca-signup

# 2. (Optional) Configure email via Resend.
# Sign up at resend.com, get an API key, then:
echo $RESEND_API_KEY | CLOUDFLARE_ACCOUNT_ID=... wrangler pages secret put RESEND_API_KEY --project-name=tca-signup
# (Optional) override the From address — defaults to "TCA Signups <onboarding@resend.dev>".
echo "TCA Signups <signups@yourdomain.com>" | CLOUDFLARE_ACCOUNT_ID=... wrangler pages secret put RESEND_FROM --project-name=tca-signup

# 3. Deploy.
CLOUDFLARE_ACCOUNT_ID=... wrangler pages deploy . --project-name=tca-signup --commit-dirty=true

# 4. Seed the initial event (or use /admin/new).
ADMIN_TOKEN=$ADMIN_TOKEN node seed.js
```

## Develop locally

```sh
wrangler pages dev . --kv TCA_SIGNUPS
ADMIN_TOKEN=test-token node seed.js --base http://localhost:8788
```

## Data model (KV)

- `event:<id>` — full event JSON (incl. server-only `adminToken`, `createdAt`)
- `booking:<id>:<date>:<HH>:<MM>:<bookingId>` — `{ id, name, email?, claimedAt }`
- `meta:active-event` — id of the event that `/` redirects to (optional)

Booking key format puts `bookingId` (16 hex chars, 8 bytes of randomness) at the end so each slot can hold N independent bookings up to its `capacity`.

## Notes

- KV is eventually consistent; capacity checks have a small race window. For school-sized signups this is fine.
- The cancellation token is just the `bookingId`. Anyone who knows it can cancel that booking — but it's never returned to other users, only to the original booker.
- The per-event admin token is stamped server-side at create time and only returned in the create response. If it's lost, you can recover it by reading the event JSON via `wrangler kv key get`.
