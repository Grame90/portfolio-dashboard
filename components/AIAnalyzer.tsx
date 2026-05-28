"use client";

import { useState } from "react";
import { Sparkles, Loader2, AlertTriangle } from "lucide-react";
import { Dialog } from "@/components/ui/Dialog";
import { useApp } from "@/lib/useApp";

export default function AIAnalyzer() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const { positions, portfolioTotal } = useApp();

  async function handleAnalyze() {
    if (!positions.length) {
      setError("Ваш портфель пуст. Добавьте позиции для анализа.");
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      const res = await fetch("/api/analyze-portfolio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ positions, totalValue: portfolioTotal }),
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || "Произошла ошибка при анализе.");
      }
      
      setResult(data.result);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        onClick={() => {
          setOpen(true);
          if (!result && !loading) {
            handleAnalyze();
          }
        }}
        className="btn-primary"
        style={{
          display: "flex", alignItems: "center", gap: 6,
          padding: "6px 12px", fontSize: 12, borderRadius: 8,
          background: "linear-gradient(135deg, #7c3aed, #9d6ef5)",
        }}
        title="AI Анализ Портфеля"
      >
        <Sparkles size={14} />
        <span>AI Анализ</span>
      </button>

      <Dialog 
        open={open} 
        onOpenChange={setOpen} 
        title="AI Анализ Портфеля" 
        description="Советы по диверсификации и ребалансировке от Claude AI"
        maxWidth={600}
      >
        <div style={{ minHeight: 200, display: "flex", flexDirection: "column" }}>
          {loading ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flex: 1, gap: 12, color: "var(--text-muted)" }}>
              <Loader2 size={32} className="animate-spin" />
              <div style={{ fontSize: 13 }}>Claude анализирует ваши активы...</div>
            </div>
          ) : error ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flex: 1, gap: 12, color: "#ef4444" }}>
              <AlertTriangle size={32} />
              <div style={{ fontSize: 13, textAlign: "center", maxWidth: "80%" }}>{error}</div>
              <button onClick={handleAnalyze} className="btn-primary" style={{ marginTop: 10 }}>Попробовать снова</button>
            </div>
          ) : result ? (
            <div style={{ fontSize: 13, color: "var(--text-primary)", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
              {/* Basic Markdown rendering for bold and lists */}
              {result.split('\\n').map((line, i) => {
                let formatted = line;
                // Bold formatting
                if (formatted.includes('**')) {
                  const parts = formatted.split('**');
                  return (
                    <div key={i} style={{ marginBottom: 6 }}>
                      {parts.map((part, j) => j % 2 === 1 ? <strong key={j} style={{ color: "var(--accent-light)" }}>{part}</strong> : part)}
                    </div>
                  );
                }
                return <div key={i} style={{ marginBottom: 6 }}>{formatted}</div>;
              })}
            </div>
          ) : null}
        </div>
      </Dialog>
    </>
  );
}
