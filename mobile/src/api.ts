// API client for the BKSC Parking server (same backend as the admin panel).
export const DEFAULT_SERVER = "https://bksc-parking-production.up.railway.app";

export type VType = "cycle" | "bike" | "auto" | "car" | "bus";
export type Kind = "parking" | "pd" | "pass";

export type Tariff = {
  slabs: number[];
  parking: Record<VType, number[]>;
  perDay: Record<VType, number>;
  pass: Record<VType, number>;
  pd: Record<VType, number>;
  pd2: Record<VType, number>;
  pdHourly: Record<VType, number>;
  pdFree: number;
  pdMax: number;
  pdHour: number;
  helmet: number;
  lostToken: number;
};

export type Config = {
  agency: string; contractor: string; gstin: string; phone: string; agreement: string;
  station: string; stationLong: string; short: string; upiVpa: string; upiName: string;
  tariff: Tariff;
};

export type Live = { minutes: number; slab: string; note: string; parking: number; helmet: number; penalty: number; total: number };

export type Ticket = {
  id: number; token_no: string; kind: Kind; vtype: VType; vehicle_no: string; mobile: string; helmet: boolean;
  in_at: string; out_at: string | null; minutes: number | null; slab: string | null;
  amt_parking: number; amt_helmet: number; amt_penalty: number; amount: number; pay_mode: string | null;
  status: "inside" | "out"; live?: Live | null; in_by_name?: string;
};

export type User = { id: number; name: string; role: string; stand: number; shift: number; label: string };
export type Stand = { id: number; name: string; types: string };
export type ShiftStats = { in: number; out: number; passes: number; cash: number; upi: number };
export type Home = {
  user: User; config: Config; shift: { id: number; start_at: string } | null; stats: ShiftStats | null;
  stand: Stand | null; inside: Partial<Record<VType, number>>; pd: { n: number; free: number };
};

export class ApiError extends Error {
  status: number; data: any;
  constructor(msg: string, status: number, data: any) { super(msg); this.status = status; this.data = data; }
}

let server = DEFAULT_SERVER;
let token = "";
let onUnauthorized: () => void = () => {};

export function configureApi(opts: { server?: string; token?: string; onUnauthorized?: () => void }) {
  if (opts.server !== undefined) server = opts.server.replace(/\/+$/, "") || DEFAULT_SERVER;
  if (opts.token !== undefined) token = opts.token;
  if (opts.onUnauthorized) onUnauthorized = opts.onUnauthorized;
}

export async function api<T = any>(path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(server + path, {
      method: body === undefined ? "GET" : "POST",
      headers: { "content-type": "application/json", authorization: "Bearer " + token },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError("Internet / server se connect nahi hua", 0, null);
  }
  let data: any = null;
  try { data = await res.json(); } catch { data = { error: "Server error" }; }
  if (res.status === 401 && !path.includes("/login")) { onUnauthorized(); throw new ApiError("Login expired", 401, data); }
  if (!res.ok) throw new ApiError(data?.error || "Error", res.status, data);
  return data as T;
}
