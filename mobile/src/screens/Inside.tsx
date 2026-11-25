import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useState } from "react";
import { FlatList, Pressable, RefreshControl, Text, View } from "react-native";
import { api, type Ticket } from "../api";
import { C, Input, Muted, Pill, TopBar, s } from "../components/ui";
import { dur, ICON, rs, tm, TL, TYPES } from "../format";
import { useApp } from "../store";

export default function Inside({ type }: { type?: string }) {
  const { go, toast, reset } = useApp();
  const [f, setF] = useState(type || "");
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { setRows(await api<Ticket[]>(`/api/inside?type=${f}&q=${encodeURIComponent(q)}`)); }
    catch (e: any) { toast(e.message); }
    finally { setLoading(false); }
  }, [f, q]);
  useEffect(() => { const t = setTimeout(load, 300); return () => clearTimeout(t); }, [load]);

  return (
    <View style={{ flex: 1 }}>
      <TopBar title={`Vehicles inside · ${rows.length}`} onBack={() => reset({ name: "home" })} />
      <View style={{ padding: 16, paddingBottom: 4 }}>
        <Input value={q} onChangeText={(v) => setQ(v.toUpperCase())} autoCapitalize="characters" placeholder="Search vehicle / token no." />
        <View style={{ flexDirection: "row", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
          {[{ key: "", label: "All" }, ...TYPES].map((t) => (
            <Pressable key={t.key} onPress={() => setF(t.key)}><Pill kind={f === t.key ? "b" : undefined} text={t.label} /></Pressable>
          ))}
        </View>
      </View>
      <FlatList
        data={rows}
        keyExtractor={(r) => String(r.id)}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
        contentContainerStyle={{ padding: 16, paddingBottom: 110 }}
        ListEmptyComponent={!loading ? <Muted>Koi vehicle andar nahi hai</Muted> : null}
        renderItem={({ item: r }) => (
          <Pressable onPress={() => go({ name: "exit", ticket: r })} style={[s.card, s.row, { marginBottom: 8 }]}>
            <View style={s.ico}><MaterialCommunityIcons name={ICON[r.vtype] as any} size={22} color={C.p2} /></View>
            <View style={{ flex: 1 }}>
              <View style={s.row}>
                <Text style={s.b}>{r.vehicle_no}</Text>
                {(r.live?.minutes || 0) > 1440 ? <Pill kind="r" text="24 hr+" /> : null}
              </View>
              <Muted>{r.token_no} · {TL[r.vtype]} · in {tm(r.in_at)}</Muted>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Muted>{dur(r.live?.minutes)}</Muted>
              <Text style={s.b}>now {rs(r.live?.total)}</Text>
            </View>
          </Pressable>
        )}
      />
    </View>
  );
}
