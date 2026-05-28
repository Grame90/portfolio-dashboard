const fs = require("fs");
let content = fs.readFileSync("app/positions/page.tsx", "utf8");

content = content.replace('import { usePortfolioHistory } from "@/lib/usePortfolioHistory";',
  'import { usePortfolioHistory } from "@/lib/usePortfolioHistory";\nimport { useApp } from "@/lib/useApp";');

// Replace the state declarations
content = content.replace('const [positions, setPositions] = useState<Position[]>([]);',
  `const app = useApp();
  const positions = app.positions;
  const setPositions = (updater: any) => {
    const next = typeof updater === "function" ? updater(app.positions) : updater;
    app.setPositions(next.map(p => ({
      id: p.id, ticker: p.ticker, name: p.name, type: p.type, qty: p.qty,
      avgPrice: p.avgPrice, color: p.color, purchaseDate: p.purchaseDate, action: p.action, broker: p.broker
    })));
  };`);

// Remove fetchQuotes and its useEffect
content = content.replace(/const fetchQuotes = useCallback.*?\}\), \[\]\);/s, "");
content = content.replace(/useEffect\(\(\) => \{\n\s*const initial = loadPositions\(\);\n\s*setPositions\(initial\);\n\s*fetchQuotes\(initial\);\n.*?eslint-disable-next-line react-hooks\/exhaustive-deps\n\s*\}, \[fetchQuotes\]\);/s, "");

// Remove the local simulation of quotes (setInterval with Math.random)
content = content.replace(/useEffect\(\(\) => \{\n\s*const id = setInterval\(\(\) => \{\n\s*setPositions\(\(prev\) => \{.*?\n\s*\}\, \[\]\);/s, "");

fs.writeFileSync("app/positions/page.tsx", content);
console.log("DONE");
