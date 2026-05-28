const fs = require("fs");
let content = fs.readFileSync("app/report/page.tsx", "utf8");

content = content.replace(/field: "note"/g, "field: keyof SnapshotRow");
content = content.replace(/function startEdit\(id: string, currentNote: string\) \{/, "function startEdit(id: string, field: keyof SnapshotRow, currentValue: any) {\n    if (lockedRows.has(id)) return;\n    setEditingCell({ id, field });\n    setEditValue(String(currentValue));\n  }\n\n  // old startEdit");

content = content.replace(/function commitEdit\(\) \{\n\s*if \(\!editingCell\) return;\n\s*const updated = rows\.map\(r => r\.id === editingCell\.id \? \{ \.\.\.r, note: editValue \} : r\);\n\s*saveSnapshots\(updated\);\n\s*setRows\(updated\);\n\s*setEditingCell\(null\);\n\s*\}/, 
`function commitEdit() {
    if (!editingCell) return;
    const { id, field } = editingCell;
    const updated = rows.map(r => {
      if (r.id !== id) return r;
      let val: any = editValue;
      if (field !== "note" && field !== "date") {
        val = Number(editValue.replace(/[^0-9.-]/g, ""));
        if (isNaN(val)) val = r[field];
      }
      return { ...r, [field]: val };
    });
    saveSnapshots(updated);
    setRows(updated);
    setEditingCell(null);
  }`);

// Make editable cells in the table
const EDITABLE_FIELDS = [
  { field: "dailyPnl", regex: /<td style=\{\{ padding: "7px 10px", color: pnlColor\(row\.dailyPnl\), fontWeight: 600 \}\}>\{row\.dailyPnl >= 0 \? "\+" : ""\}\$\{fmt\(row\.dailyPnl, 0\)\}<\/td>/ },
  { field: "totalPnl", regex: /<td style=\{\{ padding: "7px 10px", color: pnlColor\(row\.totalPnl\), fontWeight: 600 \}\}>\{row\.totalPnl >= 0 \? "\+" : ""\}\$\{fmt\(row\.totalPnl, 0\)\}<\/td>/ },
  { field: "balanceUSD", regex: /<td style=\{\{ padding: "7px 10px" \}\}>\$\{fmt\(row\.balanceUSD, 0\)\}<\/td>/ },
  { field: "invested", regex: /<td style=\{\{ padding: "7px 10px", color: "var\(--text-secondary\)" \}\}>\$\{fmt\(row\.invested, 0\)\}<\/td>/ }
];

content = content.replace(/<td style=\{\{ padding: "7px 10px", color: pnlColor\(row\.dailyPnl\), fontWeight: 600 \}\}>\{row\.dailyPnl >= 0 \? "\+" : ""\}\$\{fmt\(row\.dailyPnl, 0\)\}<\/td>/,
  `{editingCell?.id === row.id && editingCell?.field === "dailyPnl" ? (
     <td style={{ padding: "7px 10px" }}><input autoFocus value={editValue} onChange={e=>setEditValue(e.target.value)} onBlur={commitEdit} onKeyDown={e=>{if(e.key==="Enter")commitEdit();if(e.key==="Escape")setEditingCell(null);}} style={{ width:"60px", background:"var(--bg-secondary)", border:"1px solid var(--accent)", color:"var(--text-primary)"}} /></td>
   ) : (
     <td onClick={() => startEdit(row.id, "dailyPnl", row.dailyPnl)} style={{ cursor: locked ? "default" : "text", padding: "7px 10px", color: pnlColor(row.dailyPnl), fontWeight: 600 }}>{row.dailyPnl >= 0 ? "+" : ""}\${fmt(row.dailyPnl, 0)}</td>
   )}`);

content = content.replace(/<td style=\{\{ padding: "7px 10px", color: pnlColor\(row\.totalPnl\), fontWeight: 600 \}\}>\{row\.totalPnl >= 0 \? "\+" : ""\}\$\{fmt\(row\.totalPnl, 0\)\}<\/td>/,
  `{editingCell?.id === row.id && editingCell?.field === "totalPnl" ? (
     <td style={{ padding: "7px 10px" }}><input autoFocus value={editValue} onChange={e=>setEditValue(e.target.value)} onBlur={commitEdit} onKeyDown={e=>{if(e.key==="Enter")commitEdit();if(e.key==="Escape")setEditingCell(null);}} style={{ width:"60px", background:"var(--bg-secondary)", border:"1px solid var(--accent)", color:"var(--text-primary)"}} /></td>
   ) : (
     <td onClick={() => startEdit(row.id, "totalPnl", row.totalPnl)} style={{ cursor: locked ? "default" : "text", padding: "7px 10px", color: pnlColor(row.totalPnl), fontWeight: 600 }}>{row.totalPnl >= 0 ? "+" : ""}\${fmt(row.totalPnl, 0)}</td>
   )}`);

content = content.replace(/<td style=\{\{ padding: "7px 10px" \}\}>\$\{fmt\(row\.balanceUSD, 0\)\}<\/td>/,
  `{editingCell?.id === row.id && editingCell?.field === "balanceUSD" ? (
     <td style={{ padding: "7px 10px" }}><input autoFocus value={editValue} onChange={e=>setEditValue(e.target.value)} onBlur={commitEdit} onKeyDown={e=>{if(e.key==="Enter")commitEdit();if(e.key==="Escape")setEditingCell(null);}} style={{ width:"60px", background:"var(--bg-secondary)", border:"1px solid var(--accent)", color:"var(--text-primary)"}} /></td>
   ) : (
     <td onClick={() => startEdit(row.id, "balanceUSD", row.balanceUSD)} style={{ cursor: locked ? "default" : "text", padding: "7px 10px" }}>\${fmt(row.balanceUSD, 0)}</td>
   )}`);

content = content.replace(/<td style=\{\{ padding: "7px 10px", color: "var\(--text-secondary\)" \}\}>\$\{fmt\(row\.invested, 0\)\}<\/td>/,
  `{editingCell?.id === row.id && editingCell?.field === "invested" ? (
     <td style={{ padding: "7px 10px" }}><input autoFocus value={editValue} onChange={e=>setEditValue(e.target.value)} onBlur={commitEdit} onKeyDown={e=>{if(e.key==="Enter")commitEdit();if(e.key==="Escape")setEditingCell(null);}} style={{ width:"60px", background:"var(--bg-secondary)", border:"1px solid var(--accent)", color:"var(--text-primary)"}} /></td>
   ) : (
     <td onClick={() => startEdit(row.id, "invested", row.invested)} style={{ cursor: locked ? "default" : "text", padding: "7px 10px", color: "var(--text-secondary)" }}>\${fmt(row.invested, 0)}</td>
   )}`);

// Fix note click wrapper
content = content.replace(/onClick=\{\(\) => startEdit\(row\.id, row\.note\)\}/, "onClick={() => startEdit(row.id, \"note\", row.note)}");

fs.writeFileSync("app/report/page.tsx", content);
console.log("DONE");
