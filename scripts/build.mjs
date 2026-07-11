import { build } from "esbuild";
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const outdir = path.join(root, "dist");
await rm(outdir, { recursive: true, force: true });
await mkdir(outdir, { recursive: true });
await cp(path.join(root, "public"), outdir, { recursive: true });

const result = await build({
  entryPoints: [path.join(root, "src/main.tsx")],
  bundle: true,
  format: "esm",
  jsx: "automatic",
  splitting: true,
  minify: true,
  sourcemap: false,
  target: ["chrome107", "edge107", "firefox104", "safari16"],
  outdir,
  entryNames: "assets/app-[hash]",
  chunkNames: "assets/chunk-[hash]",
  assetNames: "assets/asset-[hash]",
  metafile: true,
  legalComments: "none",
  define: {
    "import.meta.env.PROD": "true",
    "import.meta.env.BASE_URL": JSON.stringify("/onevault/"),
    "import.meta.env.VITE_MS_CLIENT_ID": JSON.stringify(process.env.VITE_MS_CLIENT_ID ?? ""),
    "import.meta.env.VITE_VAULT_FOLDER": JSON.stringify(process.env.VITE_VAULT_FOLDER ?? "KnowledgeVault"),
  },
});

const outputs = Object.keys(result.metafile.outputs);
const entryOutput = outputs.find((output) => result.metafile.outputs[output].entryPoint?.endsWith("src/main.tsx"));
if (!entryOutput) throw new Error("Application bundle was not generated.");
const cssOutput = outputs.find((output) => output.endsWith(".css"));
const relative = (output) => {
  const normalized = output.replaceAll("\\", "/");
  if (normalized.startsWith("dist/")) return normalized.slice("dist/".length);
  return path.relative(outdir, output).replaceAll("\\", "/");
};
const jsFile = relative(entryOutput);
const cssFile = cssOutput ? relative(cssOutput) : "";

let html = await readFile(path.join(root, "index.html"), "utf8");
html = html.replace('<script type="module" src="/src/main.tsx"></script>', '<script type="module" src="./boot.js"></script>');
html = html.replace("</head>", `    <link rel="manifest" href="./manifest.webmanifest" />\n${cssFile ? `    <link rel="stylesheet" href="./${cssFile}" />\n` : ""}  </head>`);
await writeFile(path.join(outdir, "index.html"), html, "utf8");
await writeFile(
  path.join(outdir, "boot.js"),
  `import("./${jsFile}").catch(error => { console.error(error); const root = document.getElementById("root"); if (root) { root.textContent = "OneVaultを起動できませんでした。再読み込みしてください。"; root.dataset.error = String(error && (error.stack || error.message || error)); } });\n`,
  "utf8",
);

const manifest = {
  name: "OneVault",
  short_name: "OneVault",
  description: "暗号化オフライン対応のOneDrive Markdown Vault",
  theme_color: "#171717",
  background_color: "#171717",
  display: "standalone",
  start_url: "./",
  scope: "./",
  orientation: "any",
  icons: [
    { src: "onevault-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
    { src: "onevault-512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" },
    { src: "onevault.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
  ],
  shortcuts: [
    { name: "新規ノート", short_name: "新規", url: "./?action=new" },
    { name: "日次ノート", short_name: "日次", url: "./?action=daily" },
  ],
};
await writeFile(path.join(outdir, "manifest.webmanifest"), JSON.stringify(manifest, null, 2), "utf8");

const cacheFiles = ["./", "./index.html", "./boot.js", "./manifest.webmanifest", "./onevault.svg", "./onevault-192.png", "./onevault-512.png", ...outputs.map((output) => `./${relative(output)}`)];
const cacheName = `onevault-${path.basename(entryOutput).replace(/\W/g, "")}`;
const serviceWorker = `
const CACHE = ${JSON.stringify(cacheName)};
const ASSETS = ${JSON.stringify([...new Set(cacheFiles)])};
self.addEventListener("install", event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting())));
self.addEventListener("activate", event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim())));
self.addEventListener("fetch", event => {
  if (event.request.method !== "GET" || new URL(event.request.url).origin !== self.location.origin) return;
  if (event.request.mode === "navigate") {
    event.respondWith(fetch(event.request).catch(() => caches.match("./index.html")));
    return;
  }
  event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request)));
});
`;
await writeFile(path.join(outdir, "sw.js"), serviceWorker.trimStart(), "utf8");

console.log(`Built OneVault PWA: ${jsFile}${cssFile ? `, ${cssFile}` : ""}`);
