// Prints the env vars (ADMIN_1.., APP_1..) that carry web/admin.html and web/app.html
// for the Railway Function deployment. Usage: bun scripts/railway-env.ts > html-env.json
const out: Record<string, string> = {};
for (const [name, file] of [["ADMIN_", "admin.html"], ["APP_", "app.html"]]) {
  const t = (await Bun.file(import.meta.dir + "/../web/" + file).text()).split("\n").map((l) => l.trim()).join("\n");
  const half = Math.ceil(t.length / 2);
  out[name + 1] = t.slice(0, half); out[name + 2] = t.slice(half);
}
console.log(JSON.stringify(out));
