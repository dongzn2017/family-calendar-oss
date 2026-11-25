import { useState } from "react";
import { AlertTriangle, Bell, Check, ChevronDown, ChevronRight, Zap } from "lucide-react";
import type { OverviewAlertItem } from "../../shared/types";

interface Props {
  alerts: OverviewAlertItem[];
  onSelectDate: (date: string) => void;
  onMarkEventDone: (eventId: string) => void;
}

function formatDaysLeft(days: number): string {
  if (days <= 0) return "今天 / Today";
  if (days === 1) return "明天 / Tomorrow";
  return `${days} 天后 / D-${days}`;
}

export function TopAlertsBar({ alerts, onSelectDate, onMarkEventDone }: Props) {
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem("familycal_alerts_collapsed") === "1";
    } catch {
      return false;
    }
  });

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("familycal_alerts_collapsed", next ? "1" : "0");
      } catch {
        // ignore
      }
      return next;
    });
  }

  if (alerts.length === 0) {
    return (
      <div className="alerts-strip">
        <div className="alerts-header" style={{ marginBottom: 0 }}>
          <span>
            <Bell size={13} style={{ verticalAlign: "-2px", marginRight: 5 }} />
            近 7 天重点预警 / 7-Day Radar
          </span>
          <span style={{ fontWeight: 500, textTransform: "none" }}>
            暂无红白电价、罢工或临期提醒 / All clear
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="alerts-strip">
      <div
        className="alerts-header"
        style={{ marginBottom: collapsed ? 0 : 8, cursor: "pointer" }}
        onClick={toggleCollapsed}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", minWidth: 0 }}>
          <span>
            <Bell size={13} style={{ verticalAlign: "-2px", marginRight: 5 }} />
            近 7 天重点预警 / 7-Day Radar ({alerts.length})
          </span>
          {collapsed && (
            <span className="muted" style={{ fontWeight: 400, textTransform: "none" }}>
              {alerts
                .slice(0, 3)
                .map((a) => `${formatDaysLeft(a.days_left).split(" / ")[0]}·${a.title}`)
                .join("  |  ")}
              {alerts.length > 3 ? `  +${alerts.length - 3}` : ""}
            </span>
          )}
        </div>
        <button
          type="button"
          className="btn btn-sm"
          onClick={(e) => {
            e.stopPropagation();
            toggleCollapsed();
          }}
        >
          {collapsed ? (
            <>
              展开 <ChevronRight size={13} />
            </>
          ) : (
            <>
              折叠 <ChevronDown size={13} />
            </>
          )}
        </button>
      </div>

      {!collapsed && (
        <div className="alerts-list">
          {alerts.map((a) => (
            <div
              key={a.ref_id}
              className={`alert-pill ${a.severity}`}
              onClick={() => onSelectDate(a.date)}
            >
              {a.kind === "tempo" ? <Zap size={14} /> : <AlertTriangle size={14} />}
              <span className="alert-days">{formatDaysLeft(a.days_left)}</span>
              <div>
                <div style={{ fontWeight: 700 }}>{a.title}</div>
                <div style={{ fontSize: 11, opacity: 0.85 }}>
                  {a.date} · {a.subtitle}
                </div>
              </div>
              {a.kind === "event" && a.event && (
                <button
                  className="btn btn-sm"
                  style={{ marginLeft: 4 }}
                  title="标记已完成 / Mark done"
                  onClick={(e) => {
                    e.stopPropagation();
                    onMarkEventDone(a.event!.id);
                  }}
                >
                  <Check size={12} /> 完成
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
