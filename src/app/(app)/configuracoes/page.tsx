import type { Metadata } from "next";
import { ModuleGuard } from "@/components/layout/app-shell";
import { SettingsPage } from "@/features/settings/settings-page";

export const metadata: Metadata = { title: "Configurações" };

export default function Page() {
  return (
    <ModuleGuard module="settings">
      <SettingsPage />
    </ModuleGuard>
  );
}
