import { useMemo, useState } from "react";
import { Repeat, Trash2, X } from "lucide-react";
import { HOUSEHOLD } from "../../shared/household";
import { getSchoolWeekInfo } from "../../shared/schoolCalendar";
import type { BookingStatus, CalendarEvent, EventType, Member } from "../../shared/types";

interface Props {
  initial: Partial<CalendarEvent>;
  members: Member[];
  onClose: () => void;
  onSave: (data: Partial<CalendarEvent>, existingId?: string) => Promise<void>;
  onSaveBatch?: (events: Array<Partial<CalendarEvent>>) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
}

const WEEKDAY_OPTS = [
  { num: 1, label: "周一" },
  { num: 2, label: "周二" },
  { num: 3, label: "周三" },
  { num: 4, label: "周四" },
  { num: 5, label: "周五" },
  { num: 6, label: "周六" },
  { num: 7, label: "周日" },
];

function computeBatchDates(
  fromIso: string,
  untilIso: string,
  weekdays: number[],
  skipVacations: boolean
): string[] {
  if (!fromIso || !untilIso || fromIso > untilIso || weekdays.length === 0) return [];
  const [sy, sm, sd] = fromIso.split("-").map(Number);
  const [ey, em, ed] = untilIso.split("-").map(Number);
  const cur = new Date(Date.UTC(sy, sm - 1, sd));
  const end = new Date(Date.UTC(ey, em - 1, ed));
  const out: string[] = [];
  while (cur <= end && out.length < 200) {
    const dow = cur.getUTCDay() === 0 ? 7 : cur.getUTCDay();
    const iso = cur.toISOString().slice(0, 10);
    if (weekdays.includes(dow)) {
      if (!skipVacations || !getSchoolWeekInfo(iso).isVacation) out.push(iso);
    }
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return out;
}

export function EventModal({ initial, members, onClose, onSave, onSaveBatch, onDelete }: Props) {
  const isEdit = Boolean(initial.id);
  const [batchMode, setBatchMode] = useState(false);

  const [title, setTitle] = useState(initial.title ?? "");
  const [eventType, setEventType] = useState<EventType>(initial.event_type ?? "general");
  const [startDate, setStartDate] = useState(initial.start_date ?? "");
  const [endDate, setEndDate] = useState(initial.end_date ?? initial.start_date ?? "");
  const [startTime, setStartTime] = useState(initial.start_time ?? "");
  const [endTime, setEndTime] = useState(initial.end_time ?? "");
  const [location, setLocation] = useState(initial.location ?? "");
  const [url, setUrl] = useState(initial.url ?? "");
  const [memberId, setMemberId] = useState(initial.member_id ?? "family");
  const [bookingStatus, setBookingStatus] = useState<BookingStatus>(initial.booking_status ?? "none");
  const [remindDays, setRemindDays] = useState<number>(initial.remind_days_before ?? 0);
  const [description, setDescription] = useState(initial.description ?? "");

  const [repeatUntil, setRepeatUntil] = useState(HOUSEHOLD.defaultTermEndDate);
  const [repeatDays, setRepeatDays] = useState<number[]>(() => {
    if (!initial.start_date) return [1];
    const [y, m, d] = initial.start_date.split("-").map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    return [dt.getUTCDay() === 0 ? 7 : dt.getUTCDay()];
  });
  const [skipVacations, setSkipVacations] = useState(true);

  const [saving, setSaving] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const batchDates = useMemo(
    () => (batchMode ? computeBatchDates(startDate, repeatUntil, repeatDays, skipVacations) : []),
    [batchMode, startDate, repeatUntil, repeatDays, skipVacations]
  );

  function handleTypeChange(next: EventType) {
    setEventType(next);
    if (!isEdit) {
      if (next === "deadline" || next === "payment" || next === "exam") setRemindDays(7);
      else if (next === "outing") setBookingStatus((cur) => (cur === "none" ? "planned" : cur));
    }
  }

  function toggleWeekday(num: number) {
    setRepeatDays((prev) =>
      prev.includes(num) ? prev.filter((x) => x !== num) : [...prev, num].sort()
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !startDate) return;
    setSaving(true);
    try {
      if (batchMode && onSaveBatch) {
        if (batchDates.length === 0) return;
        await onSaveBatch(
          batchDates.map((d) => ({
            title: title.trim(),
            description,
            event_type: eventType,
            start_date: d,
            end_date: d,
            start_time: startTime,
            end_time: endTime,
            all_day: startTime ? 0 : 1,
            location,
            url: url.trim(),
            member_id: memberId,
            booking_status: bookingStatus,
            remind_days_before: remindDays,
            is_done: 0,
          }))
        );
      } else {
        await onSave(
          {
            title: title.trim(),
            description,
            event_type: eventType,
            start_date: startDate,
            end_date: endDate || startDate,
            start_time: startTime,
            end_time: endTime,
            all_day: startTime ? 0 : 1,
            location,
            url: url.trim(),
            member_id: memberId,
            booking_status: bookingStatus,
            remind_days_before: remindDays,
            is_done: initial.is_done ?? 0,
          },
          initial.id
        );
      }
      onClose();
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteClick() {
    if (!initial.id || !onDelete) return;
    if (!confirmingDelete) {
      setConfirmingDelete(true);
      return;
    }
    setSaving(true);
    try {
      await onDelete(initial.id);
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="card-header">
          <div className="card-title">{isEdit ? "编辑日程 / Edit" : "新增日程 / Add Event"}</div>
          <button className="btn btn-icon" onClick={onClose}>
            <X size={16} />
          </button>
        </div>
        <form className="card-body" onSubmit={handleSubmit}>
          {!isEdit && onSaveBatch && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <div className="view-switch">
                <button type="button" className={`view-tab ${!batchMode ? "active" : ""}`} onClick={() => setBatchMode(false)}>
                  单次日程
                </button>
                <button type="button" className={`view-tab ${batchMode ? "active" : ""}`} onClick={() => setBatchMode(true)}>
                  <Repeat size={12} style={{ verticalAlign: "-2px", marginRight: 3 }} />
                  批量重复（按周）
                </button>
              </div>
              {batchMode && <span className="badge badge-planned">将生成 {batchDates.length} 条</span>}
            </div>
          )}

          <div className="field">
            <label>事件类型 / Category</label>
            <div className="segmented">
              {(
                [
                  ["general", "📌 普通日程"],
                  ["outing", "🗺️ 出行规划"],
                  ["deadline", "⏰ Deadline"],
                  ["payment", "💳 缴费日期"],
                  ["exam", "🎓 考试"],
                ] as Array<[EventType, string]>
              ).map(([val, label]) => (
                <button
                  key={val}
                  type="button"
                  className={`seg-btn ${eventType === val ? "active" : ""}`}
                  onClick={() => handleTypeChange(val)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="field">
            <label>标题 / Title *</label>
            <input
              className="input"
              required
              placeholder="例如：击剑课 / 缴费截止 / 周末家庭出游"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          {batchMode ? (
            <>
              <div className="row-2">
                <div className="field">
                  <label>起始日期 *</label>
                  <input className="input" type="date" required value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                </div>
                <div className="field">
                  <label>结束日期 *</label>
                  <input className="input" type="date" required value={repeatUntil} onChange={(e) => setRepeatUntil(e.target.value)} />
                </div>
              </div>
              <div className="field">
                <label>重复星期（可多选）</label>
                <div className="segmented">
                  {WEEKDAY_OPTS.map((w) => (
                    <button
                      key={w.num}
                      type="button"
                      className={`seg-btn ${repeatDays.includes(w.num) ? "active" : ""}`}
                      onClick={() => toggleWeekday(w.num)}
                    >
                      {w.label}
                    </button>
                  ))}
                </div>
                <label style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 6, cursor: "pointer", color: "var(--ink-secondary)" }}>
                  <input type="checkbox" checked={skipVacations} onChange={(e) => setSkipVacations(e.target.checked)} />
                  仅上学周生效（自动跳过学校假期）
                </label>
              </div>
            </>
          ) : (
            <div className="row-2">
              <div className="field">
                <label>开始日期 *</label>
                <input
                  className="input"
                  type="date"
                  required
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    if (!endDate || endDate < e.target.value) setEndDate(e.target.value);
                  }}
                />
              </div>
              <div className="field">
                <label>结束日期</label>
                <input className="input" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </div>
            </div>
          )}

          <div className="row-2">
            <div className="field">
              <label>开始时间（留空为全天）</label>
              <input className="input" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
            </div>
            <div className="field">
              <label>结束时间</label>
              <input className="input" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
            </div>
          </div>

          <div className="row-2">
            <div className="field">
              <label>归属人 / Member</label>
              <select className="select" value={memberId} onChange={(e) => setMemberId(e.target.value)}>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>预定状态 / Booking</label>
              <select className="select" value={bookingStatus} onChange={(e) => setBookingStatus(e.target.value as BookingStatus)}>
                <option value="none">无需预定</option>
                <option value="planned">计划中 / Planned</option>
                <option value="to_book">待预定 / To book</option>
                <option value="booked">已预定 ✓ / Booked</option>
                <option value="cancelled">已取消</option>
              </select>
            </div>
          </div>

          <div className="row-2">
            <div className="field">
              <label>地点 / Location</label>
              <input className="input" value={location} onChange={(e) => setLocation(e.target.value)} />
            </div>
            <div className="field">
              <label>提前几天预警</label>
              <input className="input" type="number" min={0} max={30} value={remindDays} onChange={(e) => setRemindDays(Number(e.target.value))} />
            </div>
          </div>

          <div className="field">
            <label>相关链接 / URL（选填）</label>
            <input className="input" placeholder="https://..." value={url} onChange={(e) => setUrl(e.target.value)} />
          </div>

          <div className="field">
            <label>备注 / Notes</label>
            <textarea className="textarea" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginTop: 10 }}>
            <div>
              {isEdit && onDelete && (
                <button
                  type="button"
                  className={`btn ${confirmingDelete ? "btn-primary" : "btn-danger"}`}
                  style={confirmingDelete ? { background: "var(--danger-solid)", borderColor: "var(--danger-solid)", color: "#fff" } : undefined}
                  disabled={saving}
                  onClick={handleDeleteClick}
                >
                  <Trash2 size={14} /> {confirmingDelete ? "再次点击确认删除" : "删除日程"}
                </button>
              )}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" className="btn" onClick={onClose}>
                取消
              </button>
              <button type="submit" className="btn btn-primary" disabled={saving || (batchMode && batchDates.length === 0)}>
                {saving ? "保存中..." : batchMode ? `批量创建 (${batchDates.length} 条)` : "保存日程"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
