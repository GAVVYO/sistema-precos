"use client";

import { ChoiceGroup, MoreDetails } from "@/components/ui/choice";
import { ArrowLeftRight, Boxes, ClipboardCheck, PackageMinus, PackagePlus, Pencil, Plus, SearchX } from "lucide-react";
import { Camera, Car, Disc, Drop, Engine, Funnel, Lightning, MagnifyingGlass, Package, Prohibit, Warning } from "@phosphor-icons/react";
import { shrinkPhoto } from "@/features/orders/order-photos";
import { useState } from "react";
import { initialQuery } from "@/lib/query";
import { useApp } from "@/app-state/app-context";
import { Pager, usePager } from "@/components/ui/pager";
import { Dialog } from "@/components/ui/dialog";
import { Button, EmptyState, Field, Input, PageHeader, Select, Textarea } from "@/components/ui/primitives";
import { toast } from "@/components/ui/toast";
import { MOVEMENT_TYPE_LABELS, PART_CATEGORIES } from "@/domain/labels";
import type { Part } from "@/domain/types";
import { centsToInput, formatBRL, formatDateTime, formatOrderNumber, parseBRL } from "@/lib/format";
import { partSituation } from "@/services/stock";
import { maskMoney } from "@/lib/masks";

function PartDialog({ part, onClose }: { part: Part | null; onClose: () => void }) {
  const { act, online, view } = useApp();
  const [name, setName] = useState(part?.name ?? "");
  const [code, setCode] = useState(part?.code ?? "");
  const [category, setCategory] = useState(part?.category ?? PART_CATEGORIES[0]);
  const [description, setDescription] = useState(part?.description ?? "");
  const [initial, setInitial] = useState("0");
  const [min, setMin] = useState(String(part?.minQuantity ?? 1));
  const [cost, setCost] = useState(centsToInput(part?.costCents ?? null));
  const [price, setPrice] = useState(centsToInput(part?.priceCents ?? null));
  const [photo, setPhoto] = useState<string | null>(part?.photo ?? null);
  const categories = [...new Set([...PART_CATEGORIES, ...view.parts.map((p) => p.category)])];

  const save = () => {
    const costCents = parseBRL(cost);
    const priceCents = parseBRL(price);
    if (costCents === null || priceCents === null) return toast("error", "Diga quanto paga e quanto cobra pela peça. Exemplo: 35,00.");
    // Código em branco: cria um a partir do tipo (ex.: Filtros → FIL-004), sem repetir.
    const finalCode = code.trim() || (() => {
      const prefix = category.normalize("NFD").replace(/[^A-Za-z]/g, "").slice(0, 3).toUpperCase() || "PEC";
      const used = new Set(view.parts.map((x) => x.code.toUpperCase()));
      for (let n = 1; ; n++) { const c = `${prefix}-${String(n).padStart(3, "0")}`; if (!used.has(c)) return c; }
    })();
    const input = { name, code: finalCode, category, description, minQuantity: Number(min), costCents, priceCents, photo };
    const r = part
      ? act((c) => c.updatePart(part.id, input), "Peça atualizada.")
      : act((c) => c.createPart({ ...input, initialQuantity: Number(initial) }), "Peça cadastrada.");
    if (r.ok) onClose();
  };

  return (
    <Dialog
      title={part ? `Editar ${part.name}` : "Nova peça"}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancelar</Button>
          <Button variant="primary" disabled={!online} onClick={save}>{part ? "Salvar alterações" : "Cadastrar peça"}</Button>
        </>
      }
    >
      <div className="grid gap-4">
        <PartPhotoField value={photo} onChange={setPhoto} category={category} />
        <Field label="Nome da peça">{(p) => <Input {...p} value={name} onChange={(e) => setName(e.target.value)} autoFocus />}</Field>
        <ChoiceGroup label="Que tipo de peça?" value={category} onChange={setCategory} options={categories.map((c) => ({ value: c, label: c }))} />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Quanto você paga por uma? (R$)">{(p) => <Input {...p} inputMode="decimal" value={cost} onChange={(e) => setCost(maskMoney(e.target.value))} />}</Field>
          <Field label="Quanto cobra do cliente? (R$)">{(p) => <Input {...p} inputMode="decimal" value={price} onChange={(e) => setPrice(maskMoney(e.target.value))} />}</Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {part ? (
            <Field label="Quantas tem agora" hint="Para mudar, use Entrada / Saída (fica no histórico).">{(p) => <Input {...p} value={part.quantity} disabled />}</Field>
          ) : (
            <Field label="Quantas tem agora?">{(p) => <Input {...p} type="number" min={0} value={initial} onChange={(e) => setInitial(e.target.value)} />}</Field>
          )}
          <Field label="Me avise quando chegar a" hint="unidades ou menos">{(p) => <Input {...p} type="number" min={0} value={min} onChange={(e) => setMin(e.target.value)} />}</Field>
        </div>
        <MoreDetails summary="Mais detalhes (opcional): código e descrição">
          <Field label="Código" hint={part ? undefined : "Em branco, o sistema cria um (ex.: FIL-004)."}>{(p) => <Input {...p} value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} />}</Field>
          <Field label="Descrição">{(p) => <Textarea {...p} rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />}</Field>
        </MoreDetails>
      </div>
    </Dialog>
  );
}

type MoveType = "in" | "out" | "adjust";

function MoveDialog({ part, initial = "in", onClose }: { part: Part; initial?: MoveType; onClose: () => void }) {
  const { act, online } = useApp();
  const [type, setType] = useState<MoveType>(initial);
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("");
  const qty = Number(quantity);
  const validQty = quantity !== "" && Number.isInteger(qty) && qty >= 0;
  const after = !validQty ? null : type === "in" ? part.quantity + qty : type === "out" ? part.quantity - qty : qty;

  return (
    <Dialog
      title={part.name}
      subtitle={`Tem agora: ${part.quantity} ${part.quantity === 1 ? "unidade" : "unidades"}`}
      size="sm"
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancelar</Button>
          <Button
            variant="primary"
            disabled={!online || !validQty || (after !== null && after < 0)}
            onClick={() => {
              const r = act((c) => c.moveStock({ partId: part.id, type, quantity: qty, reason: reason.trim() || { in: "Peça chegou", out: "Peça saiu", adjust: "Contagem do estoque" }[type] }), "Pronto. Estoque atualizado.");
              if (r.ok) onClose();
            }}
          >
            Salvar
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <ChoiceGroup
          label="O que aconteceu?"
          value={type}
          onChange={setType}
          columns={3}
          options={[
            { value: "in", label: "Chegou mais", hint: "Comprei / repus", icon: <PackagePlus /> },
            { value: "out", label: "Saiu", hint: "Quebrou / perdeu", icon: <PackageMinus /> },
            { value: "adjust", label: "Contei", hint: "Acertar o número", icon: <ClipboardCheck /> },
          ]}
        />
        <Field
          label={type === "adjust" ? "Quantas você contou?" : type === "in" ? "Quantas chegaram?" : "Quantas saíram?"}
          error={after !== null && after < 0 ? `Não dá: só tem ${part.quantity} em estoque.` : undefined}
          hint={after !== null ? `Vai ficar com: ${after}` : undefined}
        >
          {(p) => <Input {...p} type="number" min={0} step={1} value={quantity} onChange={(e) => setQuantity(e.target.value)} autoFocus />}
        </Field>
        <Field label="Por quê? (opcional)">
          {(p) => <Input {...p} value={reason} onChange={(e) => setReason(e.target.value)} placeholder={type === "in" ? "Ex.: Compra de reposição" : type === "out" ? "Ex.: Peça danificada" : "Ex.: Contagem de inventário"} />}
        </Field>
      </div>
    </Dialog>
  );
}

type Sit = "all" | "low" | "out";
const SIT_WORD = { ok: "Tem", low: "Está acabando", out: "Acabou" } as const;
const DEFAULT_REASONS = new Set(["Peça chegou", "Peça saiu", "Contagem do estoque"]);

/**
 * Estoque (decisão 88, auditoria leiga G2–G4): três abas grandes como no Caixa,
 * uma busca, tipos em botões e peças em cartões ("Filtro de óleo · 21 unidades ·
 * Tem"). Tocar na peça abre a ficha com "Chegou mais / Saiu / Contei".
 * O histórico vira "O que aconteceu", em lista.
 */
export function StockPage() {
  const { view, can, online, userOf, partOf, openOrder } = useApp();
  const [area, setArea] = useState<"parts" | "moves">("parts");
  const [sit, setSit] = useState<Sit>("all");
  const [search, setSearch] = useState(initialQuery);
  const [category, setCategory] = useState("");
  const [movePart, setMovePart] = useState("");
  const [editing, setEditing] = useState<Part | null | "new">(null);
  const [moving, setMoving] = useState<{ part: Part; type: MoveType } | null>(null);
  const [openPart, setOpenPart] = useState<string | null>(null);
  const canMove = can("stock.move");

  const low = view.parts.filter((p) => partSituation(p) === "low").length;
  const out = view.parts.filter((p) => partSituation(p) === "out").length;
  const q = search.trim().toLowerCase();
  const parts = view.parts
    .filter((p) => (!q || p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q)) && (!category || p.category === category) && (sit === "all" || partSituation(p) === sit))
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  const partsPager = usePager(parts, 24, `${sit}|${category}|${q}`);
  const moves = view.stockMovements.filter((m) => !movePart || m.partId === movePart).sort((a, b) => b.at.localeCompare(a.at));
  const movesPager = usePager(moves, 25, movePart);
  const categories = [...new Set(view.parts.map((p) => p.category))].sort();
  const sheet = openPart ? view.parts.find((p) => p.id === openPart) : undefined;

  return (
    <div className="module-page module-stock">
      <PageHeader
        title="Estoque"
        description="Quanto tem de cada peça e o que entrou e saiu."
        actions={canMove && <Button variant="primary" icon={<Plus className="size-4" aria-hidden />} disabled={!online} onClick={() => setEditing("new")}>Nova peça</Button>}
      />

      <div role="tablist" aria-label="Parte do estoque" className="fin-areas">
        <button type="button" role="tab" aria-selected={area === "parts"} onClick={() => setArea("parts")}>Peças</button>
        <button type="button" role="tab" aria-selected={area === "moves"} onClick={() => setArea("moves")}>O que aconteceu</button>
      </div>

      {area === "parts" ? (
        <div className="stk">
          <div role="tablist" aria-label="Situação das peças" className="cash-tabs">
            <SitTab k="all" on={sit === "all"} onSelect={setSit} icon={<Package weight="bold" />} label="Todas" count={view.parts.length} />
            <SitTab k="low" on={sit === "low"} onSelect={setSit} icon={<Warning weight="bold" />} label="Está acabando" count={low} />
            <SitTab k="out" on={sit === "out"} onSelect={setSit} icon={<Prohibit weight="bold" />} label="Acabou" count={out} />
          </div>

          <div className="stk-tools">
            <label className="svc-search stk-search">
              <MagnifyingGlass size={20} aria-hidden />
              <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Nome ou código da peça" aria-label="Procurar peça" />
            </label>
            <div className="stk-cats" role="group" aria-label="Tipo de peça">
              <button type="button" aria-pressed={!category} onClick={() => setCategory("")}>Todos os tipos</button>
              {categories.map((c) => <button key={c} type="button" aria-pressed={category === c} onClick={() => setCategory(category === c ? "" : c)}>{c}</button>)}
            </div>
          </div>

          {view.parts.length === 0 ? (
            <EmptyState icon={<Boxes className="size-8" aria-hidden />} title="Nenhuma peça cadastrada" description="Cadastre as peças que a oficina usa para saber quanto tem e lançar nos serviços." action={canMove ? <Button variant="primary" disabled={!online} onClick={() => setEditing("new")}>Nova peça</Button> : undefined} />
          ) : parts.length === 0 ? (
            <EmptyState icon={<SearchX className="size-8" aria-hidden />} title={sit === "out" ? "Nenhuma peça acabou" : sit === "low" ? "Nenhuma peça acabando" : "Nenhuma peça encontrada"} description={q || category ? "Confira o nome ou troque o tipo de peça." : "Ótimo sinal."} />
          ) : (
            <>
              <ul className="stk-grid">
                {partsPager.items.map((p, i) => {
                  const s = partSituation(p);
                  return (
                    <li key={p.id} style={{ "--i": i } as React.CSSProperties}>
                      <button type="button" className="stk-card" data-sit={s} onClick={() => setOpenPart(p.id)}>
                        <span className="stk-pic"><PartPic part={p} /></span>
                        <span className="stk-cat">{p.category}</span>
                        <span className="stk-name">{p.name}</span>
                        <span className="stk-qty"><strong>{p.quantity}</strong> {p.quantity === 1 ? "unidade" : "unidades"}</span>
                        <span className="stk-level" aria-hidden><span style={{ "--w": Math.min(1, p.quantity / Math.max(1, p.minQuantity * 3)) } as React.CSSProperties} /></span>
                        <span className="stk-sit">{SIT_WORD[s]}{s !== "ok" && <small> · avisa com {p.minQuantity}</small>}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
              <Pager pager={partsPager} label="peças" noun="peças" />
            </>
          )}
        </div>
      ) : (
        <div className="stk">
          <div className="stk-tools">
            <Select className="w-80" value={movePart} onChange={(e) => setMovePart(e.target.value)} aria-label="Ver só uma peça">
              <option value="">Todas as peças</option>
              {[...view.parts].sort((a, b) => a.name.localeCompare(b.name)).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </Select>
          </div>
          {moves.length === 0 ? (
            <EmptyState icon={<ArrowLeftRight className="size-8" aria-hidden />} title="Nada aconteceu ainda" description="Quando chegar ou sair peça, aparece aqui. Peças usadas nos serviços também." />
          ) : (
            <section className="cash-card">
              <ul className="cash-list">
                {movesPager.items.map((m, i) => {
                  const order = m.orderId ? view.orders.find((o) => o.id === m.orderId) : null;
                  return (
                    <li key={m.id} className="cash-row" style={{ "--i": i } as React.CSSProperties}>
                      <span className="stk-delta" data-up={m.delta > 0 || undefined}>{m.delta > 0 ? `+${m.delta}` : m.delta}</span>
                      <span className="cash-row-main">
                        <b>{partOf(m.partId)?.name}</b>
                        <small>
                          {MOVEMENT_TYPE_LABELS[m.type]}
                          {/* Motivo só quando acrescenta algo (não repete "Peça chegou" nem o nº do serviço). */}
                          {m.reason && !order && !DEFAULT_REASONS.has(m.reason) ? ` · ${m.reason}` : ""}
                          {order && can("os.view") && <> · <button type="button" className="cash-link" onClick={() => openOrder(order.id)}>{formatOrderNumber(order.number)}</button></>}
                          {` · ficou com ${m.balanceAfter} · ${formatDateTime(m.at)} · ${userOf(m.userId)?.name.split(" ")[0] ?? ""}`}
                        </small>
                      </span>
                    </li>
                  );
                })}
              </ul>
              <Pager pager={movesPager} label="o que aconteceu" noun="registros" />
            </section>
          )}
        </div>
      )}

      {sheet && (
        <Dialog title={sheet.name} subtitle={`${sheet.category} · código ${sheet.code}`} size="md" onClose={() => setOpenPart(null)}
          footer={<>
            {canMove && <Button className="mr-auto" icon={<Pencil className="size-4" aria-hidden />} disabled={!online} onClick={() => { setOpenPart(null); setEditing(sheet); }}>Editar peça</Button>}
            <Button onClick={() => setOpenPart(null)}>Fechar</Button>
          </>}
        >
          <div className="stk-sheet">
            <div className="stk-sheet-pic">
              <PartPic part={sheet} />
              {canMove && <SheetPhotoButton partId={sheet.id} has={!!sheet.photo} />}
            </div>
            <div className="stk-sheet-qty" data-sit={partSituation(sheet)}>
              <strong>{sheet.quantity}</strong><span>{sheet.quantity === 1 ? "unidade" : "unidades"} · {SIT_WORD[partSituation(sheet)]}</span>
            </div>
            {canMove && (
              <div className="stk-moves">
                <button type="button" disabled={!online} onClick={() => setMoving({ part: sheet, type: "in" })}><PackagePlus aria-hidden /> Chegou mais</button>
                <button type="button" disabled={!online || sheet.quantity === 0} onClick={() => setMoving({ part: sheet, type: "out" })}><PackageMinus aria-hidden /> Saiu</button>
                <button type="button" disabled={!online} onClick={() => setMoving({ part: sheet, type: "adjust" })}><ClipboardCheck aria-hidden /> Contei</button>
              </div>
            )}
            <dl className="stk-facts">
              <div><dt>Quanto paguei</dt><dd>{formatBRL(sheet.costCents)}</dd></div>
              <div><dt>Quanto cobro</dt><dd>{formatBRL(sheet.priceCents)}</dd></div>
              <div><dt>Me avise quando tiver</dt><dd>{sheet.minQuantity} ou menos</dd></div>
            </dl>
            <div>
              <h3 className="stk-h">O que aconteceu</h3>
              <ul className="stk-mini">
                {view.stockMovements.filter((m) => m.partId === sheet.id).sort((a, b) => b.at.localeCompare(a.at)).slice(0, 5).map((m) => (
                  <li key={m.id}><span className="stk-delta" data-up={m.delta > 0 || undefined}>{m.delta > 0 ? `+${m.delta}` : m.delta}</span><span>{MOVEMENT_TYPE_LABELS[m.type]} · {formatDateTime(m.at)}</span><span>ficou com {m.balanceAfter}</span></li>
                ))}
              </ul>
              <button type="button" className="cash-link" onClick={() => { setMovePart(sheet.id); setArea("moves"); setOpenPart(null); }}>Ver tudo desta peça</button>
            </div>
          </div>
        </Dialog>
      )}
      {editing && <PartDialog part={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
      {moving && <MoveDialog part={view.parts.find((p) => p.id === moving.part.id) ?? moving.part} initial={moving.type} onClose={() => setMoving(null)} />}
    </div>
  );
}

function SitTab({ k, on, onSelect, icon, label, count }: { k: Sit; on: boolean; onSelect: (k: Sit) => void; icon: React.ReactNode; label: string; count: number }) {
  return (
    <button type="button" role="tab" aria-selected={on} className="cash-tab" data-kind={k === "all" ? "stock" : k === "low" ? "receivable" : "out"} onClick={() => onSelect(k)}>
      <span className="cash-tab-icon" aria-hidden>{icon}</span>
      <span className="cash-tab-text"><small>{label}</small><span className="cash-tab-value">{count} {count === 1 ? "peça" : "peças"}</span></span>
    </button>
  );
}

/** Ícone do tipo quando a peça ainda não tem foto. */
const CATEGORY_ICON: Record<string, React.ReactNode> = {
  Elétrica: <Lightning weight="duotone" />, Filtros: <Funnel weight="duotone" />, Freios: <Disc weight="duotone" />,
  Lubrificantes: <Drop weight="duotone" />, Motor: <Engine weight="duotone" />, Suspensão: <Car weight="duotone" />,
};

/** Foto da peça (decisão 89) ou, sem foto, o ícone do tipo dela. */
function PartPic({ part }: { part: Part }) {
  // eslint-disable-next-line @next/next/no-img-element
  return part.photo ? <img src={part.photo} alt="" className="stk-img" loading="lazy" /> : <span className="stk-noimg" aria-hidden>{CATEGORY_ICON[part.category] ?? <Package weight="duotone" />}</span>;
}

async function readPhoto(file?: File | null): Promise<string | null> {
  if (!file || !file.type.startsWith("image/")) return null;
  try { return await shrinkPhoto(file, 720); } catch { toast("error", "Não deu para ler essa foto. Tente outra."); return null; }
}

/** Na ficha: tirar ou trocar a foto direto, sem abrir o cadastro. */
function SheetPhotoButton({ partId, has }: { partId: string; has: boolean }) {
  const { act, online } = useApp();
  return (
    <label className="stk-photo-btn" data-off={!online || undefined}>
      <Camera size={18} weight="bold" aria-hidden /> {has ? "Trocar foto" : "Tirar foto"}
      <input type="file" accept="image/*" capture="environment" className="sr-only" disabled={!online} onChange={async (e) => { const d = await readPhoto(e.target.files?.[0]); if (d) act((c) => c.setPartPhoto(partId, d), "Foto da peça salva."); e.target.value = ""; }} />
    </label>
  );
}

/** No cadastro: foto opcional (no celular abre a câmera). */
function PartPhotoField({ value, onChange, category }: { value: string | null; onChange: (v: string | null) => void; category: string }) {
  return (
    <div className="stk-field-photo">
      <span className="stk-field-pic">
        {value
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={value} alt="Foto da peça" className="stk-img" />
          : <span className="stk-noimg" aria-hidden>{CATEGORY_ICON[category] ?? <Package weight="duotone" />}</span>}
      </span>
      <span className="grid gap-1">
        <span className="text-sm font-semibold">Foto da peça <span className="font-normal text-muted">(opcional)</span></span>
        <span className="flex flex-wrap gap-2">
          <label className="stk-photo-btn">
            <Camera size={18} weight="bold" aria-hidden /> {value ? "Trocar foto" : "Tirar ou escolher foto"}
            <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={async (e) => { const d = await readPhoto(e.target.files?.[0]); if (d) onChange(d); e.target.value = ""; }} />
          </label>
          {value && <button type="button" className="cash-link" onClick={() => onChange(null)}>Tirar a foto</button>}
        </span>
      </span>
    </div>
  );
}

