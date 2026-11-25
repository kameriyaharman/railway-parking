// App state: session, server config, printer settings, simple stack navigation and toasts.
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { BackHandler } from "react-native";
import { configureApi, DEFAULT_SERVER, type Config, type Ticket, type User } from "./api";
import { DEFAULT_PRINTER, printSlip, type PrinterSettings } from "./printer";

export type Route =
  | { name: "login" }
  | { name: "home" }
  | { name: "vin" }
  | { name: "token"; ticket: Ticket }
  | { name: "scan" }
  | { name: "exit"; ticket: Ticket }
  | { name: "upi"; ticket: Ticket; total: number; lost: boolean }
  | { name: "done"; ticket: Ticket }
  | { name: "inside"; type?: string }
  | { name: "shift" }
  | { name: "printer" };

type Ctx = {
  ready: boolean;
  user: User | null;
  cfg: Config | null;
  server: string;
  printer: PrinterSettings;
  route: Route;
  lastMobile: string;
  lastStand: number;
  go: (r: Route) => void; // push
  reset: (r: Route) => void; // replace whole stack (tabs)
  back: () => void;
  login: (token: string, user: User, mobile: string, stand: number) => Promise<void>;
  logout: () => Promise<void>;
  setCfg: (c: Config) => void;
  setServer: (s: string) => Promise<void>;
  setPrinter: (p: Partial<PrinterSettings>) => Promise<void>;
  toast: (msg: string, ms?: number) => void;
  toastMsg: string;
  print: (t: Ticket, out: boolean) => Promise<void>;
};

const AppCtx = createContext<Ctx>(null as unknown as Ctx);
export const useApp = () => useContext(AppCtx);

const K = { token: "tok", user: "user", printer: "printer", server: "server", mobile: "lastMobile", stand: "lastStand" };

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [cfg, setCfg] = useState<Config | null>(null);
  const [server, setServerState] = useState(DEFAULT_SERVER);
  const [printer, setPrinterState] = useState<PrinterSettings>(DEFAULT_PRINTER);
  const [stack, setStack] = useState<Route[]>([{ name: "login" }]);
  const [toastMsg, setToastMsg] = useState("");
  const [lastMobile, setLastMobile] = useState("");
  const [lastStand, setLastStand] = useState(0);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const printerRef = useRef(printer);
  printerRef.current = printer;
  const cfgRef = useRef(cfg);
  cfgRef.current = cfg;

  const toast = useCallback((msg: string, ms = 2600) => {
    setToastMsg(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMsg(""), ms);
  }, []);

  const logout = useCallback(async () => {
    await AsyncStorage.multiRemove([K.token, K.user]);
    configureApi({ token: "" });
    setUser(null);
    setStack([{ name: "login" }]);
  }, []);

  useEffect(() => {
    (async () => {
      const [[, tok], [, u], [, p], [, srv], [, mob], [, st]] = await AsyncStorage.multiGet([K.token, K.user, K.printer, K.server, K.mobile, K.stand]);
      const s = srv || DEFAULT_SERVER;
      setServerState(s);
      configureApi({ server: s, token: tok || "", onUnauthorized: () => { logout(); } });
      if (p) setPrinterState({ ...DEFAULT_PRINTER, ...JSON.parse(p) });
      if (mob) setLastMobile(mob);
      if (st) setLastStand(Number(st));
      if (tok && u) { setUser(JSON.parse(u)); setStack([{ name: "home" }]); }
      setReady(true);
    })();
  }, [logout]);

  const route = stack[stack.length - 1];
  const go = useCallback((r: Route) => setStack((s) => [...s, r]), []);
  const reset = useCallback((r: Route) => setStack(r.name === "home" || r.name === "login" ? [r] : [{ name: "home" }, r]), []);
  const back = useCallback(() => setStack((s) => (s.length > 1 ? s.slice(0, -1) : s)), []);

  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (stack.length > 1) { back(); return true; }
      return false;
    });
    return () => sub.remove();
  }, [stack.length, back]);

  const login = useCallback(async (token: string, u: User, mobile: string, stand: number) => {
    configureApi({ token });
    await AsyncStorage.multiSet([[K.token, token], [K.user, JSON.stringify(u)], [K.mobile, mobile], [K.stand, String(stand)]]);
    setLastMobile(mobile);
    setLastStand(stand);
    setUser(u);
    setStack([{ name: "home" }]);
  }, []);

  const setServer = useCallback(async (s: string) => {
    const v = s.trim().replace(/\/+$/, "") || DEFAULT_SERVER;
    await AsyncStorage.setItem(K.server, v);
    configureApi({ server: v });
    setServerState(v);
  }, []);

  const setPrinter = useCallback(async (p: Partial<PrinterSettings>) => {
    const next = { ...printerRef.current, ...p };
    setPrinterState(next);
    await AsyncStorage.setItem(K.printer, JSON.stringify(next));
  }, []);

  const print = useCallback(async (t: Ticket, out: boolean) => {
    const c = cfgRef.current;
    if (!c) return;
    try { await printSlip(t, out, c, printerRef.current); if (printerRef.current.method === "bt") toast("Printed ✓", 1500); }
    catch (e: any) { toast("Print error: " + (e?.message || e), 4000); }
  }, [toast]);

  const value = useMemo<Ctx>(() => ({
    ready, user, cfg, server, printer, route, lastMobile, lastStand, go, reset, back, login, logout, setCfg, setServer, setPrinter, toast, toastMsg, print,
  }), [ready, user, cfg, server, printer, route, lastMobile, lastStand, go, reset, back, login, logout, setServer, setPrinter, toast, toastMsg, print]);

  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}
