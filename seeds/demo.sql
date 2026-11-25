-- Dynamic demo dataset anchored to SQLite date('now')
-- Safe to re-run anytime with: npm run db:seed:demo

DELETE FROM daily_status;
DELETE FROM events;
DELETE FROM timetables;
DELETE FROM todos;
DELETE FROM ai_proposals;
DELETE FROM ai_runs;
DELETE FROM family_links;

-- 1. Daily status across the current 2-week window (Maya irregular shifts, Alex remote/leave/travel, Tempo & School strike)
INSERT INTO daily_status
  (date, partner_b_status, partner_b_hours, partner_b_note, partner_a_status, partner_a_note, tempo_color, tempo_source, school_status, school_note, day_note)
VALUES
  (date('now', '-1 day'),  'work',  '09:45-17:45', 'Morning shift',  'work',   '',                 'BLEU',  'auto',   'normal',         '', ''),
  (date('now'),            'off',   '',            'Repos',          'remote', 'WFH',              'BLANC', 'manual', 'normal',         '', 'Demo day'),
  (date('now', '+1 day'),  'work',  '11:45-19:45', 'Pause 15h-16h',  'leave',  'Day off / Congé',  'ROUGE', 'manual', 'partial_strike', 'Canteen strike — pack lunchbox for Emma', ''),
  (date('now', '+2 days'), 'work',  '11:45-19:45', 'Pause 15h-16h',  'work',   '',                 'BLEU',  'auto',   'normal',         '', ''),
  (date('now', '+3 days'), 'off',   '',            'Repos',          'work',   '',                 'BLEU',  'auto',   'normal',         '', ''),
  (date('now', '+4 days'), 'off',   '',            'Repos',          'off',    '',                 'BLEU',  'auto',   'normal',         '', ''),
  (date('now', '+5 days'), 'off',   '',            'Repos',          'off',    '',                 'BLEU',  'auto',   'normal',         '', ''),
  (date('now', '+7 days'), 'work',  '10:00-18:00', 'Retail shift',   'work',   '',                 'BLANC', 'manual', 'normal',         '', ''),
  (date('now', '+8 days'), 'off',   '',            'Repos',          'travel', 'Business trip',    'BLEU',  'auto',   'normal',         '', ''),
  (date('now', '+9 days'), 'off',   '',            'Repos',          'travel', 'Return at noon',   'BLEU',  'auto',   'normal',         '', ''),
  (date('now', '+10 days'),'work',  '12:00-20:00', 'Late shift',     'remote', 'WFH',              'BLEU',  'auto',   'normal',         '', '');

-- 2. Demo events (single-day, multi-day spanning bars, deadlines, payments, exams, email excerpts)
INSERT INTO events
  (id, title, description, event_type, start_date, end_date, start_time, end_time, all_day, location, url, member_id, booking_status, remind_days_before, is_done, source)
VALUES
  ('demo-evt-1', 'Noah 音乐课调课 / Music Lesson Rescheduled',
   'Sender: music-teacher@example.com' || char(10) || '• Moved from morning to 16:30 this week' || char(10) || '• Bring duet sheet music for group rehearsal at 18:30',
   'general', date('now', '+1 day'), date('now', '+1 day'), '16:30', '17:30', 0, 'City Conservatory', '', 'child_a', 'booked', 2, 0, 'gmail_ai'),

  ('demo-evt-2', 'Noah 数学测验 / Math Midterm',
   'Focus chapters: geometry & linear functions',
   'exam', date('now', '+3 days'), date('now', '+3 days'), '09:00', '11:00', 0, 'Middle School · Room 313', '', 'child_a', 'none', 7, 0, 'manual'),

  ('demo-evt-3', '全家周末博物馆 / Family Museum Outing',
   'Sender: tickets@example.com' || char(10) || '• 4 tickets confirmed · Booking #DEMO-80421' || char(10) || '• Arrive 15 min before entry slot',
   'outing', date('now', '+4 days'), date('now', '+4 days'), '14:30', '17:30', 0, 'Science & Arts Pavilion', 'https://example.com/tickets/demo', 'family', 'booked', 3, 0, 'gmail_ai'),

  ('demo-evt-4', '提交假期营报名材料 / Holiday Camp Registration',
   'Upload vaccination card & family quotient PDF before cutoff',
   'deadline', date('now', '+5 days'), date('now', '+5 days'), '', '', 1, 'Family Portal', 'https://example.com/family-portal', 'child_b', 'none', 7, 0, 'manual'),

  ('demo-evt-5', '缴纳学校食堂账单 / School Canteen Bill',
   'Monthly invoice due — pay online via municipal portal',
   'payment', date('now', '+6 days'), date('now', '+6 days'), '', '', 1, 'Online Portal', '', 'family', 'none', 7, 0, 'manual'),

  ('demo-evt-6', 'Alex 出差 / Business Trip (Lyon)',
   'Outbound train 07:00 on Day 1, return train noon on Day 2 (demonstrates continuous multi-day spanning bar)',
   'outing', date('now', '+8 days'), date('now', '+9 days'), '07:00', '13:30', 0, 'Lyon Part-Dieu', '', 'partner_a', 'booked', 7, 0, 'manual'),

  ('demo-evt-7', 'Emma 学校冬季义卖 / School Winter Fair',
   'Sender: school@example.edu' || char(10) || '• Drop off homemade cakes in the morning' || char(10) || '• Fair runs 16:40 - 18:30 in the main courtyard',
   'deadline', date('now', '+11 days'), date('now', '+11 days'), '16:40', '18:30', 0, 'Primary School', '', 'child_b', 'none', 7, 0, 'gmail_ai'),

  ('demo-evt-8', '全家周末短途旅行 / Weekend Mountain Getaway',
   'Cabin shortlisted — still need to confirm ski passes',
   'outing', date('now', '+12 days'), date('now', '+13 days'), '', '', 1, 'Alpine Village', '', 'family', 'to_book', 7, 0, 'manual');

-- 3. Noah A/B week school timetable (folded by default)
INSERT INTO timetables (id, member_id, day_of_week, week_parity, start_time, end_time, subject, location, note, active) VALUES
  ('demo-tt-01', 'child_a', 1, 'ALL', '08:00', '08:55', 'Literature / Français', 'Room 207', 'Ms. Martin', 1),
  ('demo-tt-02', 'child_a', 1, 'ALL', '08:55', '09:50', 'Mathematics', 'Room 313', 'Mr. Bernard', 1),
  ('demo-tt-03', 'child_a', 1, 'A',   '14:25', '15:20', 'Visual Arts', 'Room 216', 'Week A only', 1),
  ('demo-tt-04', 'child_a', 1, 'B',   '14:25', '15:20', 'Science Lab', 'Room 303', 'Week B only', 1),
  ('demo-tt-05', 'child_a', 2, 'A',   '08:55', '09:50', 'History & Geography', 'Room 212', 'Week A', 1),
  ('demo-tt-06', 'child_a', 2, 'B',   '08:55', '09:50', 'English LV1', 'Room 107', 'Week B', 1),
  ('demo-tt-07', 'child_a', 3, 'ALL', '08:30', '12:00', 'Music Conservatory (Morning)', 'Conservatory', 'Afternoon free', 1),
  ('demo-tt-08', 'child_a', 4, 'ALL', '15:40', '17:30', 'Physical Education (PE)', 'Gymnasium', 'Bring sneakers', 1),
  ('demo-tt-09', 'child_a', 5, 'ALL', '11:05', '12:00', 'Mathematics', 'Room 313', 'Mr. Bernard', 1),
  ('demo-tt-10', 'child_a', 5, 'ALL', '15:40', '17:30', 'Physical Education (PE)', 'Gymnasium', '', 1);

-- 4. Sample pending todos (click "AI 整理" in demo mode to watch them convert into review proposals!)
INSERT INTO todos (id, raw_text, author_id, status) VALUES
  ('demo-todo-1', 'Next Tuesday Maya works 09:30-17:30 (morning retail shift)', 'partner_b', 'pending'),
  ('demo-todo-2', 'Book dentist checkup for Emma next Friday morning 10:00 and pay home insurance before month end', 'partner_a', 'pending');

-- 5. Pre-populated sample AI proposal so visitors immediately see the human-in-the-loop review queue
INSERT INTO ai_proposals (id, kind, source_type, source_id, summary, payload_json, confidence, status) VALUES
  ('demo-prop-1', 'notice', 'gmail', 'demo-mail-mairie',
   '[市政提醒·需核实学校] Municipal transit & school service notice — verify whether Emma''s school is affected before adding to calendar',
   '{"date":"","note":"Demo example of a reminder-only notice from City Hall: stays in the review queue and is never auto-written to your calendar unless you manually promote it."}',
   'medium', 'pending');

-- 6. Sample family quick links
INSERT INTO family_links (id, title, url, category, note, sort_order) VALUES
  ('demo-lnk-1', 'School Parent Portal (Demo)', 'https://example.com/school-portal', 'school', 'Replace with your own school portal or announcements channel', 1),
  ('demo-lnk-2', 'Municipal Canteen & After-School Billing', 'https://example.com/canteen', 'admin', 'Monthly canteen invoices & holiday camp registration', 2),
  ('demo-lnk-3', 'EDF Tempo Live Tariff Calendar', 'https://www.api-couleur-tempo.fr', 'home', 'Public API powering automatic White/Red tariff alerts', 3);

INSERT INTO ai_runs (id, run_type, status, todos_scanned, mails_scanned, proposals_created, summary) VALUES
  ('demo-run-1', 'demo_seed', 'ok', 2, 0, 1, 'Demo SQLite dataset loaded — try clicking "AI 整理" to test the offline Demo AI parser!');
