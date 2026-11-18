import type { Metadata } from "next";
import { ModuleGuard } from "@/components/layout/app-shell";
import { PeoplePage } from "@/features/people/people-page";

export const metadata: Metadata = { title: "Pessoas" };

export default function Page() {
  return (
    <ModuleGuard module="customers">
      <PeoplePage />
    </ModuleGuard>
  );
}
