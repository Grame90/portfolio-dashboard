"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import PageHeader from "@/components/PageHeader";
import { useApp } from "@/lib/useApp";

let tvScriptLoadingPromise: Promise<void> | null = null;

export default function ChartPage() {
  const app = useApp();
  const [selectedSymbol, setSelectedSymbol] = useState("NASDAQ:QQQ");
  
  // Получаем уникальные тикеры из портфеля (исключая кэш)
  const portfolioTickers = useMemo(() => {
    const tickers = Array.from(new Set(
      app.positions
        .filter(p => p.type !== "Кэш" && p.ticker)
        .map(p => p.ticker)
    )).slice(0, 10);
    return tickers;
  }, [app.positions.length]); // Only recompute if number of positions changes

  const tickersKey = portfolioTickers.join(",");

  useEffect(() => {
    const scriptId = "tradingview-widget-loading-script";
    
    if (!tvScriptLoadingPromise) {
      tvScriptLoadingPromise = new Promise((resolve) => {
        if (typeof window !== "undefined" && (window as any).TradingView) {
          resolve();
          return;
        }
        const script = document.createElement("script");
        script.id = scriptId;
        script.src = "https://s3.tradingview.com/tv.js";
        script.type = "text/javascript";
        script.onload = () => resolve();
        document.head.appendChild(script);
      });
    }

    tvScriptLoadingPromise.then(() => {
      // Даем DOM время обновиться перед инициализацией виджетов
      setTimeout(renderCharts, 200);
    });
  }, [tickersKey, selectedSymbol]);

  function renderCharts() {
    if (typeof window === "undefined" || !("TradingView" in window)) return;
    
    // Главный график
    if (document.getElementById("main_chart")) {
      new (window as any).TradingView.widget({
        autosize: true,
        symbol: selectedSymbol,
        interval: "D",
        timezone: "Europe/Istanbul",
        theme: "dark",
        style: "1",
        locale: "ru",
        enable_publishing: false,
        backgroundColor: "rgba(0, 0, 0, 1)",
        gridColor: "rgba(255, 255, 255, 0.06)",
        container_id: "main_chart",
      });
    }

    // Мини-графики для инструментов из портфеля
    portfolioTickers.forEach((ticker, idx) => {
      const containerId = `small_chart_${idx}`;
      if (document.getElementById(containerId)) {
        new (window as any).TradingView.widget({
          width: "100%",
          height: 180,
          symbol: ticker,
          interval: "D",
          timezone: "Europe/Istanbul",
          theme: "dark",
          style: "1",
          locale: "ru",
          enable_publishing: false,
          hide_top_toolbar: true,
          hide_legend: true,
          save_image: false,
          container_id: containerId,
        });
      }
    });
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "var(--bg-main)" }}>
      <PageHeader title="ГРАФИКИ" subtitle="Технический анализ инструментов вашего портфеля" />
      
      <div style={{ flex: 1, padding: "16px 24px", display: "grid", gridTemplateColumns: "1fr 300px", gap: 16 }}>
        
        {/* Левая часть: Основной большой график */}
        <div className="card" style={{ height: "calc(100vh - 140px)", padding: 0, overflow: "hidden", border: "1px solid var(--border)" }}>
          <div id="main_chart" style={{ width: "100%", height: "100%" }} />
        </div>

        {/* Правая часть: Список инструментов из портфеля с мини-графиками */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12, overflowY: "auto", maxHeight: "calc(100vh - 140px)", paddingRight: 4 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-secondary)", letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 4 }}>
            Инструменты в портфеле ({portfolioTickers.length})
          </div>
          
          {portfolioTickers.length === 0 ? (
            <div className="card" style={{ padding: 20, textAlign: "center", color: "var(--text-secondary)", fontSize: 12 }}>
              В портфеле пока нет инструментов для отображения графиков.
            </div>
          ) : (
            portfolioTickers.map((ticker, idx) => (
              <div 
                key={ticker} 
                className="card" 
                style={{ 
                  padding: 0, 
                  overflow: "hidden", 
                  minHeight: 180, 
                  cursor: "pointer",
                  position: "relative",
                  border: selectedSymbol === ticker ? "1px solid var(--accent)" : "1px solid var(--border)",
                  transition: "all 0.2s ease",
                  opacity: selectedSymbol === ticker ? 1 : 0.8
                }}
                onClick={() => setSelectedSymbol(ticker)}
              >
                <div style={{ 
                  position: "absolute", 
                  top: 8, 
                  left: 8, 
                  zIndex: 10, 
                  background: "rgba(0,0,0,0.8)", 
                  color: "white",
                  padding: "4px 8px", 
                  borderRadius: 4, 
                  fontSize: 11, 
                  fontWeight: 700,
                  border: "1px solid rgba(255,255,255,0.1)"
                }}>
                  {ticker}
                </div>
                <div id={`small_chart_${idx}`} style={{ width: "100%", height: "100%" }} />
                <div style={{ 
                  position: "absolute", 
                  bottom: 0, 
                  left: 0, 
                  right: 0, 
                  height: 40, 
                  background: "linear-gradient(to top, rgba(0,0,0,0.4), transparent)", 
                  pointerEvents: "none" 
                }} />
              </div>
            ))
          )}
        </div>

      </div>
    </div>
  );
}
