"use client";

import type { Dispatch, SetStateAction } from "react";
import ApexChart from "@/components/ApexChart";
import type { Snapshot } from "../types";

interface SnapshotEditValue {
  comment: string;
  capital: string;
}

interface SnapshotsProps {
  liveSnapshots: Snapshot[];
  setLiveSnapshots: Dispatch<SetStateAction<Snapshot[]>>;
  snapshotExpanded: boolean;
  setSnapshotExpanded: Dispatch<SetStateAction<boolean>>;
  editingSnap: number | null;
  setEditingSnap: Dispatch<SetStateAction<number | null>>;
  editSnapVal: SnapshotEditValue;
  setEditSnapVal: Dispatch<SetStateAction<SnapshotEditValue>>;
}

export function Snapshots({
  liveSnapshots,
  setLiveSnapshots,
  snapshotExpanded,
  setSnapshotExpanded,
  editingSnap,
  setEditingSnap,
  editSnapVal,
  setEditSnapVal,
}: SnapshotsProps) {
  function commitEdit(idx: number) {
    const updated = liveSnapshots.map((snap, i) => i === idx ? {
      ...snap,
      comment: editSnapVal.comment || snap.comment,
      capital: Number(editSnapVal.capital) || snap.capital,
    } : snap);
    setLiveSnapshots(updated);
    try { localStorage.setItem("snapshots-data", JSON.stringify(updated)); } catch {}
    setEditingSnap(null);
  }

  function deleteSnapshot(idx: number) {
    const updated = liveSnapshots.filter((_, i) => i !== idx);
    setLiveSnapshots(updated);
    try { localStorage.setItem("snapshots-data", JSON.stringify(updated)); } catch {}
  }

  return (
    <div className="card" style={{ display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <div className="card-title" style={{ marginBottom: 0 }}>Снапшоты портфеля</div>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <span style={{ fontSize: 9, color: "var(--text-muted)" }}>{liveSnapshots.length} записей</span>
          <button
            onClick={() => setSnapshotExpanded(o => !o)}
            style={{ fontSize: 10, padding: "2px 7px", borderRadius: 5, border: "1px solid var(--border)", background: "transparent", color: "var(--text-secondary)", cursor: "pointer" }}
          >
            {snapshotExpanded ? "▲" : "▼"}
          </button>
        </div>
      </div>

      {liveSnapshots.length === 0 ? (
        <div style={{ padding: "16px 0", textAlign: "center", color: "var(--text-muted)", fontSize: 12 }}>
          Нет снапшотов.<br />Нажмите «Фиксировать» в шапке страницы.
        </div>
      ) : (() => {
        const latest = liveSnapshots[0];
        const prev = liveSnapshots[1];
        const diff = prev ? latest.capital - prev.capital : 0;
        return (
          <div style={{ padding: "10px 12px", background: "var(--bg-secondary)", borderRadius: 8, border: "1px solid var(--border)", marginBottom: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <div style={{ fontSize: 9, color: "var(--text-muted)", marginBottom: 2 }}>Последняя фиксация · {latest.date} {latest.time}</div>
                <div style={{ fontSize: 18, fontWeight: 700 }}>${latest.capital.toLocaleString("en-US")}</div>
                <div style={{ fontSize: 10, color: "var(--text-secondary)", marginTop: 2 }}>{latest.comment}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#22c55e" }}>{latest.profitPct}</div>
                {prev && (
                  <div style={{ fontSize: 10, color: diff >= 0 ? "#22c55e" : "#ef4444" }}>
                    {diff >= 0 ? "+" : ""}{diff.toLocaleString("en-US")} vs пред.
                  </div>
                )}
              </div>
            </div>
            {liveSnapshots.length >= 2 && (() => {
              const snapData = liveSnapshots.slice(0, 8).reverse().map(s => s.capital);
              return (
                <ApexChart
                  type="area"
                  height={44}
                  series={[{ data: snapData }]}
                  options={{
                    chart: { type: "area", toolbar: { show: false }, background: "transparent", sparkline: { enabled: true }, animations: { enabled: false } },
                    stroke: { curve: "smooth", width: 1.5, colors: ["#22c55e"] },
                    fill: { type: "gradient", gradient: { shadeIntensity: 1, opacityFrom: 0.3, opacityTo: 0, stops: [0, 100], colorStops: [{ offset: 0, color: "#22c55e", opacity: 0.3 }, { offset: 100, color: "#22c55e", opacity: 0 }] } },
                    tooltip: { theme: "dark", fixed: { enabled: false }, y: { formatter: (v: number) => `$${Number(v).toLocaleString("en-US")}` } },
                    dataLabels: { enabled: false },
                    theme: { mode: "dark" },
                  }}
                />
              );
            })()}
          </div>
        );
      })()}

      <div style={{ display: "flex", flexDirection: "column", gap: 4, overflowY: "auto", maxHeight: snapshotExpanded ? 500 : 200 }}>
        {liveSnapshots.map((s, i) => {
          const prevCap = liveSnapshots[i + 1]?.capital ?? s.capital;
          const delta = s.capital - prevCap;
          const isEditing = editingSnap === i;
          return (
            <div
              key={s.date + s.time + i}
              style={{
                borderRadius: 6,
                background: i === 0 ? "rgba(124,58,237,0.08)" : "transparent",
                border: i === 0 ? "1px solid rgba(124,58,237,0.2)" : "1px solid var(--border)",
                overflow: "hidden",
              }}
            >
              {isEditing ? (
                <div style={{ padding: "8px 10px", display: "flex", flexDirection: "column", gap: 6 }}>
                  <div style={{ display: "flex", gap: 6 }}>
                    <input
                      value={editSnapVal.comment}
                      onChange={(e) => setEditSnapVal(v => ({ ...v, comment: e.target.value }))}
                      placeholder="Комментарий"
                      style={{ flex: 1, fontSize: 11, padding: "4px 8px", borderRadius: 5, border: "1px solid var(--accent)", background: "var(--bg-secondary)", color: "var(--text-primary)" }}
                    />
                    <input
                      value={editSnapVal.capital}
                      onChange={(e) => setEditSnapVal(v => ({ ...v, capital: e.target.value }))}
                      placeholder="Капитал $"
                      type="number"
                      style={{ width: 90, fontSize: 11, padding: "4px 8px", borderRadius: 5, border: "1px solid var(--accent)", background: "var(--bg-secondary)", color: "var(--text-primary)" }}
                    />
                  </div>
                  <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                    <button
                      onClick={() => setEditingSnap(null)}
                      style={{ fontSize: 10, padding: "3px 10px", borderRadius: 5, border: "1px solid var(--border)", background: "transparent", color: "var(--text-muted)", cursor: "pointer" }}
                    >Отмена</button>
                    <button
                      onClick={() => commitEdit(i)}
                      style={{ fontSize: 10, padding: "3px 10px", borderRadius: 5, border: "none", background: "var(--accent)", color: "white", cursor: "pointer" }}
                    >Сохранить</button>
                  </div>
                </div>
              ) : (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "5px 8px" }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", minWidth: 0 }}>
                    <div style={{ width: 6, height: 6, borderRadius: "50%", background: i === 0 ? "var(--accent)" : "var(--border)", flexShrink: 0 }} />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 10, fontWeight: 600 }}>{s.date} <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>{s.time}</span></div>
                      <div style={{ fontSize: 9, color: "var(--text-secondary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 130 }}>{s.comment}</div>
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 11, fontWeight: 700 }}>${s.capital.toLocaleString("en-US")}</div>
                      <div style={{ display: "flex", gap: 4, justifyContent: "flex-end", alignItems: "center" }}>
                        <span style={{ fontSize: 9, color: "#22c55e", fontWeight: 600 }}>{s.profitPct}</span>
                        {i < liveSnapshots.length - 1 && (
                          <span style={{ fontSize: 9, color: delta >= 0 ? "#22c55e" : "#ef4444" }}>
                            {delta >= 0 ? "▲" : "▼"}{Math.abs(delta).toLocaleString("en-US")}
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => { setEditingSnap(i); setEditSnapVal({ comment: s.comment, capital: String(s.capital) }); }}
                      title="Редактировать"
                      style={{ background: "none", border: "none", cursor: "pointer", padding: 2, color: "var(--text-muted)", fontSize: 12, lineHeight: 1 }}
                    >✏️</button>
                    <button
                      onClick={() => deleteSnapshot(i)}
                      title="Удалить"
                      style={{ background: "none", border: "none", cursor: "pointer", padding: 2, color: "#ef4444", fontSize: 12, lineHeight: 1 }}
                    >✕</button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
