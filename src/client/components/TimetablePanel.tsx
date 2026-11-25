import { useState } from "react";
import { BookOpen, ChevronDown, ChevronRight, Plus, Trash2 } from "lucide-react";
import { HOUSEHOLD } from "../../shared/household";
import type { TimetableItem, WeekParity } from "../../shared/types";

interface Props {
  open: boolean;
  defaultWeek: "A" | "B";
  items: TimetableItem[];
  onToggleOpen: () => void;
  onAdd: (item: Partial<TimetableItem>) => Promise<void>;
  onDelete: (id: string) => void;
}

const DAYS = [
  { num: 1, label: "Mon 周一" },
  { num: 2, label: "Tue 周二" },
  { num: 3, label: "Wed 周三" },
  { num: 4, label: "Thu 周四" },
  { num: 5, label: "Fri 周五" },
];

export function TimetablePanel({ open, defaultWeek, items, onToggleOpen, onAdd, onDelete }: Props) {
  const [activeWeek, setActiveWeek] = useState<"A" | "B">(defaultWeek);
  const [dayOfWeek, setDayOfWeek] = useState(1);
  const [weekParity, setWeekParity] = useState<WeekParity>("ALL");
  const [startTime, setStartTime] = useState("08:00");
  const [endTime, setEndTime] = useState("08:55");
  const [subject, setSubject] = useState("");
  const [location, setLocation] = useState("");
  const [adding, setAdding] = useState(false);

  const visibleItems = items.filter((i) => i.week_parity === "ALL" || i.week_parity === activeWeek);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!subject.trim()) return;
    setAdding(true);
    try {
      await onAdd({
        member_id: HOUSEHOLD.childA.id,
        day_of_week: dayOfWeek,
        week_parity: weekParity,
        start_time: startTime,
        end_time: endTime,
        subject: subject.trim(),
        location: location.trim(),
      });
      setSubject("");
      setLocation("");
    } finally {
      setAdding(false);
    }
  }

  return (
    <div className="card folded-bar">
      <div
        className="card-header"
        style={{ cursor: "pointer", borderBottom: open ? "1px solid var(--border)" : "none" }}
        onClick={onToggleOpen}
      >
        <div className="card-title">
          <BookOpen size={15} color="var(--success)" />
          {HOUSEHOLD.childA.timetableLabel}（本周：Week {defaultWeek}）
          <span className="muted" style={{ fontWeight: 400 }}>
            · 假期自动停课 · 默认折叠
          </span>
        </div>
        {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
      </div>

      {open && (
        <div className="card-body">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10, flexWrap: "wrap", gap: 8 }}>
            <div className="view-switch">
              <button type="button" className={`view-tab ${activeWeek === "A" ? "active" : ""}`} onClick={() => setActiveWeek("A")}>
                Week A
              </button>
              <button type="button" className={`view-tab ${activeWeek === "B" ? "active" : ""}`} onClick={() => setActiveWeek("B")}>
                Week B
              </button>
            </div>
            <span className="muted">Week {activeWeek} · {visibleItems.length} classes</span>
          </div>

          <div className="timetable-grid">
            {DAYS.map((d) => {
              const dayItems = visibleItems.filter((i) => i.day_of_week === d.num);
              return (
                <div key={d.num} className="tt-day-box">
                  <div className="tt-day-title">{d.label}</div>
                  {dayItems.length === 0 ? (
                    <div className="muted">—</div>
                  ) : (
                    dayItems.map((it) => (
                      <div key={it.id} className="tt-slot">
                        <div>
                          <div style={{ fontWeight: 700, display: "flex", alignItems: "center", gap: 4 }}>
                            <span className="tabular">{it.start_time}-{it.end_time}</span>
                            {it.week_parity !== "ALL" && (
                              <span className={`badge ${it.week_parity === "A" ? "badge-planned" : "badge-vacation"}`} style={{ fontSize: 10, padding: "0 5px" }}>
                                {it.week_parity}
                              </span>
                            )}
                          </div>
                          <div>{it.subject}</div>
                          {(it.location || it.note) && (
                            <div className="muted">{[it.location, it.note].filter(Boolean).join(" · ")}</div>
                          )}
                        </div>
                        <button className="btn btn-icon" style={{ border: "none", padding: 2, background: "transparent" }} onClick={() => onDelete(it.id)} title="删除">
                          <Trash2 size={12} color="var(--ink-muted)" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              );
            })}
          </div>

          <form onSubmit={handleAdd} style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 12, paddingTop: 10, borderTop: "1px solid var(--border)", alignItems: "center" }}>
            <select className="select" style={{ width: 105 }} value={dayOfWeek} onChange={(e) => setDayOfWeek(Number(e.target.value))}>
              {DAYS.map((d) => (
                <option key={d.num} value={d.num}>{d.label}</option>
              ))}
            </select>
            <select className="select" style={{ width: 95 }} value={weekParity} onChange={(e) => setWeekParity(e.target.value as WeekParity)}>
              <option value="ALL">A+B周</option>
              <option value="A">仅 A周</option>
              <option value="B">仅 B周</option>
            </select>
            <input className="input" type="time" style={{ width: 100 }} value={startTime} onChange={(e) => setStartTime(e.target.value)} />
            <input className="input" type="time" style={{ width: 100 }} value={endTime} onChange={(e) => setEndTime(e.target.value)} />
            <input className="input" style={{ flex: 1, minWidth: 140 }} placeholder="课程名称" value={subject} onChange={(e) => setSubject(e.target.value)} />
            <input className="input" style={{ width: 115 }} placeholder="教室/老师" value={location} onChange={(e) => setLocation(e.target.value)} />
            <button className="btn btn-primary" type="submit" disabled={adding || !subject.trim()}>
              <Plus size={13} /> 添加
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
