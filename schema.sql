-- Shipment tracker database. Safe to run more than once.

CREATE TABLE IF NOT EXISTS shipments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tracking_number TEXT NOT NULL UNIQUE,
  label TEXT,
  tracker_id TEXT,
  courier TEXT,
  milestone TEXT,
  status_code TEXT,
  customs_state TEXT,
  customs_since TEXT,
  customs_text TEXT,
  last_event_at TEXT,
  last_event_text TEXT,
  last_event_location TEXT,
  est_delivery TEXT,
  first_est TEXT,
  dest_country TEXT,
  starred INTEGER NOT NULL DEFAULT 0,
  archived INTEGER NOT NULL DEFAULT 0,
  added_by TEXT,
  created_at TEXT NOT NULL,
  checked_at TEXT,
  delivered_at TEXT,
  last_error TEXT,
  alert_state TEXT,
  starred_seen_at TEXT
);

CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  shipment_id INTEGER NOT NULL,
  event_id TEXT NOT NULL,
  occurred_at TEXT,
  status_text TEXT,
  location TEXT,
  courier TEXT,
  status_code TEXT,
  status_category TEXT,
  milestone TEXT,
  UNIQUE (shipment_id, event_id)
);

CREATE INDEX IF NOT EXISTS idx_events_shipment ON events (shipment_id, occurred_at);
CREATE INDEX IF NOT EXISTS idx_shipments_open ON shipments (archived, delivered_at, checked_at);

CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT
);
