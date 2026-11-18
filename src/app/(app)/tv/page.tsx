import type { Metadata } from "next";
import { ModuleGuard } from "@/components/layout/app-shell";
import { TvPage } from "@/features/tv/tv-page";

export const metadata: Metadata = { title: "TV da oficina" };

export default function Page() {
  return (
    <ModuleGuard module="orders">
      <TvPage />
    </ModuleGuard>
  );
}
