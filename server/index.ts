// BKSC Parking — API server (Bun + Postgres)
// Serves: /app (attendant Android app / PWA), /admin (owner panel), /api/*
import { SQL } from "bun";
import { ASSETS } from "./assets";

const DB_URL = Bun.env.DATABASE_URL || "postgres://postgres@127.0.0.1:5433/parking";
const sql = new SQL(DB_URL);
const SECRET = Bun.env.APP_SECRET || (await sha(DB_URL + "bksc-parking"));
const TZ = "Asia/Kolkata";
const TYPES = ["cycle", "bike", "auto", "car", "bus"];
const TYPE_LABEL: Record<string, string> = { cycle: "Cycle", bike: "Scooter / Bike", auto: "Auto / Toto", car: "Car", bus: "Bus / Mini bus" };

const DEFAULT_CONFIG = {
  agency: "NIKITA AGENCIES", contractor: "Kumar Niraj", gstin: "20ANAPK3378C1ZL", phone: "9431363844",
  agreement: "C/197/BKSC/MX/QT-2/11/26", station: "Bokaro Steel City (BKSC)", stationLong: "Bokaro Steel City Railway Station", short: "BKSC",
  upiVpa: "", upiName: "Nikita Agencies",
  tariff: {
    slabs: [120, 360, 720, 1440],
    parking: { cycle: [6, 9, 12, 15], bike: [12, 15, 18, 24], auto: [12, 18, 24, 42], car: [18, 30, 36, 59], bus: [30, 36, 42, 70] },
    perDay: { cycle: 15, bike: 24, auto: 42, car: 59, bus: 70 },
    pass: { cycle: 236, bike: 472, auto: 885, car: 1180, bus: 0 },
    // Pick & Drop: ≤pdFree free · ≤pdMax → pd · ≤pdHour → pd2 · beyond → pdHourly × every started hour
    pd: { cycle: 25, bike: 25, auto: 25, car: 25, bus: 25 },
    pd2: { cycle: 60, bike: 60, auto: 60, car: 60, bus: 60 },
    pdHourly: { cycle: 60, bike: 60, auto: 60, car: 60, bus: 60 },
    pdFree: 15, pdMax: 30, pdHour: 60, helmet: 12, lostToken: 50,
  },
  alerts: { dailySummary: true, full90: true, cashMismatch: true },
};

// ---------------- DB ----------------
async function migrate() {
  await sql.unsafe(`
  create table if not exists stands(id serial primary key, name text not null, info text default '', area text default '', capacity int default 100, types text default 'cycle,bike,auto,car,bus', active boolean default true);
  create table if not exists staff(id serial primary key, name text not null, mobile text unique not null, secret text not null, role text not null default 'attendant', stand_id int references stands(id), shift_label text default '', active boolean default true, notes text default '', created_at timestamptz default now());
  create table if not exists settings(key text primary key, value jsonb not null);
  create table if not exists shifts(id serial primary key, staff_id int references staff(id), stand_id int references stands(id), start_at timestamptz default now(), end_at timestamptz, cash_system int, upi_system int, cash_handed int, handed_to text, status text default 'open');
  create sequence if not exists seq_t; create sequence if not exists seq_pd;
  create table if not exists tickets(id serial primary key, token_no text not null, kind text not null, vtype text not null, vehicle_no text not null, mobile text default '', helmet boolean default false, stand_id int, in_at timestamptz default now(), out_at timestamptz, in_by int references staff(id), out_by int references staff(id), in_shift int, out_shift int, minutes int, slab text, amt_parking int default 0, amt_helmet int default 0, amt_penalty int default 0, amount int default 0, pay_mode text, status text default 'inside', pass_id int, deleted boolean default false);
  create index if not exists tickets_status on tickets(status);
  create index if not exists tickets_in on tickets(in_at);
  create index if not exists tickets_out on tickets(out_at);
  create table if not exists passes(id serial primary key, holder text default '', mobile text default '', vehicle_no text not null, vtype text not null, start_date date not null, end_date date not null, amount int default 0, pay_mode text default 'Cash', created_at timestamptz default now(), active boolean default true);
  create table if not exists audit(id serial primary key, at timestamptz default now(), actor text, action text, details jsonb);
  `);
  const [c] = await sql`select count(*)::int n from stands`;
  if (c.n === 0) {
    await sql`insert into stands(name,info,area,capacity,types) values
      ('2-Wheeler Stand','Cycle & Bike','1,691.52 sq m',300,'cycle,bike'),
      ('3 & 4-Wheeler Stand','Auto, Car, Bus','3,576.02 sq m',190,'auto,car,bus'),
      ('Pick & Drop Lane','Free 15 min · separate tariff','',100,'cycle,bike,auto,car,bus')`;
  }
  const [s] = await sql`select count(*)::int n from settings where key='config'`;
  if (s.n === 0) await sql`insert into settings(key,value) values('config', ${JSON.stringify(DEFAULT_CONFIG)}::jsonb)`;
  else {
    // One-time switch to the new Pick & Drop tariff (Nov 2026): 15 free · 30 → ₹25 · 60 → ₹60 · then ₹60/hr.
    const [cur] = await sql`select value from settings where key='config'`;
    const v = typeof cur.value === "string" ? JSON.parse(cur.value) : cur.value;
    if (!v.tariff?.pd2) {
      const t = DEFAULT_CONFIG.tariff;
      v.tariff = { ...(v.tariff || {}), pd: t.pd, pd2: t.pd2, pdHourly: t.pdHourly, pdFree: 15, pdMax: 30, pdHour: 60 };
      await sql`update settings set value=${JSON.stringify(v)}::jsonb where key='config'`;
      await audit("system", "update_config", { keys: ["tariff (new Pick & Drop rates)"] });
    }
  }
  const [a] = await sql`select count(*)::int n from staff where role='admin'`;
  if (a.n === 0) {
    const mobile = Bun.env.ADMIN_MOBILE || "9431363844";
    const pass = Bun.env.ADMIN_PASSWORD || "admin@123";
    await sql`insert into staff(name,mobile,secret,role) values('Admin',${mobile},${await Bun.password.hash(pass)},'admin')`;
    await sql`insert into staff(name,mobile,secret,role,stand_id,shift_label) values('Demo Attendant','9999999999',${await Bun.password.hash("1234")},'attendant',1,'6 AM – 2 PM')`;
  }
}

let CONFIG_CACHE: any = null;
async function getConfig() {
  if (!CONFIG_CACHE) {
    const [r] = await sql`select value from settings where key='config'`;
    const v = typeof r.value === "string" ? JSON.parse(r.value) : r.value;
    CONFIG_CACHE = { ...DEFAULT_CONFIG, ...v, tariff: { ...DEFAULT_CONFIG.tariff, ...(v.tariff || {}) } };
  }
  return CONFIG_CACHE;
}

// ---------------- tariff engine ----------------
export function calcCharge(cfg: any, kind: string, vtype: string, minutes: number, helmet: boolean, lost = false) {
  const t = cfg.tariff;
  const m = Math.max(1, Math.ceil(minutes));
  let parking = 0, slab = "", note = "";
  const parkCalc = () => {
    if (m <= t.slabs[3]) {
      const i = t.slabs.findIndex((x: number) => m <= x);
      parking = t.parking[vtype][i];
      slab = ["Up to 2 hrs", "2–6 hrs", "6–12 hrs", "12–24 hrs"][i];
    } else {
      const d = Math.ceil(m / 1440);
      parking = d * t.perDay[vtype];
      slab = `${d} days × ₹${t.perDay[vtype]}`;
    }
  };
  if (kind === "pass") { slab = "Monthly pass"; }
  else if (kind === "pd") {
    if (m <= t.pdFree) { slab = `≤${t.pdFree} min`; note = `Within ${t.pdFree} min — FREE`; }
    else if (m <= t.pdMax) { parking = t.pd[vtype]; slab = `${t.pdFree}–${t.pdMax} min`; note = `${t.pdFree} – ${t.pdMax} min — Pick & Drop charge`; }
    else if (m <= t.pdHour) { parking = t.pd2[vtype]; slab = `${t.pdMax}–${t.pdHour} min`; note = `${t.pdMax} – ${t.pdHour} min — Pick & Drop charge`; }
    else { const hrs = Math.ceil(m / 60); parking = hrs * t.pdHourly[vtype]; slab = `${hrs} hr × ₹${t.pdHourly[vtype]}`; note = `Above ${t.pdHour} min — ₹${t.pdHourly[vtype]} per hour`; }
  } else parkCalc();
  const days = Math.ceil(m / 1440);
  const h = helmet ? days * t.helmet : 0;
  const pen = lost ? t.lostToken : 0;
  return { minutes: m, slab, note, parking, helmet: h, penalty: pen, total: parking + h + pen };
}

// ---------------- auth ----------------
async function sha(s: string) {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Buffer.from(b).toString("hex");
}
async function sign(payload: any) {
  const p = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return p + "." + (await sha(p + SECRET)).slice(0, 40);
}
async function verify(tok: string | null) {
  if (!tok) return null;
  const [p, s] = tok.split(".");
  if (!p || !s || (await sha(p + SECRET)).slice(0, 40) !== s) return null;
  const d = JSON.parse(Buffer.from(p, "base64url").toString());
  if (d.exp < Date.now()) return null;
  return d;
}

// ---------------- helpers ----------------
const json = (d: any, status = 200) => new Response(JSON.stringify(d), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });
const err = (m: string, status = 400) => json({ error: m }, status);
const normNo = (s: string) => String(s || "").toUpperCase().replace(/[^A-Z0-9]/g, "").replace(/^([A-Z]{2})(\d{1,2})([A-Z]{0,3})(\d{1,4})$/, "$1 $2 $3 $4").replace(/\s+/g, " ").trim();
const minutesSince = (d: any) => (Date.now() - new Date(d).getTime()) / 60000;
const istDate = () => new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10);
async function audit(actor: string, action: string, details: any) { await sql`insert into audit(actor,action,details) values(${actor},${action},${JSON.stringify(details ?? {})}::jsonb)`; }

function ticketOut(r: any, cfg: any) {
  const live = r.status === "inside" ? calcCharge(cfg, r.kind, r.vtype, minutesSince(r.in_at), r.helmet) : null;
  return { ...r, live };
}

async function activePass(vehicleNo: string, vtype: string) {
  const [p] = await sql`select * from passes where active and vehicle_no=${vehicleNo} and vtype=${vtype} and start_date <= (now() at time zone ${TZ})::date and end_date >= (now() at time zone ${TZ})::date limit 1`;
  return p || null;
}

async function shiftStats(shiftId: number) {
  const [a] = await sql`select
    (select count(*)::int from tickets where in_shift=${shiftId} and not deleted) as "in",
    (select count(*)::int from tickets where out_shift=${shiftId} and not deleted) as "out",
    (select count(*)::int from tickets where (in_shift=${shiftId}) and kind='pass' and not deleted) as passes,
    (select coalesce(sum(amount),0)::int from tickets where out_shift=${shiftId} and pay_mode='Cash' and not deleted) as cash,
    (select coalesce(sum(amount),0)::int from tickets where out_shift=${shiftId} and pay_mode='UPI' and not deleted) as upi`;
  return a;
}

// ---------------- routes ----------------
type Ctx = { req: Request; url: URL; user: any; body: any };

async function attendantHome(user: any) {
  const cfg = await getConfig();
  const [shift] = await sql`select * from shifts where id=${user.shift}`;
  const stats = shift ? await shiftStats(shift.id) : null;
  const byType = await sql`select vtype, count(*)::int n from tickets where status='inside' and not deleted group by vtype`;
  const [pd] = await sql`select count(*)::int n, count(*) filter (where amount=0 and status='out')::int free from tickets where kind='pd' and not deleted and (in_at at time zone ${TZ})::date = (now() at time zone ${TZ})::date`;
  const [stand] = await sql`select * from stands where id=${user.stand}`;
  return { user, config: cfg, shift, stats, stand, inside: Object.fromEntries(byType.map((r: any) => [r.vtype, r.n])), pd };
}

const routes: Record<string, (c: Ctx) => Promise<Response>> = {
  "GET /api/public/stands": async () => json(await sql`select id,name,types from stands where active order by id`),
  "GET /api/public/config": async () => { const c = await getConfig(); return json({ station: c.station, short: c.short, agency: c.agency }); },

  "POST /api/login": async ({ body }) => {
    const mobile = String(body.mobile || "").replace(/\D/g, "").slice(-10) || String(body.mobile || "").trim();
    const [u] = await sql`select * from staff where (mobile=${mobile} or mobile=${String(body.mobile || "").trim()}) and active`;
    if (!u || !(await Bun.password.verify(String(body.secret || ""), u.secret))) return err("Mobile ya PIN/password galat hai", 401);
    if (body.as === "admin" && u.role !== "admin") return err("Admin access nahi hai", 403);
    let shift = null, stand = Number(body.standId) || u.stand_id || 1;
    if (body.as !== "admin") {
      [shift] = await sql`select * from shifts where staff_id=${u.id} and status='open' order by id desc limit 1`;
      if (!shift) [shift] = await sql`insert into shifts(staff_id,stand_id) values(${u.id},${stand}) returning *`;
      else if (shift.stand_id !== stand) { await sql`update shifts set stand_id=${stand} where id=${shift.id}`; }
    }
    const payload = { id: u.id, name: u.name, role: body.as === "admin" ? "admin" : u.role === "admin" ? "admin-att" : "attendant", stand, shift: shift?.id, label: u.shift_label, exp: Date.now() + 1000 * 3600 * 24 * 7 };
    return json({ token: await sign(payload), user: payload });
  },

  "GET /api/me": async ({ user }) => json(await attendantHome(user)),

  "POST /api/entry": async ({ user, body }) => {
    const cfg = await getConfig();
    const vtype = String(body.vtype);
    if (!TYPES.includes(vtype)) return err("Vehicle type choose karo");
    const no = normNo(body.vehicleNo);
    if (no.replace(/\s/g, "").length < 4) return err("Vehicle number sahi daalo");
    const [dup] = await sql`select token_no from tickets where status='inside' and not deleted and replace(vehicle_no,' ','')=${no.replace(/\s/g, "")}`;
    if (dup && !body.force) return json({ error: `Ye vehicle pehle se andar hai (token ${dup.token_no})`, duplicate: true }, 409);
    let kind = body.kind === "pd" ? "pd" : "parking";
    let passId = null;
    if (kind === "parking") { const p = await activePass(no, vtype); if (p) { kind = "pass"; passId = p.id; } }
    const [{ n }] = kind === "pd" ? await sql`select nextval('seq_pd')::int n` : await sql`select nextval('seq_t')::int n`;
    const token = (kind === "pd" ? "PD-" : "T-") + String(n % 10000).padStart(4, "0");
    const [t] = await sql`insert into tickets(token_no,kind,vtype,vehicle_no,mobile,helmet,stand_id,in_by,in_shift,pass_id)
      values(${token},${kind},${vtype},${no},${String(body.mobile || "").replace(/\D/g, "").slice(-10)},${!!body.helmet},${user.stand},${user.id},${user.shift},${passId}) returning *`;
    return json({ ticket: t, config: cfg });
  },

  "GET /api/lookup": async ({ url }) => {
    const cfg = await getConfig();
    const q = String(url.searchParams.get("q") || "").trim().toUpperCase();
    let rows: any[] = [];
    const idm = q.match(/^BKSC:(\d+)$/) || q.match(/^#?(\d+)$/);
    if (q.match(/^BKSC:\d+$/) && idm) rows = await sql`select * from tickets where id=${Number(idm[1])} and not deleted`;
    if (!rows.length) {
      let tok = q.replace(/\s/g, "");
      if (/^\d+$/.test(tok)) tok = "T-" + tok.padStart(4, "0");
      if (/^(T|PD)\d+$/.test(tok)) tok = tok.replace(/^(T|PD)(\d+)$/, (_, a, b) => a + "-" + b.padStart(4, "0"));
      rows = await sql`select * from tickets where not deleted and status='inside' and (token_no=${tok} or replace(vehicle_no,' ','')=${q.replace(/[^A-Z0-9]/g, "")}) order by in_at desc limit 1`;
    }
    if (!rows.length) return err("Token nahi mila / vehicle andar nahi hai", 404);
    return json({ ticket: ticketOut(rows[0], cfg), config: cfg });
  },

  "POST /api/exit": async ({ user, body }) => {
    const cfg = await getConfig();
    const [t] = await sql`select * from tickets where id=${Number(body.id)} and not deleted`;
    if (!t) return err("Ticket nahi mila", 404);
    if (t.status !== "inside") return json({ ticket: t, config: cfg, already: true });
    const c = calcCharge(cfg, t.kind, t.vtype, minutesSince(t.in_at), t.helmet, !!body.lost);
    const mode = c.total === 0 ? (t.kind === "pass" ? "Pass" : "Free") : body.payMode === "UPI" ? "UPI" : "Cash";
    const [u] = await sql`update tickets set status='out', out_at=now(), out_by=${user.id}, out_shift=${user.shift}, minutes=${c.minutes}, slab=${c.slab}, amt_parking=${c.parking}, amt_helmet=${c.helmet}, amt_penalty=${c.penalty}, amount=${c.total}, pay_mode=${mode} where id=${t.id} and status='inside' returning *`;
    return json({ ticket: u, charge: c, config: cfg });
  },

  "GET /api/ticket": async ({ url }) => {
    const cfg = await getConfig();
    const [t] = await sql`select * from tickets where id=${Number(url.searchParams.get("id"))}`;
    return t ? json({ ticket: ticketOut(t, cfg), config: cfg }) : err("Not found", 404);
  },

  "GET /api/inside": async ({ url }) => {
    const cfg = await getConfig();
    const type = url.searchParams.get("type") || "";
    const q = (url.searchParams.get("q") || "").toUpperCase().replace(/[^A-Z0-9-]/g, "");
    const rows = await sql.unsafe(`select t.*, s.name as in_by_name from tickets t left join staff s on s.id=t.in_by where t.status='inside' and not t.deleted
      ${type ? "and t.vtype=$1" : "and $1=''"} ${q ? "and (replace(t.vehicle_no,' ','') like '%'||$2||'%' or t.token_no like '%'||$2||'%')" : "and $2=''"} order by t.in_at asc limit 1000`, [type, q]);
    return json(rows.map((r: any) => ticketOut(r, cfg)));
  },

  "GET /api/shift": async ({ user }) => {
    const [shift] = await sql`select * from shifts where id=${user.shift}`;
    const others = await sql`select name from staff where active and role='attendant' and id<>${user.id} order by name`;
    return json({ shift, stats: shift ? await shiftStats(shift.id) : null, staff: others.map((r: any) => r.name) });
  },

  "POST /api/shift/close": async ({ user, body }) => {
    const [shift] = await sql`select * from shifts where id=${user.shift} and status='open'`;
    if (!shift) return err("Shift already closed");
    const st = await shiftStats(shift.id);
    const handed = Math.round(Number(body.cashHanded) || 0);
    await sql`update shifts set end_at=now(), status=${handed === st.cash ? "matched" : "mismatch"}, cash_system=${st.cash}, upi_system=${st.upi}, cash_handed=${handed}, handed_to=${String(body.handedTo || "")} where id=${shift.id}`;
    return json({ ok: true, stats: st, matched: handed === st.cash });
  },

  // ---------- admin ----------
  "GET /api/admin/dashboard": async ({ url }) => {
    const range = url.searchParams.get("range") || "today";
    const cond = range === "yesterday" ? `= (now() at time zone '${TZ}')::date - 1` : range === "month" ? `>= date_trunc('month', now() at time zone '${TZ}')::date` : `= (now() at time zone '${TZ}')::date`;
    const prev = range === "yesterday" ? `= (now() at time zone '${TZ}')::date - 8` : range === "month" ? `between (date_trunc('month', now() at time zone '${TZ}') - interval '1 month')::date and ((now() at time zone '${TZ}')::date - interval '1 month')::date` : `= (now() at time zone '${TZ}')::date - 7`;
    const D = (col: string) => `(${col} at time zone '${TZ}')::date`;
    const [k] = await sql.unsafe(`select
      (select coalesce(sum(amount),0)::int from tickets where not deleted and ${D("out_at")} ${cond}) collection,
      (select coalesce(sum(amount),0)::int from tickets where not deleted and ${D("out_at")} ${prev}) prev_collection,
      (select count(*)::int from tickets where not deleted and ${D("in_at")} ${cond}) vin,
      (select count(*)::int from tickets where not deleted and ${D("out_at")} ${cond}) vout,
      (select coalesce(avg(minutes),0)::int from tickets where not deleted and ${D("out_at")} ${cond}) avg_stay,
      (select count(*)::int from tickets where not deleted and status='inside') inside,
      (select count(*)::int from tickets where not deleted and status='inside' and in_at < now() - interval '24 hours') over24,
      (select count(*)::int from tickets where not deleted and kind='pd' and ${D("in_at")} ${cond}) pd,
      (select count(*)::int from tickets where not deleted and kind='pd' and amount=0 and status='out' and ${D("out_at")} ${cond}) pd_free,
      (select coalesce(sum(amount),0)::int from tickets where not deleted and kind='pd' and ${D("out_at")} ${cond}) pd_amt,
      (select coalesce(sum(amount),0)::int from tickets where not deleted and pay_mode='Cash' and ${D("out_at")} ${cond}) cash,
      (select coalesce(sum(amount),0)::int from tickets where not deleted and pay_mode='UPI' and ${D("out_at")} ${cond}) upi`);
    const hourly = await sql.unsafe(`select extract(hour from h)::int hr, (select count(*)::int from tickets t where not deleted and t.in_at <= h + interval '1 hour' and (t.out_at is null or t.out_at > h + interval '1 hour')) inside,
      (select count(*)::int from tickets t where not deleted and t.in_at >= h and t.in_at < h + interval '1 hour') entered
      from generate_series(date_trunc('day', now() at time zone '${TZ}') at time zone '${TZ}', now(), interval '1 hour') h`);
    const byType = await sql.unsafe(`select vtype, count(*)::int n, coalesce(sum(amount),0)::int amt from tickets where not deleted and (${D("in_at")} ${cond} or ${D("out_at")} ${cond}) group by vtype`);
    const onDuty = await sql`select sh.id, s.name, s.shift_label, st.name stand, sh.start_at from shifts sh join staff s on s.id=sh.staff_id left join stands st on st.id=sh.stand_id where sh.status='open' order by sh.start_at`;
    for (const r of onDuty as any[]) Object.assign(r, await shiftStats(r.id));
    const cfg = await getConfig();
    const over = await sql`select * from tickets where not deleted and status='inside' and in_at < now() - interval '24 hours' order by in_at limit 50`;
    const stands = await sql`select st.*, (select count(*)::int from tickets t where t.stand_id=st.id and t.status='inside' and not t.deleted) occupied from stands st where active order by id`;
    return json({ k, hourly, byType, onDuty, over: over.map((r: any) => ticketOut(r, cfg)), stands });
  },

  "GET /api/admin/records": async ({ url }) => {
    const date = url.searchParams.get("date") || istDate();
    const rows = await sql`select t.*, a.name in_by_name, b.name out_by_name from tickets t left join staff a on a.id=t.in_by left join staff b on b.id=t.out_by
      where not t.deleted and ((t.in_at at time zone ${TZ})::date = ${date}::date or (t.out_at at time zone ${TZ})::date = ${date}::date) order by t.in_at`;
    return json(rows);
  },

  "GET /api/admin/search": async ({ url }) => {
    const q = (url.searchParams.get("q") || "").toUpperCase().replace(/[^A-Z0-9-]/g, "");
    if (q.length < 2) return json([]);
    const rows = await sql`select t.*, a.name in_by_name, b.name out_by_name from tickets t left join staff a on a.id=t.in_by left join staff b on b.id=t.out_by
      where not t.deleted and (replace(t.vehicle_no,' ','') like ${"%" + q + "%"} or t.token_no = ${q} or t.mobile like ${"%" + q + "%"}) order by t.in_at desc limit 100`;
    return json(rows);
  },

  "GET /api/admin/inside": async () => {
    const cfg = await getConfig();
    const rows = await sql`select t.*, s.name in_by_name from tickets t left join staff s on s.id=t.in_by where t.status='inside' and not t.deleted order by t.in_at`;
    return json(rows.map((r: any) => ticketOut(r, cfg)));
  },

  "POST /api/admin/ticket": async ({ user, body }) => {
    const [t] = await sql`select * from tickets where id=${Number(body.id)}`;
    if (!t) return err("Not found", 404);
    if (body.delete) {
      await sql`update tickets set deleted=true where id=${t.id}`;
      await audit(user.name, "delete_ticket", { before: t, reason: body.reason || "" });
      return json({ ok: true });
    }
    const vno = body.vehicle_no ? normNo(body.vehicle_no) : t.vehicle_no;
    const vtype = TYPES.includes(body.vtype) ? body.vtype : t.vtype;
    const amount = body.amount !== undefined && body.amount !== "" ? Math.round(Number(body.amount)) : t.amount;
    const pay = body.pay_mode || t.pay_mode;
    const [u] = await sql`update tickets set vehicle_no=${vno}, vtype=${vtype}, amount=${amount}, pay_mode=${pay} where id=${t.id} returning *`;
    await audit(user.name, "edit_ticket", { before: t, after: u, reason: body.reason || "" });
    return json(u);
  },

  "GET /api/admin/reports": async ({ url }) => {
    const month = url.searchParams.get("month") || istDate().slice(0, 7);
    const start = month + "-01";
    const M = `(out_at at time zone '${TZ}')::date >= $1::date and (out_at at time zone '${TZ}')::date < ($1::date + interval '1 month')`;
    const [k] = await sql.unsafe(`select coalesce(sum(amount),0)::int collection, count(*)::int vehicles,
      coalesce(sum(amount) filter (where kind='pd'),0)::int pd_amt, count(*) filter (where kind='pd')::int pd_n,
      coalesce(sum(amt_helmet),0)::int helmet_amt, count(*) filter (where helmet)::int helmet_n,
      coalesce(sum(amount) filter (where pay_mode='Cash'),0)::int cash, coalesce(sum(amount) filter (where pay_mode='UPI'),0)::int upi
      from tickets where not deleted and ${M}`, [start]);
    const [prev] = await sql.unsafe(`select coalesce(sum(amount),0)::int collection from tickets where not deleted and (out_at at time zone '${TZ}')::date >= ($1::date - interval '1 month') and (out_at at time zone '${TZ}')::date < $1::date`, [start]);
    const [ps] = await sql.unsafe(`select coalesce(sum(amount),0)::int amt, (select count(*)::int from passes where active and end_date >= (now() at time zone '${TZ}')::date) active from passes where (created_at at time zone '${TZ}')::date >= $1::date and (created_at at time zone '${TZ}')::date < ($1::date + interval '1 month')`, [start]);
    const days = await sql.unsafe(`select to_char((out_at at time zone '${TZ}')::date,'YYYY-MM-DD') d, coalesce(sum(amount),0)::int amt, count(*)::int n from tickets where not deleted and ${M} group by 1 order by 1`, [start]);
    const byType = await sql.unsafe(`select vtype, count(*)::int n, coalesce(sum(amount),0)::int amt from tickets where not deleted and ${M} group by vtype`, [start]);
    const byStaff = await sql.unsafe(`select s.name, count(*)::int n, coalesce(sum(t.amount),0)::int amt from tickets t join staff s on s.id=t.out_by where not t.deleted and ${M.replaceAll("out_at", "t.out_at")} group by s.name order by 3 desc`, [start]);
    const shifts = await sql.unsafe(`select sh.*, s.name, st.name stand from shifts sh join staff s on s.id=sh.staff_id left join stands st on st.id=sh.stand_id where (sh.start_at at time zone '${TZ}')::date >= $1::date and (sh.start_at at time zone '${TZ}')::date < ($1::date + interval '1 month') order by sh.start_at`, [start]);
    return json({ month, k, prev, passes: ps, days, byType, byStaff, shifts });
  },

  "GET /api/admin/passes": async () => json(await sql`select *, start_date::text start_date, end_date::text end_date, (end_date >= (now() at time zone ${TZ})::date and active) as valid from passes order by id desc`),
  "POST /api/admin/passes": async ({ user, body }) => {
    const cfg = await getConfig();
    const vtype = TYPES.includes(body.vtype) ? body.vtype : "bike";
    const start = body.start_date || istDate();
    const end = body.end_date || new Date(new Date(start).getTime() + 29 * 864e5).toISOString().slice(0, 10);
    const amount = body.amount !== undefined && body.amount !== "" ? Number(body.amount) : cfg.tariff.pass[vtype];
    const [p] = await sql`insert into passes(holder,mobile,vehicle_no,vtype,start_date,end_date,amount,pay_mode) values(${body.holder || ""},${body.mobile || ""},${normNo(body.vehicle_no)},${vtype},${start},${end},${amount},${body.pay_mode || "Cash"}) returning *`;
    await audit(user.name, "add_pass", p);
    return json(p);
  },
  "POST /api/admin/passes/cancel": async ({ user, body }) => {
    await sql`update passes set active=false where id=${Number(body.id)}`;
    await audit(user.name, "cancel_pass", { id: body.id });
    return json({ ok: true });
  },

  "GET /api/admin/staff": async () => json(await sql`select s.id,s.name,s.mobile,s.role,s.stand_id,s.shift_label,s.active,s.notes, st.name stand from staff s left join stands st on st.id=s.stand_id order by s.role, s.id`),
  "POST /api/admin/staff": async ({ user, body }) => {
    const mobile = String(body.mobile || "").replace(/\D/g, "").slice(-10);
    if (mobile.length !== 10) return err("10 digit mobile number daalo");
    if (body.id) {
      const [old] = await sql`select * from staff where id=${Number(body.id)}`;
      const secret = body.secret ? await Bun.password.hash(String(body.secret)) : old.secret;
      const [u] = await sql`update staff set name=${body.name || old.name}, mobile=${mobile}, secret=${secret}, stand_id=${body.stand_id ? Number(body.stand_id) : old.stand_id}, shift_label=${body.shift_label ?? old.shift_label}, active=${body.active ?? old.active}, notes=${body.notes ?? old.notes} where id=${old.id} returning id,name,mobile,role`;
      await audit(user.name, "edit_staff", { id: old.id, name: u.name, pinChanged: !!body.secret });
      return json(u);
    }
    if (!/^\d{4}$/.test(String(body.secret || ""))) return err("4-digit PIN daalo");
    const [ex] = await sql`select id from staff where mobile=${mobile}`;
    if (ex) return err("Ye mobile pehle se registered hai");
    const [u] = await sql`insert into staff(name,mobile,secret,role,stand_id,shift_label,notes) values(${body.name},${mobile},${await Bun.password.hash(String(body.secret))},'attendant',${Number(body.stand_id) || null},${body.shift_label || ""},${body.notes || ""}) returning id,name,mobile`;
    await audit(user.name, "add_staff", u);
    return json(u);
  },
  "POST /api/admin/password": async ({ user, body }) => {
    const [u] = await sql`select * from staff where id=${user.id}`;
    if (!(await Bun.password.verify(String(body.old || ""), u.secret))) return err("Purana password galat hai");
    if (String(body.new || "").length < 6) return err("Naya password kam se kam 6 characters");
    await sql`update staff set secret=${await Bun.password.hash(String(body.new))} where id=${u.id}`;
    await audit(user.name, "change_password", {});
    return json({ ok: true });
  },

  "GET /api/admin/stands": async () => json(await sql`select st.*, (select count(*)::int from tickets t where t.stand_id=st.id and t.status='inside' and not t.deleted) occupied from stands st order by id`),
  "POST /api/admin/stands": async ({ user, body }) => {
    const f = { name: body.name, info: body.info || "", area: body.area || "", capacity: Number(body.capacity) || 100, types: body.types || TYPES.join(","), active: body.active ?? true };
    const [r] = body.id
      ? await sql`update stands set name=${f.name}, info=${f.info}, area=${f.area}, capacity=${f.capacity}, types=${f.types}, active=${f.active} where id=${Number(body.id)} returning *`
      : await sql`insert into stands(name,info,area,capacity,types) values(${f.name},${f.info},${f.area},${f.capacity},${f.types}) returning *`;
    await audit(user.name, body.id ? "edit_stand" : "add_stand", r);
    return json(r);
  },

  "GET /api/admin/shifts": async ({ url }) => {
    const date = url.searchParams.get("date") || istDate();
    const rows = await sql`select sh.*, s.name, s.mobile, s.shift_label, st.name stand from shifts sh join staff s on s.id=sh.staff_id left join stands st on st.id=sh.stand_id
      where (sh.start_at at time zone ${TZ})::date = ${date}::date or sh.status='open' order by sh.start_at`;
    for (const r of rows as any[]) Object.assign(r, { live: await shiftStats(r.id) });
    return json(rows);
  },

  "GET /api/admin/config": async () => json(await getConfig()),
  "POST /api/admin/config": async ({ user, body }) => {
    const cur = await getConfig();
    const next = { ...cur, ...body, tariff: { ...cur.tariff, ...(body.tariff || {}) } };
    await sql`update settings set value=${JSON.stringify(next)}::jsonb where key='config'`;
    CONFIG_CACHE = null;
    await audit(user.name, "update_config", { keys: Object.keys(body) });
    return json(await getConfig());
  },
  "GET /api/admin/audit": async () => json(await sql`select * from audit order by id desc limit 200`),
};

async function handle(req: Request) {
  const url = new URL(req.url);
  const p = url.pathname;
  if (p.startsWith("/api/")) {
    const key = `${req.method} ${p}`;
    const fn = routes[key];
    if (!fn) return err("Not found", 404);
    let user = null;
    if (!p.startsWith("/api/public/") && p !== "/api/login") {
      user = await verify((req.headers.get("authorization") || "").replace("Bearer ", ""));
      if (!user) return err("Login expired", 401);
      if (p.startsWith("/api/admin/") && user.role !== "admin") return err("Admin only", 403);
    }
    let body: any = {};
    if (req.method === "POST") { try { body = await req.json(); } catch {} }
    try { return await fn({ req, url, user, body }); }
    catch (e: any) { console.error(key, e); return err("Server error: " + (e?.message || e), 500); }
  }
  if (p === "/health") return new Response("ok");
  if (p === "/" ) return new Response(null, { status: 302, headers: { location: "/app" } });
  if (p === "/qrcode.js") return new Response(null, { status: 302, headers: { location: "https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.min.js" } });
  const asset = ASSETS[p] || ASSETS[p.replace(/\/$/, "")];
  if (asset) return new Response(asset.body, { headers: { "content-type": asset.type, "cache-control": p === "/sw.js" ? "no-cache" : "public, max-age=300" } });
  return new Response("Not found", { status: 404 });
}

await migrate();
const server = Bun.serve({ port: Number(Bun.env.PORT || 3000), fetch: handle });
console.log("BKSC Parking running on :" + server.port);
