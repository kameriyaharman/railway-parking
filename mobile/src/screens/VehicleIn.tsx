import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import * as Haptics from "expo-haptics";
import React, { useEffect, useRef, useState } from "react";
import { Alert, Linking, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { api, ApiError, type Kind, type Ticket, type VType } from "../api";
import { Btn, C, Card, Input, Label, Muted, Pill, Seg, Slip, Toggle, TopBar, s } from "../components/ui";
import { digits, dt, dur, rs, TL, TYPES } from "../format";
import { useApp } from "../store";

const METHOD = { bt: "Bluetooth printer", rawbt: "RawBT app", off: "Printing OFF" } as const;

export function VehicleIn() {
  const { cfg, go, toast, print, printer } = useApp();
  const [kind, setKind] = useState<Exclude<Kind, "pass">>("parking");
  const [vtype, setVtype] = useState<VType>("bike");
  const [vno, setVno] = useState("");
  const [mob, setMob] = useState("");
  const [helmet, setHelmet] = useState(false);
  const [busy, setBusy] = useState(false);
  const ref = useRef<TextInput>(null);
  useEffect(() => { setTimeout(() => ref.current?.focus(), 250); }, []);
  const t = cfg?.tariff;

  const submit = async (force = false) => {
    setBusy(true);
    try {
      const r = await api<{ ticket: Ticket }>("/api/entry", { kind, vtype, vehicleNo: vno, mobile: mob, helmet: kind === "parking" && helmet, force });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      go({ name: "token", ticket: r.ticket });
      if (printer.autoIn) print(r.ticket, false);
    } catch (e: any) {
      if (e instanceof ApiError && e.data?.duplicate) {
        Alert.alert("Pehle se andar", e.message + "\n\nPhir bhi naya token banaye?", [
          { text: "Nahi", style: "cancel" },
          { text: "Haan, banao", onPress: () => submit(true) },
        ]);
      } else toast(e.message);
    } finally { setBusy(false); }
  };

  return (
    <View style={{ flex: 1 }}>
      <TopBar title="Vehicle IN" />
      <ScrollView contentContainerStyle={s.wrap} keyboardShouldPersistTaps="handled">
        <Card>
          <Seg value={kind} onChange={setKind} options={[{ value: "parking", label: "Parking" }, { value: "pd", label: "Pick & Drop" }]} />
          <Label>Vehicle type</Label>
          <View style={{ flexDirection: "row", gap: 6 }}>
            {TYPES.map((x) => {
              const on = x.key === vtype;
              return (
                <Pressable key={x.key} onPress={() => setVtype(x.key)}
                  style={{ flex: 1, alignItems: "center", paddingVertical: 10, borderRadius: 12, borderWidth: 1.5, borderColor: on ? C.p2 : C.b, backgroundColor: on ? "#e8f0fb" : "#fff" }}>
                  <MaterialCommunityIcons name={x.icon as any} size={24} color={on ? C.p2 : C.m} />
                  <Text style={{ fontSize: 12, fontWeight: "700", color: on ? C.p2 : C.t }}>{x.label}</Text>
                </Pressable>
              );
            })}
          </View>
          <Label>Vehicle number</Label>
          <Input ref={ref} big value={vno} onChangeText={(v) => setVno(v.toUpperCase())} autoCapitalize="characters" autoCorrect={false} placeholder="JH 09 AK 4521" />
          <Label>Customer mobile (optional)</Label>
          <Input value={mob} onChangeText={(v) => setMob(digits(v))} keyboardType="number-pad" maxLength={10} placeholder="WhatsApp slip ke liye" />
          {kind === "parking" ? <Toggle title="Helmet" sub={`${rs(t?.helmet)} for 24 hrs`} value={helmet} onChange={setHelmet} /> : null}
          {t ? (
            <View style={s.info}>
              {kind === "pd" ? (
                <>
                  <Text style={s.b}>Pick & Drop tariff · {TL[vtype]}</Text>
                  <Text>Up to {t.pdFree} min — Free</Text>
                  <Text>{t.pdFree} – {t.pdMax} min — {rs(t.pd[vtype])}</Text>
                  <Text>{t.pdMax} – {t.pdHour} min — {rs(t.pd2?.[vtype])}</Text>
                  <Text>Above {t.pdHour} min — {rs(t.pdHourly?.[vtype])} per hour</Text>
                </>
              ) : (
                <>
                  <Text style={s.b}>{TL[vtype]} rate · pay at exit</Text>
                  <Text>2 hr {rs(t.parking[vtype][0])} · 6 hr {rs(t.parking[vtype][1])} · 12 hr {rs(t.parking[vtype][2])} · 24 hr {rs(t.parking[vtype][3])}</Text>
                </>
              )}
            </View>
          ) : null}
        </Card>
        <Muted style={{ marginBottom: 10, marginLeft: 4 }}>🖨 {METHOD[printer.method]}{printer.method !== "off" ? ` · Auto print ${printer.autoIn ? "ON" : "OFF"}` : ""}</Muted>
        <Btn kind="g" icon="ticket-confirmation" title={kind === "pd" ? "Print Pick & Drop token" : "Generate token & print"} onPress={() => submit()} loading={busy} disabled={vno.replace(/\W/g, "").length < 4} />
      </ScrollView>
    </View>
  );
}

export function Token({ ticket }: { ticket: Ticket }) {
  const { cfg, go, back, print, printer } = useApp();
  if (!cfg) return null;
  return (
    <View style={{ flex: 1 }}>
      <TopBar title="Token printed" />
      <ScrollView contentContainerStyle={s.wrap}>
        <Card style={{ alignItems: "center" }}>
          <MaterialCommunityIcons name="check-circle" size={44} color={C.g} />
          <Text style={[s.b, { fontSize: 17 }]}>Token {ticket.token_no} generated</Text>
          {ticket.kind === "pass" ? <Pill kind="g" text="Monthly pass vehicle — no charge" /> : null}
        </Card>
        <Slip t={ticket} out={false} cfg={cfg} qr={printer.qr} />
        <View style={{ height: 14 }} />
        <Btn kind="g" icon="plus" title="Next vehicle" onPress={() => { back(); }} />
        <View style={[s.two, { marginTop: 10 }]}>
          <Btn kind="o" icon="printer" title="Reprint" onPress={() => print(ticket, false)} style={{ flex: 1 }} />
          <Btn kind="o" icon="whatsapp" title="WhatsApp" onPress={() => whatsapp(ticket, false, cfg)} style={{ flex: 1 }} />
        </View>
      </ScrollView>
    </View>
  );
}

export function whatsapp(t: Ticket, out: boolean, cfg: { short: string; agency: string }) {
  const msg = `${cfg.short} Parking · ${cfg.agency}\nToken: ${t.token_no}\nVehicle: ${t.vehicle_no} (${TL[t.vtype]})\nIn: ${dt(t.in_at)}` +
    (out ? `\nOut: ${dt(t.out_at)}\nDuration: ${dur(t.minutes)}\nPaid: ₹${t.amount} (${t.pay_mode})` : "\nPay at exit as per railway tariff");
  const n = digits(t.mobile || "");
  const phone = n ? "91" + n.slice(-10) : "";
  Linking.openURL(`whatsapp://send?${phone ? `phone=${phone}&` : ""}text=${encodeURIComponent(msg)}`)
    .catch(() => Linking.openURL(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`));
}
