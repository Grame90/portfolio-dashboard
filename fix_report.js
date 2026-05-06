const fs = require("fs");
let content = fs.readFileSync("app/report/page.tsx", "utf8");

content = content.replace(/const \[editingCell, setEditingCell\] = useState<\{ id: string; field: keyof SnapshotRow \} \| null>\(null\);/, 
  "const [editingCell, setEditingCell] = useState<{ id: string; field: keyof SnapshotRow } | null>(null);");

content = content.replace(/\/\/ old startEdit\n\s*if \(lockedRows.has\(id\)\) return;\n\s*setEditingCell\(\{ id, field: keyof SnapshotRow \}\);\n\s*setEditValue\(currentNote\);\n\s*\}/, "");

fs.writeFileSync("app/report/page.tsx", content);
console.log("DONE");
