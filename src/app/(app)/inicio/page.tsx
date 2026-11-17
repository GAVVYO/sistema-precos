import type { Metadata } from "next";
import { Suspense } from "react";
import { ModuleGuard } from "@/components/layout/app-shell";
import { DashboardPage } from "@/features/dashboard/dashboard-page";

export const metadata: Metadata = { title: "Hoje" };

export default function Page() {
  return (
    <ModuleGuard module="dashboard">
      <Suspense>
        <DashboardPage />
      </Suspense>
    </ModuleGuard>
  );
}
