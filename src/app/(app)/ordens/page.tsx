import type { Metadata } from "next";
import { ModuleGuard } from "@/components/layout/app-shell";
import { OrdersPage } from "@/features/orders/orders-page";

export const metadata: Metadata = { title: "Ordens de serviço" };

export default function Page() {
  return (
    <ModuleGuard module="orders">
      <OrdersPage />
    </ModuleGuard>
  );
}
