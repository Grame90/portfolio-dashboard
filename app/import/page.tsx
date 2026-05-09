"use client";

import { useState } from "react";
import PageHeader from "@/components/PageHeader";
import { Upload, FileText, Loader2, CheckCircle2, AlertCircle, Trash2, Save, ClipboardPaste } from "lucide-react";

type ExtractedTransaction = {
  date: string;
  ticker: string;
  type: "BUY" | "SELL" | "DIVIDEND" | "COMMISSION";
  qty: number;
  price: number;
  amount: number;
  commission: number;
  broker: string;
};

export default function ImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [pasteText, setPasteText] = useState("");
  const [showPaste, setShowPaste] = useState(false);
  const [loading, setLoading] = useState(false);
  const [transactions, setTransactions] = useState<ExtractedTransaction[]>([]);
  const [status, setStatus] = useState<"idle" | "parsed" | "saved">("idle");
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setError(null);
    setStatus("idle");
  };

  const handleScan = async () => {
    if (!file && !pasteText.trim()) {
      setError("Загрузите файл или вставьте текст отчёта.");
      return;
    }

    setLoading(true);
    setError(null);
    setStatus("idle");

    try {
      let res: Response;

      if (file) {
        const formData = new FormData();
        formData.append("file", file);
        res = await fetch("/api/scan-report", { method: "POST", body: formData });
      } else {
        res = await fetch("/api/scan-report", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: pasteText }),
        });
      }

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ошибка парсинга");

      if (!data.transactions || data.transactions.length === 0) {
        setError("Операции не найдены. Убедитесь что файл содержит данные о сделках.");
        return;
      }

      setTransactions(data.transactions);
      setStatus("parsed");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = () => {
    const existingOps = JSON.parse(localStorage.getItem("operations-log") || "[]");
    const newOps = transactions.map(t => ({
      date: t.date.split("-").reverse().join("."),
      ticker: t.ticker,
      action: t.type === "BUY" ? "Покупка" : t.type === "SELL" ? "Продажа" : t.type === "DIVIDEND" ? "Дивиденды" : "Комиссия",
      qty: t.qty,
      price: t.price,
      sum: t.type === "BUY" ? -t.amount : t.amount,
      broker: t.broker,
    }));
    localStorage.setItem("operations-log", JSON.stringify([...newOps, ...existingOps]));
    setStatus("saved");
    setTransactions([]);
    setFile(null);
    setPasteText("");
  };

  const hasInput = !!file || pasteText.trim().length > 0;

  return (
    <div style={{ minHeight: "100vh" }}>
      <PageHeader title="ИМПОРТ ОТЧЕТОВ" subtitle="Автоматическое распознавание выписок брокеров через ИИ" />

      <div style={{ padding: "16px 24px", display: "flex", flexDirection: "column", gap: 20 }}>

        {/* Upload Section */}
        <div className="card" style={{ padding: 24 }}>
          <div style={{ textAlign: "center", marginBottom: 20 }}>
            <Upload size={36} style={{ color: "var(--accent)", marginBottom: 10 }} />
            <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>Загрузите отчёт брокера</h3>
            <p style={{ fontSize: 12, color: "var(--text-muted)" }}>
              PDF, CSV, TXT — все форматы поддерживаются.<br />
              ИИ понимает русский, английский, турецкий и другие языки.
            </p>
          </div>

          <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
            <label className="btn-secondary" style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}>
              <FileText size={15} />
              Выбрать файл (PDF / CSV / TXT)
              <input type="file" hidden onChange={handleFileChange} accept=".pdf,.csv,.txt,.tsv" />
            </label>
            <button
              className="btn-secondary"
              onClick={() => setShowPaste(v => !v)}
              style={{ display: "flex", alignItems: "center", gap: 8 }}
            >
              <ClipboardPaste size={15} />
              Вставить текст
            </button>
          </div>

          {file && (
            <div style={{ marginTop: 14, textAlign: "center" }}>
              <div style={{ fontSize: 12, color: "var(--accent-light)", marginBottom: 4 }}>
                ✓ {file.name} ({(file.size / 1024).toFixed(1)} KB)
              </div>
              <button
                onClick={() => setFile(null)}
                style={{ fontSize: 10, color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer" }}
              >
                ✕ убрать
              </button>
            </div>
          )}

          {showPaste && (
            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 6 }}>
                Вставьте текст из отчёта:
              </div>
              <textarea
                value={pasteText}
                onChange={e => setPasteText(e.target.value)}
                placeholder={"Дата\tТикер\tКол-во\tЦена\tСумма\n2024-01-15\tAAPL\t10\t185.50\t1855.00"}
                style={{
                  width: "100%", minHeight: 140, padding: 12, borderRadius: 8,
                  border: "1px solid var(--border)", background: "var(--bg-secondary)",
                  color: "var(--text-primary)", fontSize: 12, fontFamily: "monospace",
                  resize: "vertical", boxSizing: "border-box",
                }}
              />
              {pasteText && (
                <div style={{ fontSize: 10, color: "var(--accent-light)", marginTop: 3 }}>
                  {pasteText.length.toLocaleString()} символов
                </div>
              )}
            </div>
          )}

          <div style={{ marginTop: 18, display: "flex", justifyContent: "center" }}>
            <button
              className="btn-primary"
              onClick={handleScan}
              disabled={loading || !hasInput}
              style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 210, justifyContent: "center" }}
            >
              {loading
                ? <><Loader2 size={15} className="animate-spin" /> Анализирую...</>
                : "🤖 Распознать операции"}
            </button>
          </div>
        </div>

        {error && (
          <div className="card" style={{ background: "rgba(239,68,68,0.1)", border: "1px solid #ef4444", color: "#ef4444", display: "flex", alignItems: "flex-start", gap: 10, padding: 16 }}>
            <AlertCircle size={18} style={{ flexShrink: 0, marginTop: 1 }} />
            <div style={{ fontSize: 13 }}>{error}</div>
          </div>
        )}

        {status === "saved" && (
          <div className="card" style={{ background: "rgba(34,197,94,0.1)", border: "1px solid #22c55e", color: "#22c55e", display: "flex", alignItems: "center", gap: 10 }}>
            <CheckCircle2 size={18} />
            <div style={{ fontSize: 13 }}>Операции успешно добавлены в историю!</div>
          </div>
        )}

        {transactions.length > 0 && (
          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
              <div style={{ fontSize: 14, fontWeight: 600 }}>Найдено операций: {transactions.length}</div>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn-secondary" onClick={() => setTransactions([])} style={{ color: "#ef4444", display: "flex", alignItems: "center", gap: 6 }}>
                  <Trash2 size={13} /> Сбросить
                </button>
                <button className="btn-primary" onClick={handleSave} style={{ background: "#22c55e", display: "flex", alignItems: "center", gap: 6 }}>
                  <Save size={13} /> Сохранить
                </button>
              </div>
            </div>

            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr style={{ background: "var(--bg-secondary)", borderBottom: "1px solid var(--border)" }}>
                    {["Дата", "Тикер", "Тип", "Кол-во", "Цена", "Сумма", "Брокер"].map(h => (
                      <th key={h} style={{ padding: "10px 14px", textAlign: "left", color: "var(--text-muted)", fontWeight: 600, whiteSpace: "nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((t, i) => (
                    <tr key={i} style={{ borderBottom: "1px solid var(--border)" }}>
                      <td style={{ padding: "9px 14px", whiteSpace: "nowrap" }}>{t.date}</td>
                      <td style={{ padding: "9px 14px", fontWeight: 700 }}>{t.ticker}</td>
                      <td style={{ padding: "9px 14px" }}>
                        <span style={{
                          padding: "2px 7px", borderRadius: 4, fontSize: 10, fontWeight: 700,
                          background: t.type === "BUY" ? "rgba(34,197,94,0.12)" : t.type === "SELL" ? "rgba(239,68,68,0.12)" : "rgba(59,130,246,0.12)",
                          color: t.type === "BUY" ? "#22c55e" : t.type === "SELL" ? "#ef4444" : "#3b82f6",
                        }}>
                          {t.type}
                        </span>
                      </td>
                      <td style={{ padding: "9px 14px" }}>{t.qty}</td>
                      <td style={{ padding: "9px 14px" }}>{t.price}</td>
                      <td style={{ padding: "9px 14px", fontWeight: 600 }}>{t.amount}</td>
                      <td style={{ padding: "9px 14px", color: "var(--text-muted)" }}>{t.broker}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
