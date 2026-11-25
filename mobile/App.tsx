import { StatusBar } from "expo-status-bar";
import React from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { BottomNav, C } from "./src/components/ui";
import { Done, Exit, Scan, Upi } from "./src/screens/Exit";
import Home from "./src/screens/Home";
import Inside from "./src/screens/Inside";
import Login from "./src/screens/Login";
import Printer from "./src/screens/Printer";
import Shift from "./src/screens/Shift";
import { Token, VehicleIn } from "./src/screens/VehicleIn";
import { AppProvider, useApp } from "./src/store";

function Router() {
  const { ready, route, toastMsg } = useApp();
  if (!ready) return <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}><ActivityIndicator size="large" color={C.p2} /></View>;

  let screen: React.ReactNode;
  switch (route.name) {
    case "login": screen = <Login />; break;
    case "home": screen = <Home />; break;
    case "vin": screen = <VehicleIn />; break;
    case "token": screen = <Token ticket={route.ticket} />; break;
    case "scan": screen = <Scan />; break;
    case "exit": screen = <Exit ticket={route.ticket} />; break;
    case "upi": screen = <Upi ticket={route.ticket} total={route.total} lost={route.lost} />; break;
    case "done": screen = <Done ticket={route.ticket} />; break;
    case "inside": screen = <Inside key={route.type || "all"} type={route.type} />; break;
    case "shift": screen = <Shift />; break;
    case "printer": screen = <Printer />; break;
  }

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      {screen}
      {route.name !== "login" ? <BottomNav /> : null}
      {toastMsg ? (
        <View pointerEvents="none" style={{ position: "absolute", top: 12, left: 16, right: 16, alignItems: "center" }}>
          <Text style={{ backgroundColor: "#111827", color: "#fff", paddingHorizontal: 16, paddingVertical: 11, borderRadius: 12, overflow: "hidden", fontSize: 14 }}>{toastMsg}</Text>
        </View>
      ) : null}
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AppProvider>
        <SafeAreaView style={{ flex: 1, backgroundColor: C.p }} edges={["top"]}>
          <StatusBar style="light" />
          <Router />
        </SafeAreaView>
      </AppProvider>
    </SafeAreaProvider>
  );
}
