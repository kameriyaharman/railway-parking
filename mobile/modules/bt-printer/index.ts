// Native Bluetooth (classic SPP) thermal printer module — Android only.
import { requireOptionalNativeModule } from "expo";

export type PairedDevice = { name: string; address: string };
type Native = {
  isEnabled(): Promise<boolean>;
  getPairedDevices(): Promise<PairedDevice[]>;
  print(address: string, base64: string): Promise<boolean>;
  disconnect(): Promise<boolean>;
};

// null when running in Expo Go / web (no native code) — callers fall back to RawBT.
const BtPrinter = requireOptionalNativeModule<Native>("BtPrinter");
export default BtPrinter;
