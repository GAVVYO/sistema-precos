"use client";

import { ChoiceGroup, MoreDetails } from "@/components/ui/choice";
import { ArrowLeftRight, Boxes, ClipboardCheck, History, Inbox, PackageMinus, PackagePlus, Pencil, Plus, Search, SearchX } from "lucide-react";
import { useState } from "react";
import { initialQuery } from "@/lib/query";
import { useApp } from "@/app-state/app-context";
import { Dialog } from "@/components/ui/dialog";
import { MoreMenu } from "@/components/ui/more-menu";
import { useTray } from "@/components/layout/tray";
import { Badge, Button, Card, EmptyState, Field, Input, PageHeader, Select, Stat, Tabs, Textarea } from "@/components/ui/primitives";
import { toast } from "@/components/ui/toast";
import { SortHeader, TableSort } from "@/components/ui/sort-header";
import { MOVEMENT_TYPE_LABELS, PART_CATEGORIES } from "@/domain/labels";
import type { Part } from "@/domain/types";
import { centsToInput, formatBRL, formatDateTime, formatOrderNumber, parseBRL } from "@/lib/format";
import { createPart, moveStock, partSituation, updatePart } from "@/services/stock";

function SituationBadge({ part }: { part: Part }) {
  const s = partSituation(part);
  if (s === "out") return <Badge tone="danger">Sem estoque</Badge>;
  if (s === "low") return <Badge tone="warning">Estoque baixo</Badge>;
  return <Badge tone="success">Normal</Badge>;
}

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
    const input = { name, code: finalCode, category, description, minQuantity: Number(min), costCents, priceCents };
    const r = part
      ? act((db, ctx) => updatePart(db, ctx, part.id, input), "Peça atualizada.")
      : act((db, ctx) => createPart(db, ctx, { ...input, initialQuantity: Number(initial) }), "Peça cadastrada.");
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
        <Field label="Nome da peça">{(p) => <Input {...p} value={name} onChange={(e) => setName(e.target.value)} autoFocus />}</Field>
        <ChoiceGroup label="Que tipo de peça?" value={category} onChange={setCategory} options={categories.map((c) => ({ value: c, label: c }))} />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Quanto você paga por uma? (R$)">{(p) => <Input {...p} inputMode="decimal" value={cost} onChange={(e) => setCost(e.target.value)} />}</Field>
          <Field label="Quanto cobra do cliente? (R$)">{(p) => <Input {...p} inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} />}</Field>
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

function MoveDialog({ part, onClose }: { part: Part; onClose: () => void }) {
  const { act, online } = useApp();
  const [type, setType] = useState<MoveType>("in");
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("");
  const qty = Number(quantity);
  const validQty = quantity !== "" && Number.isInteger(qty) && qty >= 0;
  const after = !validQty ? null : type === "in" ? part.quantity + qty : type === "out" ? part.quantity - qty : qty;

  return (
    <Dialog
      title={`Entrada / Saída: ${part.name}`}
      subtitle={`${part.code} · tem agora: ${part.quantity}`}
      size="sm"
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancelar</Button>
          <Button
            variant="primary"
            disabled={!online || !validQty || (after !== null && after < 0)}
            onClick={() => {
              const r = act((db, ctx) => moveStock(db, ctx, { partId: part.id, type, quantity: qty, reason: reason.trim() || { in: "Peça chegou", out: "Peça saiu", adjust: "Contagem do estoque" }[type] }), "Pronto. Estoque atualizado.");
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
            { value: "in", label: "Chegou peça", hint: "Comprei / repus", icon: <PackagePlus /> },
            { value: "out", label: "Saiu peça", hint: "Quebrou / perdeu", icon: <PackageMinus /> },
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

export function StockPage() {
  const { view, can, online, userOf, partOf, openOrder } = useApp();
  const [tab, setTab] = useState<"parts" | "moves">("parts");
  const [search, setSearch] = useState(initialQuery);
  const [category, setCategory] = useState("");
  const [situation, setSituation] = useState("");
  const [sort, setSort] = useState<TableSort<"name" | "quantity" | "priceCents">>({ key: "name", desc: false });
  const [movePart, setMovePart] = useState("");
  const [editing, setEditing] = useState<Part | null | "new">(null);
  const [moving, setMoving] = useState<Part | null>(null);
  const canMove = can("stock.move");
  const tray = useTray();

  const low = view.parts.filter((p) => partSituation(p) === "low").length;
  const out = view.parts.filter((p) => partSituation(p) === "out").length;
  const q = search.trim().toLowerCase();
  const parts = view.parts
    .filter((p) => (!q || p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q)) && (!category || p.category === category) && (!situation || partSituation(p) === situation))
    .sort((a, b) => (sort.desc ? -1 : 1) * (sort.key === "name" ? a.name.localeCompare(b.name, "pt-BR") : a[sort.key] - b[sort.key]));
  const moves = view.stockMovements.filter((m) => !movePart || m.partId === movePart).sort((a, b) => b.at.localeCompare(a.at));
  const categories = [...new Set(view.parts.map((p) => p.category))].sort();
  const filtered = !!q || !!category || !!situation;

  return (
    <div className="module-page module-stock">
      <PageHeader
        title="Estoque"
        description="Peças da oficina, quanto tem de cada uma e o que entrou e saiu."
        actions={canMove && <Button variant="primary" icon={<Plus className="size-4" aria-hidden />} disabled={!online} onClick={() => setEditing("new")}>Nova peça</Button>}
      />
      <div className="mb-4 grid grid-cols-3 gap-3">
        <Stat label="Peças cadastradas" value={view.parts.length} />
        <Stat label="Estoque baixo" value={low} tone={low ? "warning" : "neutral"} hint="Na quantidade mínima ou abaixo" />
        <Stat label="Sem estoque" value={out} tone={out ? "danger" : "neutral"} />
      </div>

      <Card>
        <div className="px-3 pt-1">
          <Tabs label="Visões do estoque" value={tab} onChange={setTab} tabs={[{ value: "parts", label: "Peças", count: view.parts.length }, { value: "moves", label: "Histórico de peças", count: view.stockMovements.length }]} />
        </div>

        {tab === "parts" ? (
          <>
            <div className="flex flex-wrap items-center gap-2 border-b border-line p-3">
              <div className="relative w-72">
                <Search className="pointer-events-none absolute top-2.5 left-2.5 size-4 text-slate-400" aria-hidden />
                <Input className="pl-8" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nome ou código" aria-label="Buscar peças" />
              </div>
              <Select className="w-48" value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Categoria">
                <option value="">Todas as categorias</option>
                {categories.map((c) => <option key={c}>{c}</option>)}
              </Select>
              <Select className="w-48" value={situation} onChange={(e) => setSituation(e.target.value)} aria-label="Situação">
                <option value="">Todas as situações</option>
                <option value="ok">Normal</option>
                <option value="low">Estoque baixo</option>
                <option value="out">Sem estoque</option>
              </Select>
            </div>
            {view.parts.length === 0 ? (
              <EmptyState icon={<Boxes className="size-8" aria-hidden />} title="Nenhuma peça cadastrada" description="Cadastre as peças que a oficina usa para controlar o estoque e lançá-las nos serviços." action={canMove ? <Button variant="primary" disabled={!online} onClick={() => setEditing("new")}>Nova peça</Button> : undefined} />
            ) : parts.length === 0 ? (
              <EmptyState icon={<SearchX className="size-8" aria-hidden />} title="Nenhuma peça encontrada" description={filtered ? "Confira o nome ou o código da peça, ou mude os filtros." : undefined} />
            ) : (
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr><SortHeader field="name" sort={sort} onSort={setSort}>Peça / código</SortHeader><th>Categoria</th><SortHeader field="quantity" sort={sort} onSort={setSort} numeric>Disponível</SortHeader><th className="num">Custo unit.</th><SortHeader field="priceCents" sort={sort} onSort={setSort} numeric>Venda</SortHeader><th>Situação</th><th className="text-right"><span className="sr-only">Ações</span></th></tr>
                  </thead>
                  <tbody>
                    {parts.map((p) => (
                      <tr key={p.id}>
                        <td><span className="block font-semibold">{p.name}</span><span className="text-xs text-muted">{p.code}</span></td>
                        <td>{p.category}</td>
                        <td className="num"><strong className="block">{p.quantity}</strong><span className="text-xs text-muted">mín. {p.minQuantity}</span></td>
                        <td className="num">{formatBRL(p.costCents)}</td>
                        <td className="num">{formatBRL(p.priceCents)}</td>
                        <td><SituationBadge part={p} /></td>
                        <td>
                          {/* Uma ação principal visível; as demais no "⋯" (referência: Stripe e Shopify Admin). */}
                          <div className="flex items-center justify-end gap-1">
                            {canMove ? (
                              <>
                                <MoreMenu
                                  label={`Mais ações de ${p.name}`}
                                  items={[
                                    { label: "Ver histórico da peça", icon: <History className="size-4" />, onSelect: () => { setMovePart(p.id); setTab("moves"); } },
                                    { label: "Editar peça", icon: <Pencil className="size-4" />, disabled: !online, onSelect: () => setEditing(p) },
                                    { label: "Guardar na bandeja", icon: <Inbox className="size-4" />, onSelect: () => tray.add([{ type: "part", id: p.id }]) },
                                  ]}
                                />
                                <Button size="sm" icon={<ArrowLeftRight className="size-3.5" aria-hidden />} disabled={!online} onClick={() => setMoving(p)} aria-label={`Entrada ou saída de ${p.name}`}>Entrada / Saída</Button>
                              </>
                            ) : (
                              <Button size="sm" icon={<History className="size-3.5" aria-hidden />} onClick={() => { setMovePart(p.id); setTab("moves"); }}>Histórico</Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        ) : (
          <>
            <div className="flex items-center gap-2 border-b border-line p-3">
              <Select className="w-80" value={movePart} onChange={(e) => setMovePart(e.target.value)} aria-label="Filtrar por peça">
                <option value="">Todas as peças</option>
                {[...view.parts].sort((a, b) => a.name.localeCompare(b.name)).map((p) => <option key={p.id} value={p.id}>{p.name} ({p.code})</option>)}
              </Select>
              <span className="text-xs text-muted">{moves.length} {moves.length === 1 ? "registro" : "registros"}</span>
            </div>
            {moves.length === 0 ? (
              <EmptyState icon={<ArrowLeftRight className="size-8" aria-hidden />} title="Nada registrado ainda" description="Quando chegar ou sair peça, clique em Entrada / Saída na lista de peças. Peças lançadas nos serviços também aparecem aqui." />
            ) : (
              <div className="max-h-[calc(100vh-330px)] overflow-auto">
                <table className="data-table">
                  <thead className="sticky top-0">
                    <tr><th>Data</th><th>Peça</th><th>Tipo</th><th className="num">Quantidade</th><th className="num">Ficou com</th><th>Motivo</th><th>Responsável</th></tr>
                  </thead>
                  <tbody>
                    {moves.map((m) => {
                      const order = m.orderId ? view.orders.find((o) => o.id === m.orderId) : null;
                      return (
                        <tr key={m.id}>
                          <td className="whitespace-nowrap">{formatDateTime(m.at)}</td>
                          <td>{partOf(m.partId)?.name}</td>
                          <td><Badge tone={m.type === "order_out" ? "info" : m.type === "return" ? "success" : "neutral"}>{MOVEMENT_TYPE_LABELS[m.type]}</Badge></td>
                          <td className={`num font-semibold ${m.delta > 0 ? "text-success" : "text-danger"}`}>{m.delta > 0 ? `+${m.delta}` : m.delta}</td>
                          <td className="num">{m.balanceAfter}</td>
                          <td>
                            {m.reason}
                            {order && can("os.view") && (
                              <button type="button" className="ml-1.5 text-xs font-semibold text-primary hover:underline" onClick={() => openOrder(order.id)}>
                                ver {formatOrderNumber(order.number)}
                              </button>
                            )}
                          </td>
                          <td>{userOf(m.userId)?.name.split(" ").slice(0, 2).join(" ")}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </Card>

      {editing && <PartDialog part={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
      {moving && <MoveDialog part={view.parts.find((p) => p.id === moving.id) ?? moving} onClose={() => setMoving(null)} />}
    </div>
  );
}
