import type { Metadata } from "next";
import { ModuleGuard } from "@/components/layout/app-shell";
import { StockPage } from "@/features/stock/stock-page";

export const metadata: Metadata = { title: "Estoque" };

export default function Page() {
  return (
    <ModuleGuard module="stock">
      <StockPage />
    </ModuleGuard>
  );
}
