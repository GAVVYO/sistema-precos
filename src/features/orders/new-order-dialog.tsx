"use client";

import { UserCheck } from "lucide-react";
import { useMemo, useState } from "react";
import { NewOrderPrefill, useApp } from "@/app-state/app-context";
import { Dialog } from "@/components/ui/dialog";
import { Button, Field, Input, Select, Textarea } from "@/components/ui/primitives";
import { toast } from "@/components/ui/toast";
import { formatBRL, formatOrderNumber, formatPhone, formatPlate, normalizePhone, normalizePlate, parseBRL } from "@/lib/format";
import { createOrder } from "@/services/orders";
import { DraftItem, draftsToItems, draftsTotal, PartsEditor, vehicleLabel } from "./shared";

const SERVICE_SUGGESTIONS = [
  "Troca de óleo e filtro",
  "Revisão completa",
  "Troca de pastilhas de freio",
  "Diagnóstico elétrico",
  "Troca de bateria",
  "Alinhamento e balanceamento",
];

const NEW_VEHICLE = "__new__";

function SectionTitle({ children }: { children: string }) {
  return <h3 className="mb-2 text-xs font-semibold tracking-wide text-muted uppercase">{children}</h3>;
}

export function NewOrderDialog({ prefill, onClose }: { prefill: NewOrderPrefill; onClose: () => void }) {
  const { view, act, mechanics, openOrder, online } = useApp();

  // Agendamentos trazem nome/telefone: reaproveita o cadastro quando já existe.
  const initialCustomerId = useMemo(() => {
    if (prefill.customerId) return prefill.customerId;
    const phone = prefill.phone ? normalizePhone(prefill.phone) : null;
    const plate = prefill.plate ? normalizePlate(prefill.plate) : null;
    const byPlate = plate ? view.vehicles.find((v) => v.plate === plate) : undefined;
    if (byPlate) return byPlate.customerId;
    return phone ? (view.customers.find((c) => c.phone === phone)?.id ?? null) : null;
  }, [prefill, view]);

  const [customerId, setCustomerId] = useState<string | null>(initialCustomerId);
  const [name, setName] = useState(prefill.customerName ?? "");
  const [phone, setPhone] = useState(prefill.phone ? formatPhone(prefill.phone) : "");
  const customer = view.customers.find((c) => c.id === customerId);
  const customerVehicles = view.vehicles.filter((v) => v.customerId === customerId);

  const [vehicleChoice, setVehicleChoice] = useState<string>(() => {
    if (prefill.vehicleId) return prefill.vehicleId;
    const plate = prefill.plate ? normalizePlate(prefill.plate) : null;
    const match = view.vehicles.find((v) => v.customerId === initialCustomerId && (plate ? v.plate === plate : true));
    return match && (plate || !prefill.model) ? match.id : NEW_VEHICLE;
  });
  const [plate, setPlate] = useState(prefill.plate ? formatPlate(prefill.plate) : "");
  const [brand, setBrand] = useState(prefill.brand ?? "");
  const [model, setModel] = useState(prefill.model ?? "");
  const [year, setYear] = useState("");
  const [mileage, setMileage] = useState("");

  const [description, setDescription] = useState(prefill.description ?? "");
  const [mechanicId, setMechanicId] = useState(prefill.mechanicId ?? "");
  const [labor, setLabor] = useState("");
  const [notes, setNotes] = useState("");
  const [drafts, setDrafts] = useState<DraftItem[]>([]);
  const [busy, setBusy] = useState(false);

  const usingExistingVehicle = !!customer && vehicleChoice !== NEW_VEHICLE;
  const query = name.trim().toLowerCase();
  const suggestions =
    !customer && query.length >= 2
      ? view.customers
          .filter((c) => {
            const digits = query.replace(/\D/g, "");
            return (
              c.name.toLowerCase().includes(query) ||
              (digits.length >= 4 && c.phone.includes(digits)) ||
              view.vehicles.some((v) => v.customerId === c.id && v.plate.toLowerCase().includes(query.replace(/[^a-z0-9]/g, "")))
            );
          })
          .slice(0, 5)
      : [];

  const laborCents = labor.trim() === "" ? null : parseBRL(labor);
  const laborInvalid = labor.trim() !== "" && laborCents === null;
  const partsTotal = draftsTotal(drafts);

  const selectCustomer = (id: string) => {
    setCustomerId(id);
    const first = view.vehicles.find((v) => v.customerId === id);
    setVehicleChoice(first ? first.id : NEW_VEHICLE);
  };

  const submit = () => {
    if (busy) return;
    if (laborInvalid) return toast("error", "Valor de mão de obra inválido. Use o formato 150,00.");
    const items = draftsToItems(drafts);
    if (typeof items === "string") return toast("error", items);
    const km = mileage.trim() === "" ? null : Number(mileage);
    const yr = year.trim() === "" ? null : Number(year);
    if ((km !== null && !Number.isInteger(km)) || (yr !== null && !Number.isInteger(yr))) {
      return toast("error", "Ano e quilometragem devem ser números inteiros.");
    }
    setBusy(true);
    const result = act((db, ctx) =>
      createOrder(db, ctx, {
        customer: customer ? { id: customer.id } : { name, phone },
        vehicle: usingExistingVehicle ? { id: vehicleChoice } : { plate, brand, model, year: yr, mileage: km },
        description,
        notes,
        mechanicId: mechanicId || null,
        laborCents,
        mileage: km,
        items,
        appointmentId: prefill.appointmentId ?? null,
      }),
    );
    setBusy(false);
    if (result.ok) {
      toast("success", `${formatOrderNumber(result.value.number)} aberto com sucesso.`);
      onClose();
      openOrder(result.value.id);
    }
  };

  return (
    <Dialog
      title="Novo serviço"
      subtitle={prefill.appointmentId ? "Criada a partir de um agendamento — confira os dados antes de salvar." : "Preencha o essencial; valores e peças podem ser completados depois."}
      size="lg"
      onClose={onClose}
      footer={
        <>
          <div className="mr-auto text-sm">
            <span className="text-muted">Mão de obra </span>
            <strong>{laborCents === null ? "a definir" : formatBRL(laborCents)}</strong>
            <span className="mx-2 text-slate-300">|</span>
            <span className="text-muted">Peças </span>
            <strong>{formatBRL(partsTotal)}</strong>
            <span className="mx-2 text-slate-300">|</span>
            <span className="text-muted">Total </span>
            <strong className="text-base">
              {laborCents === null && partsTotal === 0 ? "A definir" : formatBRL((laborCents ?? 0) + partsTotal)}
              {laborCents === null && partsTotal > 0 && <span className="text-xs font-normal text-muted"> + mão de obra</span>}
            </strong>
          </div>
          <Button onClick={onClose}>Cancelar</Button>
          <Button variant="primary" loading={busy} disabled={!online} onClick={submit}>
            Abrir serviço
          </Button>
        </>
      }
    >
      <form
        className="grid gap-x-6 gap-y-5 lg:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <div>
          <SectionTitle>Cliente</SectionTitle>
          {customer ? (
            <div className="flex items-center justify-between gap-3 rounded-md border border-line bg-slate-50 px-3 py-2">
              <div className="flex min-w-0 items-center gap-2">
                <UserCheck className="size-4 shrink-0 text-success" aria-hidden />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{customer.name}</p>
                  <p className="text-xs text-muted">{formatPhone(customer.phone)} · cliente cadastrado</p>
                </div>
              </div>
              <Button size="sm" onClick={() => { setCustomerId(null); setVehicleChoice(NEW_VEHICLE); }}>
                Trocar cliente
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-5 gap-3">
              <div className="relative col-span-3">
                <Field label="Nome" hint="Digite para buscar um cadastro ou criar um novo.">
                  {(p) => <Input {...p} value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" autoFocus placeholder="Nome, telefone ou placa" />}
                </Field>
                {suggestions.length > 0 && (
                  <ul className="absolute top-full mt-1 right-0 left-0 z-10 rounded-md border border-line bg-surface py-1 shadow-lg" aria-label="Clientes cadastrados">
                    {suggestions.map((c) => (
                      <li key={c.id}>
                        <button type="button" className="block w-full px-3 py-1.5 text-left hover:bg-primary-soft" onClick={() => selectCustomer(c.id)}>
                          <span className="block text-sm font-medium">{c.name}</span>
                          <span className="block text-xs text-muted">
                            {formatPhone(c.phone)}
                            {view.vehicles.filter((v) => v.customerId === c.id).map((v) => ` · ${v.model} ${formatPlate(v.plate)}`)}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <Field label="Telefone" className="col-span-2">
                {(p) => <Input {...p} value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" placeholder="(85) 98888-7777" />}
              </Field>
            </div>
          )}

          <div className="mt-5">
            <SectionTitle>Veículo</SectionTitle>
            {customer && customerVehicles.length > 0 && (
              <Field label="Veículo do cliente" className="mb-3">
                {(p) => (
                  <Select {...p} value={vehicleChoice} onChange={(e) => setVehicleChoice(e.target.value)}>
                    {customerVehicles.map((v) => (
                      <option key={v.id} value={v.id}>
                        {vehicleLabel(v)} — {formatPlate(v.plate)}
                      </option>
                    ))}
                    <option value={NEW_VEHICLE}>Cadastrar outro veículo…</option>
                  </Select>
                )}
              </Field>
            )}
            {!usingExistingVehicle && (
              <div className="grid grid-cols-6 gap-3">
                <Field label="Placa" className="col-span-2">
                  {(p) => <Input {...p} value={plate} onChange={(e) => setPlate(e.target.value.toUpperCase())} placeholder="ABC1D23" maxLength={8} />}
                </Field>
                <Field label="Marca" className="col-span-2">
                  {(p) => <Input {...p} value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="Fiat" />}
                </Field>
                <Field label="Modelo" className="col-span-2">
                  {(p) => <Input {...p} value={model} onChange={(e) => setModel(e.target.value)} placeholder="Uno" />}
                </Field>
                <Field label="Ano" optional className="col-span-3">
                  {(p) => <Input {...p} value={year} onChange={(e) => setYear(e.target.value)} inputMode="numeric" maxLength={4} />}
                </Field>
                <Field label="Quilometragem" optional className="col-span-3">
                  {(p) => <Input {...p} value={mileage} onChange={(e) => setMileage(e.target.value)} inputMode="numeric" />}
                </Field>
              </div>
            )}
            {usingExistingVehicle && (
              <Field label="Quilometragem atual" optional>
                {(p) => <Input {...p} value={mileage} onChange={(e) => setMileage(e.target.value)} inputMode="numeric" />}
              </Field>
            )}
          </div>
        </div>

        <div>
          <SectionTitle>Serviço</SectionTitle>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Descrição do serviço" className="col-span-2">
              {(p) => (
                <>
                  <Input {...p} value={description} onChange={(e) => setDescription(e.target.value)} list="servicos-sugeridos" placeholder="Ex.: Troca de óleo e filtro" />
                  <datalist id="servicos-sugeridos">
                    {SERVICE_SUGGESTIONS.map((s) => (
                      <option key={s} value={s} />
                    ))}
                  </datalist>
                </>
              )}
            </Field>
            <Field label="Mecânico responsável" optional>
              {(p) => (
                <Select {...p} value={mechanicId} onChange={(e) => setMechanicId(e.target.value)}>
                  <option value="">A definir</option>
                  {mechanics.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field
              label="Mão de obra (R$)"
              optional
              error={laborInvalid ? "Valor inválido. Ex.: 150,00" : undefined}
              hint="Em branco = valor a definir. Informe 0 para serviço gratuito."
            >
              {(p) => <Input {...p} value={labor} onChange={(e) => setLabor(e.target.value)} inputMode="decimal" placeholder="A definir" />}
            </Field>
            <Field label="Observações" optional className="col-span-2">
              {(p) => <Textarea {...p} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />}
            </Field>
          </div>
        </div>

        <div className="lg:col-span-2">
          <SectionTitle>Peças</SectionTitle>
          <p className="mb-2 text-xs text-muted">As peças adicionadas são baixadas do estoque assim que o serviço for salvo.</p>
          <PartsEditor drafts={drafts} onChange={setDrafts} />
        </div>
        <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
      </form>
    </Dialog>
  );
}
