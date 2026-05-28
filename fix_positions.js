const fs = require("fs");
let content = fs.readFileSync("app/positions/page.tsx", "utf8");

// Fix setPositions type
content = content.replace(
  'const setPositions = (updater: any) => {',
  'const setPositions = (updater: ((prev: Position[]) => Position[]) | Position[]) => {'
);

// Fix TS implicitly any in setPositions argument
content = content.replace(/next\.map\(p =>/g, "next.map((p: any) =>");

// Remove recompute wrapper from next (e.g. const next = recompute(...))
content = content.replace(/const next = recompute\((.*?)\);/g, "const next = $1;");

// There might be cases where recompute spans multiple lines
content = content.replace(/return recompute\(([\s\S]*?)\);/g, "return $1;");
content = content.replace(/const result = recompute\((.*?)\);/g, "const result = $1;");

fs.writeFileSync("app/positions/page.tsx", content);
console.log("DONE");
