"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { AppProvider, useDemoState } from "@/app-state/app-context";
import { AppShell } from "@/components/layout/app-shell";
import { BackendUnavailable } from "@/components/layout/backend-unavailable";
import { Skeleton } from "@/components/ui/primitives";
import { APP_MODE } from "@/config/env";
import { GlobalDialogs } from "@/features/orders/global-dialogs";
import { membershipOf } from "@/services/core";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const state = useDemoState();
  const router = useRouter();
  const session = state?.session ?? null;
  const valid = !!state && !!session && !!membershipOf(state.db, session);

  useEffect(() => {
    if (APP_MODE === "demo" && state && !valid) router.replace("/login");
  }, [state, valid, router]);

  if (APP_MODE === "production") return <BackendUnavailable />;

  if (!state || !valid || !session) {
    return (
      <div className="mx-auto max-w-[1440px] space-y-4 p-4" aria-busy="true" aria-label="Carregando">
        <Skeleton className="h-12" />
        <div className="grid grid-cols-3 gap-4">
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    // A chave reinicia o estado de interface ao trocar de oficina ou usuário.
    <AppProvider key={`${session.workshopId}:${session.userId}`} state={state}>
      <AppShell>{children}</AppShell>
      <GlobalDialogs />
    </AppProvider>
  );
}
