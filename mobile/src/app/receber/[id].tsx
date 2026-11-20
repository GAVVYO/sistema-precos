import { useLocalSearchParams } from "expo-router";
import { Receive } from "@/screens/receive";

export default function Screen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <Receive id={id} />;
}
