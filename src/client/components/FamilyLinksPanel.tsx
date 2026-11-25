import { useState } from "react";
import { ChevronDown, ChevronRight, ExternalLink, Link2, Plus, Trash2 } from "lucide-react";
import type { FamilyLink } from "../../shared/types";

interface Props {
  links: FamilyLink[];
  onAdd: (item: Partial<FamilyLink>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

const CAT_LABEL: Record<string, string> = {
  school: "学校",
  work: "班表",
  admin: "市政/缴费",
  home: "家庭",
  general: "常用",
};

export function FamilyLinksPanel({ links, onAdd, onDelete }: Props) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [category, setCategory] = useState("school");
  const [note, setNote] = useState("");
  const [adding, setAdding] = useState(false);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !url.trim()) return;
    setAdding(true);
    try {
      await onAdd({ title: title.trim(), url: url.trim(), category, note: note.trim() });
      setTitle("");
      setUrl("");
      setNote("");
    } finally {
      setAdding(false);
    }
  }

  return (
    <div className="card folded-bar">
      <div
        className="card-header"
        style={{ cursor: "pointer", borderBottom: open ? "1px solid var(--border)" : "none" }}
        onClick={() => setOpen((v) => !v)}
      >
        <div className="card-title">
          <Link2 size={15} color="var(--accent)" />
          家庭信息 &amp; 常用链接 / Quick Links ({links.length})
        </div>
        {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
      </div>

      {open && (
        <div className="card-body">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 8 }}>
            {links.map((lk) => (
              <div key={lk.id} className="link-tile">
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 5, marginBottom: 3 }}>
                    <span className="badge">{CAT_LABEL[lk.category] || lk.category}</span>
                    <a
                      href={lk.url}
                      target="_blank"
                      rel="noreferrer"
                      style={{ fontWeight: 700, color: "var(--accent)", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 3, fontSize: 13 }}
                    >
                      {lk.title} <ExternalLink size={11} />
                    </a>
                  </div>
                  {lk.note && <div className="muted">{lk.note}</div>}
                </div>
                <button className="btn btn-icon" style={{ border: "none", padding: 2, background: "transparent" }} title="删除" onClick={() => onDelete(lk.id)}>
                  <Trash2 size={12} color="var(--ink-muted)" />
                </button>
              </div>
            ))}
          </div>

          <form onSubmit={handleAdd} style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 12, paddingTop: 10, borderTop: "1px solid var(--border)" }}>
            <select className="select" style={{ width: 95 }} value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="school">学校</option>
              <option value="work">班表</option>
              <option value="admin">市政/缴费</option>
              <option value="home">家庭</option>
              <option value="general">常用</option>
            </select>
            <input className="input" style={{ width: 150 }} placeholder="名称" value={title} onChange={(e) => setTitle(e.target.value)} />
            <input className="input" style={{ flex: 1, minWidth: 180 }} placeholder="https://..." value={url} onChange={(e) => setUrl(e.target.value)} />
            <input className="input" style={{ width: 140 }} placeholder="备注（选填）" value={note} onChange={(e) => setNote(e.target.value)} />
            <button className="btn btn-primary" type="submit" disabled={adding || !title.trim() || !url.trim()}>
              <Plus size={13} /> 添加
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
