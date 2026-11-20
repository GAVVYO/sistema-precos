"use client";

import { ImageUp, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { Check, IdentificationBadge, Palette } from "@phosphor-icons/react";
import { NAV_ICONS } from "@/components/layout/personal-navigation";
import Link from "next/link";
import { useApp } from "@/app-state/app-context";
import { Button, Field, Input, PageHeader } from "@/components/ui/primitives";
import { toast } from "@/components/ui/toast";
import { BrandMark } from "@/components/ui/brand-mark";
import { contrastOn } from "@/lib/theme";
import { MODULES } from "@/domain/permissions";
import type { ModuleKey } from "@/domain/types";
import { formatPhone } from "@/lib/format";
import { updateSettings } from "@/services/admin";
import { maskPhone } from "@/lib/masks";

const DEFAULT_COLORS = { primary: "#2563EB", secondary: "#172033" };
const PRIMARY_PRESETS: [string, string][] = [["#2563EB", "Azul"], ["#0F766E", "Verde-azulado"], ["#15803D", "Verde"], ["#B45309", "Laranja"], ["#BE123C", "Vermelho"], ["#6D28D9", "Roxo"]];
const MENU_PRESETS: [string, string][] = [["#172033", "Azul-marinho"], ["#0F172A", "Quase preto"], ["#1F2937", "Grafite"], ["#3B0764", "Roxo escuro"], ["#052E16", "Verde escuro"], ["#7C2D12", "Marrom"]];
/** O que cada item do menu faz, em uma frase (decisão 91). */
const MODULE_HINT: Partial<Record<ModuleKey, string>> = {
  dashboard: "Os carros na oficina e quem chega hoje",
  orders: "Abrir serviço, mudar etapa e receber",
  stock: "Peças e quanto tem de cada uma",
  finance: "Quanto entrou, saiu e quem está devendo",
  schedule: "Clientes marcados por dia",
  customers: "Clientes, carros e funcionários",
  settings: "Esta tela",
};

/** Cores em bolinhas para tocar, sem código de cor; "Outra cor" fica guardada. */
function ColorPick({ label, hint, value, onChange, presets }: { label: string; hint: string; value: string; onChange: (v: string) => void; presets: [string, string][] }) {
  const custom = !presets.some(([c]) => c.toUpperCase() === value.toUpperCase());
  return (
    <fieldset className="cfg-colors">
      <legend>{label}</legend>
      <p className="cfg-hint">{hint}</p>
      <div className="cfg-swatches">
        {presets.map(([c, name]) => (
          <button key={c} type="button" aria-label={name} aria-pressed={c.toUpperCase() === value.toUpperCase()} onClick={() => onChange(c)} style={{ background: c }}>
            {c.toUpperCase() === value.toUpperCase() && <Check size={20} weight="bold" color={contrastOn(c)} aria-hidden />}
          </button>
        ))}
        <label className="cfg-other" data-on={custom || undefined}>
          <span style={{ background: custom ? value : undefined }} aria-hidden><Palette size={20} weight="bold" color={custom ? contrastOn(value) : undefined} /></span>
          Outra cor
          <input type="color" className="sr-only" value={value} onChange={(e) => onChange(e.target.value.toUpperCase())} />
        </label>
      </div>
    </fieldset>
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
    if (file.size > 250_000) return toast("error", "Imagem muito grande. Use um logo de até 250 KB.");
    const reader = new FileReader();
    reader.onload = () => setLogo(reader.result as string);
    reader.onerror = () => toast("error", "Não deu para ler a imagem.");
    reader.readAsDataURL(file);
  };

  const save = () =>
    act(
      (db, ctx) => updateSettings(db, ctx, { displayName, phone, logoDataUrl: logo, primaryColor: primary, secondaryColor: secondary, activeModules: modules }),
      "Salvo. As cores e o menu já mudaram.",
    );

  return (
    <div className="cfg">
      <section className="cash-card cfg-block" aria-labelledby="cfg-shop">
        <h2 id="cfg-shop" className="cash-h2">Sua oficina</h2>
        <p className="cfg-hint">Aparece no topo do sistema, nos PDFs e nas mensagens de WhatsApp.</p>
        <div className="cfg-shop">
          <div className="cfg-logo">
            {logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logo} alt="Logo da oficina" />
            ) : (
              <BrandMark className="size-12" />
            )}
          </div>
          <div className="cfg-logo-actions">
            <span className="text-sm font-semibold">Logo da oficina</span>
            <input ref={fileRef} type="file" accept="image/png,image/jpeg" className="hidden" onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ""; }} />
            <span className="flex flex-wrap gap-2">
              <Button icon={<ImageUp className="size-4" aria-hidden />} onClick={() => fileRef.current?.click()}>{logo ? "Trocar logo" : "Pôr logo"}</Button>
              {logo && <Button variant="ghost" icon={<Trash2 className="size-4" aria-hidden />} onClick={() => setLogo(null)}>Tirar logo</Button>}
            </span>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-5">
          <Field label="Nome da oficina" className="sm:col-span-3">{(p) => <Input {...p} value={displayName} onChange={(e) => setDisplayName(e.target.value)} />}</Field>
          <Field label="Telefone" optional className="sm:col-span-2">{(p) => <Input {...p} value={phone} onChange={(e) => setPhone(maskPhone(e.target.value))} inputMode="tel" />}</Field>
        </div>
      </section>

      <section className="cash-card cfg-block" aria-labelledby="cfg-colors">
        <h2 id="cfg-colors" className="cash-h2">Cores</h2>
        <ColorPick label="Cor dos botões" hint="Botões principais e destaques." value={primary} onChange={setPrimary} presets={PRIMARY_PRESETS} />
        <ColorPick label="Cor do menu" hint="Item escolhido do menu e as iniciais das pessoas." value={secondary} onChange={setSecondary} presets={MENU_PRESETS} />
        <div className="cfg-preview" aria-label="Como vai ficar">
          <span className="cfg-preview-label">Como vai ficar</span>
          <div className="cfg-preview-bar">
            <span className="cfg-preview-tab" style={{ background: secondary, color: contrastOn(secondary) }}>Hoje</span>
            <span>Serviços</span><span>Estoque</span>
            <span className="cfg-preview-btn" style={{ background: primary, color: contrastOn(primary) }}>+ Novo serviço</span>
          </div>
        </div>
        <button type="button" className="cash-link justify-self-start" onClick={() => { setPrimary(DEFAULT_COLORS.primary); setSecondary(DEFAULT_COLORS.secondary); }}>Voltar às cores da GAVYO</button>
      </section>

      <section className="cash-card cfg-block" aria-labelledby="cfg-menu">
        <h2 id="cfg-menu" className="cash-h2">O que aparece no menu</h2>
        <p className="cfg-hint">Desligue o que a oficina não usa. Some do menu de todo mundo daqui.</p>
        <ul className="cfg-mods">
          {MODULES.filter((m) => !m.hidden).map((m) => {
            const Icon = NAV_ICONS[m.key as keyof typeof NAV_ICONS];
            const on = m.required || modules.includes(m.key);
            return (
              <li key={m.key}>
                <label className="cfg-mod" data-on={on || undefined}>
                  <span className="cfg-mod-icon" aria-hidden>{Icon && <Icon />}</span>
                  <span className="cfg-mod-text"><b>{m.label}</b><small>{MODULE_HINT[m.key] ?? ""}</small></span>
                  {m.required ? <span className="cfg-always">Sempre aparece</span> : (
                    <span className="cfg-switch">
                      <input type="checkbox" role="switch" checked={on} onChange={(e) => setModules(e.target.checked ? [...modules, m.key] : modules.filter((k) => k !== m.key))} aria-label={`Mostrar ${m.label} no menu`} />
                      <span aria-hidden />
                    </span>
                  )}
                </label>
              </li>
            );
          })}
        </ul>
      </section>

      <div className="cfg-save">
        <Button variant="primary" disabled={!online} onClick={save}>Salvar</Button>
        <span className="text-sm text-muted">Vale para todos desta oficina.</span>
      </div>
    </div>
  );
}

export function SettingsPage() {
  const { can, settings } = useApp();
  // Funcionários e permissões foram para Pessoas (decisão 62).
  return (
    <div className="module-page module-settings">
      <PageHeader title="Configurações" description={`Nome, logo, cores e menu de ${settings.displayName}.`} />
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
