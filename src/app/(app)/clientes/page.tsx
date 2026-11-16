import type { Metadata } from "next";
import { ModuleGuard } from "@/components/layout/app-shell";
import { CustomersPage } from "@/features/customers/customers-page";

export const metadata: Metadata = { title: "Clientes e veículos" };

export default function Page() {
  return (
    <ModuleGuard module="customers">
      <CustomersPage />
    </ModuleGuard>
  );
}
