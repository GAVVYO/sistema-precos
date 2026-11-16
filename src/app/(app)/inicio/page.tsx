import type { Metadata } from "next";
import { ModuleGuard } from "@/components/layout/app-shell";
import { DashboardPage } from "@/features/dashboard/dashboard-page";

export const metadata: Metadata = { title: "Início" };

export default function Page() {
  return (
    <ModuleGuard module="dashboard">
      <DashboardPage />
    </ModuleGuard>
  );
}
