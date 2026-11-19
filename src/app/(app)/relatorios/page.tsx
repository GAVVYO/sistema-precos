import type { Metadata } from "next";
import { ModuleGuard } from "@/components/layout/app-shell";
import { PerformancePage } from "@/features/reports/performance-page";

export const metadata: Metadata = { title: "Desempenho" };

export default function Page() {
  return (
    <ModuleGuard module="reports">
      <PerformancePage />
    </ModuleGuard>
  );
}
