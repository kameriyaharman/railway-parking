import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as Haptics from "expo-haptics";
import React, { useRef, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import QRCode from "react-native-qrcode-svg";
import { api, type Ticket } from "../api";
import { Btn, C, Card, Input, KV, Label, Muted, Pill, Seg, Slip, Toggle, TopBar, s } from "../components/ui";
import { dt, dur, KIND, rs, tm, TL, ICON } from "../format";
import { useApp } from "../store";
import { whatsapp } from "./VehicleIn";

export function Scan() {
  const { go, toast } = useApp();
  const [perm, requestPerm] = useCameraPermissions();
  const [camOn, setCamOn] = useState(false);
  const [q, setQ] = useState("");
  const busy = useRef(false);

  const find = async (value: string) => {
    const v = value.trim();
    if (!v || busy.current) return;
    busy.current = true;
    try {
      const r = await api<{ ticket: Ticket }>("/api/lookup?q=" + encodeURIComponent(v));
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      setCamOn(false);
      go({ name: "exit", ticket: r.ticket });
    } catch (e: any) { toast(e.message); }
    finally { setTimeout(() => { busy.current = false; }, 1200); }
  };

  const startCam = async () => {
    const p = perm?.granted ? perm : await requestPerm();
    if (!p.granted) return toast("Camera permission chahiye");
    setCamOn(true);
  };

  return (
    <View style={{ flex: 1 }}>
      <TopBar title="Vehicle OUT" />
      <ScrollView contentContainerStyle={s.wrap} keyboardShouldPersistTaps="handled">
        <Card>
          {camOn ? (
            <View style={{ height: 300, borderRadius: 14, overflow: "hidden", marginBottom: 10 }}>
              <CameraView style={{ flex: 1 }} facing="back" barcodeScannerSettings={{ barcodeTypes: ["qr"] }} onBarcodeScanned={(r) => find(r.data)} />
              <View pointerEvents="none" style={{ position: "absolute", left: "15%", right: "15%", top: "15%", bottom: "15%", borderWidth: 3, borderColor: C.a, borderRadius: 16 }} />
            </View>
          ) : null}
          {camOn
            ? <Btn kind="o" icon="close" title="Camera band karein" onPress={() => setCamOn(false)} />
            : <Btn icon="qrcode-scan" title="Scan token QR" onPress={startCam} />}
          <Label>Ya token no. / vehicle no. daalein</Label>
          <View style={s.row}>
            <Input style={{ flex: 1, minWidth: 0 }} big value={q} onChangeText={(v) => setQ(v.toUpperCase())} autoCapitalize="characters" autoCorrect={false} placeholder="482 / JH09AK4521" onSubmitEditing={() => find(q)} returnKeyType="search" />
            <Btn title="Go" onPress={() => find(q)} style={{ paddingHorizontal: 20 }} />
          </View>
        </Card>
        <Muted>Tip: sirf number bhi chalega (482 = T-0482). Pick & Drop ke liye PD-0215 likhein.</Muted>
      </ScrollView>
    </View>
  );
}

export function Exit({ ticket }: { ticket: Ticket }) {
  const { cfg, go, toast, print, printer } = useApp();
  const [mode, setMode] = useState<"Cash" | "UPI">("Cash");
  const [lost, setLost] = useState(false);
  const [busy, setBusy] = useState(false);
  const l = ticket.live;
  if (!cfg || !l) return null;
  const total = l.total + (lost ? cfg.tariff.lostToken : 0);

  const collect = async () => {
    if (total > 0 && mode === "UPI") return go({ name: "upi", ticket, total, lost });
    setBusy(true);
    try {
      const r = await api<{ ticket: Ticket }>("/api/exit", { id: ticket.id, payMode: "Cash", lost });
      go({ name: "done", ticket: r.ticket });
      if (printer.autoOut) print(r.ticket, true);
    } catch (e: any) { toast(e.message); }
    finally { setBusy(false); }
  };

  return (
    <View style={{ flex: 1 }}>
      <TopBar title="Vehicle OUT" />
      <ScrollView contentContainerStyle={s.wrap}>
        <Card>
          <View style={[s.row, { justifyContent: "space-between" }]}>
            <Text style={{ fontSize: 24, fontWeight: "800", color: C.t }}>{ticket.token_no}</Text>
            <Pill kind="g" text="Token found" />
          </View>
          <Muted>Charge auto calculated</Muted>
          <View style={[s.row, { marginTop: 10 }]}>
            <View style={s.ico}><MaterialCommunityIcons name={ICON[ticket.vtype] as any} size={24} color={C.p2} /></View>
            <View>
              <Text style={[s.b, { fontSize: 18 }]}>{ticket.vehicle_no}</Text>
              <Muted>{TL[ticket.vtype]} · {KIND[ticket.kind]}</Muted>
            </View>
          </View>
        </Card>
        <Card>
          <KV k="In time" v={dt(ticket.in_at)} />
          <KV k="Out time" v={tm(new Date())} />
          <KV k="Duration" v={dur(l.minutes)} />
          {l.note ? <View style={s.info}><Text>{l.note}</Text></View> : null}
          <KV k={`${ticket.kind === "pd" ? "Pick & Drop" : "Parking"} (${l.slab})`} v={rs(l.parking)} />
          <KV k="Helmet" v={l.helmet ? rs(l.helmet) : "—"} />
          <Toggle title="Lost token" sub={`Penalty ${rs(cfg.tariff.lostToken)}`} value={lost} onChange={setLost} />
          <View style={[s.row, { justifyContent: "space-between", marginTop: 8 }]}>
            <Text style={s.b}>Collect now</Text>
            <Text style={s.amt}>{rs(total)}</Text>
          </View>
        </Card>
        {total > 0 ? (
          <Card>
            <Label>Payment mode</Label>
            <Seg value={mode} onChange={setMode} options={[{ value: "Cash", label: "Cash", icon: "cash" }, { value: "UPI", label: "UPI", icon: "cellphone" }]} />
          </Card>
        ) : null}
        <Btn kind="g" icon="check" title={total > 0 ? `Collect ${rs(total)} & print receipt` : "Exit & print free slip"} onPress={collect} loading={busy} />
      </ScrollView>
    </View>
  );
}

export function Upi({ ticket, total, lost }: { ticket: Ticket; total: number; lost: boolean }) {
  const { cfg, go, toast, print, printer } = useApp();
  const [busy, setBusy] = useState(false);
  if (!cfg) return null;
  const url = `upi://pay?pa=${encodeURIComponent(cfg.upiVpa || "")}&pn=${encodeURIComponent(cfg.upiName || cfg.agency)}&am=${total}&cu=INR&tn=${encodeURIComponent("Parking " + ticket.token_no)}`;
  const done = async (payMode: "UPI" | "Cash") => {
    setBusy(true);
    try {
      const r = await api<{ ticket: Ticket }>("/api/exit", { id: ticket.id, payMode, lost });
      go({ name: "done", ticket: r.ticket });
      if (printer.autoOut) print(r.ticket, true);
    } catch (e: any) { toast(e.message); }
    finally { setBusy(false); }
  };
  return (
    <View style={{ flex: 1 }}>
      <TopBar title="Collect by UPI" />
      <ScrollView contentContainerStyle={s.wrap}>
        <Card style={{ alignItems: "center" }}>
          <Muted>Amount</Muted>
          <Text style={s.amt}>{rs(total)}</Text>
          {cfg.upiVpa ? (
            <>
              <View style={{ padding: 12, backgroundColor: "#fff" }}><QRCode value={url} size={230} /></View>
              <Muted style={{ textAlign: "center" }}>Customer kisi bhi UPI app se scan kare{"\n"}GPay · PhonePe · Paytm · BHIM</Muted>
              <Text style={[s.b, { marginTop: 6 }]}>{cfg.upiVpa}</Text>
            </>
          ) : <View style={s.info}><Text>Admin ne UPI ID set nahi ki hai (Admin → Settings). Customer ko stand ka QR scan karayein.</Text></View>}
        </Card>
        <Btn kind="g" icon="check-circle" title="Payment received" onPress={() => done("UPI")} loading={busy} />
        <View style={{ height: 10 }} />
        <Btn kind="o" icon="cash" title="Customer ne cash diya" onPress={() => done("Cash")} disabled={busy} />
      </ScrollView>
    </View>
  );
}

export function Done({ ticket }: { ticket: Ticket }) {
  const { cfg, reset, print, printer } = useApp();
  if (!cfg) return null;
  return (
    <View style={{ flex: 1 }}>
      <TopBar title="Done" onBack={() => reset({ name: "home" })} />
      <ScrollView contentContainerStyle={s.wrap}>
        <Card style={{ alignItems: "center" }}>
          <MaterialCommunityIcons name="check-circle" size={48} color={C.g} />
          <Text style={[s.b, { fontSize: 17 }]}>Vehicle exited</Text>
          <Muted>{ticket.pay_mode} · {rs(ticket.amount)}</Muted>
        </Card>
        <Slip t={ticket} out cfg={cfg} qr={printer.qr} />
        <View style={{ height: 14 }} />
        <Btn kind="g" icon="qrcode-scan" title="Next exit" onPress={() => reset({ name: "scan" })} />
        <View style={[s.two, { marginTop: 10 }]}>
          <Btn kind="o" icon="printer" title="Reprint" onPress={() => print(ticket, true)} style={{ flex: 1 }} />
          <Btn kind="o" icon="whatsapp" title="WhatsApp" onPress={() => whatsapp(ticket, true, cfg)} style={{ flex: 1 }} />
        </View>
      </ScrollView>
    </View>
  );
}
