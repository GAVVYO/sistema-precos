"use client";

import { ImageUp, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { IdentificationBadge } from "@phosphor-icons/react";
import Link from "next/link";
import { useApp } from "@/app-state/app-context";
import { Button, Card, CardHeader, Field, Input, PageHeader } from "@/components/ui/primitives";
import { toast } from "@/components/ui/toast";
import { BrandMark } from "@/components/ui/brand-mark";
import { contrastOn } from "@/lib/theme";
import { MODULES } from "@/domain/permissions";
import type { ModuleKey } from "@/domain/types";
import { formatPhone } from "@/lib/format";
import { updateSettings } from "@/services/admin";
import { maskPhone } from "@/lib/masks";

const DEFAULT_COLORS = { primary: "#2563EB", secondary: "#172033" };
const PRIMARY_PRESETS = ["#2563EB", "#0F766E", "#B45309", "#BE123C", "#6D28D9", "#15803D"];

function ColorField({ label, value, onChange, presets }: { label: string; value: string; onChange: (v: string) => void; presets?: string[] }) {
  return (
    <Field label={label}>
      {(p) => (
        <div className="flex flex-wrap items-center gap-2">
          <input {...p} type="color" value={value} onChange={(e) => onChange(e.target.value.toUpperCase())} className="h-9 w-12 cursor-pointer rounded-md border border-line bg-surface p-1" />
          <span className="font-mono text-xs text-muted">{value}</span>
          {presets?.map((c) => (
            <button key={c} type="button" aria-label={`Usar a cor ${c}`} aria-pressed={c === value} onClick={() => onChange(c)} className="size-11 shrink-0 rounded-full border-2 border-white ring-1 ring-line aria-pressed:ring-2 aria-pressed:ring-ink" style={{ background: c }} />
          ))}
        </div>
      )}
    </Field>
  );
}

function WorkshopSettingsForm() {
  const { settings, act, online } = useApp();
  const [displayName, setDisplayName] = useState(settings.displayName);
  const [phone, setPhone] = useState(settings.phone ? formatPhone(settings.phone) : "");
  const [logo, setLogo] = useState(settings.logoDataUrl);
  const [primary, setPrimary] = useState(settings.primaryColor);
  const [secondary, setSecondary] = useState(settings.secondaryColor);
  const [modules, setModules] = useState<ModuleKey[]>(settings.activeModules);
  const fileRef = useRef<HTMLInputElement>(null);

  const onFile = (file: File | undefined) => {
    if (!file) return;
    if (!/^image\/(png|jpeg)$/.test(file.type)) return toast("error", "Use uma imagem PNG ou JPG.");
    if (file.size > 250_000) return toast("error", "Imagem muito grande. Use um logotipo de até 250 KB.");
    const reader = new FileReader();
    reader.onload = () => setLogo(reader.result as string);
    reader.onerror = () => toast("error", "Não foi possível ler a imagem.");
    reader.readAsDataURL(file);
  };

  const save = () =>
    act(
      (db, ctx) => updateSettings(db, ctx, { displayName, phone, logoDataUrl: logo, primaryColor: primary, secondaryColor: secondary, activeModules: modules }),
      "Configurações salvas. A identidade visual já foi aplicada.",
    );

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader title="Identidade da oficina" subtitle="Aparece no cabeçalho, nos PDFs e nas mensagens de WhatsApp." />
        <div className="space-y-4 p-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-5">
            <Field label="Nome da oficina" className="sm:col-span-3">{(p) => <Input {...p} value={displayName} onChange={(e) => setDisplayName(e.target.value)} />}</Field>
            <Field label="Telefone" optional className="sm:col-span-2">{(p) => <Input {...p} value={phone} onChange={(e) => setPhone(maskPhone(e.target.value))} inputMode="tel" />}</Field>
          </div>
          <div>
            <p className="mb-1 text-xs font-medium">Logotipo</p>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex size-14 items-center justify-center rounded-md border border-line bg-slate-50">
                {logo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={logo} alt="Logotipo atual" className="max-h-full max-w-full object-contain" />
                ) : (
                  <BrandMark className="size-9" />
                )}
              </div>
              <input ref={fileRef} type="file" accept="image/png,image/jpeg" className="hidden" onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ""; }} />
              <Button icon={<ImageUp className="size-4" aria-hidden />} onClick={() => fileRef.current?.click()}>Enviar imagem</Button>
              {logo && <Button variant="ghost" icon={<Trash2 className="size-4" aria-hidden />} onClick={() => setLogo(null)}>Remover</Button>}
              <span className="text-xs text-muted">PNG ou JPG, até 250 KB.</span>
            </div>
          </div>
          <ColorField label="Cor principal (botões, destaques e links)" value={primary} onChange={setPrimary} presets={PRIMARY_PRESETS} />
          <ColorField label="Cor secundária (aba ativa e avatar)" value={secondary} onChange={setSecondary} />
          <div className="overflow-hidden rounded-md border border-line" aria-label="Pré-visualização">
            <div className="flex items-center gap-2 px-4 py-4 text-sm font-semibold" style={{ background: secondary, color: contrastOn(secondary) }}>
              <span className="truncate">{displayName}</span>
              <span className="ml-auto opacity-80">Pré-visualização</span>
            </div>
            <div className="flex gap-4 border-b border-line bg-white px-4 py-3 text-xs font-semibold"><span style={{ color: primary }}>Hoje</span><span>Serviços</span><span>Estoque</span></div>
            <div className="flex items-center gap-3 bg-bg px-3 py-3">
              <span className="rounded-md px-3 py-1.5 text-xs font-semibold" style={{ background: primary, color: contrastOn(primary) }}>Novo serviço</span>
              <span className="text-xs font-semibold text-ink">Serviços da oficina</span>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={() => { setPrimary(DEFAULT_COLORS.primary); setSecondary(DEFAULT_COLORS.secondary); }}>Restaurar cores padrão do GAVYO Auto</Button>
        </div>
      </Card>

      <Card className="self-start">
        <CardHeader title="Módulos ativos" subtitle="Módulos desativados somem do menu de todos os usuários desta oficina." />
        <ul className="divide-y divide-line">
          {MODULES.map((m) => (
            <li key={m.key}>
              <label className="flex items-center gap-3 px-4 py-2.5 text-sm">
                <input
                  type="checkbox"
                  className="size-4 accent-(--primary)"
                  checked={m.required || modules.includes(m.key)}
                  disabled={m.required}
                  onChange={(e) => setModules(e.target.checked ? [...modules, m.key] : modules.filter((k) => k !== m.key))}
                />
                <span className="font-medium">{m.label}</span>
                {m.required && <span className="text-xs text-muted">sempre ativo</span>}
              </label>
            </li>
          ))}
        </ul>
      </Card>

      <div className="flex flex-wrap items-center gap-3 lg:col-span-2">
        <Button variant="primary" disabled={!online} onClick={save}>Salvar configurações</Button>
        <span className="text-xs text-muted">As alterações valem apenas para esta oficina.</span>
      </div>
    </div>
  );
}

export function SettingsPage() {
  const { can, settings } = useApp();
  // Funcionários e permissões foram para Pessoas (decisão 62).
  return (
    <div className="module-page module-settings">
      <PageHeader title="Configurações" description={`Personalização e acessos de ${settings.displayName}.`} />
      {can("staff.manage") && (
        <Link href="/clientes" className="rail-line mb-4">
          <IdentificationBadge size={22} weight="duotone" aria-hidden />
          <span><strong>Funcionários e permissões</strong> agora ficam em Pessoas › Funcionários.</span>
          <span className="rail-line-go">Abrir →</span>
        </Link>
      )}
      {can("settings.manage") && <WorkshopSettingsForm key={settings.workshopId} />}
    </div>
  );
}
