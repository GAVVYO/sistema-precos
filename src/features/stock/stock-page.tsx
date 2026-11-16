"use client";

import { ArrowLeftRight, Boxes, Pencil, Plus, Search, SearchX } from "lucide-react";
import { useMemo, useState } from "react";
import { takeQueryParam } from "@/components/layout/command-palette";
import { useApp } from "@/app-state/app-context";
import { type DataColumn, DataTable } from "@/components/ui/data-table";
import { Dialog } from "@/components/ui/dialog";
import { Badge, Button, Card, EmptyState, Field, Input, PageHeader, Segmented, Select, Stat, Tabs, Textarea } from "@/components/ui/primitives";
import { toast } from "@/components/ui/toast";
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
    if (costCents === null || priceCents === null) return toast("error", "Informe custo e preço de venda válidos. Ex.: 35,00");
    const input = { name, code, category, description, minQuantity: Number(min), costCents, priceCents };
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
      <div className="grid grid-cols-6 gap-3">
        <Field label="Nome" className="col-span-4">{(p) => <Input {...p} value={name} onChange={(e) => setName(e.target.value)} autoFocus />}</Field>
        <Field label="Código interno" className="col-span-2">{(p) => <Input {...p} value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="FIL-001" />}</Field>
        <Field label="Categoria" className="col-span-3">
          {(p) => (
            <Select {...p} value={category} onChange={(e) => setCategory(e.target.value)}>
              {categories.map((c) => <option key={c}>{c}</option>)}
            </Select>
          )}
        </Field>
        {part ? (
          <Field label="Quantidade atual" className="col-span-3" hint="Altere pelo botão Movimentar, para manter o histórico.">
            {(p) => <Input {...p} value={part.quantity} disabled />}
          </Field>
        ) : (
          <Field label="Quantidade inicial" className="col-span-3">{(p) => <Input {...p} type="number" min={0} value={initial} onChange={(e) => setInitial(e.target.value)} />}</Field>
        )}
        <Field label="Quantidade mínima" className="col-span-2" hint="Abaixo ou igual gera alerta.">{(p) => <Input {...p} type="number" min={0} value={min} onChange={(e) => setMin(e.target.value)} />}</Field>
        <Field label="Custo unitário (R$)" className="col-span-2">{(p) => <Input {...p} inputMode="decimal" value={cost} onChange={(e) => setCost(e.target.value)} placeholder="0,00" />}</Field>
        <Field label="Preço de venda (R$)" className="col-span-2">{(p) => <Input {...p} inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0,00" />}</Field>
        <Field label="Descrição" optional className="col-span-6">{(p) => <Textarea {...p} rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />}</Field>
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
      title={`Movimentar ${part.name}`}
      subtitle={`${part.code} · saldo atual: ${part.quantity}`}
      size="sm"
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancelar</Button>
          <Button
            variant="primary"
            disabled={!online || !validQty || (after !== null && after < 0)}
            onClick={() => {
              const r = act((db, ctx) => moveStock(db, ctx, { partId: part.id, type, quantity: qty, reason }), "Movimentação registrada.");
              if (r.ok) onClose();
            }}
          >
            Registrar movimentação
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Segmented
          label="Tipo de movimentação"
          value={type}
          onChange={setType}
          options={[{ value: "in", label: "Entrada" }, { value: "out", label: "Saída manual" }, { value: "adjust", label: "Ajuste de saldo" }]}
        />
        <Field
          label={type === "adjust" ? "Quantidade contada (novo saldo)" : "Quantidade"}
          error={after !== null && after < 0 ? `Saldo insuficiente: há apenas ${part.quantity} em estoque.` : undefined}
          hint={after !== null ? `Saldo após a movimentação: ${after}` : undefined}
        >
          {(p) => <Input {...p} type="number" min={0} step={1} value={quantity} onChange={(e) => setQuantity(e.target.value)} autoFocus />}
        </Field>
        <Field label="Motivo">
          {(p) => <Input {...p} value={reason} onChange={(e) => setReason(e.target.value)} placeholder={type === "in" ? "Ex.: Compra de reposição" : type === "out" ? "Ex.: Peça danificada" : "Ex.: Contagem de inventário"} />}
        </Field>
      </div>
    </Dialog>
  );
}

export function StockPage() {
  const { view, can, online, userOf, partOf, openOrder } = useApp();
  const [tab, setTab] = useState<"parts" | "moves">("parts");
  const [search, setSearch] = useState(takeQueryParam);
  const [category, setCategory] = useState("");
  const [situation, setSituation] = useState("");
  const [movePart, setMovePart] = useState("");
  const [editing, setEditing] = useState<Part | null | "new">(null);
  const [moving, setMoving] = useState<Part | null>(null);
  const canMove = can("stock.move");

  const low = view.parts.filter((p) => partSituation(p) === "low").length;
  const out = view.parts.filter((p) => partSituation(p) === "out").length;
  const q = search.trim().toLowerCase();
  const parts = useMemo(
    () =>
      view.parts.filter(
        (p) => (!q || p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q)) && (!category || p.category === category) && (!situation || partSituation(p) === situation),
      ),
    [view.parts, q, category, situation],
  );
  const moves = view.stockMovements.filter((m) => !movePart || m.partId === movePart).sort((a, b) => b.at.localeCompare(a.at));
  const categories = [...new Set(view.parts.map((p) => p.category))].sort();
  const filtered = !!q || !!category || !!situation;

  const partColumns = useMemo<DataColumn<Part>[]>(
    () => [
      { id: "code", header: "Código", size: 96, sortValue: (p) => p.code, cell: (p) => <span className="font-mono text-xs">{p.code}</span>, hideable: false },
      { id: "name", header: "Nome", size: 240, sortValue: (p) => p.name.toLowerCase(), cell: (p) => <span className="font-medium" title={p.name}>{p.name}</span>, hideable: false },
      { id: "category", header: "Categoria", size: 130, sortValue: (p) => p.category, cell: (p) => p.category },
      { id: "quantity", header: "Disponível", size: 100, align: "right", sortValue: (p) => p.quantity, cell: (p) => <span className="font-semibold">{p.quantity}</span> },
      { id: "min", header: "Mínimo", size: 84, align: "right", sortValue: (p) => p.minQuantity, cell: (p) => p.minQuantity },
      { id: "cost", header: "Custo unit.", size: 110, align: "right", sortValue: (p) => p.costCents, cell: (p) => formatBRL(p.costCents) },
      { id: "price", header: "Preço de venda", size: 124, align: "right", sortValue: (p) => p.priceCents, cell: (p) => formatBRL(p.priceCents) },
      { id: "situation", header: "Situação", size: 120, sortValue: (p) => ({ out: 0, low: 1, ok: 2 })[partSituation(p)], cell: (p) => <SituationBadge part={p} /> },
      {
        id: "actions",
        header: "Ações",
        size: canMove ? 290 : 110,
        align: "right",
        hideable: false,
        cell: (p) => (
          <div className="flex justify-end gap-1.5">
            <Button size="sm" onClick={() => { setMovePart(p.id); setTab("moves"); }}>Histórico</Button>
            {canMove && (
              <>
                <Button size="sm" icon={<ArrowLeftRight className="size-3.5" aria-hidden />} disabled={!online} onClick={() => setMoving(p)}>Movimentar</Button>
                <Button size="sm" icon={<Pencil className="size-3.5" aria-hidden />} disabled={!online} onClick={() => setEditing(p)} aria-label={`Editar ${p.name}`}>Editar</Button>
              </>
            )}
          </div>
        ),
      },
    ],
    [canMove, online],
  );

  return (
    <>
      <PageHeader
        title="Estoque"
        description="Peças cadastradas, quantidades disponíveis e histórico de movimentações."
        actions={canMove && <Button variant="primary" icon={<Plus className="size-4" aria-hidden />} disabled={!online} onClick={() => setEditing("new")}>Nova peça</Button>}
      />
      <div className="mb-4 grid grid-cols-3 gap-3">
        <Stat label="Peças cadastradas" value={view.parts.length} />
        <Stat label="Estoque baixo" value={low} tone={low ? "warning" : "neutral"} hint="Na quantidade mínima ou abaixo" />
        <Stat label="Sem estoque" value={out} tone={out ? "danger" : "neutral"} />
      </div>

      <Card>
        <div className="px-3 pt-1">
          <Tabs label="Visões do estoque" value={tab} onChange={setTab} tabs={[{ value: "parts", label: "Peças", count: view.parts.length }, { value: "moves", label: "Movimentações", count: view.stockMovements.length }]} />
        </div>

        {tab === "parts" ? (
          <>
            <div className="flex flex-wrap items-center gap-2 border-b border-line p-3">
              <div className="relative w-72">
                <Search className="pointer-events-none absolute top-2.5 left-2.5 size-4 text-slate-400" aria-hidden />
                <Input className="pl-8" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nome ou código" aria-label="Buscar peças" />
              </div>
              <Select className="w-52" value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Categoria">
                <option value="">Todas as categorias</option>
                {categories.map((c) => <option key={c}>{c}</option>)}
              </Select>
              <Select className="w-52" value={situation} onChange={(e) => setSituation(e.target.value)} aria-label="Situação">
                <option value="">Todas as situações</option>
                <option value="ok">Normal</option>
                <option value="low">Estoque baixo</option>
                <option value="out">Sem estoque</option>
              </Select>
            </div>
            {view.parts.length === 0 ? (
              <EmptyState icon={<Boxes className="size-8" aria-hidden />} title="Nenhuma peça cadastrada" description="Cadastre as peças que a oficina utiliza para controlar o estoque e usá-las nas OS." action={canMove ? <Button variant="primary" disabled={!online} onClick={() => setEditing("new")}>Nova peça</Button> : undefined} />
            ) : parts.length === 0 ? (
              <EmptyState icon={<SearchX className="size-8" aria-hidden />} title="Nenhuma peça encontrada" description={filtered ? "Revise a busca ou os filtros aplicados." : undefined} />
            ) : (
              <DataTable prefKey="estoque-pecas" label="Peças em estoque" columns={partColumns} data={parts} rowKey={(p) => p.id} defaultSort={{ id: "name" }} />
            )}
          </>
        ) : (
          <>
            <div className="flex items-center gap-2 border-b border-line p-3">
              <Select className="w-80" value={movePart} onChange={(e) => setMovePart(e.target.value)} aria-label="Filtrar por peça">
                <option value="">Todas as peças</option>
                {[...view.parts].sort((a, b) => a.name.localeCompare(b.name)).map((p) => <option key={p.id} value={p.id}>{p.name} ({p.code})</option>)}
              </Select>
              <span className="text-xs text-muted">{moves.length} {moves.length === 1 ? "movimentação" : "movimentações"}</span>
            </div>
            {moves.length === 0 ? (
              <EmptyState icon={<ArrowLeftRight className="size-8" aria-hidden />} title="Nenhuma movimentação registrada" />
            ) : (
              <div className="max-h-[calc(100vh-330px)] overflow-auto">
                <table className="data-table">
                  <thead className="sticky top-0">
                    <tr><th>Data</th><th>Peça</th><th>Tipo</th><th className="num">Quantidade</th><th className="num">Saldo após</th><th>Motivo</th><th>Responsável</th></tr>
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
                                abrir {formatOrderNumber(order.number)}
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
    </>
  );
}
