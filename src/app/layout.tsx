import type { Metadata } from "next";
import { Toaster } from "@/components/ui/toast";
import "@fontsource-variable/manrope";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "GAVYO Auto", template: "%s · GAVYO Auto" },
  description: "Gestão para oficinas mecânicas, autoelétricas e centros automotivos.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className="h-full antialiased" suppressHydrationWarning>
      <body className="min-h-full" suppressHydrationWarning>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
