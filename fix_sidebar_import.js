const fs = require("fs");
let content = fs.readFileSync("components/Sidebar.tsx", "utf8");

content = content.replace('{ href: "/history",    icon: History,         label: "История" },',
  '{ href: "/history",    icon: History,         label: "История" },\n  { href: "/import",     icon: FileText,        label: "Импорт" },');

fs.writeFileSync("components/Sidebar.tsx", content);
console.log("DONE");
