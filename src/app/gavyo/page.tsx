import type { Metadata } from "next";
import { GavyoAdmin } from "@/features/gavyo/gavyo-admin";

export const metadata: Metadata = { title: "Área da GAVYO", robots: { index: false, follow: false } };

export default function GavyoPage() {
  return <GavyoAdmin />;
}
