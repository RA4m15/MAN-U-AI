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

// 1. Create 404.html as SPA fallback for static hosts (Render, GitHub Pages, etc.)
const notFoundPath = path.join(distDir, "404.html");
fs.writeFileSync(notFoundPath, indexHtml);
console.log("[postbuild] Created dist/404.html");

// 2. Pre-generate static route files for all client-side routes in App.tsx
// This ensures direct navigation and browser refresh return HTTP 200 OK
// on static hosts even if a server-side SPA rewrite rule has not yet been applied.
const routes = [
  "login",
  "knowledge",
  "equipment",
  "summaries",
  "insights",
  "activity",
  "integrations",
  "settings",
  "chat",
];

for (const route of routes) {
  const routeDir = path.join(distDir, route);
  if (!fs.existsSync(routeDir)) {
    fs.mkdirSync(routeDir, { recursive: true });
  }
  fs.writeFileSync(path.join(routeDir, "index.html"), indexHtml);
  fs.writeFileSync(path.join(distDir, `${route}.html`), indexHtml);
}
console.log(`[postbuild] Generated static fallbacks for ${routes.length} client routes.`);
