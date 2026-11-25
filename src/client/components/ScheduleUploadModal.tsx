import { useRef, useState } from "react";
import { Camera, Sparkles, Upload, X } from "lucide-react";
import { HOUSEHOLD } from "../../shared/household";

interface Props {
  defaultMonth: string;
  geminiConfigured: boolean;
  demoAiMode: boolean;
  onClose: () => void;
  onUpload: (input: {
    image_base64: string;
    mime_type: string;
    hint_month: string;
    extra_note: string;
  }) => Promise<void>;
}

async function compressImageToJpegBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Failed to read image"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Unsupported image format"));
      img.onload = () => {
        const maxSide = 1600;
        let { width, height } = img;
        if (width > maxSide || height > maxSide) {
          if (width >= height) {
            height = Math.round((height * maxSide) / width);
            width = maxSide;
          } else {
            width = Math.round((width * maxSide) / height);
            height = maxSide;
          }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Canvas init failed"));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", 0.85));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

export function ScheduleUploadModal({
  defaultMonth,
  geminiConfigured,
  demoAiMode,
  onClose,
  onUpload,
}: Props) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [hintMonth, setHintMonth] = useState(defaultMonth);
  const [extraNote, setExtraNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleFileChange(file?: File) {
    if (!file) return;
    setError("");
    try {
      setPreviewUrl(await compressImageToJpegBase64(file));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!previewUrl) return;
    setLoading(true);
    setError("");
    try {
      await onUpload({
        image_base64: previewUrl,
        mime_type: "image/jpeg",
        hint_month: hintMonth,
        extra_note: extraNote.trim(),
      });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="card-header">
          <div className="card-title">
            <Camera size={16} color="var(--partner-b)" /> 上传 {HOUSEHOLD.partnerB.name} 班表图片 / Import Shift Roster
          </div>
          <button className="btn btn-icon" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <form className="card-body" onSubmit={handleSubmit}>
          {!geminiConfigured && (
            <div className="notice-banner">
              {demoAiMode
                ? "当前为离线 Demo AI 模式：上传任意图片将生成模拟排班建议供体验；配置 GEMINI_API_KEY 后即可启用真实多模态看图识表。"
                : "尚未配置 GEMINI_API_KEY：请在 .dev.vars 或 Cloudflare Secret 中填写 Key。"}
            </div>
          )}

          <div
            className="upload-dropzone"
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              handleFileChange(e.dataTransfer.files?.[0]);
            }}
          >
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={(e) => handleFileChange(e.target.files?.[0])}
            />
            {previewUrl ? (
              <img src={previewUrl} alt="Schedule preview" style={{ maxWidth: "100%", maxHeight: 240, borderRadius: 8 }} />
            ) : (
              <div>
                <Upload size={24} color="var(--partner-b)" />
                <div style={{ fontWeight: 600, marginTop: 6 }}>点击拍照 / 选择班表截图，或拖放到这里</div>
                <div className="muted" style={{ marginTop: 3 }}>
                  AI 自动识别上下班时间、休息与请假，放入待确认队列由你核对后一键写入
                </div>
              </div>
            )}
          </div>

          <div className="row-2" style={{ marginTop: 12 }}>
            <div className="field">
              <label>班表参考年月</label>
              <input className="input" type="month" value={hintMonth} onChange={(e) => setHintMonth(e.target.value)} />
            </div>
            <div className="field">
              <label>补充提示（选填）</label>
              <input className="input" placeholder="如：第 2 行 / 跨月班表" value={extraNote} onChange={(e) => setExtraNote(e.target.value)} />
            </div>
          </div>

          {error && <div style={{ color: "var(--danger)", fontSize: 12.5, marginBottom: 8 }}>{error}</div>}

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 8 }}>
            <button type="button" className="btn" onClick={onClose}>
              取消
            </button>
            <button type="submit" className="btn btn-primary" disabled={!previewUrl || loading}>
              <Sparkles size={14} /> {loading ? "识图中..." : "开始 AI 识表"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
