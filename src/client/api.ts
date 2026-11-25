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

async function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }
  return (await res.json()) as T;
}

export const api = {
  health: () =>
    apiFetch<{
      ok: boolean;
      today: string;
      timezone: string;
      gemini_configured: boolean;
      demo_ai_mode: boolean;
      gemini_model: string;
    }>("/api/health"),

  getMembers: () => apiFetch<{ members: Member[] }>("/api/members"),

  getCalendar: (start: string, end: string) =>
    apiFetch<{ daily_status: DailyStatus[]; events: CalendarEvent[] }>(
      `/api/calendar?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`
    ),

  getAlerts: () => apiFetch<{ today: string; alerts: OverviewAlertItem[] }>("/api/alerts"),

  upsertDailyStatus: (date: string, patch: Partial<DailyStatus>) =>
    apiFetch<{ daily_status: DailyStatus }>(`/api/daily-status/${date}`, {
      method: "PUT",
      body: JSON.stringify(patch),
    }),

  createEvent: (evt: Partial<CalendarEvent>) =>
    apiFetch<{ event: CalendarEvent }>("/api/events", {
      method: "POST",
      body: JSON.stringify(evt),
    }),

  createEventsBatch: (events: Array<Partial<CalendarEvent>>) =>
    apiFetch<{ ok: boolean; created: number }>("/api/events/batch", {
      method: "POST",
      body: JSON.stringify({ events }),
    }),

  updateEvent: (id: string, patch: Partial<CalendarEvent>) =>
    apiFetch<{ event: CalendarEvent }>(`/api/events/${id}`, {
      method: "PUT",
      body: JSON.stringify(patch),
    }),

  deleteEvent: (id: string) =>
    apiFetch<{ ok: boolean }>(`/api/events/${id}`, { method: "DELETE" }),

  getTimetables: (memberId = "child_a") =>
    apiFetch<{ timetables: TimetableItem[] }>(`/api/timetables?member_id=${memberId}`),

  createTimetable: (item: Partial<TimetableItem>) =>
    apiFetch<{ timetable: TimetableItem }>("/api/timetables", {
      method: "POST",
      body: JSON.stringify(item),
    }),

  deleteTimetable: (id: string) =>
    apiFetch<{ ok: boolean }>(`/api/timetables/${id}`, { method: "DELETE" }),

  getTodos: () => apiFetch<{ todos: TodoItem[] }>("/api/todos"),

  createTodo: (raw_text: string, author_id: string) =>
    apiFetch<{ todo: TodoItem }>("/api/todos", {
      method: "POST",
      body: JSON.stringify({ raw_text, author_id }),
    }),

  updateTodo: (id: string, patch: Partial<TodoItem>) =>
    apiFetch<{ ok: boolean }>(`/api/todos/${id}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    }),

  deleteTodo: (id: string) =>
    apiFetch<{ ok: boolean }>(`/api/todos/${id}`, { method: "DELETE" }),

  getProposals: () => apiFetch<{ proposals: AiProposal[] }>("/api/proposals"),

  confirmProposal: (id: string, payload?: Record<string, unknown>) =>
    apiFetch<{ ok: boolean }>(`/api/proposals/${id}/confirm`, {
      method: "POST",
      body: JSON.stringify(payload ? { payload } : {}),
    }),

  confirmAllProposals: () =>
    apiFetch<{ ok: boolean; confirmed: number }>("/api/proposals/confirm-all", {
      method: "POST",
    }),

  dismissProposal: (id: string) =>
    apiFetch<{ ok: boolean }>(`/api/proposals/${id}/dismiss`, { method: "POST" }),

  parseScheduleImage: (input: {
    image_base64: string;
    mime_type: string;
    hint_month?: string;
    extra_note?: string;
  }) =>
    apiFetch<{ status: string; proposals_created: number; summary: string }>(
      "/api/ai/parse-schedule-image",
      { method: "POST", body: JSON.stringify(input) }
    ),

  syncTempo: () =>
    apiFetch<{ updated: Array<{ date: string; color: string }>; errors: string[]; summary: string }>(
      "/api/tempo/sync",
      { method: "POST" }
    ),

  runAi: () =>
    apiFetch<{
      status: string;
      todos_scanned: number;
      mails_scanned: number;
      proposals_created: number;
      summary: string;
    }>("/api/ai/run", { method: "POST" }),

  getAiRuns: () => apiFetch<{ runs: AiRunLog[] }>("/api/ai/runs"),
  getMails: () => apiFetch<{ mails: MailInboxItem[] }>("/api/mails"),
  getLinks: () => apiFetch<{ links: FamilyLink[] }>("/api/links"),

  createLink: (item: Partial<FamilyLink>) =>
    apiFetch<{ link: FamilyLink }>("/api/links", {
      method: "POST",
      body: JSON.stringify(item),
    }),

  deleteLink: (id: string) =>
    apiFetch<{ ok: boolean }>(`/api/links/${id}`, { method: "DELETE" }),
};
