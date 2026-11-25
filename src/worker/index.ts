import { Hono } from "hono";
import { syncEdfTempo } from "./tempo";
import { getLocalToday, parseScheduleImage, runAiOrganizer } from "./ai";
import { HOUSEHOLD } from "../shared/household";
import type {
  AiProposal,
  AiRunLog,
  CalendarEvent,
  DailyStatus,
  FamilyLink,
  MailInboxItem,
  Member,
  OverviewAlertItem,
  TimetableItem,
  TodoItem,
} from "../shared/types";

interface Env {
  DB: D1Database;
  GEMINI_API_KEY?: string;
  GEMINI_MODEL?: string;
  GMAIL_INGEST_SECRET?: string;
  APP_TIMEZONE?: string;
  DEMO_AI_MODE?: string;
}

const app = new Hono<{ Bindings: Env }>();

function diffDays(fromIso: string, toIso: string): number {
  const a = Date.parse(`${fromIso}T00:00:00Z`);
  const b = Date.parse(`${toIso}T00:00:00Z`);
  return Math.round((b - a) / 86_400_000);
}

function addDaysIso(baseIso: string, delta: number): string {
  const d = new Date(`${baseIso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

async function applyProposal(
  db: D1Database,
  proposal: AiProposal,
  overridePayload?: Record<string, unknown>
) {
  const payload = overridePayload ?? (JSON.parse(proposal.payload_json) as Record<string, unknown>);

  if (proposal.kind === "daily_status" && typeof payload.date === "string") {
    const existing = await db
      .prepare(`SELECT * FROM daily_status WHERE date = ?`)
      .bind(payload.date)
      .first<DailyStatus>();
    await db
      .prepare(
        `INSERT INTO daily_status
          (date, partner_b_status, partner_b_hours, partner_b_note, partner_a_status, partner_a_note,
           tempo_color, tempo_source, school_status, school_note, day_note, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
         ON CONFLICT(date) DO UPDATE SET
           partner_b_status = excluded.partner_b_status,
           partner_b_hours = excluded.partner_b_hours,
           partner_b_note = excluded.partner_b_note,
           partner_a_status = excluded.partner_a_status,
           partner_a_note = excluded.partner_a_note,
           school_status = excluded.school_status,
           school_note = excluded.school_note,
           updated_at = datetime('now')`
      )
      .bind(
        payload.date,
        String(payload.partner_b_status ?? existing?.partner_b_status ?? "unset"),
        String(payload.partner_b_hours ?? existing?.partner_b_hours ?? ""),
        String(payload.partner_b_note ?? existing?.partner_b_note ?? ""),
        String(payload.partner_a_status ?? existing?.partner_a_status ?? "unset"),
        String(payload.partner_a_note ?? existing?.partner_a_note ?? ""),
        existing?.tempo_color ?? "UNKNOWN",
        existing?.tempo_source ?? "auto",
        String(payload.school_status ?? existing?.school_status ?? "normal"),
        String(payload.school_note ?? existing?.school_note ?? ""),
        existing?.day_note ?? ""
      )
      .run();
  } else if (
    proposal.kind === "event" &&
    typeof payload.title === "string" &&
    typeof payload.start_date === "string"
  ) {
    const eventId = crypto.randomUUID();
    const startTime = String(payload.start_time ?? "");
    const allDay = payload.all_day === false || Boolean(startTime) ? 0 : 1;
    await db
      .prepare(
        `INSERT INTO events
          (id, title, description, event_type, start_date, end_date, start_time, end_time,
           all_day, location, url, member_id, booking_status, remind_days_before, is_done, source, source_ref)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '', ?, ?, ?, 0, ?, ?)`
      )
      .bind(
        eventId,
        payload.title,
        String(payload.description ?? ""),
        String(payload.event_type ?? "general"),
        payload.start_date,
        String(payload.end_date ?? payload.start_date),
        startTime,
        String(payload.end_time ?? ""),
        allDay,
        String(payload.location ?? ""),
        String(payload.member_id ?? "family"),
        String(payload.booking_status ?? "none"),
        Number(payload.remind_days_before ?? 0),
        proposal.source_type === "gmail" ? "gmail_ai" : "todo_ai",
        proposal.source_id
      )
      .run();

    if (proposal.source_type === "todo" && proposal.source_id) {
      await db
        .prepare(
          `UPDATE todos SET status = 'scheduled', linked_event_id = ?, updated_at = datetime('now') WHERE id = ?`
        )
        .bind(eventId, proposal.source_id)
        .run();
    }
  }

  await db
    .prepare(`UPDATE ai_proposals SET status = 'confirmed', resolved_at = datetime('now') WHERE id = ?`)
    .bind(proposal.id)
    .run();
}

app.get("/api/health", (c) => {
  return c.json({
    ok: true,
    today: getLocalToday(c.env.APP_TIMEZONE),
    timezone: c.env.APP_TIMEZONE || HOUSEHOLD.timezone,
    gemini_configured: Boolean(c.env.GEMINI_API_KEY),
    demo_ai_mode: !c.env.GEMINI_API_KEY && c.env.DEMO_AI_MODE === "true",
    gemini_model: c.env.GEMINI_MODEL || "gemini-3.8-flash",
  });
});

app.get("/api/members", async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT * FROM members ORDER BY sort_order ASC`
  ).all<Member>();
  return c.json({ members: results });
});

app.get("/api/calendar", async (c) => {
  const start = c.req.query("start");
  const end = c.req.query("end");
  if (!start || !end) {
    return c.json({ error: "start and end query params (YYYY-MM-DD) are required" }, 400);
  }

  const [daysRes, eventsRes] = await Promise.all([
    c.env.DB.prepare(
      `SELECT * FROM daily_status WHERE date >= ? AND date <= ? ORDER BY date ASC`
    )
      .bind(start, end)
      .all<DailyStatus>(),
    c.env.DB.prepare(
      `SELECT * FROM events WHERE end_date >= ? AND start_date <= ? ORDER BY start_date ASC, all_day DESC, start_time ASC`
    )
      .bind(start, end)
      .all<CalendarEvent>(),
  ]);

  return c.json({ daily_status: daysRes.results, events: eventsRes.results });
});

app.get("/api/alerts", async (c) => {
  const today = getLocalToday(c.env.APP_TIMEZONE);
  const in7 = addDaysIso(today, 7);
  const in14 = addDaysIso(today, 14);

  const [daysRes, eventsRes] = await Promise.all([
    c.env.DB.prepare(
      `SELECT * FROM daily_status WHERE date >= ? AND date <= ? ORDER BY date ASC`
    )
      .bind(today, in7)
      .all<DailyStatus>(),
    c.env.DB.prepare(
      `SELECT * FROM events WHERE is_done = 0 AND end_date >= ? AND start_date <= ? ORDER BY start_date ASC`
    )
      .bind(today, in14)
      .all<CalendarEvent>(),
  ]);

  const alerts: OverviewAlertItem[] = [];

  for (const day of daysRes.results) {
    const daysLeft = diffDays(today, day.date);
    if (day.tempo_color === "ROUGE" || day.tempo_color === "BLANC") {
      alerts.push({
        kind: "tempo",
        severity: day.tempo_color === "ROUGE" ? "danger" : "warning",
        date: day.date,
        days_left: daysLeft,
        title: `EDF Tempo ${day.tempo_color}`,
        subtitle:
          day.tempo_color === "ROUGE"
            ? "高电价红日 · Avoid high-load appliances"
            : "中电价白日 · Moderate tariff",
        ref_id: `tempo-${day.date}`,
      });
    }
    if (day.school_status === "strike" || day.school_status === "partial_strike") {
      alerts.push({
        kind: "strike",
        severity: day.school_status === "strike" ? "danger" : "warning",
        date: day.date,
        days_left: daysLeft,
        title:
          day.school_status === "strike"
            ? `${HOUSEHOLD.childB.name} 学校罢工 / Strike`
            : `${HOUSEHOLD.childB.name} 部分罢工 / Partial strike`,
        subtitle: day.school_note || "Check childcare or packed lunch",
        ref_id: `strike-${day.date}`,
      });
    }
  }

  for (const evt of eventsRes.results) {
    const daysLeft = diffDays(today, evt.start_date);
    const windowDays = Math.max(
      evt.remind_days_before || 0,
      evt.event_type === "deadline" || evt.event_type === "payment" || evt.event_type === "exam"
        ? 7
        : evt.booking_status === "to_book"
          ? 7
          : 0
    );

    if (windowDays > 0 && daysLeft <= windowDays) {
      const typeLabel: Record<string, string> = {
        deadline: "Deadline",
        payment: "缴费 / Payment",
        exam: "考试 / Exam",
        outing: "待预定 / To book",
        general: "提醒 / Reminder",
      };
      alerts.push({
        kind: "event",
        severity: daysLeft <= 2 ? "danger" : "warning",
        date: evt.start_date,
        days_left: daysLeft,
        title: evt.title,
        subtitle: `${typeLabel[evt.event_type] || "提醒"}${evt.location ? ` · ${evt.location}` : ""}`,
        ref_id: evt.id,
        event: evt,
      });
    }
  }

  alerts.sort((a, b) => a.days_left - b.days_left);
  return c.json({ today, alerts });
});

app.put("/api/daily-status/:date", async (c) => {
  const date = c.req.param("date");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return c.json({ error: "Invalid date format" }, 400);
  }
  const body = (await c.req.json()) as Partial<DailyStatus>;
  const existing = await c.env.DB.prepare(`SELECT * FROM daily_status WHERE date = ?`)
    .bind(date)
    .first<DailyStatus>();

  const next: DailyStatus = {
    date,
    partner_b_status: body.partner_b_status ?? existing?.partner_b_status ?? "unset",
    partner_b_hours: body.partner_b_hours ?? existing?.partner_b_hours ?? "",
    partner_b_note: body.partner_b_note ?? existing?.partner_b_note ?? "",
    partner_a_status: body.partner_a_status ?? existing?.partner_a_status ?? "unset",
    partner_a_note: body.partner_a_note ?? existing?.partner_a_note ?? "",
    tempo_color: body.tempo_color ?? existing?.tempo_color ?? "UNKNOWN",
    tempo_source:
      body.tempo_color !== undefined && body.tempo_color !== existing?.tempo_color
        ? "manual"
        : (body.tempo_source ?? existing?.tempo_source ?? "auto"),
    school_status: body.school_status ?? existing?.school_status ?? "normal",
    school_note: body.school_note ?? existing?.school_note ?? "",
    day_note: body.day_note ?? existing?.day_note ?? "",
  };

  await c.env.DB.prepare(
    `INSERT INTO daily_status
      (date, partner_b_status, partner_b_hours, partner_b_note, partner_a_status, partner_a_note,
       tempo_color, tempo_source, school_status, school_note, day_note, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
     ON CONFLICT(date) DO UPDATE SET
       partner_b_status = excluded.partner_b_status,
       partner_b_hours = excluded.partner_b_hours,
       partner_b_note = excluded.partner_b_note,
       partner_a_status = excluded.partner_a_status,
       partner_a_note = excluded.partner_a_note,
       tempo_color = excluded.tempo_color,
       tempo_source = excluded.tempo_source,
       school_status = excluded.school_status,
       school_note = excluded.school_note,
       day_note = excluded.day_note,
       updated_at = datetime('now')`
  )
    .bind(
      next.date,
      next.partner_b_status,
      next.partner_b_hours,
      next.partner_b_note,
      next.partner_a_status,
      next.partner_a_note,
      next.tempo_color,
      next.tempo_source,
      next.school_status,
      next.school_note,
      next.day_note
    )
    .run();

  return c.json({ daily_status: next });
});

app.post("/api/events", async (c) => {
  const body = (await c.req.json()) as Partial<CalendarEvent>;
  if (!body.title?.trim() || !body.start_date) {
    return c.json({ error: "title and start_date are required" }, 400);
  }
  const id = crypto.randomUUID();
  const eventType = body.event_type ?? "general";
  const defaultRemind =
    eventType === "deadline" || eventType === "payment" || eventType === "exam" ? 7 : 0;

  const evt: CalendarEvent = {
    id,
    title: body.title.trim(),
    description: body.description ?? "",
    event_type: eventType,
    start_date: body.start_date,
    end_date: body.end_date || body.start_date,
    start_time: body.start_time ?? "",
    end_time: body.end_time ?? "",
    all_day: body.all_day ?? (body.start_time ? 0 : 1),
    location: body.location ?? "",
    url: body.url ?? "",
    member_id: body.member_id ?? "family",
    booking_status: body.booking_status ?? "none",
    remind_days_before: body.remind_days_before ?? defaultRemind,
    is_done: body.is_done ?? 0,
    source: body.source ?? "manual",
    source_ref: body.source_ref ?? "",
  };

  await c.env.DB.prepare(
    `INSERT INTO events
      (id, title, description, event_type, start_date, end_date, start_time, end_time,
       all_day, location, url, member_id, booking_status, remind_days_before, is_done, source, source_ref)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      evt.id,
      evt.title,
      evt.description,
      evt.event_type,
      evt.start_date,
      evt.end_date,
      evt.start_time,
      evt.end_time,
      evt.all_day,
      evt.location,
      evt.url ?? "",
      evt.member_id,
      evt.booking_status,
      evt.remind_days_before,
      evt.is_done,
      evt.source,
      evt.source_ref
    )
    .run();

  return c.json({ event: evt }, 201);
});

app.post("/api/events/batch", async (c) => {
  const body = (await c.req.json()) as { events?: Array<Partial<CalendarEvent>> };
  const list = Array.isArray(body.events) ? body.events : [];
  if (list.length === 0 || list.length > 200) {
    return c.json({ error: "events array (1..200 items) is required" }, 400);
  }
  const stmt = c.env.DB.prepare(
    `INSERT INTO events
      (id, title, description, event_type, start_date, end_date, start_time, end_time,
       all_day, location, url, member_id, booking_status, remind_days_before, is_done, source, source_ref)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const batch = [];
  for (const item of list) {
    if (!item.title?.trim() || !item.start_date) continue;
    const eventType = item.event_type ?? "general";
    const defaultRemind =
      eventType === "deadline" || eventType === "payment" || eventType === "exam" ? 7 : 0;
    batch.push(
      stmt.bind(
        crypto.randomUUID(),
        item.title.trim(),
        item.description ?? "",
        eventType,
        item.start_date,
        item.end_date || item.start_date,
        item.start_time ?? "",
        item.end_time ?? "",
        item.all_day ?? (item.start_time ? 0 : 1),
        item.location ?? "",
        item.url ?? "",
        item.member_id ?? "family",
        item.booking_status ?? "none",
        item.remind_days_before ?? defaultRemind,
        item.is_done ?? 0,
        item.source ?? "manual",
        item.source_ref ?? ""
      )
    );
  }
  if (batch.length === 0) return c.json({ error: "No valid events to insert" }, 400);
  await c.env.DB.batch(batch);
  return c.json({ ok: true, created: batch.length }, 201);
});

app.put("/api/events/:id", async (c) => {
  const id = c.req.param("id");
  const existing = await c.env.DB.prepare(`SELECT * FROM events WHERE id = ?`)
    .bind(id)
    .first<CalendarEvent>();
  if (!existing) return c.json({ error: "Event not found" }, 404);
  const body = (await c.req.json()) as Partial<CalendarEvent>;
  const next: CalendarEvent = {
    ...existing,
    ...body,
    id,
    title: (body.title ?? existing.title).trim(),
    end_date: body.end_date || body.start_date || existing.end_date,
  };
  await c.env.DB.prepare(
    `UPDATE events SET
       title = ?, description = ?, event_type = ?, start_date = ?, end_date = ?,
       start_time = ?, end_time = ?, all_day = ?, location = ?, url = ?, member_id = ?,
       booking_status = ?, remind_days_before = ?, is_done = ?, updated_at = datetime('now')
     WHERE id = ?`
  )
    .bind(
      next.title,
      next.description,
      next.event_type,
      next.start_date,
      next.end_date,
      next.start_time,
      next.end_time,
      next.all_day,
      next.location,
      next.url ?? "",
      next.member_id,
      next.booking_status,
      next.remind_days_before,
      next.is_done,
      id
    )
    .run();
  return c.json({ event: next });
});

app.delete("/api/events/:id", async (c) => {
  await c.env.DB.prepare(`DELETE FROM events WHERE id = ?`).bind(c.req.param("id")).run();
  return c.json({ ok: true });
});

app.get("/api/timetables", async (c) => {
  const memberId = c.req.query("member_id") || HOUSEHOLD.childA.id;
  const { results } = await c.env.DB.prepare(
    `SELECT * FROM timetables WHERE member_id = ? AND active = 1 ORDER BY day_of_week ASC, start_time ASC`
  )
    .bind(memberId)
    .all<TimetableItem>();
  return c.json({ timetables: results });
});

app.post("/api/timetables", async (c) => {
  const body = (await c.req.json()) as Partial<TimetableItem>;
  if (!body.subject?.trim() || !body.day_of_week || !body.start_time || !body.end_time) {
    return c.json({ error: "day_of_week, start_time, end_time, and subject are required" }, 400);
  }
  const item: TimetableItem = {
    id: crypto.randomUUID(),
    member_id: body.member_id || HOUSEHOLD.childA.id,
    day_of_week: Number(body.day_of_week),
    week_parity: body.week_parity === "A" || body.week_parity === "B" ? body.week_parity : "ALL",
    start_time: body.start_time,
    end_time: body.end_time,
    subject: body.subject.trim(),
    location: body.location ?? "",
    note: body.note ?? "",
    active: 1,
  };
  await c.env.DB.prepare(
    `INSERT INTO timetables (id, member_id, day_of_week, week_parity, start_time, end_time, subject, location, note, active)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`
  )
    .bind(item.id, item.member_id, item.day_of_week, item.week_parity, item.start_time, item.end_time, item.subject, item.location, item.note)
    .run();
  return c.json({ timetable: item }, 201);
});

app.delete("/api/timetables/:id", async (c) => {
  await c.env.DB.prepare(`DELETE FROM timetables WHERE id = ?`).bind(c.req.param("id")).run();
  return c.json({ ok: true });
});

app.get("/api/links", async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT * FROM family_links ORDER BY sort_order ASC, created_at ASC`
  ).all<FamilyLink>();
  return c.json({ links: results });
});

app.post("/api/links", async (c) => {
  const body = (await c.req.json()) as Partial<FamilyLink>;
  if (!body.title?.trim() || !body.url?.trim()) {
    return c.json({ error: "title and url are required" }, 400);
  }
  const link: FamilyLink = {
    id: crypto.randomUUID(),
    title: body.title.trim(),
    url: body.url.trim(),
    category: body.category || "general",
    note: body.note ?? "",
    sort_order: Number(body.sort_order ?? 50),
  };
  await c.env.DB.prepare(
    `INSERT INTO family_links (id, title, url, category, note, sort_order) VALUES (?, ?, ?, ?, ?, ?)`
  )
    .bind(link.id, link.title, link.url, link.category, link.note, link.sort_order)
    .run();
  return c.json({ link }, 201);
});

app.delete("/api/links/:id", async (c) => {
  await c.env.DB.prepare(`DELETE FROM family_links WHERE id = ?`).bind(c.req.param("id")).run();
  return c.json({ ok: true });
});

app.get("/api/todos", async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT * FROM todos ORDER BY CASE status WHEN 'pending' THEN 0 WHEN 'proposed' THEN 1 ELSE 2 END, created_at DESC LIMIT 80`
  ).all<TodoItem>();
  return c.json({ todos: results });
});

app.post("/api/todos", async (c) => {
  const body = (await c.req.json()) as { raw_text?: string; author_id?: string };
  if (!body.raw_text?.trim()) return c.json({ error: "raw_text is required" }, 400);
  const id = crypto.randomUUID();
  const author = body.author_id === "partner_a" ? "partner_a" : "partner_b";
  await c.env.DB.prepare(
    `INSERT INTO todos (id, raw_text, author_id, status) VALUES (?, ?, ?, 'pending')`
  )
    .bind(id, body.raw_text.trim(), author)
    .run();
  const todo = await c.env.DB.prepare(`SELECT * FROM todos WHERE id = ?`).bind(id).first<TodoItem>();
  return c.json({ todo }, 201);
});

app.patch("/api/todos/:id", async (c) => {
  const id = c.req.param("id");
  const body = (await c.req.json()) as Partial<TodoItem>;
  const existing = await c.env.DB.prepare(`SELECT * FROM todos WHERE id = ?`).bind(id).first<TodoItem>();
  if (!existing) return c.json({ error: "Todo not found" }, 404);
  await c.env.DB.prepare(
    `UPDATE todos SET raw_text = ?, status = ?, updated_at = datetime('now') WHERE id = ?`
  )
    .bind((body.raw_text ?? existing.raw_text).trim(), body.status ?? existing.status, id)
    .run();
  return c.json({ ok: true });
});

app.delete("/api/todos/:id", async (c) => {
  await c.env.DB.prepare(`DELETE FROM todos WHERE id = ?`).bind(c.req.param("id")).run();
  return c.json({ ok: true });
});

app.get("/api/proposals", async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT * FROM ai_proposals WHERE status = 'pending' ORDER BY created_at ASC`
  ).all<AiProposal>();
  return c.json({ proposals: results });
});

app.post("/api/proposals/:id/confirm", async (c) => {
  const id = c.req.param("id");
  const proposal = await c.env.DB.prepare(`SELECT * FROM ai_proposals WHERE id = ?`)
    .bind(id)
    .first<AiProposal>();
  if (!proposal) return c.json({ error: "Proposal not found" }, 404);
  let overridePayload: Record<string, unknown> | undefined;
  try {
    const body = (await c.req.json()) as { payload?: Record<string, unknown> };
    if (body?.payload && typeof body.payload === "object") overridePayload = body.payload;
  } catch {
    // optional body
  }
  await applyProposal(c.env.DB, proposal, overridePayload);
  return c.json({ ok: true });
});

app.post("/api/proposals/confirm-all", async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT * FROM ai_proposals WHERE status = 'pending' AND kind != 'notice' ORDER BY created_at ASC`
  ).all<AiProposal>();
  let count = 0;
  for (const p of results) {
    await applyProposal(c.env.DB, p);
    count++;
  }
  return c.json({ ok: true, confirmed: count });
});

app.post("/api/proposals/:id/dismiss", async (c) => {
  await c.env.DB.prepare(
    `UPDATE ai_proposals SET status = 'dismissed', resolved_at = datetime('now') WHERE id = ?`
  )
    .bind(c.req.param("id"))
    .run();
  return c.json({ ok: true });
});

app.post("/api/ai/parse-schedule-image", async (c) => {
  const body = (await c.req.json()) as {
    image_base64?: string;
    mime_type?: string;
    hint_month?: string;
    extra_note?: string;
  };
  if (!body.image_base64) return c.json({ error: "image_base64 is required" }, 400);
  const result = await parseScheduleImage(c.env, {
    imageBase64: body.image_base64,
    mimeType: body.mime_type || "image/jpeg",
    hintMonth: body.hint_month,
    extraNote: body.extra_note,
  });
  return c.json(result);
});

app.post("/api/tempo/sync", async (c) => {
  const result = await syncEdfTempo(c.env.DB);
  const summary =
    result.updated.length > 0
      ? result.updated.map((u) => `${u.date}: ${u.color}`).join(" | ")
      : result.errors.join("; ") || "Tempo 暂无更新";
  await c.env.DB.prepare(
    `INSERT INTO ai_runs (id, run_type, status, summary) VALUES (?, 'manual_tempo', ?, ?)`
  )
    .bind(crypto.randomUUID(), result.errors.length > 0 && result.updated.length === 0 ? "error" : "ok", summary)
    .run();
  return c.json({ ...result, summary });
});

app.post("/api/ai/run", async (c) => {
  return c.json(await runAiOrganizer(c.env, "manual_ai"));
});

app.get("/api/ai/runs", async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT * FROM ai_runs ORDER BY created_at DESC LIMIT 20`
  ).all<AiRunLog>();
  return c.json({ runs: results });
});

app.get("/api/mails", async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT gmail_message_id, gmail_thread_id, sender, subject, snippet, gmail_url, received_at, matched_rule, ai_status, ai_summary
     FROM mail_inbox ORDER BY received_at DESC LIMIT 30`
  ).all<MailInboxItem>();
  return c.json({ mails: results });
});

app.post("/api/ingest/gmail", async (c) => {
  const secret = c.env.GMAIL_INGEST_SECRET;
  const authHeader = c.req.header("X-FamilyCal-Secret") || "";
  if (!secret || authHeader !== secret) return c.json({ error: "Unauthorized ingest secret" }, 401);
  const body = (await c.req.json()) as {
    messages?: Array<{
      gmail_message_id: string;
      gmail_thread_id?: string;
      sender: string;
      subject: string;
      snippet?: string;
      body_clean?: string;
      gmail_url?: string;
      received_at: string;
      matched_rule?: string;
    }>;
  };
  const messages = Array.isArray(body.messages) ? body.messages : [];
  let inserted = 0;
  for (const m of messages) {
    if (!m.gmail_message_id || !m.sender || !m.subject) continue;
    const res = await c.env.DB.prepare(
      `INSERT OR IGNORE INTO mail_inbox
        (gmail_message_id, gmail_thread_id, sender, subject, snippet, body_clean, gmail_url, received_at, matched_rule)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        m.gmail_message_id,
        m.gmail_thread_id ?? "",
        m.sender,
        m.subject,
        m.snippet ?? "",
        (m.body_clean ?? "").slice(0, 4000),
        m.gmail_url ?? "",
        m.received_at,
        m.matched_rule ?? ""
      )
      .run();
    if (res.meta.changes > 0) inserted++;
  }
  return c.json({ received: messages.length, inserted });
});

export default {
  fetch: app.fetch,
  async scheduled(controller: ScheduledController, env: Env, _ctx: ExecutionContext) {
    if (controller.cron === "30 10 * * *") {
      const result = await syncEdfTempo(env.DB);
      const summary =
        result.updated.map((u) => `${u.date}: ${u.color}`).join(" | ") ||
        result.errors.join("; ") ||
        "Tempo auto-check done";
      await env.DB.prepare(
        `INSERT INTO ai_runs (id, run_type, status, summary) VALUES (?, 'cron_tempo', ?, ?)`
      )
        .bind(crypto.randomUUID(), result.updated.length > 0 ? "ok" : "error", summary)
        .run();
    } else {
      await syncEdfTempo(env.DB);
      await runAiOrganizer(env, "cron_ai");
    }
  },
};
