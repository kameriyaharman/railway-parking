import React, { useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { api, type ShiftStats } from "../api";
import { Btn, C, Card, Input, KV, Label, Muted, Pill, TopBar, s } from "../components/ui";
import { digits, dt, rs } from "../format";
import { useApp } from "../store";

export default function Shift() {
  const { user, toast, logout, reset } = useApp();
  const [data, setData] = useState<{ shift: { start_at: string } | null; stats: ShiftStats | null; staff: string[] } | null>(null);
  const [cash, setCash] = useState("");
  const [to, setTo] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { api("/api/shift").then(setData).catch((e) => toast(e.message)); }, []);
  const st = data?.stats || { in: 0, out: 0, passes: 0, cash: 0, upi: 0 };
  const diff = cash === "" ? null : Number(cash) - st.cash;

  const close = () => {
    if (cash === "") return toast("Cash amount daalo");
    Alert.alert("Shift close", `Cash handover ${rs(Number(cash))}${to ? " → " + to : ""}. Shift close karein?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Close shift", style: "destructive", onPress: async () => {
          setBusy(true);
          try {
            const r = await api<{ matched: boolean }>("/api/shift/close", { cashHanded: cash, handedTo: to });
            toast(r.matched ? "Shift closed · cash matched" : "Shift closed · mismatch admin ko dikhega", 3500);
            await logout();
          } catch (e: any) { toast(e.message); }
          finally { setBusy(false); }
        },
      },
    ]);
  };

  return (
    <View style={{ flex: 1 }}>
      <TopBar title="My shift" onBack={() => reset({ name: "home" })} />
      <ScrollView contentContainerStyle={s.wrap} keyboardShouldPersistTaps="handled">
        <Card>
          <Text style={[s.b, { fontSize: 17 }]}>{user?.name}</Text>
          <Muted>{user?.label} · since {dt(data?.shift?.start_at)}</Muted>
          <View style={[s.row, { marginTop: 12 }]}>
            {[["IN", st.in], ["OUT", st.out], ["Passes", st.passes]].map(([l, v]) => (
              <View key={l} style={{ flex: 1, backgroundColor: C.soft, borderRadius: 12, padding: 8, alignItems: "center" }}>
                <Text style={[s.b, { fontSize: 20 }]}>{v}</Text><Muted>{l}</Muted>
              </View>
            ))}
          </View>
        </Card>
        <Card>
          <KV k="Cash" v={rs(st.cash)} />
          <KV k="UPI" v={rs(st.upi)} />
          <KV k="Total collection" v={rs(st.cash + st.upi)} bold />
        </Card>
        <Card>
          <Label>Cash handed over</Label>
          <Input value={cash} onChangeText={(v) => setCash(digits(v))} keyboardType="number-pad" placeholder={String(st.cash)} />
          <Label>Handed to</Label>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            {[...(data?.staff || []), "Admin / Owner"].map((n) => (
              <Pressable key={n} onPress={() => setTo(n)}><Pill kind={to === n ? "b" : undefined} text={n} /></Pressable>
            ))}
          </View>
          {diff !== null ? <View style={{ marginTop: 12 }}>{diff === 0 ? <Pill kind="g" text="✓ Matches system cash" /> : <Pill kind="r" text={diff < 0 ? `${rs(-diff)} short` : `${rs(diff)} extra`} />}</View> : null}
        </Card>
        <Btn kind="r" icon="logout" title="Close shift & logout" onPress={close} loading={busy} />
        <View style={{ height: 10 }} />
        <Btn kind="o" title="Logout only (shift open rahega)" onPress={logout} />
      </ScrollView>
    </View>
  );
}
