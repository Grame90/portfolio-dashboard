const fs = require("fs");
let content = fs.readFileSync("app/portfolio/page.tsx", "utf8");

content = content.replace(/function loadLivePositions\(\): LivePosition\[\] \{[\s\S]*?\}\n\n/, "");
content = content.replace(/const \[positions, setPositions\] = useState<LivePosition\[\]>\(\[\]\);/,
  `const app = useApp();\n  const positions = app.positions as unknown as LivePosition[];\n  const setPositions = (updater: any) => {\n    const next = typeof updater === "function" ? updater(positions) : updater;\n    app.setPositions(next);\n  };`);

// Remove any manual `recompute` and fetch quotes effects
content = content.replace(/useEffect\(\(\) => \{\n\s*const initial = loadLivePositions\(\);\n\s*setPositions\(initial\);\n\s*fetchQuotes\(initial\);\n.*?\}\, \[fetchQuotes\]\);/s, "");
content = content.replace(/const fetchQuotes = useCallback.*?\}\), \[\]\);/s, "");
content = content.replace(/useEffect\(\(\) => \{\n\s*const id = setInterval\(\(\) => \{\n\s*setPositions\(\(prev\) => \{\n.*?\}\, 3000\);\n\s*return \(\) => clearInterval\(id\);\n\s*\}\, \[\]\);/s, "");

// Replace persist type logic if it exists
content = content.replace(/function persistPositions.*?\}\n/s, "");

fs.writeFileSync("app/portfolio/page.tsx", content);
console.log("DONE");
