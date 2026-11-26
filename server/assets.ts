// Web assets. On Railway Functions the two HTML pages come from env vars (ADMIN_1..n, APP_1..n);
// locally they are read from ../web. Icons are generated, the QR library comes from jsDelivr.
import { deflateSync } from "zlib";
export const ASSETS: Record<string, { body: any; type: string }> = {};
const addAsset = (f: string, type: string, body: any) => { ASSETS["/" + f] = { body, type }; if (f.endsWith(".html")) ASSETS["/" + f.replace(".html", "")] = { body, type }; };
const fromEnv = (p: string) => { let s = ""; for (let i = 1; Bun.env[p + i]; i++) s += Bun.env[p + i]; return s; };
const disk = async (f: string) => { try { return (await Bun.file(import.meta.dir + "/../web/" + f).text()).split("\n").map((l) => l.trim()).join("\n"); } catch { return ""; } };
addAsset("admin.html", "text/html; charset=utf-8", (await disk("admin.html")) || fromEnv("ADMIN_"));
addAsset("app.html", "text/html; charset=utf-8", (await disk("app.html")) || fromEnv("APP_"));
addAsset("sw.js", "text/javascript", `const C='bksc-v2',SHELL=['/app','/manifest.webmanifest','/icon.svg'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(C).then(c=>c.addAll(SHELL)));self.skipWaiting()});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==C).map(x=>caches.delete(x)))));self.clients.claim()});
self.addEventListener('fetch',e=>{const u=new URL(e.request.url);if(e.request.method!=='GET'||u.pathname.startsWith('/api/'))return;
e.respondWith(fetch(e.request).then(r=>{if(r.ok){const c=r.clone();caches.open(C).then(x=>x.put(e.request,c))}return r}).catch(()=>caches.match(e.request)))});
`);
addAsset("manifest.webmanifest", "application/manifest+json", JSON.stringify({ name: "BKSC Parking", short_name: "BKSC Parking", description: "Railway parking attendant app — Nikita Agencies", start_url: "/app", scope: "/", display: "standalone", orientation: "portrait", background_color: "#0f2a4a", theme_color: "#0f2a4a", icons: [{ src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any maskable" }, { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" }, { src: "/icon.svg", sizes: "any", type: "image/svg+xml" }] }));
addAsset("icon.svg", "image/svg+xml", `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" rx="110" fill="#0f2a4a"/><rect x="96" y="96" width="320" height="320" rx="70" fill="#f59e0b"/><text x="256" y="340" font-family="Arial,Helvetica,sans-serif" font-weight="900" font-size="230" text-anchor="middle" fill="#0f2a4a">P</text></svg>`);
function crc32(b: Buffer) { let crc = 0xffffffff; for (let n = 0; n < b.length; n++) { let c = (crc ^ b[n]) & 0xff; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crc = (crc >>> 8) ^ c; } return (crc ^ 0xffffffff) >>> 0; }
function pngChunk(type: string, data: Buffer) { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td)); return Buffer.concat([len, td, crc]); }
function makeIcon(s: number) {
  const raw = Buffer.alloc((s * 3 + 1) * s), k = s / 512;
  for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
    const X = x / k, Y = y / k, inR = X >= 96 && X < 416 && Y >= 96 && Y < 416, d = Math.hypot(X - 262, Y - 215);
    const p = (X >= 190 && X < 250 && Y >= 135 && Y < 375) || (X >= 262 && d >= 32 && d <= 80) || (X >= 240 && X < 262 && ((Y >= 135 && Y < 183) || (Y >= 247 && Y < 295)));
    const c = inR && !p ? [245, 158, 11] : [15, 42, 74]; const o = y * (s * 3 + 1) + 1 + x * 3; raw[o] = c[0]; raw[o + 1] = c[1]; raw[o + 2] = c[2];
  }
  const ih = Buffer.alloc(13); ih.writeUInt32BE(s, 0); ih.writeUInt32BE(s, 4); ih[8] = 8; ih[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), pngChunk("IHDR", ih), pngChunk("IDAT", deflateSync(raw)), pngChunk("IEND", Buffer.alloc(0))]);
}
addAsset("icon-192.png", "image/png", makeIcon(192));
addAsset("icon-512.png", "image/png", makeIcon(512));
for (const [k, v] of Object.entries(ASSETS)) if (!k.endsWith(".html")) console.log("asset", k, v.body.length, new Bun.CryptoHasher("md5").update(v.body).digest("hex"));
