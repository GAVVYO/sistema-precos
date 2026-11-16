"use client";

import { FlaskConical } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useDemoState } from "@/app-state/app-context";
import { BackendUnavailable } from "@/components/layout/backend-unavailable";
import { Button, cx, Field, Select, Skeleton } from "@/components/ui/primitives";
import { BrandMark } from "@/components/ui/brand-mark";
import { APP_MODE } from "@/config/env";
import { demoStore } from "@/demo/store";
import { ROLE_LABELS } from "@/domain/permissions";

const ROLE_HINTS = {
  owner: "Acesso geral, usuários e configurações",
  receptionist: "Agenda, clientes e abertura de OS",
  mechanic: "Serviços atribuídos, status e peças",
  financial: "Receitas, despesas e relatórios",
};

export default function LoginPage() {
  const state = useDemoState();
  const router = useRouter();
  const [workshopId, setWorkshopId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  if (APP_MODE === "production") return <BackendUnavailable />;

  const db = state?.db;
  const selectedWorkshop = workshopId ?? db?.workshops[0]?.id ?? "";
  const members = db?.memberships.filter((m) => m.workshopId === selectedWorkshop && m.active) ?? [];
  const selectedUser = members.some((m) => m.userId === userId) ? userId : (members[0]?.userId ?? null);

  return (
    <main className="login-screen flex min-h-screen items-center justify-center p-6">
      <div className="login-panel page-enter w-full max-w-lg">
        <div className="mb-5 flex items-center justify-center gap-2.5">
          <BrandMark className="size-11" />
          <div>
            <p className="text-lg leading-tight font-semibold">GAVYO Auto</p>
            <p className="text-xs text-muted">Gestão para oficinas e centros automotivos</p>
          </div>
        </div>

        <div className="rounded-md border border-line bg-surface">
          <div className="flex items-start gap-2 rounded-t-md border-b border-amber-200 bg-amber-50 px-5 py-3 text-xs leading-relaxed text-amber-900">
            <FlaskConical className="mt-0.5 size-4 shrink-0" aria-hidden />
            <p>
              <strong>Acesso de demonstração.</strong> Os dados são fictícios e ficam salvos apenas neste
              navegador. A escolha de usuário abaixo é uma simulação, não um login real — não informe dados
              verdadeiros de clientes.
            </p>
          </div>

          {!db ? (
            <div className="space-y-3 p-5" aria-busy="true" aria-label="Carregando">
              <Skeleton className="h-9" />
              <Skeleton className="h-28" />
              <Skeleton className="h-9" />
            </div>
          ) : (
            <form
              className="space-y-4 p-5"
              onSubmit={(e) => {
                e.preventDefault();
                if (!selectedUser) return;
                demoStore.login(selectedWorkshop, selectedUser);
                router.replace("/inicio");
              }}
            >
              <Field label="Oficina">
                {(p) => (
                  <Select {...p} value={selectedWorkshop} onChange={(e) => setWorkshopId(e.target.value)}>
                    {db.workshops.map((w) => (
                      <option key={w.id} value={w.id}>
                        {db.settings.find((s) => s.workshopId === w.id)?.displayName ?? w.name}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>

              <fieldset>
                <legend className="mb-1 text-xs font-medium">Entrar como</legend>
                <div className="grid gap-2 sm:grid-cols-2">
                  {members.map((m) => {
                    const u = db.users.find((x) => x.id === m.userId)!;
                    const checked = selectedUser === m.userId;
                    return (
                      <label
                        key={m.id}
                        className={cx(
                          "flex cursor-pointer items-start gap-2 rounded-md border px-3 py-2",
                          checked ? "border-primary bg-primary-soft" : "border-line hover:bg-slate-50",
                        )}
                      >
                        <input type="radio" name="user" className="mt-1 accent-(--primary)" checked={checked} onChange={() => setUserId(m.userId)} />
                        <span className="min-w-0">
                          <span className="block truncate text-[13px] font-semibold">{u.name}</span>
                          <span className="block text-xs text-muted">
                            {ROLE_LABELS[m.role]} · {ROLE_HINTS[m.role]}
                          </span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>

              <Button type="submit" variant="primary" className="w-full" disabled={!selectedUser}>
                Entrar na demonstração
              </Button>
            </form>
          )}
        </div>
        <p className="mt-4 text-center text-xs text-muted">Desenvolvido pela GAVYO · Fortaleza, CE</p>
      </div>
    </main>
  );
}
