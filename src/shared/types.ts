export type MemberRole = "adult" | "child" | "shared";

export interface Member {
  id: string;
  name: string;
  role: MemberRole;
  color: string;
  can_login: number;
  email: string | null;
  sort_order: number;
}

export type PartnerBStatus = "unset" | "work" | "off" | "leave";
export type PartnerAStatus = "unset" | "work" | "remote" | "leave" | "travel" | "off";
export type TempoColor = "UNKNOWN" | "BLEU" | "BLANC" | "ROUGE";
export type SchoolStatus = "normal" | "strike" | "partial_strike" | "holiday";

export interface DailyStatus {
  date: string; // YYYY-MM-DD
  partner_b_status: PartnerBStatus;
  partner_b_hours: string;
  partner_b_note: string;
  partner_a_status: PartnerAStatus;
  partner_a_note: string;
  tempo_color: TempoColor;
  tempo_source: "auto" | "manual";
  school_status: SchoolStatus;
  school_note: string;
  day_note: string;
  updated_at?: string;
}

export type EventType = "outing" | "deadline" | "payment" | "exam" | "general";
export type BookingStatus = "none" | "planned" | "to_book" | "booked" | "cancelled";

export interface CalendarEvent {
  id: string;
  title: string;
  description: string;
  event_type: EventType;
  start_date: string;
  end_date: string;
  start_time: string;
  end_time: string;
  all_day: number;
  location: string;
  url?: string;
  member_id: string;
  booking_status: BookingStatus;
  remind_days_before: number;
  is_done: number;
  source: "manual" | "todo_ai" | "gmail_ai";
  source_ref: string;
  created_at?: string;
  updated_at?: string;
}

export type WeekParity = "ALL" | "A" | "B";

export interface TimetableItem {
  id: string;
  member_id: string;
  day_of_week: number; // 1=Mon .. 7=Sun
  week_parity: WeekParity;
  start_time: string;
  end_time: string;
  subject: string;
  location: string;
  note: string;
  active: number;
}

export interface FamilyLink {
  id: string;
  title: string;
  url: string;
  category: string;
  note: string;
  sort_order: number;
}

export type TodoStatus = "pending" | "proposed" | "scheduled" | "done" | "dismissed";

export interface TodoItem {
  id: string;
  raw_text: string;
  author_id: string;
  status: TodoStatus;
  ai_note: string;
  linked_event_id: string;
  created_at: string;
  updated_at: string;
}

export interface MailInboxItem {
  gmail_message_id: string;
  gmail_thread_id: string;
  sender: string;
  subject: string;
  snippet: string;
  gmail_url: string;
  received_at: string;
  matched_rule: string;
  ai_status: string;
  ai_summary: string;
}

export interface AiProposal {
  id: string;
  kind: "event" | "daily_status" | "notice";
  source_type: "todo" | "gmail" | "schedule_image";
  source_id: string;
  summary: string;
  payload_json: string;
  confidence: "high" | "medium" | "low";
  status: "pending" | "confirmed" | "dismissed";
  created_at: string;
  resolved_at: string;
}

export interface AiRunLog {
  id: string;
  run_type: string;
  status: "ok" | "skipped" | "error";
  todos_scanned: number;
  mails_scanned: number;
  proposals_created: number;
  summary: string;
  created_at: string;
}

export interface OverviewAlertItem {
  kind: "tempo" | "strike" | "event";
  severity: "danger" | "warning" | "info";
  date: string;
  days_left: number;
  title: string;
  subtitle: string;
  ref_id: string;
  event?: CalendarEvent;
}
