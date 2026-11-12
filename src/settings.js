// Shared alert settings, stored in the database so they can be changed from
// the Settings page without touching code.

export const EVENT_TYPES = ["customs", "problem", "stalled", "notfound", "resolved", "delivered", "starred"];
export const MODES = ["now", "summary", "off"];

export function defaults(env) {
  return {
    events: {
      customs: "now",
      problem: "now",
      stalled: "now",
      notfound: "summary",
      resolved: "now",
      delivered: "off",
      starred: "now",
    },
    summary: { enabled: true, hour: 8, days: [1, 2, 3, 4, 5] }, // 1 = Monday ... 7 = Sunday
    workingHours: { enabled: false, start: 8, end: 18 },        // weekdays, UK time
    stallDays: clampInt(env && env.STALL_DAYS, 1, 30, 3),
    customsHours: clampInt(env && env.CUSTOMS_HOURS, 1, 240, 24),
    recipients: [],
  };
}

function clampInt(v, min, max, fallback) {
  const n = parseInt(v, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

const EMAIL_RE = /^[^@\s,;<>]+@[^@\s,;<>]+\.[^@\s,;<>]+$/;

// Takes anything (stored JSON, a form post) and returns a complete, safe
// settings object. Unknown or bad values fall back to the defaults.
export function clean(input, env) {
  const d = defaults(env);
  const src = input && typeof input === "object" ? input : {};
  const out = defaults(env);

  const ev = src.events && typeof src.events === "object" ? src.events : {};
  for (const type of EVENT_TYPES) {
    if (MODES.includes(ev[type])) out.events[type] = ev[type];
  }
  // "Summary only" makes no sense for these two: they are moments, not states.
  for (const type of ["resolved", "delivered", "starred"]) {
    if (out.events[type] === "summary") out.events[type] = d.events[type] === "summary" ? "now" : d.events[type];
  }

  const sm = src.summary && typeof src.summary === "object" ? src.summary : {};
  out.summary.enabled = sm.enabled === undefined ? d.summary.enabled : !!sm.enabled;
  out.summary.hour = clampInt(sm.hour, 0, 23, d.summary.hour);
  if (Array.isArray(sm.days)) {
    const days = [...new Set(sm.days.map((x) => parseInt(x, 10)).filter((x) => x >= 1 && x <= 7))].sort();
    out.summary.days = days;
  }

  const wh = src.workingHours && typeof src.workingHours === "object" ? src.workingHours : {};
  out.workingHours.enabled = !!wh.enabled;
  out.workingHours.start = clampInt(wh.start, 0, 23, d.workingHours.start);
  out.workingHours.end = clampInt(wh.end, 1, 24, d.workingHours.end);
  if (out.workingHours.end <= out.workingHours.start) {
    out.workingHours.start = d.workingHours.start;
    out.workingHours.end = d.workingHours.end;
  }

  out.stallDays = clampInt(src.stallDays, 1, 30, d.stallDays);
  out.customsHours = clampInt(src.customsHours, 1, 240, d.customsHours);

  if (Array.isArray(src.recipients)) {
    out.recipients = [...new Set(src.recipients.map((r) => String(r || "").trim().toLowerCase()).filter((r) => EMAIL_RE.test(r) && r.length <= 200))].slice(0, 20);
  }
  return out;
}

export async function getMeta(env, key) {
  const row = await env.DB.prepare("SELECT value FROM meta WHERE key = ?").bind(key).first();
  return row ? row.value : null;
}

export async function setMeta(env, key, value) {
  await env.DB.prepare("INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
    .bind(key, value)
    .run();
}

export async function loadSettings(env) {
  let stored = null;
  try {
    const raw = await getMeta(env, "settings");
    if (raw) stored = JSON.parse(raw);
  } catch (e) {
    stored = null;
  }
  return clean(stored, env);
}

export async function saveSettings(env, input) {
  const s = clean(input, env);
  await setMeta(env, "settings", JSON.stringify(s));
  return s;
}
