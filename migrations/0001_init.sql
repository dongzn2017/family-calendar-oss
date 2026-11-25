-- FamilyCalendar Open-Source Schema v1 (Cloudflare D1 / SQLite)

CREATE TABLE IF NOT EXISTS members (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member', -- 'adult' | 'child' | 'shared'
  color TEXT NOT NULL,
  can_login INTEGER NOT NULL DEFAULT 0,
  email TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO members (id, name, role, color, can_login, sort_order) VALUES
  ('partner_a', 'Alex',           'adult',  '#2563eb', 1, 1),
  ('partner_b', 'Maya',           'adult',  '#db2777', 1, 2),
  ('child_a',   'Noah',           'child',  '#059669', 0, 3),
  ('child_b',   'Emma',           'child',  '#d97706', 0, 4),
  ('family',    '全家 / Family',  'shared', '#7c3aed', 0, 5);

-- Daily status layer: irregular shift hours, partner status, electricity tariff, school strike
CREATE TABLE IF NOT EXISTS daily_status (
  date TEXT PRIMARY KEY, -- YYYY-MM-DD
  partner_b_status TEXT NOT NULL DEFAULT 'unset', -- unset | work | off | leave
  partner_b_hours TEXT NOT NULL DEFAULT '',       -- e.g. '09:45-17:45'
  partner_b_note TEXT NOT NULL DEFAULT '',
  partner_a_status TEXT NOT NULL DEFAULT 'unset', -- unset | work | remote | leave | travel | off
  partner_a_note TEXT NOT NULL DEFAULT '',
  tempo_color TEXT NOT NULL DEFAULT 'UNKNOWN',    -- UNKNOWN | BLEU | BLANC | ROUGE
  tempo_source TEXT NOT NULL DEFAULT 'auto',      -- auto | manual
  school_status TEXT NOT NULL DEFAULT 'normal',   -- normal | strike | partial_strike | holiday
  school_note TEXT NOT NULL DEFAULT '',
  day_note TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Household events: outings, deadlines, bill payments, exams, general
CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  event_type TEXT NOT NULL DEFAULT 'general', -- outing | deadline | payment | exam | general
  start_date TEXT NOT NULL,                   -- YYYY-MM-DD
  end_date TEXT NOT NULL,                     -- YYYY-MM-DD
  start_time TEXT NOT NULL DEFAULT '',        -- HH:MM or '' for all-day
  end_time TEXT NOT NULL DEFAULT '',          -- HH:MM or ''
  all_day INTEGER NOT NULL DEFAULT 1,
  location TEXT NOT NULL DEFAULT '',
  member_id TEXT NOT NULL DEFAULT 'family',
  booking_status TEXT NOT NULL DEFAULT 'none', -- none | planned | to_book | booked | cancelled
  remind_days_before INTEGER NOT NULL DEFAULT 0,
  is_done INTEGER NOT NULL DEFAULT 0,
  source TEXT NOT NULL DEFAULT 'manual',      -- manual | todo_ai | gmail_ai
  source_ref TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (member_id) REFERENCES members(id)
);

CREATE INDEX IF NOT EXISTS idx_events_dates ON events(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_events_type_done ON events(event_type, is_done);

-- School fixed timetable (folded by default in UI)
CREATE TABLE IF NOT EXISTS timetables (
  id TEXT PRIMARY KEY,
  member_id TEXT NOT NULL DEFAULT 'child_a',
  day_of_week INTEGER NOT NULL, -- 1=Mon .. 7=Sun
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  subject TEXT NOT NULL,
  location TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT '',
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (member_id) REFERENCES members(id)
);

CREATE INDEX IF NOT EXISTS idx_timetables_member_day ON timetables(member_id, day_of_week, start_time);

-- Family quick inbox (todos)
CREATE TABLE IF NOT EXISTS todos (
  id TEXT PRIMARY KEY,
  raw_text TEXT NOT NULL,
  author_id TEXT NOT NULL DEFAULT 'partner_b',
  status TEXT NOT NULL DEFAULT 'pending', -- pending | proposed | scheduled | done | dismissed
  ai_note TEXT NOT NULL DEFAULT '',
  linked_event_id TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_todos_status ON todos(status, created_at);

-- Optional selected email ingest cache
CREATE TABLE IF NOT EXISTS mail_inbox (
  gmail_message_id TEXT PRIMARY KEY,
  gmail_thread_id TEXT NOT NULL DEFAULT '',
  sender TEXT NOT NULL,
  subject TEXT NOT NULL,
  snippet TEXT NOT NULL DEFAULT '',
  body_clean TEXT NOT NULL DEFAULT '',
  gmail_url TEXT NOT NULL DEFAULT '',
  received_at TEXT NOT NULL,
  matched_rule TEXT NOT NULL DEFAULT '',
  ai_status TEXT NOT NULL DEFAULT 'pending',
  ai_summary TEXT NOT NULL DEFAULT '',
  processed_at TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Human-in-the-loop AI proposals queue
CREATE TABLE IF NOT EXISTS ai_proposals (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,             -- event | daily_status | notice
  source_type TEXT NOT NULL,      -- todo | gmail | schedule_image
  source_id TEXT NOT NULL,
  summary TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  confidence TEXT NOT NULL DEFAULT 'medium',
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  resolved_at TEXT NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_proposals_status ON ai_proposals(status, created_at);

-- Cron & AI run logs
CREATE TABLE IF NOT EXISTS ai_runs (
  id TEXT PRIMARY KEY,
  run_type TEXT NOT NULL,
  status TEXT NOT NULL,
  todos_scanned INTEGER NOT NULL DEFAULT 0,
  mails_scanned INTEGER NOT NULL DEFAULT 0,
  proposals_created INTEGER NOT NULL DEFAULT 0,
  summary TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
