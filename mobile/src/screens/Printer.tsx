import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useState } from "react";
import { Linking, Pressable, ScrollView, Text, View } from "react-native";
import type { Ticket } from "../api";
import { Btn, C, Card, Input, Label, Muted, Seg, Toggle, TopBar, s } from "../components/ui";
import { listPrinters, nativeBluetoothAvailable, type PrintMethod } from "../printer";
import type { PairedDevice } from "../../modules/bt-printer";
import { useApp } from "../store";

export default function Printer() {
  const { printer, setPrinter, print, cfg, user, logout, server, setServer, toast, reset } = useApp();
  const [devices, setDevices] = useState<PairedDevice[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [srv, setSrv] = useState(server);

  const scan = async () => {
    setLoading(true);
    try { setDevices(await listPrinters()); } catch (e: any) { toast(e.message, 3500); }
    finally { setLoading(false); }
  };

  const test: Ticket = {
    id: 0, token_no: "T-TEST", kind: "parking", vtype: "car", vehicle_no: "JH 09 AB 1234", mobile: "", helmet: false,
    in_at: new Date().toISOString(), out_at: null, minutes: null, slab: null, amt_parking: 0, amt_helmet: 0, amt_penalty: 0, amount: 0, pay_mode: null, status: "inside",
  };

  return (
    <View style={{ flex: 1 }}>
      <TopBar title="Printer settings" onBack={() => reset({ name: "home" })} />
      <ScrollView contentContainerStyle={s.wrap} keyboardShouldPersistTaps="handled">
        <Card>
          <Label>Print method</Label>
          <Seg<PrintMethod> value={printer.method} onChange={(m) => setPrinter({ method: m })}
            options={[{ value: "bt", label: "Bluetooth" }, { value: "rawbt", label: "RawBT app" }, { value: "off", label: "Off" }]} />
          {printer.method === "bt" ? (
            <>
              <View style={s.info}>
                <Text>Phone ki Bluetooth settings me printer ek baar pair karein (PIN aksar 0000 ya 1234). Fir yahan se select karein — har token seedha print hoga.</Text>
                {!nativeBluetoothAvailable ? <Text style={{ color: C.r, marginTop: 6 }}>Ye feature sirf APK build me chalta hai.</Text> : null}
              </View>
              <View style={[s.row, { marginTop: 12 }]}>
                <MaterialCommunityIcons name="printer-pos" size={26} color={printer.address ? C.g : C.m} />
                <View style={{ flex: 1 }}>
                  <Text style={s.b}>{printer.name || "Koi printer select nahi"}</Text>
                  {printer.address ? <Muted>{printer.address}</Muted> : null}
                </View>
              </View>
              <View style={{ height: 10 }} />
              <Btn kind="o" icon="bluetooth" title="Paired printers dikhayein" onPress={scan} loading={loading} />
              {devices ? (devices.length ? devices.map((d) => (
                <Pressable key={d.address} onPress={() => { setPrinter({ address: d.address, name: d.name }); toast("Printer selected: " + d.name); }}
                  style={[s.row, { padding: 12, marginTop: 8, borderRadius: 12, borderWidth: 1.5, borderColor: d.address === printer.address ? C.p2 : C.b }]}>
                  <MaterialCommunityIcons name="printer" size={22} color={C.p2} />
                  <View style={{ flex: 1 }}><Text style={s.b}>{d.name}</Text><Muted>{d.address}</Muted></View>
                  {d.address === printer.address ? <MaterialCommunityIcons name="check-circle" size={22} color={C.g} /> : null}
                </Pressable>
              )) : <Muted style={{ marginTop: 8 }}>Koi paired device nahi mila — pehle phone settings me printer pair karein.</Muted>) : null}
            </>
          ) : printer.method === "rawbt" ? (
            <View style={s.info}>
              <Text>Play Store se RawBT app install karke usme printer pair karein. Fir har slip RawBT ke through print hogi.</Text>
              <Text style={{ color: C.p2, fontWeight: "700", marginTop: 6 }} onPress={() => Linking.openURL("market://details?id=ru.a402d.rawbtprinter").catch(() => Linking.openURL("https://play.google.com/store/apps/details?id=ru.a402d.rawbtprinter"))}>Install RawBT →</Text>
            </View>
          ) : null}
        </Card>
        <Card>
          <Toggle title="Auto print on entry" sub="Token prints on Generate" value={printer.autoIn} onChange={(v) => setPrinter({ autoIn: v })} />
          <Toggle title="Auto print on exit" sub="Receipt with duration & amount" value={printer.autoOut} onChange={(v) => setPrinter({ autoOut: v })} />
          <Toggle title="Print QR on token" sub="Fast scan at exit" value={printer.qr} onChange={(v) => setPrinter({ qr: v })} />
          <Label>Paper size</Label>
          <Seg<58 | 80> value={printer.paper} onChange={(p) => setPrinter({ paper: p })} options={[{ value: 58, label: "58 mm" }, { value: 80, label: "80 mm" }]} />
        </Card>
        <Card>
          <Text style={s.b}>Header on slip</Text>
          <Muted style={{ marginTop: 4 }}>{cfg ? `${cfg.agency} · Parking ${cfg.station} · GSTIN ${cfg.gstin} · Ph ${cfg.phone}` : "—"}</Muted>
          <Muted>(Admin panel → Settings se badlein)</Muted>
        </Card>
        <Btn icon="printer-check" title="Test print" onPress={() => print(test, false)} disabled={printer.method === "off"} />
        <Card style={{ marginTop: 12 }}>
          <Label>Server</Label>
          <Input value={srv} onChangeText={setSrv} autoCapitalize="none" autoCorrect={false} keyboardType="url" />
          <View style={{ height: 8 }} />
          <Btn kind="o" title="Save server" onPress={async () => { await setServer(srv); toast("Server saved"); }} />
        </Card>
        <Btn kind="o" icon="logout" title={`Logout · ${user?.name || ""}`} onPress={logout} />
      </ScrollView>
    </View>
  );
}
