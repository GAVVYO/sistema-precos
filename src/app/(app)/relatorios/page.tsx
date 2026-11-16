import type { Metadata } from "next";
import { ModuleGuard } from "@/components/layout/app-shell";
import { ReportsPage } from "@/features/reports/reports-page";

export const metadata: Metadata = { title: "Relatórios" };

export default function Page() {
  return (
    <ModuleGuard module="reports">
      <ReportsPage />
    </ModuleGuard>
  );
}
