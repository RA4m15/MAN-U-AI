import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const distDir = path.resolve(__dirname, "../dist");
const indexHtmlPath = path.join(distDir, "index.html");

if (!fs.existsSync(indexHtmlPath)) {
  console.error("[postbuild] Error: dist/index.html does not exist!");
  process.exit(1);
}

const indexHtml = fs.readFileSync(indexHtmlPath, "utf-8");

// Create a static fallback for hosts that do not automatically apply SPA rewrites.
const notFoundPath = path.join(distDir, "404.html");
fs.writeFileSync(notFoundPath, indexHtml);
console.log("[postbuild] Created dist/404.html");

// Pre-generate files for top-level and panel-prefixed client routes so direct
// navigation and browser refresh work even before a hosting rewrite is configured.
const routes = [
  "login",
  "engineer-mobile-required",
  "unsupported-access",
  "knowledge",
  "equipment",
  "summaries",
  "insights",
  "activity",
  "integrations",
  "settings",
  "chat",
  "admin",
  "admin/assistant",
  "admin/chat",
  "admin/knowledge",
  "admin/equipment",
  "admin/summaries",
  "admin/insights",
  "admin/activity",
  "admin/integrations",
  "admin/settings",
  "manager",
  "manager/assistant",
  "manager/chat",
  "manager/knowledge",
  "manager/equipment",
  "manager/summaries",
];

for (const route of routes) {
  const routeDir = path.join(distDir, route);
  if (!fs.existsSync(routeDir)) {
    fs.mkdirSync(routeDir, { recursive: true });
  }
  fs.writeFileSync(path.join(routeDir, "index.html"), indexHtml);
  if (!route.includes("/")) {
    fs.writeFileSync(path.join(distDir, `${route}.html`), indexHtml);
  }
}
console.log(`[postbuild] Generated static fallbacks for ${routes.length} client routes.`);
