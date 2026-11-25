import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useState } from "react";
import { Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { api, type Home as HomeData } from "../api";
import { Btn, C, Card, Muted, s } from "../components/ui";
import { rs, TYPES } from "../format";
import { useApp } from "../store";

export default function Home() {
  const { go, reset, setCfg, toast } = useApp();
  const [h, setH] = useState<HomeData | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { const d = await api<HomeData>("/api/me"); setH(d); setCfg(d.config); }
    catch (e: any) { toast(e.message); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const st = h?.stats || { in: 0, out: 0, cash: 0, upi: 0, passes: 0 };
  const ins = h?.inside || {};
  const total = Object.values(ins).reduce((a, b) => a + (b || 0), 0);

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 110 }} refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}>
      <View style={{ backgroundColor: C.p, padding: 18, paddingTop: 22, borderBottomLeftRadius: 22, borderBottomRightRadius: 22 }}>
        <Text style={{ color: "#cbd5e1", fontSize: 13 }}>{h ? `${h.config.station} · ${h.stand?.name || ""}` : "Loading…"}</Text>
        <Text style={{ color: "#fff", fontSize: 22, fontWeight: "800", marginTop: 4 }}>Hi, {h?.user.name.split(" ")[0] || ""} 👋</Text>
        <View style={[s.row, { justifyContent: "space-between", marginTop: 14 }]}>
          <View>
            <Text style={{ color: "#cbd5e1", fontSize: 13 }}>Today's collection (my shift)</Text>
            <Text style={{ color: "#fff", fontSize: 30, fontWeight: "800" }}>{rs(st.cash + st.upi)}</Text>
          </View>
          {h?.user.label ? <Text style={{ color: "#fff", backgroundColor: "#ffffff22", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, fontSize: 12, fontWeight: "700" }}>Shift {h.user.label}</Text> : null}
        </View>
        <View style={[s.row, { marginTop: 14 }]}>
          {[["IN", st.in], ["OUT", st.out], ["INSIDE", total]].map(([l, v]) => (
            <View key={l} style={{ flex: 1, backgroundColor: "#ffffff1a", borderRadius: 12, padding: 8, alignItems: "center" }}>
              <Text style={{ color: "#fff", fontSize: 20, fontWeight: "800" }}>{v}</Text>
              <Text style={{ color: "#cbd5e1", fontSize: 12 }}>{l}</Text>
            </View>
          ))}
        </View>
      </View>
      <View style={{ padding: 16 }}>
        <View style={[s.two, { marginBottom: 12 }]}>
          <Btn big kind="g" icon="arrow-down-bold-box" title="Vehicle IN" onPress={() => go({ name: "vin" })} style={{ flex: 1 }} />
          <Btn big kind="r" icon="arrow-up-bold-box" title="Vehicle OUT" onPress={() => go({ name: "scan" })} style={{ flex: 1 }} />
        </View>
        <Card>
          <View style={[s.row, { justifyContent: "space-between", marginBottom: 4 }]}>
            <Text style={s.b}>Vehicles inside</Text><Text style={s.b}>{total}</Text>
          </View>
          {TYPES.map((t) => (
            <Pressable key={t.key} onPress={() => reset({ name: "inside", type: t.key })} style={[s.row, { paddingVertical: 9, borderTopWidth: 1, borderTopColor: "#f1f5f9" }]}>
              <View style={s.ico}><MaterialCommunityIcons name={t.icon as any} size={22} color={C.p2} /></View>
              <Text style={{ flex: 1, fontSize: 15, color: C.t }}>{t.long}</Text>
              <Text style={s.b}>{ins[t.key] || 0}</Text>
            </Pressable>
          ))}
        </Card>
        <Card style={[s.row, { justifyContent: "space-between" }]}>
          <View>
            <Text style={s.b}>Pick & Drop today: {h?.pd.n || 0}</Text>
            <Muted>{h?.pd.free || 0} free (within {h?.config.tariff.pdFree ?? 15} min)</Muted>
          </View>
          <MaterialCommunityIcons name="taxi" size={30} color={C.a} />
        </Card>
        <View style={s.two}>
          <Btn kind="o" icon="printer" title="Printer" onPress={() => reset({ name: "printer" })} style={{ flex: 1 }} />
          <Btn kind="o" icon="qrcode-scan" title="Scan token" onPress={() => go({ name: "scan" })} style={{ flex: 1 }} />
        </View>
      </View>
    </ScrollView>
  );
}
