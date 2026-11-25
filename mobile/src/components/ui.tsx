// Shared UI building blocks (design: navy + amber, matches the admin panel).
import { MaterialCommunityIcons } from "@expo/vector-icons";
import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View, type StyleProp, type TextInputProps, type ViewStyle } from "react-native";
import QRCode from "react-native-qrcode-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { Config, Ticket } from "../api";
import { dt, dur, KIND, rs, tm, TL } from "../format";
import { useApp, type Route } from "../store";

export const C = {
  p: "#0f2a4a", p2: "#1d4f8c", a: "#f59e0b", g: "#16a34a", r: "#dc2626",
  bg: "#f2f4f8", card: "#ffffff", t: "#0f172a", m: "#64748b", b: "#e2e8f0", soft: "#eef2f7",
};

export function Btn({ title, onPress, kind = "p", icon, disabled, loading, style, big }: {
  title: string; onPress: () => void; kind?: "p" | "g" | "r" | "o" | "a"; icon?: string; disabled?: boolean; loading?: boolean; style?: StyleProp<ViewStyle>; big?: boolean;
}) {
  const bg = { p: C.p2, g: C.g, r: C.r, o: "#fff", a: C.a }[kind];
  const fg = kind === "o" ? C.p2 : kind === "a" ? "#111" : "#fff";
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        s.btn, { backgroundColor: bg, opacity: disabled ? 0.5 : pressed ? 0.85 : 1 },
        kind === "o" && { borderWidth: 1.5, borderColor: C.p2 }, big && { paddingVertical: 26, borderRadius: 18 }, style,
      ]}
    >
      {loading ? <ActivityIndicator color={fg} /> : (
        <View style={[s.row, { justifyContent: "center", flexDirection: big ? "column" : "row" }]}>
          {icon ? <MaterialCommunityIcons name={icon as any} size={big ? 28 : 20} color={fg} /> : null}
          <Text style={[s.btnText, { color: fg, fontSize: big ? 18 : 16 }]}>{title}</Text>
        </View>
      )}
    </Pressable>
  );
}

export const Card = ({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) => <View style={[s.card, style]}>{children}</View>;
export const Label = ({ children }: { children: React.ReactNode }) => <Text style={s.label}>{children}</Text>;
export const Muted = ({ children, style }: { children: React.ReactNode; style?: any }) => <Text style={[s.muted, style]}>{children}</Text>;

export function Input(props: TextInputProps & { big?: boolean; ref?: React.Ref<TextInput> }) {
  const { big, style, ref, ...rest } = props;
  return <TextInput ref={ref} placeholderTextColor="#94a3b8" {...rest} style={[s.input, big && s.inputBig, style]} />;
}

export function Seg<T extends string | number>({ options, value, onChange }: { options: { value: T; label: string; icon?: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <View style={s.seg}>
      {options.map((o) => (
        <Pressable key={String(o.value)} onPress={() => onChange(o.value)} style={[s.segBtn, o.value === value && s.segOn]}>
          {o.icon ? <MaterialCommunityIcons name={o.icon as any} size={16} color={o.value === value ? C.p : C.m} /> : null}
          <Text style={[s.segText, o.value === value && { color: C.p }]}>{o.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export function Toggle({ title, sub, value, onChange }: { title: string; sub?: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <Pressable onPress={() => onChange(!value)} style={s.tog}>
      <View style={{ flex: 1 }}>
        <Text style={s.b}>{title}</Text>
        {sub ? <Muted>{sub}</Muted> : null}
      </View>
      <View style={[s.sw, value && { backgroundColor: C.g }]}>
        <View style={[s.knob, value && { left: 22 }]} />
      </View>
    </Pressable>
  );
}

export const Pill = ({ text, kind }: { text: string; kind?: "g" | "r" | "b" | "a" }) => {
  const m = { g: ["#dcfce7", "#166534"], r: ["#fee2e2", "#991b1b"], b: ["#dbeafe", "#1e40af"], a: ["#fef3c7", "#92400e"] } as const;
  const [bg, fg] = kind ? m[kind] : ["#e2e8f0", C.t];
  return <Text style={[s.pill, { backgroundColor: bg, color: fg }]}>{text}</Text>;
};

export const KV = ({ k, v, bold }: { k: string; v: string; bold?: boolean }) => (
  <View style={s.kv}>
    <Text style={[s.kvK, bold && s.b]}>{k}</Text>
    <Text style={[s.b, bold && { fontSize: 18 }]}>{v}</Text>
  </View>
);

export function TopBar({ title, onBack }: { title: string; onBack?: () => void }) {
  const { back } = useApp();
  return (
    <View style={s.bar}>
      <Pressable onPress={onBack || back} style={s.backBtn} hitSlop={10}>
        <MaterialCommunityIcons name="arrow-left" size={22} color={C.t} />
      </Pressable>
      <Text style={s.barTitle}>{title}</Text>
      <Text style={s.muted}>{tm(new Date())}</Text>
    </View>
  );
}

const TABS: { name: Route["name"]; label: string; icon: string }[] = [
  { name: "home", label: "Home", icon: "home-variant" },
  { name: "inside", label: "Inside", icon: "parking" },
  { name: "scan", label: "Scan", icon: "qrcode-scan" },
  { name: "shift", label: "Shift", icon: "clock-outline" },
  { name: "printer", label: "Printer", icon: "printer" },
];

export function BottomNav() {
  const { route, reset } = useApp();
  const insets = useSafeAreaInsets();
  return (
    <View style={[s.nav, { paddingBottom: Math.max(insets.bottom, 6) }]}>
      {TABS.map((t) => {
        const on = t.name === route.name;
        return (
          <Pressable key={t.name} style={s.navBtn} onPress={() => reset({ name: t.name } as Route)}>
            <MaterialCommunityIcons name={t.icon as any} size={24} color={on ? C.p2 : C.m} />
            <Text style={[s.navText, on && { color: C.p2 }]}>{t.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Slip({ t, out, cfg, qr }: { t: Ticket; out: boolean; cfg: Config; qr: boolean }) {
  return (
    <View style={s.slip}>
      <Text style={[s.mono, s.b, { textAlign: "center" }]}>{cfg.short} Parking · {cfg.agency}</Text>
      <Text style={[s.mono, { textAlign: "center" }]}>{cfg.stationLong}</Text>
      <View style={s.dash} />
      {out ? <Text style={[s.mono, s.b, { textAlign: "center" }]}>EXIT RECEIPT</Text> : null}
      <Text style={[s.mono, { fontSize: 28, fontWeight: "800", textAlign: "center" }]}>{t.token_no}</Text>
      <Text style={[s.mono, { fontSize: 18, fontWeight: "800", textAlign: "center" }]}>{t.vehicle_no}</Text>
      <Text style={[s.mono, { textAlign: "center" }]}>{TL[t.vtype]} · {KIND[t.kind]}</Text>
      <View style={s.dash} />
      <SlipRow k="In time" v={dt(t.in_at)} />
      {out ? (
        <>
          <SlipRow k="Out time" v={dt(t.out_at)} />
          <SlipRow k="Duration" v={dur(t.minutes)} />
          <SlipRow k="Slab" v={t.slab || ""} />
          {t.amt_helmet ? <SlipRow k="Helmet" v={rs(t.amt_helmet)} /> : null}
          {t.amt_penalty ? <SlipRow k="Lost token" v={rs(t.amt_penalty)} /> : null}
          <View style={s.dash} />
          <SlipRow k={`TOTAL (${t.pay_mode})`} v={rs(t.amount)} />
        </>
      ) : <SlipRow k="Helmet" v={t.helmet ? "Yes" : "No"} />}
      {qr && !out ? <View style={{ alignItems: "center", marginVertical: 8 }}><QRCode value={"BKSC:" + t.id} size={120} /></View> : null}
      <View style={s.dash} />
      <Text style={[s.mono, { fontSize: 11, textAlign: "center" }]}>
        {out ? "Thank you · Happy journey" : "Pay at exit as per railway tariff"}{"\n"}GSTIN {cfg.gstin} · Ph {cfg.phone}
      </Text>
    </View>
  );
}
const SlipRow = ({ k, v }: { k: string; v: string }) => (
  <View style={[s.row, { justifyContent: "space-between" }]}>
    <Text style={s.mono}>{k}</Text>
    <Text style={[s.mono, s.b]}>{v}</Text>
  </View>
);

export const s = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  b: { fontWeight: "700", color: C.t, fontSize: 15 },
  muted: { color: C.m, fontSize: 13 },
  wrap: { padding: 16, paddingBottom: 110 },
  card: { backgroundColor: C.card, borderRadius: 16, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: C.b },
  btn: { borderRadius: 14, paddingVertical: 15, paddingHorizontal: 12, alignItems: "center", justifyContent: "center" },
  btnText: { fontWeight: "700", fontSize: 16 },
  label: { fontSize: 12, fontWeight: "700", color: C.m, marginTop: 14, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 },
  input: { borderWidth: 1.5, borderColor: C.b, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 17, backgroundColor: "#fff", color: C.t },
  inputBig: { fontSize: 22, fontWeight: "800", letterSpacing: 1.5 },
  seg: { flexDirection: "row", backgroundColor: "#e8edf4", borderRadius: 12, padding: 4 },
  segBtn: { flex: 1, paddingVertical: 10, borderRadius: 9, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 6 },
  segOn: { backgroundColor: "#fff", elevation: 2 },
  segText: { fontWeight: "700", color: C.m, fontSize: 15 },
  tog: { flexDirection: "row", alignItems: "center", paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.b, gap: 10 },
  sw: { width: 46, height: 27, borderRadius: 14, backgroundColor: "#cbd5e1", justifyContent: "center" },
  knob: { position: "absolute", left: 3, width: 21, height: 21, borderRadius: 11, backgroundColor: "#fff" },
  pill: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 20, fontSize: 12, fontWeight: "700", overflow: "hidden", alignSelf: "flex-start" },
  kv: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#f1f5f9" },
  kvK: { color: C.t, fontSize: 15 },
  bar: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingVertical: 12, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: C.b },
  backBtn: { width: 38, height: 38, borderRadius: 10, backgroundColor: C.soft, alignItems: "center", justifyContent: "center" },
  barTitle: { flex: 1, fontSize: 18, fontWeight: "700", color: C.t },
  nav: { position: "absolute", left: 0, right: 0, bottom: 0, flexDirection: "row", backgroundColor: "#fff", borderTopWidth: 1, borderTopColor: C.b, paddingTop: 6 },
  navBtn: { flex: 1, alignItems: "center", gap: 2 },
  navText: { fontSize: 11, fontWeight: "600", color: C.m },
  slip: { backgroundColor: "#fff", borderWidth: 1, borderStyle: "dashed", borderColor: "#94a3b8", borderRadius: 6, padding: 14, alignSelf: "center", width: "92%", maxWidth: 320 },
  mono: { fontFamily: "monospace", fontSize: 13, color: C.t },
  dash: { borderTopWidth: 1, borderStyle: "dashed", borderColor: "#94a3b8", marginVertical: 8 },
  info: { backgroundColor: "#fff7e6", borderColor: "#fde3a7", borderWidth: 1, borderRadius: 12, padding: 10, marginTop: 12 },
  ico: { width: 42, height: 42, borderRadius: 12, backgroundColor: C.soft, alignItems: "center", justifyContent: "center" },
  amt: { fontSize: 40, fontWeight: "800", color: C.p },
  two: { flexDirection: "row", gap: 10 },
});
