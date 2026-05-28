const fs = require("fs");
let content = fs.readFileSync("components/PageHeader.tsx", "utf8");

// Add Zap icon import
content = content.replace('RefreshCw, FileDown, Settings, MoreHorizontal, CheckCircle, Upload, Info', 'RefreshCw, FileDown, Settings, MoreHorizontal, CheckCircle, Upload, Info, Zap');

// Add handleBybitSync function
const syncFunc = `
  async function handleBybitSync() {
    setMoreOpen(false);
    showToast("Синхронизация с Bybit...", "#f59e0b");
    try {
      const res = await fetch("/api/bybit");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ошибка API");
      
      const bybitBalances = data.balances || [];
      if (!bybitBalances.length) {
        showToast("Bybit: Активных балансов не найдено", "#f59e0b");
        return;
      }

      // Merge into positions-data
      const raw = localStorage.getItem("positions-data");
      let current = raw ? JSON.parse(raw) : [];
      
      // Remove old Bybit positions to replace with fresh ones
      current = current.filter((p: any) => p.broker !== "Bybit");
      
      // Add new Bybit positions
      const newPositions = bybitBalances.map((b: any, i: number) => ({
        id: Date.now() + i,
        ticker: b.ticker,
        name: b.ticker,
        type: b.type,
        qty: b.qty,
        avgPrice: 0, // We don't have cost basis from wallet balance API usually
        color: "#f59e0b",
        purchaseDate: new Date().toISOString().slice(0, 10),
        action: "Удерживать",
        broker: "Bybit"
      }));

      localStorage.setItem("positions-data", JSON.stringify([...current, ...newPositions]));
      app.refreshPositions();
      showToast(\`Bybit: Синхронизировано \${newPositions.length} позиций\`);
    } catch (err: any) {
      showToast(err.message, "#ef4444");
    }
  }
`;

content = content.replace('function handleImportFile', syncFunc + '\n  function handleImportFile');

// Add button to dropdown
const bybitBtn = `
                <button
                  onClick={handleBybitSync}
                  style={{ width: "100%", background: "none", border: "none", padding: "9px 16px", textAlign: "left", cursor: "pointer", fontSize: 13, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: 10 }}
                >
                  <Zap size={14} style={{ color: "#f59e0b" }} /> Синхронизировать Bybit
                </button>`;

content = content.replace('<button\n                   onClick={() => importRef.current?.click()}', bybitBtn + '\n                <button\n                   onClick={() => importRef.current?.click()}');

fs.writeFileSync("components/PageHeader.tsx", content);
console.log("DONE");
