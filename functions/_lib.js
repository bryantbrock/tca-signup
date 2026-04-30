// Shared helpers for tca-signup Pages Functions.

export function json(body, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...extraHeaders },
  });
}

export function generateId(byteCount = 8) {
  const bytes = new Uint8Array(byteCount);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

// Strip server-only fields before returning an event publicly.
export function publicEvent(event) {
  if (!event) return null;
  const { adminToken, ...rest } = event;
  return rest;
}

const RESERVED_IDS = new Set(["admin", "api", "new"]);

export function isValidEventId(id) {
  if (typeof id !== "string") return false;
  if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(id)) return false;
  if (RESERVED_IDS.has(id)) return false;
  return true;
}

export function isValidDate(d) {
  return typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d);
}

export function isValidTime(t) {
  return typeof t === "string" && /^\d{2}:\d{2}$/.test(t);
}

export function looksLikeEmail(s) {
  return typeof s === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

// Parse "Authorization: Bearer <token>" header.
export function bearerToken(request) {
  const h = request.headers.get("authorization") || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : null;
}

// ---------- ICS ----------

const TZID = "America/Chicago";

function pad(n) {
  return String(n).padStart(2, "0");
}

function utcStamp() {
  const d = new Date();
  return (
    d.getUTCFullYear().toString() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    "T" +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds()) +
    "Z"
  );
}

function localFloating(date, time) {
  // YYYYMMDDTHHMMSS — interpreted in TZID
  const [y, mo, d] = date.split("-");
  const [h, mi] = time.split(":");
  return `${y}${mo}${d}T${h}${mi}00`;
}

function addMinutes(date, time, minutes) {
  const [y, mo, d] = date.split("-").map(Number);
  const [h, mi] = time.split(":").map(Number);
  const t = mi + minutes;
  const newH = h + Math.floor(t / 60);
  const newM = t % 60;
  // Doesn't roll into the next day for our use cases (slots <= a few hours).
  return `${y}${pad(mo)}${pad(d)}T${pad(newH)}${pad(newM)}00`;
}

function escapeIcs(s) {
  return String(s)
    .replace(/\\/g, "\\\\")
    .replace(/\r?\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

export function buildIcs({
  uid,
  title,
  description,
  location,
  date,
  time,
  durationMinutes = 30,
}) {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//TCA Signup//EN",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${uid}@tca-signup.pages.dev`,
    `DTSTAMP:${utcStamp()}`,
    `DTSTART;TZID=${TZID}:${localFloating(date, time)}`,
    `DTEND;TZID=${TZID}:${addMinutes(date, time, durationMinutes)}`,
    `SUMMARY:${escapeIcs(title)}`,
  ];
  if (description) lines.push(`DESCRIPTION:${escapeIcs(description)}`);
  if (location) lines.push(`LOCATION:${escapeIcs(location)}`);
  lines.push("END:VEVENT", "END:VCALENDAR");
  return lines.join("\r\n");
}

// ---------- Email (Resend) ----------

export async function sendEmail({ env, from, to, subject, html, text, attachments }) {
  if (!env.RESEND_API_KEY) return { skipped: true, reason: "no_api_key" };
  if (!to || (Array.isArray(to) && to.length === 0)) return { skipped: true, reason: "no_recipient" };
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        from: from || env.RESEND_FROM || "TCA Signups <onboarding@resend.dev>",
        to: Array.isArray(to) ? to : [to],
        subject,
        html,
        text,
        attachments,
      }),
    });
    if (!r.ok) {
      const detail = await r.text().catch(() => "");
      return { ok: false, status: r.status, detail };
    }
    const data = await r.json().catch(() => ({}));
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}
