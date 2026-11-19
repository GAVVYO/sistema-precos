import { View } from "react-native";
import { useApp } from "@/data/store";
import { SignIn } from "@/screens/sign-in";
import { Unlock } from "@/screens/unlock";
import { Welcome } from "@/screens/welcome";
import { colors } from "@/theme";

/**
 * Porta de entrada (decisão 76), conforme o celular está ligado à oficina:
 * sem ligação → "Ler QR"; celular da pessoa → digital ou PIN;
 * aparelho da oficina → "Quem está entrando?" + PIN.
 */
export default function Screen() {
  const { device, deviceLoaded } = useApp();
  if (!deviceLoaded) return <View style={{ flex: 1, backgroundColor: colors.background }} />;
  if (!device) return <Welcome />;
  if (device.mode === "person") return <Unlock key={device.userId} workshopId={device.workshopId} userId={device.userId} />;
  return <SignIn key={device.workshopId} workshopId={device.workshopId} lastUserId={device.lastUserId} />;
}
