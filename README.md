# tca-signup

Reusable slot-signup web app for Trinity Classical Academy events. Built on Cloudflare Pages + Functions + KV. No framework, no build step — vanilla HTML/CSS/JS plus file-based Functions.

## URLs

- `/<event_id>` — the sign-up page for a specific event
- `/api/events/:id` — `GET` event config
- `/api/events` — `POST` to create a new event
- `/api/events/:id/bookings` — `GET` all bookings for an event
- `/api/events/:id/book` — `POST` `{ date, time, name }` to claim a slot

The root `/` redirects to whichever event id is stored in KV under `meta:active-event`, falling back to a "no event selected" message.

## Develop locally

```sh
npm install -g wrangler
wrangler login
wrangler pages dev . --kv TCA_SIGNUPS
# In another shell:
node seed.js --base http://localhost:8788
```

## Deploy

```sh
wrangler pages deploy . --project-name=tca-signup
node seed.js   # seeds the initial video-shoot-2026 event in production
```

## Adding a new event

```sh
curl -X POST https://tca-signup.pages.dev/api/events \
  -H 'content-type: application/json' \
  -d '{
    "id": "fall-2026-orientation",
    "title": "Fall Orientation",
    "description": "Pick a 30-minute slot to come meet your child'"'"'s teacher.",
    "slotDurationMinutes": 30,
    "dates": [{ "date": "2026-08-12", "label": "Wednesday, Aug 12" }],
    "slots": [
      { "time": "09:00", "label": "9:00 AM" },
      { "time": "09:30", "label": "9:30 AM" }
    ]
  }'
```

To make a new event the default landing page:

```sh
wrangler kv key put --binding=TCA_SIGNUPS meta:active-event fall-2026-orientation
```

## Data model

- `event:<id>` — full event JSON
- `booking:<id>:<date>:<time>` — `{ name, claimedAt }`
- `meta:active-event` — id of the event that `/` redirects to (optional)
