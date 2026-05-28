const fs = require("fs");
let content = fs.readFileSync("app/portfolio/page.tsx", "utf8");

// Remove duplicate const app = useApp() declarations if any
content = content.replace(/const app = useApp\(\);\n  const positions = app\.positions as unknown as LivePosition\[\];\n  const setPositions = \(updater: any\) => \{\n    const next = typeof updater === "function" \? updater\(positions\) : updater;\n    app\.setPositions\(next\);\n  \};\n/g, "");

content = content.replace(/export default function PortfolioPage\(\) \{/, 
  `export default function PortfolioPage() {
  const app = useApp();
  const positions = app.positions as unknown as LivePosition[];
  const setPositions = (updater: ((prev: LivePosition[]) => LivePosition[]) | LivePosition[]) => {
    const next = typeof updater === "function" ? updater(positions) : updater;
    app.setPositions(next as any);
  };
  `);

// Fix implicitly any
content = content.replace(/setPositions\(\(prev\) =>/g, "setPositions((prev: any) =>");
content = content.replace(/setPositions\(prev =>/g, "setPositions((prev: any) =>");
content = content.replace(/setPositions\(\(current\) =>/g, "setPositions((current: any) =>");
content = content.replace(/prev\.map\(\(p\) =>/g, "prev.map((p: any) =>");
content = content.replace(/prev\.map\(p =>/g, "prev.map((p: any) =>");

// Remove loadLivePositions usage
content = content.replace(/const initial = loadLivePositions\(\);/g, "const initial = positions;");

// Remove fetchQuotes call inside useEffect
content = content.replace(/setPositions\(\(prev: any\) => \{ fetchQuotes\(prev\); return prev; \}\);/g, "");

fs.writeFileSync("app/portfolio/page.tsx", content);
console.log("DONE");
