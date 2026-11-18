import { useLocalSearchParams } from "expo-router";
import { OrderDetail } from "@/screens/order-detail";

export default function Screen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <OrderDetail id={id} />;
}
