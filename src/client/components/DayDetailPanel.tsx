import { useEffect, useState } from "react";
import { BookOpen, Check, ChevronDown, ChevronRight, ExternalLink, Plus, Save, Trash2 } from "lucide-react";
import { HOUSEHOLD } from "../../shared/household";
import type { SchoolWeekInfo } from "../../shared/schoolCalendar";
import type {
  CalendarEvent,
  DailyStatus,
  Member,
  PartnerAStatus,
  PartnerBStatus,
  SchoolStatus,
  TempoColor,
  TimetableItem,
} from "../../shared/types";

interface Props {
  date: string;
  status: DailyStatus;
  schoolInfo: SchoolWeekInfo;
  dayEvents: CalendarEvent[];
  childDayClasses: TimetableItem[];
  membersMap: Record<string, Member>;
  onSaveStatus: (date: string, patch: Partial<DailyStatus>) => Promise<void>;
  onAddEventForDate: (date: string) => void;
  onEditEvent: (evt: CalendarEvent) => void;
  onToggleDone: (evt: CalendarEvent) => void;
  onDeleteEvent: (id: string) => void;
}

const BOOKING_LABEL: Record<string, string> = {
  none: "",
  planned: "计划中 / Planned",
  to_book: "待预定 / To book",
  booked: "已预定 ✓ / Booked",
  cancelled: "已取消",
};

export function DayDetailPanel({
  date,
  status,
  schoolInfo,
  dayEvents,
  childDayClasses,
  membersMap,
  onSaveStatus,
  onAddEventForDate,
  onEditEvent,
  onToggleDone,
  onDeleteEvent,
}: Props) {
  const [draft, setDraft] = useState<DailyStatus>(status);
  const [saving, setSaving] = useState(false);
  const [showTimetableToday, setShowTimetableToday] = useState(false);

  useEffect(() => {
    setDraft(status);
  }, [status, date]);

  async function handleSave() {
    setSaving(true);
    try {
      await onSaveStatus(date, draft);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card">
      <div className="card-header">
        <div className="card-title">📅 {date} 当日详情</div>
        <button className="btn btn-sm btn-primary" onClick={() => onAddEventForDate(date)}>
          <Plus size={13} /> 加日程
        </button>
      </div>

      <div className="card-body">
        <div className="field">
          <label>{HOUSEHOLD.partnerB.name} 排班与时间 / Shift Schedule</label>
          <div className="segmented">
            {(
              [
                ["work", "上班 Work"],
                ["off", "休息 Repos"],
                ["leave", "请假 Leave"],
                ["unset", "未排班"],
              ] as Array<[PartnerBStatus, string]>
            ).map(([val, label]) => (
              <button
                key={val}
                type="button"
                className={`seg-btn ${draft.partner_b_status === val ? "active-partner-b" : ""}`}
                onClick={() => setDraft((p) => ({ ...p, partner_b_status: val }))}
              >
                {label}
              </button>
            ))}
          </div>

          {draft.partner_b_status === "work" && (
            <div style={{ marginTop: 6 }}>
              <input
                className="input"
                placeholder="具体上班时间，如 09:45-17:45"
                value={draft.partner_b_hours}
                onChange={(e) => setDraft((p) => ({ ...p, partner_b_hours: e.target.value }))}
              />
              <div className="preset-row">
                {HOUSEHOLD.partnerB.shiftPresets.map((t) => (
                  <button
                    key={t}
                    type="button"
                    className="preset-chip"
                    onClick={() => setDraft((p) => ({ ...p, partner_b_hours: t }))}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          )}
          <input
            className="input"
            style={{ marginTop: 6 }}
            placeholder={`${HOUSEHOLD.partnerB.name} 备注（选填）`}
            value={draft.partner_b_note}
            onChange={(e) => setDraft((p) => ({ ...p, partner_b_note: e.target.value }))}
          />
        </div>

        <div className="field">
          <label>{HOUSEHOLD.partnerA.name} 状态</label>
          <div className="segmented">
            {(
              [
                ["unset", "常规"],
                ["work", "上班"],
                ["remote", "居家 WFH"],
                ["leave", "请假"],
                ["travel", "出差"],
                ["off", "休息"],
              ] as Array<[PartnerAStatus, string]>
            ).map(([val, label]) => (
              <button
                key={val}
                type="button"
                className={`seg-btn ${draft.partner_a_status === val ? "active" : ""}`}
                onClick={() => setDraft((p) => ({ ...p, partner_a_status: val }))}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <label>{HOUSEHOLD.childB.schoolLabel}</label>
          <div className="segmented">
            {(
              [
                ["normal", "正常"],
                ["strike", "罢工 Strike"],
                ["partial_strike", "部分罢工/无食堂"],
                ["holiday", "假期"],
              ] as Array<[SchoolStatus, string]>
            ).map(([val, label]) => (
              <button
                key={val}
                type="button"
                className={`seg-btn ${
                  draft.school_status === val
                    ? val === "strike" || val === "partial_strike"
                      ? "active-danger"
                      : "active"
                    : ""
                }`}
                onClick={() => setDraft((p) => ({ ...p, school_status: val }))}
              >
                {label}
              </button>
            ))}
          </div>
          {draft.school_status !== "normal" && (
            <input
              className="input"
              style={{ marginTop: 6 }}
              placeholder="备注：如仅食堂罢工 / 需自备午餐"
              value={draft.school_note}
              onChange={(e) => setDraft((p) => ({ ...p, school_note: e.target.value }))}
            />
          )}
        </div>

        <div className="field">
          <label>EDF Tempo（蓝日静默，白/红日自动预警）</label>
          <div className="segmented">
            {(["UNKNOWN", "BLEU", "BLANC", "ROUGE"] as TempoColor[]).map((col) => (
              <button
                key={col}
                type="button"
                className={`seg-btn ${
                  draft.tempo_color === col ? (col === "ROUGE" ? "active-danger" : "active") : ""
                }`}
                onClick={() => setDraft((p) => ({ ...p, tempo_color: col, tempo_source: "manual" }))}
              >
                {col === "UNKNOWN" ? "未公布" : col}
              </button>
            ))}
          </div>
        </div>

        <button
          className="btn btn-primary"
          style={{ width: "100%", justifyContent: "center" }}
          onClick={handleSave}
          disabled={saving}
        >
          <Save size={14} /> {saving ? "保存中..." : "保存当日状态 / Save"}
        </button>

        <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid var(--border)" }}>
          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8 }}>
            当日日程与 Deadline ({dayEvents.length})
          </div>
          {dayEvents.length === 0 ? (
            <div className="muted">这一天还没有安排，点右上角“+ 加日程”。</div>
          ) : (
            dayEvents.map((evt) => {
              const member = membersMap[evt.member_id];
              return (
                <div
                  key={evt.id}
                  className={`detail-event-card ${evt.is_done ? "is-done" : ""}`}
                  style={{ borderLeftColor: member?.color || "var(--accent)" }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 6 }}>
                    <div
                      style={{
                        fontWeight: 700,
                        cursor: "pointer",
                        textDecoration: evt.is_done ? "line-through" : "none",
                      }}
                      onClick={() => onEditEvent(evt)}
                    >
                      {evt.title}
                    </div>
                    <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                      <button className="btn btn-sm" title="切换完成状态" onClick={() => onToggleDone(evt)}>
                        <Check size={12} />
                      </button>
                      <button
                        className="btn btn-sm btn-danger"
                        title="删除"
                        onClick={() => onDeleteEvent(evt.id)}
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                  <div className="muted" style={{ marginTop: 3, display: "flex", flexWrap: "wrap", gap: 6 }}>
                    <span>{member?.name || evt.member_id}</span>
                    {evt.start_time && (
                      <span className="tabular">
                        {evt.start_time}
                        {evt.end_time ? `-${evt.end_time}` : ""}
                      </span>
                    )}
                    {evt.location && <span>📍 {evt.location}</span>}
                    {evt.booking_status !== "none" && (
                      <span className={`badge badge-${evt.booking_status}`}>
                        {BOOKING_LABEL[evt.booking_status]}
                      </span>
                    )}
                  </div>
                  {evt.description && (
                    <div className="mail-excerpt-box">
                      {evt.source === "gmail_ai" && (
                        <div style={{ fontWeight: 700, fontSize: 11, color: "var(--accent)", marginBottom: 2 }}>
                          📧 邮件摘录 / Email Summary
                        </div>
                      )}
                      {evt.description}
                    </div>
                  )}
                  {evt.url && (
                    <div style={{ marginTop: 5 }}>
                      <a
                        href={evt.url}
                        target="_blank"
                        rel="noreferrer"
                        style={{
                          fontSize: 11.5,
                          color: "var(--accent)",
                          textDecoration: "none",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 3,
                        }}
                      >
                        打开链接 <ExternalLink size={11} />
                      </a>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--border)" }}>
          <button
            type="button"
            className="btn btn-sm"
            style={{ width: "100%", justifyContent: "space-between" }}
            onClick={() => setShowTimetableToday((v) => !v)}
          >
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <BookOpen size={13} />{" "}
              {schoolInfo.isVacation
                ? `${HOUSEHOLD.childA.name} 课表（${schoolInfo.vacationName} · 放假）`
                : `${HOUSEHOLD.childA.name} 当日课表 · Week ${schoolInfo.weekType ?? "A"} (${childDayClasses.length})`}
            </span>
            {showTimetableToday ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
          {showTimetableToday && (
            <div style={{ marginTop: 8 }}>
              {schoolInfo.isVacation ? (
                <div className="muted">🏖️ {schoolInfo.vacationName}，当天无固定校内课表。</div>
              ) : childDayClasses.length === 0 ? (
                <div className="muted">当天无固定课表记录。</div>
              ) : (
                childDayClasses.map((c) => (
                  <div key={c.id} className="tt-slot">
                    <div>
                      <strong className="tabular">
                        {c.start_time}-{c.end_time}
                      </strong>{" "}
                      {c.subject}
                      {(c.location || c.note) && (
                        <div className="muted">{[c.location, c.note].filter(Boolean).join(" · ")}</div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
