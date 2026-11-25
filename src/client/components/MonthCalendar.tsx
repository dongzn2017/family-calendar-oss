import { HOUSEHOLD } from "../../shared/household";
import { getSchoolWeekInfo } from "../../shared/schoolCalendar";
import type { CalendarEvent, DailyStatus, Member } from "../../shared/types";

export type CalendarViewMode = "2weeks" | "month";

export interface CalendarDayCell {
  iso: string;
  dayNum: number;
  monthNum: number;
  weekdayIndex: number; // 0=Mon .. 6=Sun
  inMonth: boolean;
  isWeekend: boolean;
}

interface Props {
  viewMode: CalendarViewMode;
  days: CalendarDayCell[];
  todayIso: string;
  selectedDate: string;
  dailyMap: Record<string, DailyStatus>;
  events: CalendarEvent[];
  membersMap: Record<string, Member>;
  onSelectDate: (date: string) => void;
  onEditEvent: (evt: CalendarEvent) => void;
}

const WEEKDAYS = ["Mon 周一", "Tue 周二", "Wed 周三", "Thu 周四", "Fri 周五", "Sat 周六", "Sun 周日"];

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function toIso(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function dayDiff(aIso: string, bIso: string): number {
  return Math.round((Date.parse(`${bIso}T00:00:00Z`) - Date.parse(`${aIso}T00:00:00Z`)) / 86_400_000);
}

export function getMondayOfWeek(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  const offset = (dt.getDay() + 6) % 7;
  dt.setDate(dt.getDate() - offset);
  return toIso(dt);
}

export function shiftIsoDays(iso: string, deltaDays: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d + deltaDays);
  return toIso(dt);
}

export function getTwoWeekRange(startMondayIso: string) {
  const [y, m, d] = startMondayIso.split("-").map(Number);
  const days: CalendarDayCell[] = [];
  for (let i = 0; i < 14; i++) {
    const cur = new Date(y, m - 1, d + i);
    const dow = cur.getDay();
    days.push({
      iso: toIso(cur),
      dayNum: cur.getDate(),
      monthNum: cur.getMonth() + 1,
      weekdayIndex: (dow + 6) % 7,
      inMonth: true,
      isWeekend: dow === 0 || dow === 6,
    });
  }
  return { days, startIso: days[0].iso, endIso: days[days.length - 1].iso };
}

export function getMonthGridRange(year: number, month: number) {
  const first = new Date(year, month, 1);
  const startOffset = (first.getDay() + 6) % 7;
  const gridStart = new Date(year, month, 1 - startOffset);
  const days: CalendarDayCell[] = [];
  for (let i = 0; i < 42; i++) {
    const cur = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i);
    const dow = cur.getDay();
    days.push({
      iso: toIso(cur),
      dayNum: cur.getDate(),
      monthNum: cur.getMonth() + 1,
      weekdayIndex: (dow + 6) % 7,
      inMonth: cur.getMonth() === month,
      isWeekend: dow === 0 || dow === 6,
    });
  }
  return { days, startIso: days[0].iso, endIso: days[days.length - 1].iso };
}

const TYPE_ICON: Record<string, string> = {
  outing: "🗺️",
  deadline: "⏰",
  payment: "💳",
  exam: "🎓",
  general: "•",
};

const PARTNER_A_SHORT: Record<string, string> = {
  remote: `${HOUSEHOLD.partnerA.shortPrefix} WFH`,
  leave: `${HOUSEHOLD.partnerA.shortPrefix} 请假`,
  travel: `${HOUSEHOLD.partnerA.shortPrefix} 出差`,
  off: `${HOUSEHOLD.partnerA.shortPrefix} 休`,
};

interface SpanSegment {
  evt: CalendarEvent;
  colStart: number;
  colSpan: number;
  continuesLeft: boolean;
  continuesRight: boolean;
}

function getWeekSpanSegments(weekDays: CalendarDayCell[], multiDayEvents: CalendarEvent[]): SpanSegment[] {
  const weekStart = weekDays[0].iso;
  const weekEnd = weekDays[6].iso;
  const segments: SpanSegment[] = [];
  for (const evt of multiDayEvents) {
    if (evt.end_date < weekStart || evt.start_date > weekEnd) continue;
    const effStart = evt.start_date < weekStart ? weekStart : evt.start_date;
    const effEnd = evt.end_date > weekEnd ? weekEnd : evt.end_date;
    const startIdx = weekDays.findIndex((d) => d.iso === effStart);
    const endIdx = weekDays.findIndex((d) => d.iso === effEnd);
    if (startIdx < 0 || endIdx < 0) continue;
    segments.push({
      evt,
      colStart: startIdx + 1,
      colSpan: endIdx - startIdx + 1,
      continuesLeft: evt.start_date < weekStart,
      continuesRight: evt.end_date > weekEnd,
    });
  }
  return segments;
}

export function MonthCalendar({
  viewMode,
  days,
  todayIso,
  selectedDate,
  dailyMap,
  events,
  membersMap,
  onSelectDate,
  onEditEvent,
}: Props) {
  const maxVisibleEvents = viewMode === "2weeks" ? 5 : 3;
  const multiDayEvents = events.filter((e) => e.end_date > e.start_date);
  const singleDayEvents = events.filter((e) => e.end_date <= e.start_date);

  const weeks: CalendarDayCell[][] = [];
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7));
  }

  const pB = HOUSEHOLD.partnerB.shortPrefix;

  return (
    <div className={`card calendar-card mode-${viewMode}`}>
      <div className="calendar-desktop-wrap">
        <div className="calendar-weekdays">
          {WEEKDAYS.map((w) => (
            <div key={w} className="weekday-cell">
              {w}
            </div>
          ))}
        </div>

        <div className="calendar-weeks">
          {weeks.map((weekDays) => {
            const spanSegments = getWeekSpanSegments(weekDays, multiDayEvents);
            return (
              <div key={weekDays[0].iso} className="calendar-week-block">
                {spanSegments.length > 0 && (
                  <div className="week-span-track">
                    {spanSegments.map((seg) => {
                      const color = membersMap[seg.evt.member_id]?.color || "var(--accent)";
                      const totalDays = dayDiff(seg.evt.start_date, seg.evt.end_date) + 1;
                      return (
                        <div
                          key={`${seg.evt.id}-${weekDays[0].iso}`}
                          className={`span-event-bar ${seg.evt.is_done ? "done" : ""} ${
                            seg.continuesLeft ? "cont-left" : ""
                          } ${seg.continuesRight ? "cont-right" : ""}`}
                          style={{ gridColumn: `${seg.colStart} / span ${seg.colSpan}`, borderLeftColor: color }}
                          title={`${seg.evt.title} (${seg.evt.start_date} ~ ${seg.evt.end_date})`}
                          onClick={(e) => {
                            e.stopPropagation();
                            onEditEvent(seg.evt);
                          }}
                        >
                          <span>{TYPE_ICON[seg.evt.event_type] || "•"}</span>
                          <span style={{ fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis" }}>
                            {seg.evt.title}
                          </span>
                          <span className="span-meta tabular">
                            {seg.evt.start_date.slice(5)}
                            {seg.evt.start_time ? ` ${seg.evt.start_time}` : ""} → {seg.evt.end_date.slice(5)}
                            {seg.evt.end_time ? ` ${seg.evt.end_time}` : ""} ({totalDays}天)
                          </span>
                          {seg.evt.booking_status === "to_book" && (
                            <span style={{ color: "var(--warning)", fontWeight: 700, flexShrink: 0 }}>未订</span>
                          )}
                          {seg.evt.booking_status === "booked" && (
                            <span style={{ color: "var(--success)", fontWeight: 700, flexShrink: 0 }}>已订</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                <div className={`calendar-grid mode-${viewMode}`}>
                  {weekDays.map((d) => {
                    const st = dailyMap[d.iso];
                    const schoolInfo = getSchoolWeekInfo(d.iso);
                    const dayEvents = singleDayEvents.filter((e) => e.start_date === d.iso);
                    const isToday = d.iso === todayIso;
                    const isSelected = d.iso === selectedDate;

                    const partnerBLabel =
                      st?.partner_b_status === "work"
                        ? `${pB} ${st.partner_b_hours || "上班"}`
                        : st?.partner_b_status === "off"
                          ? `${pB} Repos`
                          : st?.partner_b_status === "leave"
                            ? `${pB} 请假`
                            : "";

                    const partnerALabel = st?.partner_a_status
                      ? PARTNER_A_SHORT[st.partner_a_status] || ""
                      : "";

                    return (
                      <div
                        key={d.iso}
                        className={`day-cell ${viewMode === "2weeks" ? "tall" : ""} ${
                          d.inMonth ? "" : "outside"
                        } ${d.isWeekend ? "weekend" : ""} ${isToday ? "today" : ""} ${
                          isSelected ? "selected" : ""
                        }`}
                        onClick={() => onSelectDate(d.iso)}
                      >
                        <div className="day-top">
                          <span className="day-num-wrap">
                            <span className="day-num">{d.dayNum}</span>
                            {(viewMode === "2weeks" || d.dayNum === 1) && (
                              <span className="day-month-tag">{d.monthNum}月</span>
                            )}
                            {d.weekdayIndex === 0 && !schoolInfo.isVacation && schoolInfo.weekType && (
                              <span className="badge" style={{ fontSize: 9.5, padding: "0 4px" }}>
                                {schoolInfo.weekType}周
                              </span>
                            )}
                            {schoolInfo.isVacation && (
                              <span className="badge badge-vacation" style={{ fontSize: 9.5, padding: "0 4px" }}>
                                假期
                              </span>
                            )}
                          </span>
                          <div className="day-badges">
                            {st?.tempo_color === "ROUGE" && (
                              <span className="tempo-chip tempo-ROUGE" title="EDF Tempo ROUGE">
                                ⚡红
                              </span>
                            )}
                            {st?.tempo_color === "BLANC" && (
                              <span className="tempo-chip tempo-BLANC" title="EDF Tempo BLANC">
                                ⚡白
                              </span>
                            )}
                            {(st?.school_status === "strike" || st?.school_status === "partial_strike") && (
                              <span className="strike-chip" title={st.school_note || "School strike"}>
                                ⚠️罢工
                              </span>
                            )}
                          </div>
                        </div>

                        {(partnerBLabel || partnerALabel) && (
                          <div className="shift-row">
                            {partnerBLabel && (
                              <span className={`shift-pill shift-partner-b-${st?.partner_b_status}`}>
                                {partnerBLabel}
                              </span>
                            )}
                            {partnerALabel && (
                              <span className="shift-pill shift-partner-a">{partnerALabel}</span>
                            )}
                          </div>
                        )}

                        {dayEvents.slice(0, maxVisibleEvents).map((evt) => {
                          const color = membersMap[evt.member_id]?.color || "var(--accent)";
                          return (
                            <div
                              key={evt.id}
                              className={`event-chip type-${evt.event_type} ${evt.is_done ? "done" : ""}`}
                              style={{ borderLeftColor: color }}
                              title={`${evt.title}${evt.location ? ` @ ${evt.location}` : ""}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                onEditEvent(evt);
                              }}
                            >
                              <span>{TYPE_ICON[evt.event_type] || "•"}</span>
                              <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
                                {evt.start_time ? `${evt.start_time} ` : ""}
                                {evt.title}
                              </span>
                              {evt.booking_status === "to_book" && (
                                <span style={{ color: "var(--warning)", fontWeight: 700, flexShrink: 0 }}>未订</span>
                              )}
                              {evt.booking_status === "booked" && (
                                <span style={{ color: "var(--success)", fontWeight: 700, flexShrink: 0 }}>已订</span>
                              )}
                            </div>
                          );
                        })}

                        {dayEvents.length > maxVisibleEvents && (
                          <div className="muted" style={{ fontSize: 11, paddingLeft: 4 }}>
                            +{dayEvents.length - maxVisibleEvents} 更多
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {viewMode === "2weeks" && (
        <div className="mobile-agenda-list">
          {days.map((d, idx) => {
            const st = dailyMap[d.iso];
            const schoolInfo = getSchoolWeekInfo(d.iso);
            const dayEvents = events.filter((e) => e.start_date <= d.iso && e.end_date >= d.iso);
            const isToday = d.iso === todayIso;
            const isSelected = d.iso === selectedDate;
            const partnerBLabel =
              st?.partner_b_status === "work"
                ? `${HOUSEHOLD.partnerB.name} 上班 ${st.partner_b_hours || ""}`.trim()
                : st?.partner_b_status === "off"
                  ? `${HOUSEHOLD.partnerB.name} 休息 Repos`
                  : st?.partner_b_status === "leave"
                    ? `${HOUSEHOLD.partnerB.name} 请假`
                    : "";
            const partnerALabel = st?.partner_a_status
              ? PARTNER_A_SHORT[st.partner_a_status] || ""
              : "";

            return (
              <div key={d.iso}>
                {idx === 0 && <div className="agenda-week-divider">第一周 · Week 1</div>}
                {idx === 7 && <div className="agenda-week-divider">第二周 · Week 2</div>}
                <div
                  className={`agenda-day-card ${isToday ? "today" : ""} ${
                    isSelected ? "selected" : ""
                  } ${d.isWeekend ? "weekend" : ""}`}
                  onClick={() => onSelectDate(d.iso)}
                >
                  <div className="agenda-day-head">
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span className="day-num">{d.dayNum}</span>
                      <div>
                        <span style={{ fontWeight: 700 }}>{WEEKDAYS[d.weekdayIndex]}</span>
                        <span className="muted" style={{ marginLeft: 6 }}>
                          {d.monthNum}/{d.dayNum}
                        </span>
                        {isToday && (
                          <span
                            className="badge"
                            style={{ marginLeft: 6, background: "var(--today-pill-bg)", color: "var(--today-pill-ink)" }}
                          >
                            今天
                          </span>
                        )}
                        {schoolInfo.isVacation ? (
                          <span className="badge badge-vacation" style={{ marginLeft: 6 }}>
                            假期
                          </span>
                        ) : (
                          d.weekdayIndex === 0 &&
                          schoolInfo.weekType && (
                            <span className="badge" style={{ marginLeft: 6 }}>
                              {schoolInfo.weekType}周
                            </span>
                          )
                        )}
                      </div>
                    </div>
                    <div className="day-badges">
                      {st?.tempo_color === "ROUGE" && <span className="tempo-chip tempo-ROUGE">⚡Tempo 红</span>}
                      {st?.tempo_color === "BLANC" && <span className="tempo-chip tempo-BLANC">⚡Tempo 白</span>}
                      {(st?.school_status === "strike" || st?.school_status === "partial_strike") && (
                        <span className="strike-chip">⚠️ 罢工</span>
                      )}
                    </div>
                  </div>

                  {(partnerBLabel || partnerALabel) && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
                      {partnerBLabel && (
                        <span className={`shift-pill shift-partner-b-${st?.partner_b_status}`}>
                          {partnerBLabel}
                        </span>
                      )}
                      {partnerALabel && <span className="shift-pill shift-partner-a">{partnerALabel}</span>}
                    </div>
                  )}

                  {dayEvents.length > 0 && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 7 }}>
                      {dayEvents.map((evt) => {
                        const color = membersMap[evt.member_id]?.color || "var(--accent)";
                        const isMulti = evt.end_date > evt.start_date;
                        const spanTotal = isMulti ? dayDiff(evt.start_date, evt.end_date) + 1 : 1;
                        const spanCur = isMulti ? dayDiff(evt.start_date, d.iso) + 1 : 1;
                        return (
                          <div
                            key={evt.id}
                            className={`event-chip type-${evt.event_type} ${evt.is_done ? "done" : ""}`}
                            style={{ borderLeftColor: color, padding: "4px 8px", fontSize: 12.5 }}
                            onClick={(e) => {
                              e.stopPropagation();
                              onEditEvent(evt);
                            }}
                          >
                            <span>{TYPE_ICON[evt.event_type] || "•"}</span>
                            <span style={{ flex: 1 }}>
                              {!isMulti && evt.start_time ? `${evt.start_time} ` : ""}
                              {evt.title}
                            </span>
                            {isMulti && (
                              <span className="badge badge-planned" style={{ fontSize: 10 }}>
                                第 {spanCur}/{spanTotal} 天
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
