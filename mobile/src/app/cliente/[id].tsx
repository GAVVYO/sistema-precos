import { useLocalSearchParams } from "expo-router";
import { CustomerDetail } from "@/screens/customer-detail";

export default function Screen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <CustomerDetail id={id} />;
}
