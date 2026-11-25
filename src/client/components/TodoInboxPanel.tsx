import { useState } from "react";
import { CalendarPlus, Check, Inbox, Sparkles, Trash2 } from "lucide-react";
import { HOUSEHOLD } from "../../shared/household";
import type { TodoItem } from "../../shared/types";

interface Props {
  todos: TodoItem[];
  aiRunning: boolean;
  onAddTodo: (text: string, author: string) => Promise<void>;
  onToggleTodoDone: (todo: TodoItem) => void;
  onDeleteTodo: (id: string) => void;
  onConvertTodoToEvent: (todo: TodoItem) => void;
  onRunAi: () => void;
}

export function TodoInboxPanel({
  todos,
  aiRunning,
  onAddTodo,
  onToggleTodoDone,
  onDeleteTodo,
  onConvertTodoToEvent,
  onRunAi,
}: Props) {
  const [text, setText] = useState("");
  const [author, setAuthor] = useState<"partner_b" | "partner_a">("partner_b");
  const [submitting, setSubmitting] = useState(false);

  const pendingCount = todos.filter((t) => t.status === "pending").length;

  async function handleSaveTodo() {
    if (!text.trim() || submitting) return;
    setSubmitting(true);
    try {
      await onAddTodo(text.trim(), author);
      setText("");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="card">
      <div className="card-header">
        <div className="card-title">
          <Inbox size={15} /> 待办收件箱 / Inbox ({pendingCount})
        </div>
        <button className="btn btn-sm" onClick={onRunAi} disabled={aiRunning}>
          <Sparkles size={13} /> {aiRunning ? "整理中..." : "AI 整理"}
        </button>
      </div>
      <div className="card-body">
        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6, marginBottom: 6 }}>
            <div style={{ display: "flex", gap: 6 }}>
              <button
                type="button"
                className={`seg-btn ${author === "partner_b" ? "active-partner-b" : ""}`}
                onClick={() => setAuthor("partner_b")}
              >
                {HOUSEHOLD.partnerB.name} 记
              </button>
              <button
                type="button"
                className={`seg-btn ${author === "partner_a" ? "active" : ""}`}
                onClick={() => setAuthor("partner_a")}
              >
                {HOUSEHOLD.partnerA.name} 记
              </button>
            </div>
            <button
              className="btn btn-sm btn-primary"
              type="button"
              onClick={handleSaveTodo}
              disabled={submitting || !text.trim()}
            >
              {submitting ? "保存中..." : "记下"}
            </button>
          </div>
          <textarea
            className="textarea"
            rows={3}
            style={{ resize: "vertical" }}
            placeholder="可自由换行输入多行内容（排班、缴费、罢工、粘贴邮件片段）……写完点右上角「记下」"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        </div>

        <div style={{ marginTop: 10 }}>
          {todos.length === 0 ? (
            <div className="empty-hint">收件箱空空如也 · 随时随手记录家庭事项</div>
          ) : (
            todos.slice(0, 15).map((t) => {
              const isDone = t.status === "done" || t.status === "scheduled";
              const isPartnerB = t.author_id === "partner_b";
              return (
                <div key={t.id} className="todo-item">
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                      <span className={`todo-author ${isPartnerB ? "author-partner-b" : "author-partner-a"}`}>
                        {isPartnerB ? HOUSEHOLD.partnerB.name : HOUSEHOLD.partnerA.name}
                      </span>
                      {t.status === "proposed" && <span className="badge">AI 已出建议</span>}
                      {t.status === "scheduled" && <span className="badge badge-booked">已入日历</span>}
                    </div>
                    <div
                      style={{
                        fontSize: 13,
                        textDecoration: isDone ? "line-through" : "none",
                        opacity: isDone ? 0.55 : 1,
                        wordBreak: "break-word",
                        whiteSpace: "pre-line",
                      }}
                    >
                      {t.raw_text}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                    {!isDone && (
                      <button className="btn btn-sm" title="手动转为日历事件" onClick={() => onConvertTodoToEvent(t)}>
                        <CalendarPlus size={12} />
                      </button>
                    )}
                    <button className="btn btn-sm" title={isDone ? "重新打开" : "标记完成"} onClick={() => onToggleTodoDone(t)}>
                      <Check size={12} />
                    </button>
                    <button className="btn btn-sm btn-danger" title="删除" onClick={() => onDeleteTodo(t.id)}>
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
