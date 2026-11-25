-- Migration 0002: A/B week parity for timetables, event URLs, and family quick links

ALTER TABLE timetables ADD COLUMN week_parity TEXT NOT NULL DEFAULT 'ALL'; -- ALL | A | B

ALTER TABLE events ADD COLUMN url TEXT NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS family_links (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general', -- school | work | admin | home | general
  note TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
