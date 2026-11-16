"use client";

import { Accessibility, RotateCcw, ScanText } from "lucide-react";
import { ReactNode, useId, useState } from "react";
import { useAccessibility } from "./accessibility-provider";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/primitives";

function Option({ title, description, checked, onChange }: { title: string; description: string; checked: boolean; onChange: (checked: boolean) => void }) {
  const id = useId();
  return <label className="accessibility-option">
    <span><span id={`${id}-label`} className="block font-semibold">{title}</span><span id={id} className="mt-1 block text-sm text-muted">{description}</span></span>
    <input type="checkbox" checked={checked} onChange={event => onChange(event.target.checked)} aria-labelledby={`${id}-label`} aria-describedby={id} />
  </label>;
}

export function AccessibilityControls() {
  const [open, setOpen] = useState(false);
  const { preferences, update, reset } = useAccessibility();
  const name = useId();
  const changed = preferences.textSize !== "default" || preferences.contrast || preferences.spacing || preferences.motion === "reduce" || preferences.reading;
  return <>
    <button type="button" className="accessibility-trigger" onClick={() => setOpen(true)} aria-haspopup="dialog" aria-label="Acessibilidade" title="Acessibilidade">
      <Accessibility size={20} aria-hidden /><span className="accessibility-trigger-label">Acessibilidade</span>{changed && <span className="accessibility-active" aria-label="Preferências ativas" />}
    </button>
    {open && <Dialog title="Acessibilidade" subtitle="Ajuste a leitura e os controles ao seu jeito de trabalhar." onClose={() => setOpen(false)} footer={<><Button icon={<RotateCcw size={16} aria-hidden />} onClick={reset}>Restaurar padrão</Button><Button variant="primary" onClick={() => setOpen(false)}>Concluir</Button></>}>
      <p className="mb-5 text-sm text-muted">As mudanças são imediatas e ficam salvas para você nesta oficina e neste navegador.</p>
      <fieldset className="mb-5">
        <legend className="mb-2 font-semibold">Tamanho do texto</legend>
        <div className="accessibility-sizes">{([{ value: "default", label: "Padrão", scale: "100%" }, { value: "large", label: "Grande", scale: "125%" }, { value: "larger", label: "Maior", scale: "150%" }] as const).map(option => <label key={option.value}>
          <input type="radio" name={name} value={option.value} checked={preferences.textSize === option.value} onChange={() => update({ textSize: option.value })} />
          <span className="font-semibold">{option.label}</span><span className="text-sm text-muted">{option.scale}</span>
        </label>)}</div>
        <p className="mt-2 text-sm text-muted">Você também pode usar o zoom do navegador, inclusive acima de 150%.</p>
      </fieldset>
      <div className="accessibility-options">
        <Option title="Mais contraste" description="Reforça textos, bordas, estados e o foco do teclado." checked={preferences.contrast} onChange={contrast => update({ contrast })} />
        <Option title="Mais espaço para ler" description="Aumenta o espaço entre linhas, letras e palavras." checked={preferences.spacing} onChange={spacing => update({ spacing })} />
        <Option title="Reduzir movimento" description="Desativa animações e deslocamentos. O ajuste do seu sistema também é respeitado." checked={preferences.motion === "reduce"} onChange={reduce => update({ motion: reduce ? "reduce" : "system" })} />
        <Option title="Leitura ampliada" description="Mostra o botão Ampliar ao lado de placas, valores e descrições. Também permite selecionar um texto e usar Alt + L." checked={preferences.reading} onChange={reading => update({ reading })} />
      </div>
      <p className="mt-5 text-sm text-muted">Use Tab para navegar, Enter ou Espaço para ativar e Esc para fechar janelas. Na barra de navegação, use as setas para mover e Home para voltar ao topo.</p>
    </Dialog>}
  </>;
}

/** O botão é irmão do texto; nunca envolve ações existentes em outro botão. */
export function ReadableText({ label, text, children }: { label: string; text: string; children?: ReactNode }) {
  const { preferences, read } = useAccessibility();
  return <span className="readable-text">{children ?? text}{preferences.reading && <button type="button" className="reading-trigger" aria-label={`Ampliar ${label}`} title={`Ampliar ${label}`} onClick={() => read(label, text)}><ScanText size={16} aria-hidden /><span className="sr-only">Ampliar</span></button>}</span>;
}
