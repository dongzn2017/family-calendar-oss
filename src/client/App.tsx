import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  Calendar,
  Camera,
  ChevronLeft,
  ChevronRight,
  History,
  Plus,
  Sparkles,
  X,
  Zap,
} from "lucide-react";
import { api } from "./api";
import {
  type CalendarViewMode,
  getMondayOfWeek,
  getMonthGridRange,
  getTwoWeekRange,
  MonthCalendar,
  shiftIsoDays,
} from "./components/MonthCalendar";
import { TopAlertsBar } from "./components/TopAlertsBar";
import { DayDetailPanel } from "./components/DayDetailPanel";
import { TodoInboxPanel } from "./components/TodoInboxPanel";
import { ReviewQueuePanel } from "./components/ReviewQueuePanel";
import { EventModal } from "./components/EventModal";
import { TimetablePanel } from "./components/TimetablePanel";
import { FamilyLinksPanel } from "./components/FamilyLinksPanel";
import { ScheduleUploadModal } from "./components/ScheduleUploadModal";
import { HOUSEHOLD } from "../shared/household";
import { getSchoolWeekInfo } from "../shared/schoolCalendar";
import type {
  AiProposal,
  AiRunLog,
  CalendarEvent,
  DailyStatus,
  FamilyLink,
  Member,
  OverviewAlertItem,
  TimetableItem,
  TodoItem,
} from "../shared/types";

type ThemeName = "nord" | "tokyo" | "warm";

function getInitialTheme(): ThemeName {
  try {
    const saved = localStorage.getItem("familycal_theme");
    if (saved === "nord" || saved === "tokyo" || saved === "warm") return saved;
  } catch {
    // ignore
  }
  return "nord";
}

function getLocalTodayIso(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function emptyDailyStatus(date: string): DailyStatus {
  return {
    date,
    partner_b_status: "unset",
    partner_b_hours: "",
    partner_b_note: "",
    partner_a_status: "unset",
    partner_a_note: "",
    tempo_color: "UNKNOWN",
    tempo_source: "auto",
    school_status: "normal",
    school_note: "",
    day_note: "",
  };
}

function getIsoDayOfWeek(iso: string): number {
  const d = new Date(`${iso}T12:00:00Z`);
  const dow = d.getUTCDay();
  return dow === 0 ? 7 : dow;
}

export default function App() {
  const localToday = getLocalTodayIso();
  const [theme, setTheme] = useState<ThemeName>(getInitialTheme);
  const [todayIso, setTodayIso] = useState(localToday);
  const [geminiConfigured, setGeminiConfigured] = useState(false);
  const [demoAiMode, setDemoAiMode] = useState(false);

  const [viewMode, setViewMode] = useState<CalendarViewMode>("2weeks");
  const [twoWeekStart, setTwoWeekStart] = useState(() => getMondayOfWeek(localToday));

  const initialDate = new Date();
  const [viewYear, setViewYear] = useState(initialDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(initialDate.getMonth());
  const [selectedDate, setSelectedDate] = useState(localToday);

  const [members, setMembers] = useState<Member[]>([]);
  const [dailyList, setDailyList] = useState<DailyStatus[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [alerts, setAlerts] = useState<OverviewAlertItem[]>([]);
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [proposals, setProposals] = useState<AiProposal[]>([]);
  const [timetables, setTimetables] = useState<TimetableItem[]>([]);
  const [familyLinks, setFamilyLinks] = useState<FamilyLink[]>([]);
  const [runs, setRuns] = useState<AiRunLog[]>([]);

  const [timetableOpen, setTimetableOpen] = useState(false);
  const [logsOpen, setLogsOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [modalEvent, setModalEvent] = useState<Partial<CalendarEvent> | null>(null);
  const [syncingTempo, setSyncingTempo] = useState(false);
  const [aiRunning, setAiRunning] = useState(false);
  const [toast, setToast] = useState("");

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem("familycal_theme", theme);
    } catch {
      // ignore
    }
  }, [theme]);

  const range = useMemo(
    () => (viewMode === "2weeks" ? getTwoWeekRange(twoWeekStart) : getMonthGridRange(viewYear, viewMonth)),
    [viewMode, twoWeekStart, viewYear, viewMonth]
  );

  const membersMap = useMemo(() => Object.fromEntries(members.map((m) => [m.id, m])), [members]);
  const dailyMap = useMemo(() => Object.fromEntries(dailyList.map((d) => [d.date, d])), [dailyList]);

  const loadRangeData = useCallback(async () => {
    const [calRes, alertsRes] = await Promise.all([
      api.getCalendar(range.startIso, range.endIso),
      api.getAlerts(),
    ]);
    setDailyList(calRes.daily_status);
    setEvents(calRes.events);
    setAlerts(alertsRes.alerts);
    setTodayIso(alertsRes.today);
  }, [range.startIso, range.endIso]);

  const loadSideData = useCallback(async () => {
    const [healthRes, membersRes, todosRes, proposalsRes, ttRes, runsRes, linksRes] =
      await Promise.all([
        api.health(),
        api.getMembers(),
        api.getTodos(),
        api.getProposals(),
        api.getTimetables(HOUSEHOLD.childA.id),
        api.getAiRuns(),
        api.getLinks(),
      ]);
    setTodayIso(healthRes.today);
    setGeminiConfigured(healthRes.gemini_configured);
    setDemoAiMode(healthRes.demo_ai_mode);
    setMembers(membersRes.members);
    setTodos(todosRes.todos);
    setProposals(proposalsRes.proposals);
    setTimetables(ttRes.timetables);
    setRuns(runsRes.runs);
    setFamilyLinks(linksRes.links);
  }, []);

  useEffect(() => {
    loadSideData().catch((e) => setToast(`加载失败: ${String(e)}`));
  }, [loadSideData]);

  useEffect(() => {
    loadRangeData().catch((e) => setToast(`加载日历失败: ${String(e)}`));
  }, [loadRangeData]);

  function handlePrev() {
    if (viewMode === "2weeks") setTwoWeekStart((s) => shiftIsoDays(s, -14));
    else if (viewMonth === 0) {
      setViewYear((y) => y - 1);
      setViewMonth(11);
    } else setViewMonth((m) => m - 1);
  }

  function handleNext() {
    if (viewMode === "2weeks") setTwoWeekStart((s) => shiftIsoDays(s, 14));
    else if (viewMonth === 11) {
      setViewYear((y) => y + 1);
      setViewMonth(0);
    } else setViewMonth((m) => m + 1);
  }

  function goToday() {
    const [y, m] = todayIso.split("-").map(Number);
    setViewYear(y);
    setViewMonth(m - 1);
    setTwoWeekStart(getMondayOfWeek(todayIso));
    setSelectedDate(todayIso);
  }

  function jumpToDate(iso: string) {
    const [y, m] = iso.split("-").map(Number);
    setViewYear(y);
    setViewMonth(m - 1);
    setTwoWeekStart(getMondayOfWeek(iso));
    setSelectedDate(iso);
  }

  function switchViewMode(next: CalendarViewMode) {
    if (next === "month") {
      const [y, m] = selectedDate.split("-").map(Number);
      setViewYear(y);
      setViewMonth(m - 1);
    } else {
      setTwoWeekStart(getMondayOfWeek(selectedDate));
    }
    setViewMode(next);
  }

  async function handleSaveDailyStatus(date: string, patch: Partial<DailyStatus>) {
    await api.upsertDailyStatus(date, patch);
    await loadRangeData();
    setToast(`已保存 ${date} 当日状态`);
  }

  async function handleSaveEvent(data: Partial<CalendarEvent>, existingId?: string) {
    if (existingId) {
      await api.updateEvent(existingId, data);
      setToast("已更新日程");
    } else {
      await api.createEvent(data);
      setToast("已新增日程");
    }
    await loadRangeData();
  }

  async function handleToggleEventDone(evt: CalendarEvent) {
    await api.updateEvent(evt.id, { is_done: evt.is_done ? 0 : 1 });
    await loadRangeData();
  }

  async function handleMarkEventDoneById(id: string) {
    await api.updateEvent(id, { is_done: 1 });
    await loadRangeData();
    setToast("已标记完成");
  }

  async function handleDeleteEvent(id: string) {
    await api.deleteEvent(id);
    await loadRangeData();
    setToast("已删除日程");
  }

  async function handleSyncTempo() {
    setSyncingTempo(true);
    try {
      const res = await api.syncTempo();
      await Promise.all([loadRangeData(), loadSideData()]);
      setToast(`EDF Tempo 同步完成：${res.summary}`);
    } catch (e) {
      setToast(`Tempo 同步失败: ${String(e)}`);
    } finally {
      setSyncingTempo(false);
    }
  }

  async function handleRunAi() {
    setAiRunning(true);
    try {
      const res = await api.runAi();
      await Promise.all([loadSideData(), loadRangeData()]);
      setToast(`AI 整理：${res.summary}`);
    } catch (e) {
      setToast(`AI 整理失败: ${String(e)}`);
    } finally {
      setAiRunning(false);
    }
  }

  const selectedStatus = dailyMap[selectedDate] ?? emptyDailyStatus(selectedDate);
  const selectedSchoolInfo = getSchoolWeekInfo(selectedDate);
  const todaySchoolInfo = getSchoolWeekInfo(todayIso);
  const selectedDayEvents = events.filter((e) => e.start_date <= selectedDate && e.end_date >= selectedDate);
  const selectedDayClasses = selectedSchoolInfo.isVacation
    ? []
    : timetables.filter(
        (t) =>
          t.day_of_week === getIsoDayOfWeek(selectedDate) &&
          (t.week_parity === "ALL" || t.week_parity === selectedSchoolInfo.weekType)
      );

  const rangeTitle =
    viewMode === "2weeks"
      ? `${range.startIso.slice(5)} ~ ${range.endIso.slice(5)}`
      : `${viewYear} 年 ${viewMonth + 1} 月`;

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">
            <Calendar size={19} />
          </div>
          <div>
            <div className="brand-title">{HOUSEHOLD.appName}</div>
            <div className="brand-sub">{HOUSEHOLD.subtitle}</div>
          </div>
        </div>

        <div className="month-nav">
          <div className="view-switch">
            <button className={`view-tab ${viewMode === "2weeks" ? "active" : ""}`} onClick={() => switchViewMode("2weeks")}>
              近两周
            </button>
            <button className={`view-tab ${viewMode === "month" ? "active" : ""}`} onClick={() => switchViewMode("month")}>
              月视图
            </button>
          </div>
          <button className="btn btn-icon" onClick={handlePrev}>
            <ChevronLeft size={16} />
          </button>
          <div className="month-label">{rangeTitle}</div>
          <button className="btn btn-icon" onClick={handleNext}>
            <ChevronRight size={16} />
          </button>
          <button className="btn btn-sm" onClick={goToday}>
            {viewMode === "2weeks" ? "本周" : "今天"}
          </button>
        </div>

        <div className="topbar-actions">
          <div className="view-switch" title="切换主题">
            <button className={`view-tab ${theme === "nord" ? "active" : ""}`} onClick={() => setTheme("nord")}>
              Nord
            </button>
            <button className={`view-tab ${theme === "tokyo" ? "active" : ""}`} onClick={() => setTheme("tokyo")}>
              Tokyo
            </button>
            <button className={`view-tab ${theme === "warm" ? "active" : ""}`} onClick={() => setTheme("warm")}>
              暖浅色
            </button>
          </div>
          <button className="btn btn-partner-b" onClick={() => setUploadOpen(true)}>
            <Camera size={14} /> 传班表
          </button>
          <button className="btn" onClick={handleSyncTempo} disabled={syncingTempo}>
            <Zap size={14} /> {syncingTempo ? "同步中..." : "Tempo"}
          </button>
          <button className="btn" onClick={handleRunAi} disabled={aiRunning}>
            <Sparkles size={14} /> {aiRunning ? "整理中..." : "AI 整理"}
          </button>
          <button className="btn" onClick={() => setTimetableOpen((v) => !v)}>
            <BookOpen size={14} /> 课表
          </button>
          <button className="btn" onClick={() => setLogsOpen((v) => !v)}>
            <History size={14} /> 日志
          </button>
          <button
            className="btn btn-primary"
            onClick={() => setModalEvent({ start_date: selectedDate, end_date: selectedDate })}
          >
            <Plus size={14} /> 新增日程
          </button>
        </div>
      </header>

      {toast && (
        <div className="toast-bar">
          <span>{toast}</span>
          <button className="btn btn-icon" style={{ background: "transparent", color: "var(--ink-muted)", border: "none" }} onClick={() => setToast("")}>
            <X size={14} />
          </button>
        </div>
      )}

      <TopAlertsBar alerts={alerts} onSelectDate={jumpToDate} onMarkEventDone={handleMarkEventDoneById} />

      <main className="workspace">
        <div>
          <MonthCalendar
            viewMode={viewMode}
            days={range.days}
            todayIso={todayIso}
            selectedDate={selectedDate}
            dailyMap={dailyMap}
            events={events}
            membersMap={membersMap}
            onSelectDate={setSelectedDate}
            onEditEvent={(evt) => setModalEvent(evt)}
          />

          <TimetablePanel
            open={timetableOpen}
            defaultWeek={todaySchoolInfo.weekType ?? "A"}
            items={timetables}
            onToggleOpen={() => setTimetableOpen((v) => !v)}
            onAdd={async (item) => {
              await api.createTimetable(item);
              await loadSideData();
              setToast("已添加课程");
            }}
            onDelete={async (id) => {
              await api.deleteTimetable(id);
              await loadSideData();
            }}
          />

          <FamilyLinksPanel
            links={familyLinks}
            onAdd={async (item) => {
              await api.createLink(item);
              await loadSideData();
              setToast("已添加常用链接");
            }}
            onDelete={async (id) => {
              await api.deleteLink(id);
              await loadSideData();
            }}
          />
        </div>

        <aside className="sidebar-stack">
          <ReviewQueuePanel
            proposals={proposals}
            onConfirm={async (id, overridePayload) => {
              await api.confirmProposal(id, overridePayload);
              await Promise.all([loadRangeData(), loadSideData()]);
              setToast("已确认并写入日历");
            }}
            onConfirmAll={async () => {
              const res = await api.confirmAllProposals();
              await Promise.all([loadRangeData(), loadSideData()]);
              setToast(`已批量确认写入 ${res.confirmed} 条建议`);
            }}
            onDismiss={async (id) => {
              await api.dismissProposal(id);
              await loadSideData();
            }}
            onPromoteNoticeToEvent={(title, date, description) =>
              setModalEvent({
                title,
                start_date: date || selectedDate,
                end_date: date || selectedDate,
                description,
                member_id: HOUSEHOLD.childB.id,
                event_type: "general",
              })
            }
          />

          <TodoInboxPanel
            todos={todos}
            aiRunning={aiRunning}
            onAddTodo={async (raw, author) => {
              await api.createTodo(raw, author);
              await loadSideData();
            }}
            onToggleTodoDone={async (todo) => {
              const next = todo.status === "done" ? "pending" : "done";
              await api.updateTodo(todo.id, { status: next });
              await loadSideData();
            }}
            onDeleteTodo={async (id) => {
              await api.deleteTodo(id);
              await loadSideData();
            }}
            onConvertTodoToEvent={(todo) =>
              setModalEvent({
                title: todo.raw_text,
                start_date: selectedDate,
                end_date: selectedDate,
                member_id: todo.author_id,
              })
            }
            onRunAi={handleRunAi}
          />

          <DayDetailPanel
            date={selectedDate}
            status={selectedStatus}
            schoolInfo={selectedSchoolInfo}
            dayEvents={selectedDayEvents}
            childDayClasses={selectedDayClasses}
            membersMap={membersMap}
            onSaveStatus={handleSaveDailyStatus}
            onAddEventForDate={(date) => setModalEvent({ start_date: date, end_date: date })}
            onEditEvent={(evt) => setModalEvent(evt)}
            onToggleDone={handleToggleEventDone}
            onDeleteEvent={handleDeleteEvent}
          />
        </aside>
      </main>

      {modalEvent && (
        <EventModal
          initial={modalEvent}
          members={members}
          onClose={() => setModalEvent(null)}
          onSave={handleSaveEvent}
          onSaveBatch={async (batch) => {
            const res = await api.createEventsBatch(batch);
            await loadRangeData();
            setToast(`已批量新增 ${res.created} 条日程`);
          }}
          onDelete={handleDeleteEvent}
        />
      )}

      {uploadOpen && (
        <ScheduleUploadModal
          defaultMonth={selectedDate.slice(0, 7)}
          geminiConfigured={geminiConfigured}
          demoAiMode={demoAiMode}
          onClose={() => setUploadOpen(false)}
          onUpload={async (input) => {
            const res = await api.parseScheduleImage(input);
            await Promise.all([loadSideData(), loadRangeData()]);
            setToast(res.summary);
          }}
        />
      )}

      {logsOpen && (
        <div className="modal-backdrop" onClick={() => setLogsOpen(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="card-header">
              <div className="card-title">
                <History size={15} /> AI &amp; Cron 运行日志
              </div>
              <button className="btn btn-icon" onClick={() => setLogsOpen(false)}>
                <X size={16} />
              </button>
            </div>
            <div className="card-body">
              <div className="muted" style={{ marginBottom: 10 }}>
                AI 状态：
                {geminiConfigured
                  ? "✅ 已连接 Google Gemini API"
                  : demoAiMode
                    ? "🧪 离线 Demo AI 模式（无需 Key 即可体验，填入 GEMINI_API_KEY 后自动切真实 Gemini）"
                    : "⏳ 尚未配置 GEMINI_API_KEY"}
              </div>
              {runs.length === 0 ? (
                <div className="empty-hint">暂无运行记录。</div>
              ) : (
                runs.map((r) => (
                  <div key={r.id} style={{ padding: "7px 9px", border: "1px solid var(--border)", borderRadius: 8, marginBottom: 6 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                      <strong>{r.run_type}</strong>
                      <span className="muted">{r.created_at}</span>
                    </div>
                    <div style={{ fontSize: 12.5, marginTop: 2 }}>{r.summary}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
