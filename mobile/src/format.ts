import type { Kind, VType } from "./api";

export const TYPES: { key: VType; label: string; long: string; icon: string }[] = [
  { key: "cycle", label: "Cycle", long: "Cycle", icon: "bicycle" },
  { key: "bike", label: "Bike", long: "Scooter / Bike", icon: "motorbike" },
  { key: "auto", label: "Auto", long: "Auto / Toto", icon: "rickshaw" },
  { key: "car", label: "Car", long: "Car", icon: "car" },
  { key: "bus", label: "Bus", long: "Bus / Mini bus", icon: "bus" },
];
export const TL: Record<VType, string> = Object.fromEntries(TYPES.map((t) => [t.key, t.long])) as Record<VType, string>;
export const ICON: Record<VType, string> = Object.fromEntries(TYPES.map((t) => [t.key, t.icon])) as Record<VType, string>;
export const KIND: Record<Kind, string> = { parking: "Parking", pd: "Pick & Drop", pass: "Monthly Pass" };

// Hermes ships Intl, but toLocaleString time zone support varies by device — do IST maths ourselves.
const IST = 330 * 60000;
const pad = (n: number) => String(n).padStart(2, "0");
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function rs(n: number | null | undefined) {
  const v = Math.round(Number(n || 0));
  const s = String(Math.abs(v));
  const last3 = s.slice(-3), rest = s.slice(0, -3);
  const grouped = rest ? rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",") + "," + last3 : last3;
  return (v < 0 ? "-₹" : "₹") + grouped;
}
function ist(d: string | number | Date) { return new Date(new Date(d).getTime() + IST); }
export function tm(d?: string | number | Date | null) {
  if (!d) return "—";
  const x = ist(d); const h = x.getUTCHours();
  return `${pad(h % 12 || 12)}:${pad(x.getUTCMinutes())} ${h < 12 ? "AM" : "PM"}`;
}
export function dt(d?: string | number | Date | null) {
  if (!d) return "—";
  const x = ist(d);
  return `${x.getUTCDate()} ${MON[x.getUTCMonth()]}, ${tm(d)}`;
}
export function dur(m?: number | null) {
  const v = Math.max(0, Math.round(Number(m || 0)));
  return v < 60 ? `${v} min` : `${Math.floor(v / 60)} h ${pad(v % 60)} m`;
}
export const digits = (s: string) => s.replace(/\D/g, "");
