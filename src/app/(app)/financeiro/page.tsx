import type { Metadata } from "next";
import { ModuleGuard } from "@/components/layout/app-shell";
import { FinancePage } from "@/features/finance/finance-page";

export const metadata: Metadata = { title: "Financeiro" };

export default function Page() {
  return (
    <ModuleGuard module="finance">
      <FinancePage />
    </ModuleGuard>
  );
}
