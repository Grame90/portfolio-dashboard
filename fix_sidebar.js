const fs = require("fs");
let content = fs.readFileSync("components/Sidebar.tsx", "utf8");

content = content.replace('{ href: "/analytics",  icon: BarChart2,       label: "Аналитика" },',
  '{ href: "/chart",      icon: TrendingUp,      label: "Графики" },\n  { href: "/analytics",  icon: BarChart2,       label: "Аналитика" },');

fs.writeFileSync("components/Sidebar.tsx", content);
console.log("DONE");
