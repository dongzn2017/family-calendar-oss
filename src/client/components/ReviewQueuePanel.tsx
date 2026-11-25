import { useState } from "react";
import { AlertTriangle, CalendarPlus, Check, CheckCheck, Sparkles, X } from "lucide-react";
import type { AiProposal, PartnerBStatus } from "../../shared/types";

interface Props {
  proposals: AiProposal[];
  onConfirm: (id: string, overridePayload?: Record<string, unknown>) => Promise<void>;
  onConfirmAll: () => Promise<void>;
  onDismiss: (id: string) => Promise<void>;
  onPromoteNoticeToEvent: (title: string, date: string, description: string) => void;
}

export function ReviewQueuePanel({
  proposals,
  onConfirm,
  onConfirmAll,
  onDismiss,
  onPromoteNoticeToEvent,
}: Props) {
  const [edits, setEdits] = useState<Record<string, Record<string, unknown>>>({});
  const [busyAll, setBusyAll] = useState(false);

  if (proposals.length === 0) return null;

  const writableCount = proposals.filter((p) => p.kind !== "notice").length;

  function getPayload(p: AiProposal): Record<string, unknown> {
    if (edits[p.id]) return edits[p.id];
    try {
      return JSON.parse(p.payload_json) as Record<string, unknown>;
    } catch {
      return {};
    }
  }

  function patchPayload(p: AiProposal, patch: Record<string, unknown>) {
    const cur = getPayload(p);
    setEdits((prev) => ({ ...prev, [p.id]: { ...cur, ...patch } }));
  }

  return (
    <div className="card card-review">
      <div className="card-header">
        <div className="card-title" style={{ color: "var(--accent)" }}>
          <Sparkles size={15} /> AI 待确认建议 ({proposals.length})
        </div>
        {writableCount > 1 && (
          <button
            className="btn btn-sm btn-primary"
            disabled={busyAll}
            onClick={async () => {
              setBusyAll(true);
              try {
                await onConfirmAll();
              } finally {
                setBusyAll(false);
              }
            }}
          >
            <CheckCheck size={13} /> 全部确认 ({writableCount})
          </button>
        )}
      </div>
      <div className="card-body">
        {proposals.map((p) => {
          const payload = getPayload(p);
          const isNotice = p.kind === "notice";
          const isShiftProposal =
            p.kind === "daily_status" && payload.partner_b_status !== undefined;

          return (
            <div key={p.id} className={`proposal-card ${isNotice ? "is-notice" : ""}`}>
              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 5, marginBottom: 4 }}>
                <span className="badge">
                  {isNotice
                    ? "⚠️ 仅提醒·不自动入库"
                    : p.kind === "daily_status"
                      ? "每日排班/状态"
                      : "日历日程"}
                </span>
                <span className="badge">
                  {p.source_type === "schedule_image"
                    ? "📷 班表识图"
                    : p.source_type === "gmail"
                      ? "📧 精选邮件"
                      : "📝 待办"}
                </span>
              </div>

              <div style={{ fontWeight: 600, marginBottom: 6, fontSize: 13 }}>{p.summary}</div>

              {isNotice && typeof payload.note === "string" && payload.note && (
                <div className="muted" style={{ marginBottom: 6 }}>
                  {payload.note}
                </div>
              )}

              {isShiftProposal && (
                <div style={{ display: "flex", gap: 6, marginBottom: 7, flexWrap: "wrap" }}>
                  <select
                    className="select"
                    style={{ width: 105, padding: "4px 6px", fontSize: 12 }}
                    value={String(payload.partner_b_status || "work")}
                    onChange={(e) =>
                      patchPayload(p, { partner_b_status: e.target.value as PartnerBStatus })
                    }
                  >
                    <option value="work">上班</option>
                    <option value="off">休息 Repos</option>
                    <option value="leave">请假 Leave</option>
                  </select>
                  {payload.partner_b_status === "work" && (
                    <input
                      className="input"
                      style={{ flex: 1, minWidth: 110, padding: "4px 7px", fontSize: 12 }}
                      placeholder="HH:MM-HH:MM"
                      value={String(payload.partner_b_hours || "")}
                      onChange={(e) => patchPayload(p, { partner_b_hours: e.target.value })}
                    />
                  )}
                </div>
              )}

              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {isNotice ? (
                  <>
                    <button
                      className="btn btn-sm"
                      onClick={() =>
                        onPromoteNoticeToEvent(
                          p.summary,
                          String(payload.date || ""),
                          String(payload.note || "")
                        )
                      }
                    >
                      <CalendarPlus size={12} /> 核实后手动录入
                    </button>
                    <button className="btn btn-sm" onClick={() => onDismiss(p.id)}>
                      <AlertTriangle size={12} /> 已知晓关闭
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      className="btn btn-sm btn-primary"
                      onClick={() => onConfirm(p.id, edits[p.id])}
                    >
                      <Check size={12} /> 确认写入
                    </button>
                    <button className="btn btn-sm" onClick={() => onDismiss(p.id)}>
                      <X size={12} /> 忽略
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
