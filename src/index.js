// Shipment tracker: engine + board in one Cloudflare Worker.
//
// Engine: registers shipments with Ship24, checks them on a schedule,
//         stores the history, works out a plain-English state.
// Board:  one page served from "/", which talks to the engine's /api routes.
//
// Access control: the Worker refuses every request that has not come through
// Cloudflare Access. If Access is switched off, the tool locks itself.

import { PAGE } from "./page.js";
import { SETTINGS_PAGE } from "./page-settings.js";
import { HISTORY_PAGE } from "./page-history.js";
import { ADD_PAGE } from "./page-add.js";
import { loadSettings, saveSettings, getMeta, setMeta } from "./settings.js";
import { runAlerts, composeEmail, sendEmail } from "./alerts.js";

const SHIP24_DEFAULT_BASE = "https://api.ship24.com/public/v1";
const MAX_PER_PASTE = 20; // keeps one paste inside Cloudflare's per-request limits
const MAX_PER_CRON = 40;
const LOOKUP_GRACE_HOURS = 2;

export default {
  async fetch(request, env, ctx) {
    try {
      const user = await whoIsThis(env, ctx);
      if (!user) return lockedOut();
      return await route(request, env, user);
    } catch (err) {
      console.error(err && err.stack ? err.stack : err);
      return json({ error: "Something broke on our side. Try again in a minute." }, 500);
    }
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil(
      (async () => {
        await ensureSchema(env);
        await refreshOpenShipments(env);
        try {
          await runAlerts(env, present);
        } catch (e) {
          console.error("alerts failed: " + ((e && e.stack) || e));
        }
      })()
    );
  },
};

// ---------------------------------------------------------------- access

async function whoIsThis(env, ctx) {
  // Local testing only. This variable must never be set on the live Worker.
  if (env.DEV_NO_AUTH === "true") return { email: "local-test@example.com" };
  if (!ctx || !ctx.access) return null;
  let email = "unknown";
  try {
    const identity = await ctx.access.getIdentity();
    if (identity && identity.email) email = identity.email;
  } catch (e) {
    // Identity lookup failed, but Access did authenticate the request.
  }
  return { email };
}

function lockedOut() {
  return new Response(
    "Locked. This tool only answers requests that have signed in through Cloudflare Access. " +
      "If you are the owner: Workers & Pages > trackster > Settings > Domains & Routes > Enable Cloudflare Access.",
    { status: 403, headers: { "content-type": "text/plain; charset=utf-8" } }
  );
}

// ---------------------------------------------------------------- routing

// Small database changes are applied by the tool itself, once per start-up,
// so a new version never depends on someone running a command by hand.
// "Shipped" means the first time the carrier actually handled the parcel.
// A label being printed does not count: that can happen days before pickup.
const FIRST_SCAN_SQL = `(SELECT MIN(occurred_at) FROM events
   WHERE shipment_id = ?
     AND (milestone IS NULL OR milestone NOT IN ('info_received', 'pending'))
     AND LOWER(COALESCE(status_text, '')) NOT LIKE '%created a label%'
     AND LOWER(COALESCE(status_text, '')) NOT LIKE '%label created%'
     AND LOWER(COALESCE(status_text, '')) NOT LIKE '%shipment information sent%')`;
// Until there is a scan, fall back to the day it was added to the tool.
const SHIP_DAY_SQL = "substr(COALESCE(shipped_at, created_at), 1, 10)";

let schemaReady = false;
async function ensureSchema(env) {
  if (schemaReady) return;
  try {
    await env.DB.prepare("ALTER TABLE shipments ADD COLUMN first_est TEXT").run();
    // First run only: shipments still on the move keep their current estimate
    // as the starting point. Delivered ones get no verdict, since the date we
    // hold for them may already have been revised.
    await env.DB.prepare("UPDATE shipments SET first_est = est_delivery WHERE first_est IS NULL AND delivered_at IS NULL").run();
  } catch (e) {
    // "duplicate column" means it is already there, which is the normal case.
  }
  try {
    await env.DB.prepare("ALTER TABLE shipments ADD COLUMN shipped_at TEXT").run();
    // First run only: work out the ship date for everything already stored.
    await env.DB.prepare(`UPDATE shipments SET shipped_at = ${FIRST_SCAN_SQL.replace("?", "shipments.id")}`).run();
  } catch (e) {
    // Already there.
  }
  schemaReady = true;
}

async function route(request, env, user) {
  await ensureSchema(env);
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;

  const pages = { "/": PAGE, "/add": ADD_PAGE, "/history": HISTORY_PAGE, "/settings": SETTINGS_PAGE };
  if (method === "GET" && pages[path]) {
    return new Response(pages[path], {
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-store",
        "x-frame-options": "DENY",
        "referrer-policy": "no-referrer",
      },
    });
  }

  if (!path.startsWith("/api/")) return json({ error: "Not found" }, 404);

  if (method !== "GET") {
    // Changes must come from our own page, as JSON.
    const type = request.headers.get("content-type") || "";
    if (!type.includes("application/json") || request.headers.get("x-tracker") !== "1") {
      return json({ error: "Bad request" }, 400);
    }
  }

  if (method === "GET" && path === "/api/shipments") return listShipments(env, user);
  if (method === "GET" && path === "/api/history") return listHistory(env, user, url);
  if (method === "GET" && path === "/api/history.csv") return historyCsv(env, url);
  if (method === "GET" && path === "/api/settings") return getSettings(env, user);
  if (method === "POST" && path === "/api/settings") return postSettings(request, env, user);
  if (method === "POST" && path === "/api/settings/test") return testEmail(env, user);
  if (method === "POST" && path === "/api/shipments") return addShipments(request, env, user);
  if (method === "POST" && path === "/api/parse") return parseRoute(request);

  const m = path.match(/^\/api\/shipments\/(\d+)(?:\/(events|star|refresh|label|remove|restore))?$/);
  if (m) {
    const id = Number(m[1]);
    const action = m[2];
    if (method === "GET" && action === "events") return shipmentEvents(env, id);
    if (method === "POST" && action === "star") return setStar(request, env, id);
    if (method === "POST" && action === "label") return setLabel(request, env, id);
    if (method === "POST" && action === "refresh") return refreshOne(env, id);
    if (method === "POST" && action === "remove") return removeShipment(env, id);
    if (method === "POST" && action === "restore") return restoreShipment(env, id);
  }
  return json({ error: "Not found" }, 404);
}

// ---------------------------------------------------------------- board data

async function listShipments(env, user) {
  const now = new Date();
  const settings = await loadSettings(env);
  const stallDays = settings.stallDays;
  const { results } = await env.DB.prepare(
    `SELECT * FROM shipments
     WHERE archived = 0
       AND (delivered_at IS NULL OR delivered_at >= ?)
     ORDER BY created_at DESC`
  )
    .bind(new Date(now.getTime() - 14 * 86400000).toISOString())
    .all();

  const customsHours = settings.customsHours;
  const shipments = results.map((row) => present(row, now, stallDays, customsHours));
  const quota = await quotaStatus(env, now);
  return json({ shipments, quota, user: user.email, stallDays, now: now.toISOString(), firstMonth: await firstMonth(env) });
}

// ---------------------------------------------------------------- history
//
// Nothing is ever deleted. History is everything that has been delivered,
// plus anything someone removed from the board, newest first.

const HISTORY_PAGE_SIZE = 50;
const HISTORY_WHEN = "COALESCE(delivered_at, created_at)";

// The earliest month anything shipped, so the "Shipped" list knows where to stop.
async function firstMonth(env) {
  const row = await env.DB.prepare(`SELECT MIN(${SHIP_DAY_SQL}) AS d FROM shipments`).first();
  return row && row.d ? String(row.d).slice(0, 7) : "";
}

function historyFilter(url) {
  const q = (url.searchParams.get("q") || "").trim().slice(0, 60);
  let where = "(delivered_at IS NOT NULL OR archived = 1)";
  const binds = [];
  if (/^[a-z]{2}$/i.test(q)) {
    // Two letters on their own mean a country code. Otherwise "de" would also find every FedEx parcel.
    where += " AND UPPER(dest_country) = ?";
    binds.push(q.toUpperCase());
  } else if (q) {
    const like = "%" + q.replace(/[\\%_]/g, (c) => "\\" + c) + "%";
    where +=
      " AND (tracking_number LIKE ? ESCAPE '\\' OR label LIKE ? ESCAPE '\\' OR dest_country LIKE ? ESCAPE '\\'" +
      " OR courier LIKE ? ESCAPE '\\' OR last_event_location LIKE ? ESCAPE '\\')";
    binds.push(like, like, like, like, like);
  }
  const carrier = (url.searchParams.get("carrier") || "").toLowerCase();
  if (carrier === "ups" || carrier === "fedex") {
    where += " AND LOWER(COALESCE(courier, '')) LIKE ?";
    binds.push(carrier + "%");
  }
  const isDay = (v) => /^\d{4}-\d{2}-\d{2}$/.test(v || "");
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  if (isDay(from)) {
    where += ` AND ${SHIP_DAY_SQL} >= ?`;
    binds.push(from);
  }
  if (isDay(to)) {
    where += ` AND ${SHIP_DAY_SQL} <= ?`;
    binds.push(to);
  }
  // Oldest first or newest first, by the day it was delivered (or added, for removed ones).
  const dir = url.searchParams.get("sort") === "old" ? "ASC" : "DESC";
  return { q, where, binds, order: `${HISTORY_WHEN} ${dir}, id ${dir}` };
}

async function listHistory(env, user, url) {
  const now = new Date();
  const settings = await loadSettings(env);
  const f = historyFilter(url);
  const offset = Math.max(0, parseInt(url.searchParams.get("offset") || "0", 10) || 0);

  const { results } = await env.DB.prepare(
    `SELECT * FROM shipments WHERE ${f.where} ORDER BY ${f.order} LIMIT ? OFFSET ?`
  )
    .bind(...f.binds, HISTORY_PAGE_SIZE + 1, offset)
    .all();
  const more = results.length > HISTORY_PAGE_SIZE;
  const items = results.slice(0, HISTORY_PAGE_SIZE).map((row) => ({
    ...present(row, now, settings.stallDays, settings.customsHours),
    removed: !!row.archived,
    month: String(row.delivered_at || row.created_at || "").slice(0, 7),
  }));

  // Month totals come from the whole history, not just the rows on screen.
  // Removed shipments are left out of the counts: they are mostly typos.
  const live = "archived = 0 AND delivered_at IS NOT NULL";
  const stats = await env.DB.prepare(
    `SELECT substr(${HISTORY_WHEN}, 1, 7) AS month,
            SUM(CASE WHEN ${live} THEN 1 ELSE 0 END) AS delivered,
            SUM(CASE WHEN ${live} AND first_est IS NOT NULL THEN 1 ELSE 0 END) AS judged,
            SUM(CASE WHEN ${live} AND first_est IS NOT NULL
                      AND substr(delivered_at, 1, 10) <= substr(first_est, 1, 10) THEN 1 ELSE 0 END) AS ontime,
            SUM(CASE WHEN archived = 1 THEN 1 ELSE 0 END) AS removed
     FROM shipments WHERE ${f.where} GROUP BY month`
  )
    .bind(...f.binds)
    .all();
  const months = {};
  let total = 0;
  for (const m of stats.results) {
    months[m.month] = { delivered: m.delivered, judged: m.judged, ontime: m.ontime, removed: m.removed };
    total += m.delivered + m.removed;
  }
  return json({
    items, months, total, nextOffset: more ? offset + HISTORY_PAGE_SIZE : null, q: f.q, user: user.email,
    firstMonth: await firstMonth(env),
  });
}

// The same list as a spreadsheet file. Follows the search box.
async function historyCsv(env, url) {
  const f = historyFilter(url);
  const { results } = await env.DB.prepare(
    `SELECT * FROM shipments WHERE ${f.where} ORDER BY ${f.order} LIMIT 20000`
  )
    .bind(...f.binds)
    .all();
  const day = (v) => (v ? String(v).slice(0, 10) : "");
  const lines = [
    ["Tracking number", "Note", "Carrier", "Destination", "Added", "Shipped", "Delivered", "First estimate", "On time", "Days late", "Last scan", "Last scan place", "Removed from board"],
  ];
  for (const row of results) {
    const t = timing(row);
    lines.push([
      // Long all-digit numbers get mangled by spreadsheets unless marked as text.
      /^\d{11,}$/.test(row.tracking_number) ? { text: row.tracking_number } : row.tracking_number,
      row.label || "",
      (row.courier || "").toUpperCase(),
      row.dest_country || "",
      day(row.created_at),
      day(row.shipped_at),
      day(row.delivered_at),
      t.due || "",
      t.status === "ontime" ? "Yes" : t.status === "late" ? "No" : "",
      t.status === "late" ? String(t.daysLate) : "",
      row.last_event_text || "",
      row.last_event_location || "",
      row.archived ? "Yes" : "",
    ]);
  }
  const body = "\uFEFF" + lines.map((l) => l.map(csvCell).join(",")).join("\r\n") + "\r\n";
  return new Response(body, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": 'attachment; filename="shipment-history-' + new Date().toISOString().slice(0, 10) + '.csv"',
      "cache-control": "no-store",
    },
  });
}

function csvCell(v) {
  if (v && typeof v === "object") return '"=""' + String(v.text).replace(/"/g, "") + '"""';
  let s = String(v == null ? "" : v);
  // Carrier text is outside our control: never let it be read as a formula.
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

function present(row, now, stallDays, customsHours) {
  const s = deriveState(row, now, stallDays, customsHours);
  return {
    id: row.id,
    trackingNumber: row.tracking_number,
    label: row.label || "",
    courier: row.courier || "",
    state: s.state,
    reason: s.reason,
    lastEventAt: row.last_event_at,
    lastEventText: row.last_event_text || "",
    lastEventLocation: row.last_event_location || "",
    estDelivery: row.est_delivery,
    timing: timing(row),
    destCountry: row.dest_country || "",
    starred: !!row.starred,
    createdAt: row.created_at,
    shipDay: String(row.shipped_at || row.created_at || "").slice(0, 10),
    shipKnown: !!row.shipped_at,
    checkedAt: row.checked_at,
    deliveredAt: row.delivered_at,
    error: row.last_error || "",
  };
}

// The seven plain states. "stalled" is our own judgement: Ship24 and the
// carriers do not announce that nothing has happened.
export function deriveState(row, now, stallDays, customsHours) {
  const ms = row.milestone || "pending";
  const code = row.status_code || "";

  if (ms === "delivered") return { state: "delivered", reason: "" };

  if (ms === "exception") return { state: "problem", reason: problemText(code) || "Carrier reports it cannot be delivered" };
  if (ms === "failed_attempt") return { state: "problem", reason: "Delivery attempt failed" };
  if (code === "delivery_exception" || code === "delivery_refused") {
    return { state: "problem", reason: problemText(code) };
  }

  const said = row.customs_text ? ' Carrier says: "' + clip(row.customs_text, 170) + '"' : "";
  const sinceDay = row.customs_since ? " since " + dayMonth(row.customs_since) : "";
  if (row.customs_state === "hold") {
    if (code === "customs_rejected") return { state: "customs", reason: "Rejected by customs." + said };
    return { state: "customs", reason: said ? "Held at import" + sinceDay + "." + said : "Held in customs: documents or payment may be needed" };
  }
  // Most parcels sit with customs for minutes. Only flag one that lingers.
  let customsNote = "";
  if (row.customs_state === "in") {
    const since = row.customs_since || row.last_event_at;
    const hours = since ? Math.floor((now.getTime() - new Date(since).getTime()) / 3600000) : 0;
    if (hours >= (customsHours || 24)) {
      return { state: "customs", reason: "With customs for " + (hours >= 48 ? Math.floor(hours / 24) + " days" : hours + " hours") + " and not released." + said };
    }
    customsNote = "With customs";
  }

  if (ms === "out_for_delivery") return { state: "out", reason: "" };
  if (ms === "available_for_pickup") return { state: "out", reason: "Waiting to be collected" };

  if (ms === "pending") {
    // Ship24 fetches from the carrier in the background, so a new shipment is
    // blank for the first few minutes. Past two hours, the number is the problem.
    const hours = (now.getTime() - new Date(row.created_at).getTime()) / 3600000;
    if (hours < LOOKUP_GRACE_HOURS) return { state: "looking", reason: "Asking the carrier. This usually takes a few minutes." };
    return { state: "notfound", reason: "No carrier recognises this number. Check it for a typo." };
  }

  const today = now.toISOString().slice(0, 10);
  if (row.est_delivery && row.est_delivery.slice(0, 10) < today) {
    return { state: "stalled", reason: "Past its expected delivery date (" + row.est_delivery.slice(0, 10) + ")" };
  }
  const since = row.last_event_at || row.created_at;
  const quietDays = workingDaysBetween(new Date(since), now);
  if (quietDays >= stallDays) {
    return { state: "stalled", reason: "No scan for " + quietDays + " working days" };
  }

  if (ms === "info_received") return { state: "label", reason: "" };
  return { state: "transit", reason: customsNote };
}

// Did it arrive when the carrier first said it would?
// Carriers revise their estimate as a parcel slips, so the fair comparison
// is against the first date we ever saw, not the latest one.
export function timing(row) {
  const day = (v) => (v ? String(v).slice(0, 10) : null);
  const due = day(row.first_est) || (row.delivered_at ? null : day(row.est_delivery));
  if (!due) return { status: row.delivered_at ? "unknown" : "none", due: null, revised: null, daysLate: null };
  const latest = day(row.est_delivery);
  const revised = latest && latest !== due ? latest : null;
  if (!row.delivered_at) return { status: "due", due, revised, daysLate: null };
  const daysLate = Math.round((Date.parse(day(row.delivered_at) + "T00:00:00Z") - Date.parse(due + "T00:00:00Z")) / 86400000);
  return { status: daysLate > 0 ? "late" : "ontime", due, revised, daysLate };
}

function clip(text, max) {
  const t = String(text || "").replace(/\s+/g, " ").trim();
  return t.length > max ? t.slice(0, max - 1).trimEnd() + "\u2026" : t;
}

function dayMonth(iso) {
  const d = new Date(iso);
  if (isNaN(d)) return "";
  return new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", day: "numeric", month: "short" }).format(d);
}

function problemText(code) {
  return (
    {
      exception_return: "Being returned to sender",
      exception_lost: "Reported lost by the carrier",
      exception_discarded: "Destroyed by the carrier",
      delivery_exception: "Delivery problem reported by the carrier",
      delivery_refused: "Refused by the recipient",
    }[code] || ""
  );
}

// Whole weekdays that have passed between two moments.
export function workingDaysBetween(from, to) {
  if (!(from instanceof Date) || isNaN(from) || to <= from) return 0;
  let days = 0;
  const cursor = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()));
  const end = Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate());
  while (true) {
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    if (cursor.getTime() > end) break;
    const dow = cursor.getUTCDay();
    if (dow !== 0 && dow !== 6) days++;
  }
  return days;
}

async function quotaStatus(env, now) {
  const limit = parseInt(env.MAX_SHIPMENTS_PER_MONTH || "10", 10) || 10;
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
  const row = await env.DB.prepare(
    "SELECT COUNT(*) AS n FROM shipments WHERE tracker_id IS NOT NULL AND created_at >= ?"
  )
    .bind(monthStart)
    .first();
  return { used: row ? row.n : 0, limit };
}

// ---------------------------------------------------------------- adding

async function addShipments(request, env, user) {
  if (!env.SHIP24_API_KEY) return json({ error: "The tracking service has not been connected yet." }, 503);

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return json({ error: "Could not read that." }, 400);
  }
  const lines = Array.isArray(body && body.items) ? body.items : [];
  const wanted = [];
  const seen = new Set();
  for (const item of lines) {
    const tn = cleanTrackingNumber(item && item.trackingNumber);
    if (!tn || seen.has(tn)) continue;
    seen.add(tn);
    wanted.push({ tn, label: String((item && item.label) || "").trim().slice(0, 120), force: !!(item && item.force) });
  }
  if (!wanted.length) return json({ error: "No tracking numbers found in that." }, 400);
  if (wanted.length > MAX_PER_PASTE) {
    return json({ error: "Add up to " + MAX_PER_PASTE + " at a time." }, 400);
  }

  const now = new Date();
  const quota = await quotaStatus(env, now);
  let room = quota.limit - quota.used;
  const report = [];

  for (const w of wanted) {
    const existing = await env.DB.prepare("SELECT id, archived FROM shipments WHERE tracking_number = ?").bind(w.tn).first();
    if (existing) {
      if (existing.archived) {
        await env.DB.prepare("UPDATE shipments SET archived = 0 WHERE id = ?").bind(existing.id).run();
        report.push({ trackingNumber: w.tn, result: "restored" });
      } else {
        report.push({ trackingNumber: w.tn, result: "duplicate" });
      }
      continue;
    }
    if (!w.force) {
      const shape = carrierFormat(w.tn);
      if (!shape.ok) {
        report.push({ trackingNumber: w.tn, result: "suspect", detail: shape.why });
        continue;
      }
    }
    if (room <= 0) {
      report.push({ trackingNumber: w.tn, result: "over_limit" });
      continue;
    }

    let trackerId;
    try {
      trackerId = await ship24CreateTracker(env, w.tn);
    } catch (e) {
      report.push({ trackingNumber: w.tn, result: "failed", detail: String(e.message || e).slice(0, 200) });
      continue;
    }
    room--;
    const inserted = await env.DB.prepare(
      `INSERT INTO shipments (tracking_number, label, tracker_id, milestone, added_by, created_at)
       VALUES (?, ?, ?, 'pending', ?, ?) RETURNING id`
    )
      .bind(w.tn, w.label || null, trackerId, user.email, now.toISOString())
      .first();
    report.push({ trackingNumber: w.tn, result: "added" });

    // First look. Often empty this early; the schedule picks it up later.
    try {
      await refreshShipment(env, { id: inserted.id, tracker_id: trackerId });
    } catch (e) {
      // Not fatal.
    }
  }
  return json({ report });
}

// Sam ships with UPS and FedEx only. Checking the number's shape (and its
// built-in check digit where there is one) catches typos and made-up numbers
// before they cost a Ship24 slot.
export function carrierFormat(tn) {
  if (/^1Z[A-Z0-9]{16}$/.test(tn)) {
    let total = 0;
    const body = tn.slice(2, 17);
    for (let i = 0; i < body.length; i++) {
      const c = body[i];
      const v = c >= "0" && c <= "9" ? Number(c) : (c.charCodeAt(0) - 63) % 10;
      total += i % 2 === 0 ? v : 2 * v;
    }
    const ok = (10 - (total % 10)) % 10 === Number(tn[17]);
    return ok ? { ok: true, carrier: "ups" } : { ok: false, why: "It is shaped like a UPS number but its check digit is wrong, which usually means a typo." };
  }
  if (/^\d{12}$/.test(tn)) {
    const w = [3, 1, 7];
    let total = 0;
    for (let i = 0; i < 11; i++) total += Number(tn[i]) * w[i % 3];
    const ok = (total % 11) % 10 === Number(tn[11]);
    return ok ? { ok: true, carrier: "fedex" } : { ok: false, why: "It is shaped like a FedEx number but its check digit is wrong, which usually means a typo." };
  }
  if (/^\d{15}$/.test(tn) || /^\d{20}$/.test(tn) || /^\d{22}$/.test(tn)) return { ok: true, carrier: "fedex" };
  return { ok: false, why: "It does not look like a UPS or FedEx tracking number." };
}

// Turns whatever was pasted into a list of shipments. People paste one per
// line, several on a line with commas, or a spreadsheet row with tabs, so the
// rule is: anything that is a valid UPS or FedEx number is its own shipment,
// and any other text is the note for the number it sits beside.
export function parsePaste(text) {
  const items = [];
  const seen = new Set();
  const push = (tn, shape) => {
    if (seen.has(tn)) return null;
    seen.add(tn);
    const item = { trackingNumber: tn, label: "", ok: shape.ok, carrier: shape.carrier || "", why: shape.ok ? "" : shape.why };
    items.push(item);
    return item;
  };
  for (const line of String(text || "").split(/\r?\n/)) {
    const tokens = line.split(/[,;\t]+/).map((t) => t.trim()).filter(Boolean);
    if (!tokens.length) continue;
    // Each token becomes numbers, or stays as text.
    const parts = [];
    for (const tok of tokens) {
      const joined = cleanTrackingNumber(tok);
      // A number with a typo still counts as a number, so it is flagged and not
      // swallowed as the note of the one before it.
      if (joined && (carrierFormat(joined).ok || /^1Z[A-Z0-9]{16}$/.test(joined) || /^\d{12}$/.test(joined))) {
        parts.push({ numbers: [joined] });
        continue;
      }
      // Several numbers separated only by spaces.
      const pieces = tok.split(/\s+/).map(cleanTrackingNumber);
      if (pieces.length > 1 && pieces.every((p) => p && carrierFormat(p).ok)) parts.push({ numbers: pieces });
      else parts.push({ text: tok });
    }
    if (!parts.some((p) => p.numbers)) {
      // Nothing recognisable: keep the old reading, first piece is the number, so
      // an unusual number can still be added on purpose.
      // A row of things that all look like codes (no spaces, some digits, a
      // decent length) is a list of numbers in a format we do not know.
      const codey = (t) => /^[A-Za-z0-9_-]{8,50}$/.test(t) && /\d/.test(t);
      if (tokens.length > 1 && tokens.every(codey)) {
        for (const t of tokens) {
          const each = cleanTrackingNumber(t);
          if (each) push(each, carrierFormat(each));
        }
        continue;
      }
      const tn = cleanTrackingNumber(tokens[0]);
      if (!tn) continue;
      const item = push(tn, carrierFormat(tn));
      if (item) item.label = tokens.slice(1).join(", ").slice(0, 120);
      continue;
    }
    let current = null;
    let waiting = []; // text that came before the first number on the line
    for (const p of parts) {
      if (p.numbers) {
        for (const tn of p.numbers) {
          current = push(tn, carrierFormat(tn)) || { label: "" }; // a repeat still soaks up its own note
          if (waiting.length) {
            current.label = waiting.join(", ");
            waiting = [];
          }
        }
      } else if (current) {
        current.label = (current.label ? current.label + ", " : "") + p.text;
      } else {
        waiting.push(p.text);
      }
    }
  }
  for (const it of items) it.label = it.label.slice(0, 120);
  return items;
}

async function parseRoute(request) {
  const body = await request.json().catch(() => ({}));
  return json({ items: parsePaste(String((body && body.text) || "").slice(0, 20000)) });
}

function cleanTrackingNumber(v) {
  const tn = String(v || "").replace(/\s+/g, "").toUpperCase();
  if (tn.length < 5 || tn.length > 50) return "";
  if (!/^[A-Z0-9_-]+$/.test(tn)) return "";
  return tn;
}

// ---------------------------------------------------------------- Ship24

function ship24Base(env) {
  return (env.SHIP24_API_BASE || SHIP24_DEFAULT_BASE).replace(/\/+$/, "");
}

async function ship24(env, method, path, body) {
  const res = await fetch(ship24Base(env) + path, {
    method,
    headers: {
      authorization: "Bearer " + env.SHIP24_API_KEY,
      "content-type": "application/json",
      accept: "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try {
    data = await res.json();
  } catch (e) {
    // Non-JSON reply.
  }
  if (!res.ok) {
    const msg =
      (data && data.errors && data.errors[0] && (data.errors[0].message || data.errors[0].code)) ||
      (data && data.error && (data.error.message || data.error.code)) ||
      "The tracking service replied " + res.status;
    const err = new Error(msg);
    err.status = res.status;
    throw err;
  }
  return data;
}

async function ship24CreateTracker(env, trackingNumber) {
  const data = await ship24(env, "POST", "/trackers", { trackingNumber });
  const id = data && data.data && data.data.tracker && data.data.tracker.trackerId;
  if (!id) throw new Error("The tracking service did not return a tracker id");
  return id;
}

async function ship24Results(env, trackerId) {
  const data = await ship24(env, "GET", "/trackers/" + encodeURIComponent(trackerId) + "/results");
  const list = (data && data.data && data.data.trackings) || [];
  return list[0] || null;
}

// ---------------------------------------------------------------- refreshing

async function refreshShipment(env, row) {
  const nowIso = new Date().toISOString();
  let tracking;
  try {
    tracking = await ship24Results(env, row.tracker_id);
  } catch (e) {
    await env.DB.prepare("UPDATE shipments SET checked_at = ?, last_error = ? WHERE id = ?")
      .bind(nowIso, String(e.message || e).slice(0, 200), row.id)
      .run();
    throw e;
  }
  if (!tracking) {
    await env.DB.prepare("UPDATE shipments SET checked_at = ?, last_error = NULL WHERE id = ?").bind(nowIso, row.id).run();
    return;
  }
  await storeTracking(env, row.id, tracking, nowIso);
}

// Turns one Ship24 result into our stored summary plus the event history.
export function summarise(tracking) {
  const shipment = tracking.shipment || {};
  const events = (Array.isArray(tracking.events) ? tracking.events : [])
    .filter((e) => e && e.eventId)
    .slice()
    .sort((a, b) => String(a.occurrenceDatetime || "").localeCompare(String(b.occurrenceDatetime || "")));

  // Walk the history in order: the most recent customs event decides.
  // "in" = with customs, nothing wrong yet. "hold" = customs wants something.
  let customs = null;
  let customsSince = null;
  let customsText = null; // the carrier's own words for the current state
  for (const e of events) {
    let kind = customsKind(e);
    // A parcel that is out for delivery or delivered has plainly been let
    // go, even if the carrier never said "released".
    if (!kind && (customs === "in" || customs === "hold") &&
        (e.statusMilestone === "out_for_delivery" || e.statusMilestone === "delivered")) kind = "cleared";
    if (!kind) continue;
    if (kind === "cleared") {
      customs = "cleared";
      customsSince = null;
      customsText = null;
    } else {
      if (customs !== "in" && customs !== "hold") customsSince = toIso(e.occurrenceDatetime);
      if (kind === "hold" || customs !== "hold") {
        if (kind === "hold" || !customsText) customsText = e.status || null;
        customs = kind;
      }
    }
  }

  const last = events[events.length - 1] || null;
  const milestone = shipment.statusMilestone || (last && last.statusMilestone) || "pending";
  const delivery = shipment.delivery || {};
  const est =
    delivery.estimatedDeliveryDate ||
    (delivery.courierEstimatedDeliveryDate && (delivery.courierEstimatedDeliveryDate.to || delivery.courierEstimatedDeliveryDate.from)) ||
    null;

  let deliveredAt = null;
  if (milestone === "delivered") {
    const stamp = tracking.statistics && tracking.statistics.timestamps && tracking.statistics.timestamps.deliveredDatetime;
    deliveredAt = stamp || (last && last.occurrenceDatetime) || null;
  }

  return {
    milestone,
    statusCode: shipment.statusCode || (last && last.statusCode) || null,
    customs,
    customsSince,
    customsText,
    courier: (last && last.courierCode) || null,
    lastEventAt: last ? toIso(last.occurrenceDatetime) : null,
    lastEventText: last ? last.status || null : null,
    lastEventLocation: last ? last.location || null : null,
    estDelivery: est,
    destCountry: shipment.destinationCountryCode || null,
    deliveredAt: deliveredAt ? toIso(deliveredAt) : null,
    events,
  };
}

// Ship24 has customs status codes, but real UPS events arrive without them:
// "pending release from a Government Agency" comes through as plain text.
// So read the carrier's own wording as well as the code.
const CUSTOMS_CLEARED = /released by (a |the )?(government agency|customs|clearing agency)|cleared customs|customs clearance (is )?complete|clearance (is )?complete|international shipment release/i;
const CUSTOMS_HOLD = /gateway hold|we(?:'|\u2019)?ll contact the (sender|receiver|shipper)|(additional|more|missing|incomplete|incorrect) (information|documentation|documents|paperwork|details)|commercial invoice|dut(y|ies)( and| or|\/| &)? ?tax(es)? .*(due|owed|unpaid|required|outstanding)|payment .*(required|needed|due).*(customs|dut|tax)|held (by|in|at|for) (customs|a government agency|the government agency)|customs (hold|delay)|clearance delay|rejected by customs|unable to clear/i;
const CUSTOMS_IN = /government agency is conducting|document inspection|pending release from (a |the )?(government agency|customs)|presented to customs|clearance in progress|awaiting (customs )?clearance|in customs|customs clearance/i;

export function customsKind(e) {
  const code = e.statusCode || "";
  if (code === "customs_cleared") return "cleared";
  if (code === "customs_exception" || code === "customs_rejected") return "hold";
  const text = String(e.status || "");
  if (CUSTOMS_CLEARED.test(text)) return "cleared";
  if (CUSTOMS_HOLD.test(text)) return "hold";
  if (code === "customs_received" || CUSTOMS_IN.test(text)) return "in";
  return null;
}

function toIso(v) {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d) ? String(v) : d.toISOString();
}

async function storeTracking(env, shipmentId, tracking, nowIso) {
  const s = summarise(tracking);
  const statements = [
    env.DB.prepare(
      `UPDATE shipments SET
         milestone = ?, status_code = ?, customs_state = ?, customs_since = ?, customs_text = ?,
         courier = COALESCE(?, courier),
         last_event_at = ?, last_event_text = ?, last_event_location = ?,
         est_delivery = COALESCE(?, est_delivery), first_est = COALESCE(first_est, ?),
         dest_country = COALESCE(?, dest_country),
         delivered_at = ?, checked_at = ?, last_error = NULL
       WHERE id = ?`
    ).bind(
      s.milestone,
      s.statusCode,
      s.customs,
      s.customsSince,
      s.customsText,
      s.courier,
      s.lastEventAt,
      s.lastEventText,
      s.lastEventLocation,
      s.estDelivery,
      s.estDelivery,
      s.destCountry,
      s.deliveredAt,
      nowIso,
      shipmentId
    ),
  ];
  for (const e of s.events) {
    statements.push(
      env.DB.prepare(
        `INSERT OR IGNORE INTO events
           (shipment_id, event_id, occurred_at, status_text, location, courier, status_code, status_category, milestone)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        shipmentId,
        String(e.eventId),
        toIso(e.occurrenceDatetime),
        e.status || null,
        e.location || null,
        e.courierCode || null,
        e.statusCode || null,
        e.statusCategory || null,
        e.statusMilestone || null
      )
    );
  }
  statements.push(
    env.DB.prepare(`UPDATE shipments SET shipped_at = ${FIRST_SCAN_SQL} WHERE id = ?`).bind(shipmentId, shipmentId)
  );
  await env.DB.batch(statements);
}

async function refreshOpenShipments(env) {
  if (!env.SHIP24_API_KEY) return;
  const { results } = await env.DB.prepare(
    `SELECT id, tracker_id FROM shipments
     WHERE archived = 0 AND delivered_at IS NULL AND tracker_id IS NOT NULL
     ORDER BY COALESCE(checked_at, '') ASC
     LIMIT ?`
  )
    .bind(MAX_PER_CRON)
    .all();
  for (const row of results) {
    try {
      await refreshShipment(env, row);
    } catch (e) {
      console.error("refresh failed for shipment " + row.id + ": " + (e.message || e));
    }
  }
}

async function refreshOne(env, id) {
  const row = await env.DB.prepare("SELECT id, tracker_id FROM shipments WHERE id = ? AND archived = 0").bind(id).first();
  if (!row || !row.tracker_id) return json({ error: "Not found" }, 404);
  try {
    await refreshShipment(env, row);
  } catch (e) {
    return json({ error: "The tracking service did not answer: " + String(e.message || e).slice(0, 200) }, 502);
  }
  return json({ ok: true });
}

// ---------------------------------------------------------------- small actions

async function shipmentEvents(env, id) {
  const { results } = await env.DB.prepare(
    `SELECT occurred_at, status_text, location, courier, status_code
     FROM events WHERE shipment_id = ? ORDER BY occurred_at DESC, id DESC`
  )
    .bind(id)
    .all();
  return json({
    events: results.map((e) => ({
      at: e.occurred_at,
      text: e.status_text || "",
      location: e.location || "",
      courier: e.courier || "",
      code: e.status_code || "",
      customs: customsKind({ statusCode: e.status_code, status: e.status_text }) || "",
    })),
  });
}

async function setStar(request, env, id) {
  const body = await request.json().catch(() => ({}));
  // Starting point for "every update": from now on, not the whole history.
  await env.DB.prepare("UPDATE shipments SET starred = ?, starred_seen_at = COALESCE(last_event_at, ?) WHERE id = ?")
    .bind(body.starred ? 1 : 0, new Date().toISOString(), id)
    .run();
  return json({ ok: true });
}

async function setLabel(request, env, id) {
  const body = await request.json().catch(() => ({}));
  const label = String(body.label || "").trim().slice(0, 120);
  await env.DB.prepare("UPDATE shipments SET label = ? WHERE id = ?").bind(label || null, id).run();
  return json({ ok: true });
}

async function removeShipment(env, id) {
  await env.DB.prepare("UPDATE shipments SET archived = 1 WHERE id = ?").bind(id).run();
  return json({ ok: true });
}

async function restoreShipment(env, id) {
  await env.DB.prepare("UPDATE shipments SET archived = 0 WHERE id = ?").bind(id).run();
  return json({ ok: true });
}

// ---------------------------------------------------------------- settings

async function emailStatus(env, settings) {
  return {
    senderReady: !!(env.EMAIL && env.ALERT_FROM),
    from: env.ALERT_FROM || "",
    hasRecipients: settings.recipients.length > 0,
    lastSent: (await getMeta(env, "alert_last_sent")) || "",
    lastError: (await getMeta(env, "alert_error")) || "",
  };
}

async function getSettings(env, user) {
  const settings = await loadSettings(env);
  return json({ settings, status: await emailStatus(env, settings), user: user.email });
}

async function postSettings(request, env, user) {
  let body;
  try {
    body = await request.json();
  } catch (e) {
    return json({ error: "Could not read that." }, 400);
  }
  const settings = await saveSettings(env, body && body.settings);
  return json({ settings, status: await emailStatus(env, settings), user: user.email });
}

async function testEmail(env, user) {
  const settings = await loadSettings(env);
  if (!env.EMAIL || !env.ALERT_FROM) return json({ error: "Email sending has not been set up for this tool yet." }, 503);
  if (!settings.recipients.length) return json({ error: "Add at least one recipient and save first." }, 400);
  const now = new Date().toISOString();
  const email = composeEmail({
    raised: [
      {
        state: "customs",
        label: "Test shipment",
        trackingNumber: "1Z000TEST000000000",
        reason: "This is a test. No real shipment is affected.",
        courier: "ups",
        destCountry: "DE",
        lastEventAt: now,
        lastEventText: "Test requested by " + user.email,
        lastEventLocation: "",
      },
    ],
    boardUrl: (env.BOARD_URL || "").replace(/\/+$/, ""),
  });
  email.subject = "[Dot Logistics] Test email";
  const failures = await sendEmail(env, settings.recipients, email);
  // A test is the freshest evidence of whether email works, so it replaces any older failure note.
  await setMeta(env, "alert_error", failures.length ? new Date().toISOString() + " " + failures.join("; ") : "");
  return json({ sent: settings.recipients.length - failures.length, failures });
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}
