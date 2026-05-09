"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Upload, Check, X, RefreshCw, Trash2, ImagePlus } from "lucide-react";

type ScannedPosition = {
  id: number;
  ticker: string;
  name: string;
  type: string;
  qty: number;
  avgPrice: number;
  broker: string;
  color: string;
  purchaseDate: string;
  action: string;
  selected: boolean;
  isNew: boolean;
};

const BROKERS = ["Interactive Brokers", "Midas", "Binance", "Bybit", "Тинькофф"];
const TYPE_COLORS: Record<string, string> = {
  ETF: "#3b82f6", Акция: "#7c3aed", Крипто: "#f59e0b",
  Сырьё: "#84cc16", Облигация: "#06b6d4", Кэш: "#22c55e",
};

export default function ScanPage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);

  const [images, setImages] = useState<{ file: File; preview: string }[]>([]);
  const [broker, setBroker] = useState("");
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState("");
  const [positions, setPositions] = useState<ScannedPosition[]>([]);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [mode, setMode] = useState<"replace" | "merge">("merge");

  function addFiles(files: FileList | File[]) {
    const arr = Array.from(files).filter(f => f.type.startsWith("image/"));
    const newImgs = arr.map(file => ({ file, preview: URL.createObjectURL(file) }));
    setImages(prev => [...prev, ...newImgs]);
    setPositions([]);
    setError("");
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    addFiles(e.dataTransfer.files);
  }, []);

  async function handleScan() {
    if (!images.length) return;
    setLoading(true);
    setError("");
    setPositions([]);

    const existing = localStorage.getItem("positions-data") || "[]";
    const allPositions: ScannedPosition[] = [];

    for (let i = 0; i < images.length; i++) {
      setProgress(`Обрабатываю фото ${i + 1} из ${images.length}...`);
      const fd = new FormData();
      fd.append("image", images[i].file);
      fd.append("broker", broker);
      fd.append("existing", existing);

      try {
        const res = await fetch("/api/scan-portfolio", { method: "POST", body: fd });
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        const withSelected = (data.positions || []).map((p: any) => ({
          ...p,
          selected: true,
          isNew: true,
        }));
        allPositions.push(...withSelected);
      } catch (e: any) {
        setError(`Ошибка при обработке фото ${i + 1}: ${e.message}`);
      }
    }

    setPositions(allPositions);
    setProgress("");
    setLoading(false);
  }

  function toggleSelect(id: number) {
    setPositions(prev => prev.map(p => p.id === id ? { ...p, selected: !p.selected } : p));
  }

  function updateField(id: number, key: keyof ScannedPosition, val: string | number) {
    setPositions(prev => prev.map(p => p.id === id ? { ...p, [key]: val } : p));
  }

  function removePosition(id: number) {
    setPositions(prev => prev.filter(p => p.id !== id));
  }

  function handleApply() {
    const selected = positions.filter(p => p.selected);
    if (!selected.length) return;

    const existing: any[] = mode === "replace" ? [] : JSON.parse(localStorage.getItem("positions-data") || "[]");

    const merged = [...existing];
    for (const pos of selected) {
      const { selected: _, isNew: __, ...clean } = pos as any;
      const idx = merged.findIndex(e => e.ticker === pos.ticker && e.broker === pos.broker);
      if (idx >= 0) merged[idx] = { ...merged[idx], ...clean };
      else merged.push(clean);
    }

    localStorage.setItem("positions-data", JSON.stringify(merged));
    window.dispatchEvent(new CustomEvent("positions-updated"));
    setDone(true);
    setTimeout(() => router.push("/positions"), 1500);
  }

  const selectedCount = positions.filter(p => p.selected).length;

  return (
    <div style={{ padding: "20px 24px", maxWidth: 900, margin: "0 auto" }}>
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)" }}>Импорт из фото</div>
        <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 4 }}>
          Загрузи скриншот брокерского портфеля — ИИ распознает позиции автоматически
        </div>
      </div>

      {/* Upload area */}
      <div
        ref={dropRef}
        onDrop={onDrop}
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onClick={() => fileRef.current?.click()}
        style={{
          border: `2px dashed ${dragging ? "var(--accent)" : "var(--border)"}`,
          borderRadius: 14, padding: "32px 24px", textAlign: "center",
          cursor: "pointer", transition: "all 0.2s",
          background: dragging ? "rgba(124,58,237,0.06)" : "var(--bg-card)",
          marginBottom: 16,
        }}
      >
        <input ref={fileRef} type="file" accept="image/*" multiple style={{ display: "none" }}
          onChange={e => e.target.files && addFiles(e.target.files)} />
        <ImagePlus size={32} color="var(--accent-light)" style={{ marginBottom: 10 }} />
        <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", marginBottom: 4 }}>
          Перетащи скриншоты сюда или нажми для выбора
        </div>
        <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
          Можно загрузить несколько фото сразу (PNG, JPG, WebP)
        </div>
      </div>

      {/* Image previews */}
      {images.length > 0 && (
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
          {images.map((img, i) => (
            <div key={i} style={{ position: "relative" }}>
              <img src={img.preview} alt="" style={{ width: 80, height: 80, objectFit: "cover", borderRadius: 10, border: "1px solid var(--border)" }} />
              <button
                onClick={e => { e.stopPropagation(); setImages(prev => prev.filter((_, j) => j !== i)); }}
                style={{ position: "absolute", top: -6, right: -6, width: 20, height: 20, borderRadius: "50%", background: "#ef4444", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
              >
                <X size={12} color="white" />
              </button>
            </div>
          ))}
          <button
            onClick={e => { e.stopPropagation(); fileRef.current?.click(); }}
            style={{ width: 80, height: 80, borderRadius: 10, border: "2px dashed var(--border)", background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
          >
            <ImagePlus size={20} color="var(--text-muted)" />
          </button>
        </div>
      )}

      {/* Controls */}
      <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap", marginBottom: 20 }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 5 }}>Брокер (необязательно)</div>
          <input
            list="brokers-scan-list"
            value={broker}
            onChange={e => setBroker(e.target.value)}
            placeholder="Claude определит сам из скриншота"
            style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-secondary)", color: "var(--text-primary)", fontSize: 12, boxSizing: "border-box" }}
          />
          <datalist id="brokers-scan-list">{BROKERS.map(b => <option key={b} value={b} />)}</datalist>
        </div>
        <div>
          <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 5 }}>Режим импорта</div>
          <div style={{ display: "flex", borderRadius: 8, overflow: "hidden", border: "1px solid var(--border)" }}>
            {(["merge", "replace"] as const).map(m => (
              <button key={m} onClick={() => setMode(m)} style={{
                padding: "9px 16px", border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600,
                background: mode === m ? "var(--accent)" : "var(--bg-secondary)",
                color: mode === m ? "white" : "var(--text-secondary)",
              }}>
                {m === "merge" ? "Добавить к портфелю" : "Заменить портфель"}
              </button>
            ))}
          </div>
        </div>
        <button
          onClick={handleScan}
          disabled={!images.length || loading}
          style={{
            padding: "9px 24px", borderRadius: 8, border: "none", cursor: !images.length || loading ? "not-allowed" : "pointer",
            background: "var(--accent)", color: "white", fontSize: 13, fontWeight: 700,
            opacity: !images.length || loading ? 0.5 : 1, display: "flex", alignItems: "center", gap: 8,
          }}
        >
          {loading ? <RefreshCw size={15} style={{ animation: "spin 1s linear infinite" }} /> : <Upload size={15} />}
          {loading ? progress || "Анализирую..." : "Распознать"}
        </button>
      </div>

      {error && (
        <div style={{ padding: "12px 16px", borderRadius: 10, background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "#ef4444", fontSize: 13, marginBottom: 16 }}>
          {error}
        </div>
      )}

      {/* Results */}
      {positions.length > 0 && (
        <div className="card" style={{ padding: 18 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 10 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>
                Распознано: {positions.length} позиций
              </div>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                Выбрано для импорта: {selectedCount}. Нажми на строку чтобы включить/исключить.
              </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setPositions(p => p.map(x => ({ ...x, selected: true })))}
                style={{ padding: "6px 12px", borderRadius: 7, border: "1px solid var(--border)", background: "transparent", color: "var(--text-secondary)", cursor: "pointer", fontSize: 12 }}>
                Выбрать все
              </button>
              <button onClick={() => setPositions(p => p.map(x => ({ ...x, selected: false })))}
                style={{ padding: "6px 12px", borderRadius: 7, border: "1px solid var(--border)", background: "transparent", color: "var(--text-secondary)", cursor: "pointer", fontSize: 12 }}>
                Снять все
              </button>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {positions.map(pos => (
              <div key={pos.id}
                onClick={() => toggleSelect(pos.id)}
                style={{
                  display: "grid", gridTemplateColumns: "28px 70px 1fr 80px 80px 110px 100px 32px",
                  alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 10,
                  background: pos.selected ? "rgba(124,58,237,0.08)" : "var(--bg-secondary)",
                  border: `1px solid ${pos.selected ? "rgba(124,58,237,0.3)" : "var(--border)"}`,
                  cursor: "pointer", transition: "all 0.15s",
                }}
              >
                <div style={{
                  width: 20, height: 20, borderRadius: 5, border: `2px solid ${pos.selected ? "var(--accent)" : "var(--border)"}`,
                  background: pos.selected ? "var(--accent)" : "transparent",
                  display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                }}>
                  {pos.selected && <Check size={12} color="white" />}
                </div>

                <div style={{ fontWeight: 700, fontSize: 13, color: "var(--accent-light)" }}>{pos.ticker}</div>

                <div style={{ fontSize: 11, color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{pos.name}</div>

                <div>
                  <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 5, fontWeight: 600, background: `${TYPE_COLORS[pos.type] || "#7c3aed"}22`, color: TYPE_COLORS[pos.type] || "#7c3aed" }}>
                    {pos.type}
                  </span>
                </div>

                <input
                  type="number"
                  value={pos.qty}
                  onClick={e => e.stopPropagation()}
                  onChange={e => updateField(pos.id, "qty", parseFloat(e.target.value) || 0)}
                  style={{ width: "100%", padding: "4px 8px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg-card)", color: "var(--text-primary)", fontSize: 12, boxSizing: "border-box" }}
                />

                <input
                  type="number"
                  value={pos.avgPrice}
                  onClick={e => e.stopPropagation()}
                  onChange={e => updateField(pos.id, "avgPrice", parseFloat(e.target.value) || 0)}
                  style={{ width: "100%", padding: "4px 8px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg-card)", color: "var(--text-primary)", fontSize: 12, boxSizing: "border-box" }}
                />

                <input
                  type="text"
                  value={pos.broker}
                  onClick={e => e.stopPropagation()}
                  onChange={e => updateField(pos.id, "broker", e.target.value)}
                  placeholder="Брокер"
                  style={{ width: "100%", padding: "4px 8px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg-card)", color: "var(--text-primary)", fontSize: 11, boxSizing: "border-box" }}
                />

                <button
                  onClick={e => { e.stopPropagation(); removePosition(pos.id); }}
                  style={{ background: "none", border: "none", cursor: "pointer", padding: 4, display: "flex", alignItems: "center", justifyContent: "center" }}
                >
                  <Trash2 size={14} color="#ef4444" />
                </button>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 16, display: "flex", justifyContent: "flex-end" }}>
            {done ? (
              <div style={{ padding: "12px 24px", borderRadius: 10, background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.3)", color: "#22c55e", fontWeight: 700, fontSize: 13 }}>
                ✅ Импортировано! Переходим в позиции...
              </div>
            ) : (
              <button
                onClick={handleApply}
                disabled={!selectedCount}
                style={{
                  padding: "11px 28px", borderRadius: 10, border: "none",
                  background: selectedCount ? "var(--accent)" : "var(--border)",
                  color: selectedCount ? "white" : "var(--text-muted)",
                  fontSize: 13, fontWeight: 700, cursor: selectedCount ? "pointer" : "not-allowed",
                }}
              >
                Применить {selectedCount} позиций →
              </button>
            )}
          </div>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
