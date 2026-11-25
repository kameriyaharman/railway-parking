import React, { useEffect, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { api, type Stand, type User } from "../api";
import { Btn, C, Card, Input, Label, Muted, s } from "../components/ui";
import { digits } from "../format";
import { useApp } from "../store";

export default function Login() {
  const { login, lastMobile, lastStand, toast, reset } = useApp();
  const [stands, setStands] = useState<Stand[]>([]);
  const [info, setInfo] = useState<{ station?: string; short?: string; agency?: string }>({});
  const [stand, setStand] = useState(lastStand);
  const [mobile, setMobile] = useState(lastMobile);
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      const [st, c] = await Promise.all([api<Stand[]>("/api/public/stands"), api("/api/public/config")]);
      setStands(st); setInfo(c);
      if (!st.find((x) => x.id === stand) && st[0]) setStand(st[0].id);
    } catch (e: any) { toast(e.message); }
  };
  useEffect(() => { load(); }, []);

  const submit = async (p = pin) => {
    if (digits(mobile).length !== 10) return toast("10 digit mobile number daalo");
    if (p.length !== 4) return toast("4-digit PIN daalo");
    setBusy(true);
    try {
      const r = await api<{ token: string; user: User }>("/api/login", { mobile: digits(mobile), secret: p, standId: stand });
      await login(r.token, r.user, digits(mobile), stand);
    } catch (e: any) { toast(e.message); setPin(""); }
    finally { setBusy(false); }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView keyboardShouldPersistTaps="handled">
        <View style={{ backgroundColor: C.p, paddingHorizontal: 22, paddingTop: 40, paddingBottom: 46, borderBottomLeftRadius: 24, borderBottomRightRadius: 24 }}>
          <View style={{ width: 56, height: 56, borderRadius: 16, backgroundColor: C.a, alignItems: "center", justifyContent: "center" }}>
            <Text style={{ fontSize: 32, fontWeight: "900", color: C.p }}>P</Text>
          </View>
          <Text style={{ color: "#fff", fontSize: 24, fontWeight: "800", marginTop: 14 }}>{info.short || "BKSC"} PARKING</Text>
          <Text style={{ color: "#cbd5e1", marginTop: 2 }}>Start your shift</Text>
        </View>
        <View style={{ padding: 16, marginTop: -26 }}>
          <Card>
            <Label>Parking stand</Label>
            {stands.length ? stands.map((x) => (
              <Pressable key={x.id} onPress={() => setStand(x.id)}
                style={[s.row, { padding: 12, borderRadius: 12, borderWidth: 1.5, marginBottom: 8, borderColor: stand === x.id ? C.p2 : C.b, backgroundColor: stand === x.id ? "#e8f0fb" : "#fff" }]}>
                <View style={{ width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: stand === x.id ? C.p2 : "#94a3b8", alignItems: "center", justifyContent: "center" }}>
                  {stand === x.id ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: C.p2 }} /> : null}
                </View>
                <Text style={[s.b, { flex: 1 }]}>{x.name}</Text>
              </Pressable>
            )) : <Btn kind="o" title="Stands load karein (retry)" onPress={load} />}
            <Label>Attendant mobile</Label>
            <Input value={mobile} onChangeText={(v) => setMobile(digits(v))} keyboardType="number-pad" maxLength={10} placeholder="10 digit mobile" />
            <Label>4-digit PIN</Label>
            <Input
              value={pin} secureTextEntry keyboardType="number-pad" maxLength={4} placeholder="• • • •"
              style={{ textAlign: "center", fontSize: 26, letterSpacing: 12 }}
              onChangeText={(v) => { const p = digits(v); setPin(p); if (p.length === 4) submit(p); }}
            />
            <View style={{ height: 16 }} />
            <Btn title="Login & start shift" onPress={() => submit()} loading={busy} />
          </Card>
          <Muted style={{ textAlign: "center" }}>{info.agency || ""} · Attendant app</Muted>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
