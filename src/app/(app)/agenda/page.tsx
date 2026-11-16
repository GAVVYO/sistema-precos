import type { Metadata } from "next";
import { Suspense } from "react";
import { ModuleGuard } from "@/components/layout/app-shell";
import { SchedulePage } from "@/features/schedule/schedule-page";

export const metadata: Metadata = { title: "Agenda" };

export default function Page() {
  return (
    <ModuleGuard module="schedule">
      {/* useSearchParams exige um limite de Suspense. */}
      <Suspense>
        <SchedulePage />
      </Suspense>
    </ModuleGuard>
  );
}
