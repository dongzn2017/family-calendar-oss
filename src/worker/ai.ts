import { HOUSEHOLD } from "../shared/household";
import type { CalendarEvent, TodoItem } from "../shared/types";

export interface AiEnv {
  DB: D1Database;
  GEMINI_API_KEY?: string;
  GEMINI_MODEL?: string;
  APP_TIMEZONE?: string;
  DEMO_AI_MODE?: string;
}

interface RawGeminiProposal {
  kind: "event" | "daily_status" | "notice";
  source_type: "todo" | "gmail" | "schedule_image";
  source_id: string;
  summary: string;
  confidence?: "high" | "medium" | "low";
  payload: Record<string, unknown>;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchGeminiWithRetry(endpoint: string, payload: unknown): Promise<Response> {
  const delays = [0, 1500, 3000];
  let lastRes: Response | null = null;
  for (let i = 0; i < delays.length; i++) {
    if (delays[i] > 0) await sleep(delays[i]);
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    lastRes = res;
    if (res.status !== 503 && res.status !== 429) {
      return res;
    }
  }
  return lastRes!;
}

export function getLocalToday(tz = HOUSEHOLD.timezone): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const y = parts.find((p) => p.type === "year")?.value ?? "2026";
  const m = parts.find((p) => p.type === "month")?.value ?? "01";
  const d = parts.find((p) => p.type === "day")?.value ?? "01";
  return `${y}-${m}-${d}`;
}

function addDays(baseIso: string, delta: number): string {
  const dt = new Date(`${baseIso}T00:00:00Z`);
  dt.setUTCDate(dt.getUTCDate() + delta);
  return dt.toISOString().slice(0, 10);
}

/**
 * Offline Demo AI simulator so anyone running the open-source repo locally
 * without a GEMINI_API_KEY can still experience the full human-in-the-loop AI flow.
 */
async function runDemoAiFallback(
  env: AiEnv,
  pendingTodos: TodoItem[],
  runType: "cron_ai" | "manual_ai"
) {
  const today = getLocalToday(env.APP_TIMEZONE);
  let created = 0;

  for (let idx = 0; idx < pendingTodos.length; idx++) {
    const todo = pendingTodos[idx];
    const lower = todo.raw_text.toLowerCase();
    const hoursMatch = todo.raw_text.match(/(\d{1,2}[:h]\d{2})\s*[-–]\s*(\d{1,2}[:h]\d{2})/i);
    const targetDate = addDays(today, 2 + idx);

    if (
      hoursMatch ||
      lower.includes(HOUSEHOLD.partnerB.name.toLowerCase()) ||
      lower.includes("shift") ||
      lower.includes("上班") ||
      lower.includes("repos")
    ) {
      const hours = hoursMatch
        ? `${hoursMatch[1].replace("h", ":")}-${hoursMatch[2].replace("h", ":")}`
        : "09:30-17:30";
      const isOff = lower.includes("repos") || lower.includes("休息");
      await env.DB.prepare(
        `INSERT INTO ai_proposals (id, kind, source_type, source_id, summary, payload_json, confidence, status)
         VALUES (?, 'daily_status', 'todo', ?, ?, ?, 'high', 'pending')`
      )
        .bind(
          crypto.randomUUID(),
          todo.id,
          `[Demo AI] ${targetDate} · ${HOUSEHOLD.partnerB.name} ${isOff ? "Repos 休息" : `上班 ${hours}`}`,
          JSON.stringify({
            date: targetDate,
            partner_b_status: isOff ? "off" : "work",
            partner_b_hours: isOff ? "" : hours,
            partner_b_note: todo.raw_text.slice(0, 60),
          })
        )
        .run();
      created++;
    } else {
      const isPayment = lower.includes("pay") || lower.includes("bill") || lower.includes("交") || lower.includes("缴");
      await env.DB.prepare(
        `INSERT INTO ai_proposals (id, kind, source_type, source_id, summary, payload_json, confidence, status)
         VALUES (?, 'event', 'todo', ?, ?, ?, 'medium', 'pending')`
      )
        .bind(
          crypto.randomUUID(),
          todo.id,
          `[Demo AI] ${targetDate} · ${todo.raw_text.slice(0, 65)}`,
          JSON.stringify({
            title: todo.raw_text.slice(0, 65),
            description: `Parsed in offline Demo AI mode from todo:\n${todo.raw_text}`,
            event_type: isPayment ? "payment" : "deadline",
            start_date: targetDate,
            end_date: targetDate,
            start_time: lower.includes("10:00") ? "10:00" : "",
            end_time: "",
            all_day: !lower.includes("10:00"),
            location: "",
            member_id: todo.author_id === "partner_b" ? "partner_b" : "family",
            booking_status: isPayment ? "none" : "to_book",
            remind_days_before: 7,
          })
        )
        .run();
      created++;
    }

    await env.DB.prepare(
      `UPDATE todos SET status = 'proposed', ai_note = 'Demo AI 已生成待确认建议', updated_at = datetime('now') WHERE id = ?`
    )
      .bind(todo.id)
      .run();
  }

  const summary = `Demo AI 模式（未填 GEMINI_API_KEY）：已模拟解析 ${pendingTodos.length} 条待办，生成 ${created} 条待确认建议`;
  await logRun(env.DB, runType, "ok", pendingTodos.length, 0, created, summary);
  return {
    status: "ok" as const,
    todos_scanned: pendingTodos.length,
    mails_scanned: 0,
    proposals_created: created,
    summary,
  };
}

export async function runAiOrganizer(
  env: AiEnv,
  runType: "cron_ai" | "manual_ai"
): Promise<{
  status: "ok" | "skipped" | "error";
  todos_scanned: number;
  mails_scanned: number;
  proposals_created: number;
  summary: string;
}> {
  const pendingTodos = (
    await env.DB.prepare(
      `SELECT * FROM todos WHERE status = 'pending' ORDER BY created_at ASC LIMIT 30`
    ).all<TodoItem>()
  ).results;

  const pendingMails = (
    await env.DB.prepare(
      `SELECT gmail_message_id, sender, subject, snippet, body_clean, received_at, gmail_url, matched_rule
       FROM mail_inbox WHERE ai_status = 'pending' ORDER BY received_at ASC LIMIT 20`
    ).all<{
      gmail_message_id: string;
      sender: string;
      subject: string;
      snippet: string;
      body_clean: string;
      received_at: string;
      gmail_url: string;
      matched_rule: string;
    }>()
  ).results;

  if (pendingTodos.length === 0 && pendingMails.length === 0) {
    const summary = "没有待处理的待办或邮件 / Nothing pending to organize";
    await logRun(env.DB, runType, "skipped", 0, 0, 0, summary);
    return { status: "skipped", todos_scanned: 0, mails_scanned: 0, proposals_created: 0, summary };
  }

  if (!env.GEMINI_API_KEY) {
    if (env.DEMO_AI_MODE === "true" && pendingTodos.length > 0) {
      return runDemoAiFallback(env, pendingTodos, runType);
    }
    const summary =
      "尚未配置 GEMINI_API_KEY（本地请在 .dev.vars 填入 Key，或保持 DEMO_AI_MODE=true 体验模拟解析）";
    await logRun(env.DB, runType, "skipped", pendingTodos.length, pendingMails.length, 0, summary);
    return {
      status: "skipped",
      todos_scanned: pendingTodos.length,
      mails_scanned: pendingMails.length,
      proposals_created: 0,
      summary,
    };
  }

  const today = getLocalToday(env.APP_TIMEZONE);
  const upcomingEvents = (
    await env.DB.prepare(
      `SELECT id, title, event_type, start_date, end_date, member_id, booking_status
       FROM events WHERE end_date >= ? ORDER BY start_date ASC LIMIT 40`
    )
      .bind(today)
      .all<Partial<CalendarEvent>>()
  ).results;

  const prompt = `You are a family calendar assistant (timezone ${env.APP_TIMEZONE || HOUSEHOLD.timezone}).
Today is ${today}.
Household members:
- partner_a: ${HOUSEHOLD.partnerA.name} (adult)
- partner_b: ${HOUSEHOLD.partnerB.name} (adult, irregular shift schedule)
- child_a: ${HOUSEHOLD.childA.name} (child)
- child_b: ${HOUSEHOLD.childB.name} (child)
- family (shared)

Task: Read pending todos and selected emails and produce structured proposals for manual human confirmation.
Return STRICT JSON ONLY:
{
  "proposals": [
    {
      "kind": "event" | "daily_status" | "notice",
      "source_type": "todo" | "gmail",
      "source_id": "<exact id>",
      "summary": "<concise summary>",
      "confidence": "high" | "medium" | "low",
      "payload": { ... }
    }
  ]
}

Schemas:
1) kind === "daily_status":
{ "date": "YYYY-MM-DD", "partner_b_status": "work|off|leave|unset", "partner_b_hours": "HH:MM-HH:MM", "partner_b_note": "", "partner_a_status": "work|remote|leave|travel|off|unset", "partner_a_note": "", "school_status": "normal|strike|partial_strike|holiday", "school_note": "" }
2) kind === "event":
{ "title": "", "description": "", "event_type": "outing|deadline|payment|exam|general", "start_date": "YYYY-MM-DD", "end_date": "YYYY-MM-DD", "start_time": "HH:MM", "end_time": "HH:MM", "all_day": true, "location": "", "member_id": "partner_a|partner_b|child_a|child_b|family", "booking_status": "none|planned|to_book|booked|cancelled", "remind_days_before": 7 }
3) kind === "notice" (for city-wide alerts that need manual verification):
{ "date": "YYYY-MM-DD", "note": "..." }

Existing upcoming events:
${JSON.stringify(upcomingEvents)}

Pending todos:
${JSON.stringify(pendingTodos.map((t) => ({ id: t.id, author: t.author_id, text: t.raw_text, created_at: t.created_at })))}

Pending emails:
${JSON.stringify(pendingMails.map((m) => ({ id: m.gmail_message_id, from: m.sender, rule: m.matched_rule, subject: m.subject, received_at: m.received_at, body: m.body_clean.slice(0, 1800) })))}`;

  const model = env.GEMINI_MODEL || "gemini-3.8-flash";
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(env.GEMINI_API_KEY)}`;

  try {
    const res = await fetchGeminiWithRetry(endpoint, {
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.1, responseMimeType: "application/json" },
    });

    if (!res.ok) {
      const errText = await res.text();
      const summary =
        res.status === 503 || res.status === 429
          ? `Google Gemini 高峰拥堵 (HTTP ${res.status}，已自动重试 3 次)，请稍后再试`
          : `Gemini API 调用失败 (HTTP ${res.status}): ${errText.slice(0, 500)}`;
      await logRun(env.DB, runType, "error", pendingTodos.length, pendingMails.length, 0, summary);
      return { status: "error", todos_scanned: pendingTodos.length, mails_scanned: pendingMails.length, proposals_created: 0, summary };
    }

    const body = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const rawText = body.candidates?.[0]?.content?.parts?.[0]?.text ?? '{"proposals":[]}';
    const parsed = JSON.parse(rawText) as { proposals?: RawGeminiProposal[] };
    const proposals = Array.isArray(parsed.proposals) ? parsed.proposals : [];

    let created = 0;
    const touchedTodoIds = new Set<string>();
    const touchedMailIds = new Set<string>();

    for (const p of proposals) {
      if (!p || !["event", "daily_status", "notice"].includes(p.kind) || !p.payload) continue;
      await env.DB.prepare(
        `INSERT INTO ai_proposals (id, kind, source_type, source_id, summary, payload_json, confidence, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')`
      )
        .bind(
          crypto.randomUUID(),
          p.kind,
          p.source_type === "gmail" ? "gmail" : "todo",
          String(p.source_id || ""),
          String(p.summary || "AI Proposal"),
          JSON.stringify(p.payload),
          p.confidence === "high" || p.confidence === "low" ? p.confidence : "medium"
        )
        .run();
      created++;
      if (p.source_type === "gmail" && p.source_id) touchedMailIds.add(p.source_id);
      else if (p.source_id) touchedTodoIds.add(p.source_id);
    }

    for (const todoId of touchedTodoIds) {
      await env.DB.prepare(
        `UPDATE todos SET status = 'proposed', ai_note = '已生成待确认建议', updated_at = datetime('now') WHERE id = ?`
      )
        .bind(todoId)
        .run();
    }

    for (const mail of pendingMails) {
      const nextStatus = touchedMailIds.has(mail.gmail_message_id) ? "proposed" : "ignored";
      await env.DB.prepare(
        `UPDATE mail_inbox SET ai_status = ?, processed_at = datetime('now') WHERE gmail_message_id = ?`
      )
        .bind(nextStatus, mail.gmail_message_id)
        .run();
    }

    const summary = `扫描 ${pendingTodos.length} 条待办、${pendingMails.length} 封邮件，生成 ${created} 条待确认建议`;
    await logRun(env.DB, runType, "ok", pendingTodos.length, pendingMails.length, created, summary);
    return { status: "ok", todos_scanned: pendingTodos.length, mails_scanned: pendingMails.length, proposals_created: created, summary };
  } catch (err) {
    const summary = `AI 解析异常: ${err instanceof Error ? err.message : String(err)}`;
    await logRun(env.DB, runType, "error", pendingTodos.length, pendingMails.length, 0, summary);
    return { status: "error", todos_scanned: pendingTodos.length, mails_scanned: pendingMails.length, proposals_created: 0, summary };
  }
}

export async function parseScheduleImage(
  env: AiEnv,
  input: { imageBase64: string; mimeType: string; hintMonth?: string; extraNote?: string }
): Promise<{ status: "ok" | "skipped" | "error"; proposals_created: number; summary: string }> {
  const today = getLocalToday(env.APP_TIMEZONE);

  if (!env.GEMINI_API_KEY) {
    if (env.DEMO_AI_MODE === "true") {
      // Offline demo vision preview so OSS visitors can test the image upload modal without an API key
      const batchId = `demo-img-${Date.now()}`;
      const sample = [
        { date: addDays(today, 3), status: "work", hours: "09:45-17:45", note: "Demo parsed shift" },
        { date: addDays(today, 4), status: "off", hours: "", note: "Repos" },
      ];
      for (const s of sample) {
        await env.DB.prepare(
          `INSERT INTO ai_proposals (id, kind, source_type, source_id, summary, payload_json, confidence, status)
           VALUES (?, 'daily_status', 'schedule_image', ?, ?, ?, 'high', 'pending')`
        )
          .bind(
            crypto.randomUUID(),
            batchId,
            `[Demo 识图] ${s.date} ${HOUSEHOLD.partnerB.name} ${s.status === "work" ? `上班 ${s.hours}` : "休息 Repos"}`,
            JSON.stringify({
              date: s.date,
              partner_b_status: s.status,
              partner_b_hours: s.hours,
              partner_b_note: s.note,
            })
          )
          .run();
      }
      const summary = `Demo 模式模拟识图：已生成 ${sample.length} 条 ${HOUSEHOLD.partnerB.name} 排班待确认建议（填入 GEMINI_API_KEY 即可启用真实看图识表）`;
      await logRun(env.DB, "schedule_image", "ok", 0, 0, sample.length, summary);
      return { status: "ok", proposals_created: sample.length, summary };
    }
    const summary = "尚未配置 GEMINI_API_KEY，请在 .dev.vars 或 Worker Secret 填入 Key";
    await logRun(env.DB, "schedule_image", "skipped", 0, 0, 0, summary);
    return { status: "skipped", proposals_created: 0, summary };
  }

  const model = env.GEMINI_MODEL || "gemini-3.8-flash";
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(env.GEMINI_API_KEY)}`;

  const prompt = `Read this photo or screenshot of ${HOUSEHOLD.partnerB.name}'s work schedule.
Today is ${today}.
${input.hintMonth ? `Reference year-month: ${input.hintMonth}.` : ""}
${input.extraNote ? `User hint: ${input.extraNote}` : ""}

Return STRICT JSON ONLY:
{
  "days": [
    {
      "date": "YYYY-MM-DD",
      "partner_b_status": "work" | "off" | "leave",
      "partner_b_hours": "HH:MM-HH:MM" (empty if off/leave),
      "partner_b_note": "<shift label or note>",
      "confidence": "high" | "medium" | "low"
    }
  ]
}`;

  try {
    const cleanBase64 = input.imageBase64.replace(/^data:[^;]+;base64,/, "");
    const res = await fetchGeminiWithRetry(endpoint, {
      contents: [
        {
          role: "user",
          parts: [
            { text: prompt },
            { inline_data: { mime_type: input.mimeType || "image/jpeg", data: cleanBase64 } },
          ],
        },
      ],
      generationConfig: { temperature: 0.1, responseMimeType: "application/json" },
    });

    if (!res.ok) {
      const errText = await res.text();
      const summary =
        res.status === 503 || res.status === 429
          ? `Google Gemini 高峰拥堵 (HTTP ${res.status}，已自动重试 3 次)，请稍后再传`
          : `Gemini 看图识班表失败 (HTTP ${res.status}): ${errText.slice(0, 500)}`;
      await logRun(env.DB, "schedule_image", "error", 0, 0, 0, summary);
      return { status: "error", proposals_created: 0, summary };
    }

    const body = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const rawText = body.candidates?.[0]?.content?.parts?.[0]?.text ?? '{"days":[]}';
    const parsed = JSON.parse(rawText) as {
      days?: Array<{
        date?: string;
        partner_b_status?: string;
        partner_b_hours?: string;
        partner_b_note?: string;
        confidence?: "high" | "medium" | "low";
      }>;
    };

    const days = Array.isArray(parsed.days) ? parsed.days : [];
    const batchId = `img-${Date.now()}`;
    let created = 0;

    for (const d of days) {
      if (!d.date || !/^\d{4}-\d{2}-\d{2}$/.test(d.date)) continue;
      const st =
        d.partner_b_status === "work" || d.partner_b_status === "off" || d.partner_b_status === "leave"
          ? d.partner_b_status
          : "work";
      const hours = st === "work" ? String(d.partner_b_hours ?? "") : "";
      const note = String(d.partner_b_note ?? "");
      const statusLabel =
        st === "work" ? `上班 ${hours || "(未注明时段)"}` : st === "off" ? "休息 Repos" : "请假 Congé";

      await env.DB.prepare(
        `INSERT INTO ai_proposals (id, kind, source_type, source_id, summary, payload_json, confidence, status)
         VALUES (?, 'daily_status', 'schedule_image', ?, ?, ?, ?, 'pending')`
      )
        .bind(
          crypto.randomUUID(),
          batchId,
          `${d.date} ${HOUSEHOLD.partnerB.name} ${statusLabel}${note ? ` · ${note}` : ""}`,
          JSON.stringify({
            date: d.date,
            partner_b_status: st,
            partner_b_hours: hours,
            partner_b_note: note,
          }),
          d.confidence === "high" || d.confidence === "low" ? d.confidence : "medium"
        )
        .run();
      created++;
    }

    const summary =
      created > 0
        ? `从班表图片识别出 ${created} 天 ${HOUSEHOLD.partnerB.name} 排班，已加入待确认队列`
        : "未能识别出明确日期和排班，请尝试更清晰截图";
    await logRun(env.DB, "schedule_image", created > 0 ? "ok" : "skipped", 0, 0, created, summary);
    return { status: created > 0 ? "ok" : "skipped", proposals_created: created, summary };
  } catch (err) {
    const summary = `班表图片识别异常: ${err instanceof Error ? err.message : String(err)}`;
    await logRun(env.DB, "schedule_image", "error", 0, 0, 0, summary);
    return { status: "error", proposals_created: 0, summary };
  }
}

async function logRun(
  db: D1Database,
  runType: string,
  status: "ok" | "skipped" | "error",
  todosScanned: number,
  mailsScanned: number,
  proposalsCreated: number,
  summary: string
) {
  await db
    .prepare(
      `INSERT INTO ai_runs (id, run_type, status, todos_scanned, mails_scanned, proposals_created, summary)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(crypto.randomUUID(), runType, status, todosScanned, mailsScanned, proposalsCreated, summary)
    .run();
}
