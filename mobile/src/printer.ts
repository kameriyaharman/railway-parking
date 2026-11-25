// ESC/POS slip builder + printing via the native Bluetooth module or the RawBT app.
import { Linking, PermissionsAndroid, Platform } from "react-native";
import BtPrinter from "../modules/bt-printer";
import type { Config, Ticket } from "./api";
import { dt, dur, KIND, TL } from "./format";

export type PrintMethod = "bt" | "rawbt" | "off";
export type PrinterSettings = {
  method: PrintMethod;
  address: string; // paired printer MAC (for method "bt")
  name: string;
  autoIn: boolean;
  autoOut: boolean;
  qr: boolean;
  paper: 58 | 80;
};
export const DEFAULT_PRINTER: PrinterSettings = { method: "bt", address: "", name: "", autoIn: true, autoOut: true, qr: true, paper: 58 };

export const nativeBluetoothAvailable = !!BtPrinter && Platform.OS === "android";

const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
export function toBase64(bytes: Uint8Array) {
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i], b = bytes[i + 1], c = bytes[i + 2];
    const n = (a << 16) | ((b ?? 0) << 8) | (c ?? 0);
    out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63] + (b === undefined ? "=" : B64[(n >> 6) & 63]) + (c === undefined ? "=" : B64[n & 63]);
  }
  return out;
}

const ascii = (s: string) =>
  String(s ?? "")
    .replace(/₹/g, "Rs.").replace(/[–—]/g, "-").replace(/·/g, "-").replace(/≤/g, "<=").replace(/×/g, "x")
    .normalize("NFKD").replace(/[^\x20-\x7e\n]/g, "");

export function buildSlip(t: Ticket, out: boolean, cfg: Config, s: PrinterSettings): Uint8Array {
  const W = s.paper === 80 ? 48 : 32;
  const b: number[] = [];
  const cmd = (...a: number[]) => b.push(...a);
  const ln = (str: string) => { for (const ch of ascii(str)) b.push(ch.charCodeAt(0)); b.push(10); };
  const kv = (k: string, v: string) => { k = ascii(k); v = ascii(v); ln(k + " ".repeat(Math.max(1, W - k.length - v.length)) + v); };
  const hr = () => ln("-".repeat(W));

  cmd(27, 64, 27, 97, 1, 27, 69, 1); ln(`${cfg.short} Parking - ${cfg.agency}`); cmd(27, 69, 0);
  ln(cfg.stationLong); hr();
  if (out) { cmd(27, 69, 1); ln("EXIT RECEIPT"); cmd(27, 69, 0); }
  cmd(29, 33, 17); ln(t.token_no); cmd(29, 33, 1); ln(t.vehicle_no); cmd(29, 33, 0);
  ln(`${TL[t.vtype]} - ${KIND[t.kind]}`); cmd(27, 97, 0); hr();
  kv("In time", dt(t.in_at));
  if (out) {
    kv("Out time", dt(t.out_at)); kv("Duration", dur(t.minutes)); kv("Slab", t.slab || "");
    if (t.amt_helmet) kv("Helmet", "Rs." + t.amt_helmet);
    if (t.amt_penalty) kv("Lost token", "Rs." + t.amt_penalty);
    hr(); cmd(27, 69, 1); kv(`TOTAL (${t.pay_mode})`, "Rs." + t.amount); cmd(27, 69, 0);
  } else kv("Helmet", t.helmet ? "Yes" : "No");
  cmd(27, 97, 1);
  if (s.qr && !out) {
    const d = Array.from(ascii("BKSC:" + t.id)).map((c) => c.charCodeAt(0));
    const L = d.length + 3;
    cmd(29, 40, 107, 4, 0, 49, 65, 50, 0); // model 2
    cmd(29, 40, 107, 3, 0, 49, 67, 7); // module size
    cmd(29, 40, 107, 3, 0, 49, 69, 49); // error correction M
    cmd(29, 40, 107, L & 255, L >> 8, 49, 80, 48, ...d); // store
    cmd(29, 40, 107, 3, 0, 49, 81, 48); // print
    cmd(10);
  }
  hr(); ln(out ? "Thank you - Happy journey" : "Pay at exit as per railway tariff");
  ln(`GSTIN ${cfg.gstin} Ph ${cfg.phone}`);
  cmd(10, 10, 10, 29, 86, 66, 0);
  return new Uint8Array(b);
}

export async function ensureBluetoothPermission() {
  if (Platform.OS !== "android" || Number(Platform.Version) < 31) return true;
  const r = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT);
  return r === PermissionsAndroid.RESULTS.GRANTED;
}

export async function listPrinters() {
  if (!BtPrinter) throw new Error("Bluetooth printing is APK build me hi chalega");
  if (!(await ensureBluetoothPermission())) throw new Error("Bluetooth permission chahiye");
  return BtPrinter.getPairedDevices();
}

/** Sends the slip to the configured printer. Throws with a readable message on failure. */
export async function printSlip(t: Ticket, out: boolean, cfg: Config, s: PrinterSettings) {
  if (s.method === "off") return;
  const data = toBase64(buildSlip(t, out, cfg, s));
  if (s.method === "rawbt") {
    await Linking.openURL("rawbt:base64," + data).catch(() => {
      throw new Error("RawBT app install nahi hai");
    });
    return;
  }
  if (!BtPrinter) throw new Error("Bluetooth printing ke liye APK chahiye (Expo Go me nahi chalega)");
  if (!s.address) throw new Error("Printer select nahi hai — Printer tab me printer choose karein");
  if (!(await ensureBluetoothPermission())) throw new Error("Bluetooth permission chahiye");
  await BtPrinter.print(s.address, data);
}
