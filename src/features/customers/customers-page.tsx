"use client";

import { Car, Pencil, Plus, Search, SearchX, UserPlus, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { takeQueryParam } from "@/components/layout/command-palette";
import { useApp } from "@/app-state/app-context";
import { type DataColumn, DataTable } from "@/components/ui/data-table";
import { Dialog } from "@/components/ui/dialog";
import { Button, Card, EmptyState, Field, Input, PageHeader, Select, Tabs } from "@/components/ui/primitives";
import { toast } from "@/components/ui/toast";
import type { Customer, ID, ServiceOrder, Vehicle } from "@/domain/types";
import { orderTotalText, StatusBadge, vehicleLabel } from "@/features/orders/shared";
import { formatDate, formatOrderNumber, formatPhone, formatPlate } from "@/lib/format";
import { createCustomer, saveVehicle, updateCustomer } from "@/services/customers";
import { orderTotals } from "@/services/orders";

/** Histórico derivado das OS existentes — nada é digitado em duplicidade. */
function OrderHistory({ orders, showVehicle, onOpen }: { orders: ServiceOrder[]; showVehicle?: boolean; onOpen: (id: ID) => void }) {
  const { view, vehicleOf, userOf, partOf, can } = useApp();
  if (orders.length === 0) {
    return <p className="rounded-md border border-dashed border-line px-3 py-5 text-center text-[13px] text-muted">Nenhum atendimento registrado ainda.</p>;
  }
  return (
    <div className="overflow-x-auto rounded-md border border-line">
      <table className="data-table">
        <thead>
          <tr><th>Data</th><th>OS</th>{showVehicle && <th>Veículo</th>}<th>Serviço</th><th>Peças</th><th className="num">Valor</th><th>Responsável</th><th>Status</th></tr>
        </thead>
        <tbody>
          {orders.map((o) => {
            const items = view.orderItems.filter((i) => i.orderId === o.id);
            return (
              <tr key={o.id}>
                <td>{formatDate(o.openedAt)}</td>
                <td>
                  {can("os.view") ? (
                    <button type="button" className="font-semibold whitespace-nowrap text-primary hover:underline" onClick={() => onOpen(o.id)}>{formatOrderNumber(o.number)}</button>
                  ) : (
                    <span className="font-semibold whitespace-nowrap">{formatOrderNumber(o.number)}</span>
                  )}
                </td>
                {showVehicle && <td>{vehicleLabel(vehicleOf(o.vehicleId))}</td>}
                <td>{o.description}</td>
                <td className="text-xs">{items.length ? items.map((i) => `${i.quantity}× ${partOf(i.partId)?.name ?? "peça"}`).join(", ") : "—"}</td>
                <td className="num">{orderTotalText(orderTotals(view, o))}</td>
                <td>{userOf(o.mechanicId)?.name.split(" ").slice(0, 2).join(" ") ?? "—"}</td>
                <td><StatusBadge order={o} /></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function VehicleForm({ customerId, vehicle, onDone }: { customerId: ID; vehicle: Vehicle | null; onDone: () => void }) {
  const { view, act, online } = useApp();
  const [owner, setOwner] = useState(customerId);
  const [plate, setPlate] = useState(vehicle ? formatPlate(vehicle.plate) : "");
  const [brand, setBrand] = useState(vehicle?.brand ?? "");
  const [model, setModel] = useState(vehicle?.model ?? "");
  const [year, setYear] = useState(vehicle?.year?.toString() ?? "");
  const [mileage, setMileage] = useState(vehicle?.mileage?.toString() ?? "");

  const save = () => {
    const yr = year.trim() === "" ? null : Number(year);
    const km = mileage.trim() === "" ? null : Number(mileage);
    if ((yr !== null && !Number.isInteger(yr)) || (km !== null && !Number.isInteger(km))) return toast("error", "Ano e quilometragem devem ser números inteiros.");
    const r = act((db, ctx) => saveVehicle(db, ctx, owner, { plate, brand, model, year: yr, mileage: km }, vehicle?.id), vehicle ? "Veículo atualizado." : "Veículo cadastrado.");
    if (r.ok) onDone();
  };

  return (
    <div className="grid grid-cols-6 gap-3 rounded-md border border-primary/40 bg-primary-soft/40 p-3">
      <Field label="Placa" className="col-span-2">{(p) => <Input {...p} value={plate} onChange={(e) => setPlate(e.target.value.toUpperCase())} maxLength={8} autoFocus />}</Field>
      <Field label="Marca" className="col-span-2">{(p) => <Input {...p} value={brand} onChange={(e) => setBrand(e.target.value)} />}</Field>
      <Field label="Modelo" className="col-span-2">{(p) => <Input {...p} value={model} onChange={(e) => setModel(e.target.value)} />}</Field>
      <Field label="Ano" optional className="col-span-2">{(p) => <Input {...p} value={year} onChange={(e) => setYear(e.target.value)} inputMode="numeric" maxLength={4} />}</Field>
      <Field label="Quilometragem" optional className="col-span-2">{(p) => <Input {...p} value={mileage} onChange={(e) => setMileage(e.target.value)} inputMode="numeric" />}</Field>
      {vehicle && (
        <Field label="Proprietário atual" className="col-span-2">
          {(p) => (
            <Select {...p} value={owner} onChange={(e) => setOwner(e.target.value)}>
              {[...view.customers].sort((a, b) => a.name.localeCompare(b.name)).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          )}
        </Field>
      )}
      <div className="col-span-6 flex justify-end gap-2">
        <Button size="sm" onClick={onDone}>Descartar</Button>
        <Button size="sm" variant="primary" disabled={!online} onClick={save}>Salvar veículo</Button>
      </div>
    </div>
  );
}

function CustomerDialog({ customer, onClose }: { customer: Customer | null; onClose: () => void }) {
  const { view, act, can, online, openOrder, openNewOrder } = useApp();
  const [name, setName] = useState(customer?.name ?? "");
  const [phone, setPhone] = useState(customer ? formatPhone(customer.phone) : "");
  const [editing, setEditing] = useState(!customer);
  const [vehicleForm, setVehicleForm] = useState<Vehicle | "new" | null>(null);
  const canManage = can("os.create") || can("os.edit") || can("schedule.manage");

  const vehicles = customer ? view.vehicles.filter((v) => v.customerId === customer.id) : [];
  const orders = customer ? view.orders.filter((o) => o.customerId === customer.id).sort((a, b) => b.openedAt.localeCompare(a.openedAt)) : [];

  const save = () => {
    const r = customer
      ? act((db, ctx) => updateCustomer(db, ctx, customer.id, { name, phone }), "Cliente atualizado.")
      : act((db, ctx) => createCustomer(db, ctx, { name, phone }), "Cliente cadastrado.");
    if (!r.ok) return;
    if (customer) setEditing(false);
    else onClose();
  };

  return (
    <Dialog
      title={customer ? customer.name : "Novo cliente"}
      subtitle={customer ? `${formatPhone(customer.phone)} · cliente desde ${formatDate(customer.createdAt)}` : "Apenas nome e telefone são necessários."}
      size={customer ? "lg" : "sm"}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Fechar</Button>
          {customer && can("os.create") && (
            <Button variant="primary" icon={<Plus className="size-4" aria-hidden />} disabled={!online} onClick={() => { onClose(); openNewOrder({ customerId: customer.id }); }}>
              Nova OS para este cliente
            </Button>
          )}
          {!customer && <Button variant="primary" disabled={!online} onClick={save}>Cadastrar cliente</Button>}
        </>
      }
    >
      <div className="space-y-5">
        {editing ? (
          <div className="grid grid-cols-5 items-end gap-3">
            <Field label="Nome" className="col-span-3">{(p) => <Input {...p} value={name} onChange={(e) => setName(e.target.value)} autoFocus />}</Field>
            <Field label="Telefone" className="col-span-2">{(p) => <Input {...p} value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" placeholder="(85) 98888-7777" />}</Field>
            {customer && (
              <div className="col-span-5 flex justify-end gap-2">
                <Button size="sm" onClick={() => { setEditing(false); setName(customer.name); setPhone(formatPhone(customer.phone)); }}>Descartar</Button>
                <Button size="sm" variant="primary" disabled={!online} onClick={save}>Salvar cliente</Button>
              </div>
            )}
          </div>
        ) : (
          canManage && <Button size="sm" icon={<Pencil className="size-3.5" aria-hidden />} disabled={!online} onClick={() => setEditing(true)}>Editar nome e telefone</Button>
        )}

        {customer && (
          <>
            <section>
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-sm font-semibold">Veículos ({vehicles.length})</h3>
                {canManage && !vehicleForm && <Button size="sm" icon={<Plus className="size-3.5" aria-hidden />} disabled={!online} onClick={() => setVehicleForm("new")}>Adicionar veículo</Button>}
              </div>
              {vehicleForm ? (
                <VehicleForm key={vehicleForm === "new" ? "new" : vehicleForm.id} customerId={customer.id} vehicle={vehicleForm === "new" ? null : vehicleForm} onDone={() => setVehicleForm(null)} />
              ) : vehicles.length === 0 ? (
                <p className="rounded-md border border-dashed border-line px-3 py-4 text-center text-[13px] text-muted">Nenhum veículo vinculado.</p>
              ) : (
                <ul className="grid gap-2 sm:grid-cols-2">
                  {vehicles.map((v) => (
                    <li key={v.id} className="flex items-center justify-between gap-2 rounded-md border border-line px-3 py-2">
                      <span className="min-w-0 text-[13px]">
                        <span className="block font-medium">{vehicleLabel(v)}</span>
                        <span className="text-xs text-muted"><span className="font-mono">{formatPlate(v.plate)}</span>{v.mileage ? ` · ${v.mileage.toLocaleString("pt-BR")} km` : ""}</span>
                      </span>
                      {canManage && <Button size="sm" disabled={!online} onClick={() => setVehicleForm(v)} aria-label={`Editar ${vehicleLabel(v)}`}>Editar</Button>}
                    </li>
                  ))}
                </ul>
              )}
            </section>
            <section>
              <h3 className="mb-2 text-sm font-semibold">Histórico de ordens de serviço ({orders.length})</h3>
              <OrderHistory orders={orders} showVehicle onOpen={(id) => { onClose(); openOrder(id); }} />
            </section>
          </>
        )}
      </div>
    </Dialog>
  );
}

function VehicleDialog({ vehicle, onClose }: { vehicle: Vehicle; onClose: () => void }) {
  const { view, can, online, customerOf, openOrder, openNewOrder } = useApp();
  const [editing, setEditing] = useState(false);
  const orders = view.orders.filter((o) => o.vehicleId === vehicle.id).sort((a, b) => b.openedAt.localeCompare(a.openedAt));
  const owner = customerOf(vehicle.customerId);
  const canManage = can("os.create") || can("os.edit") || can("schedule.manage");
  return (
    <Dialog
      title={`${vehicleLabel(vehicle)} — ${formatPlate(vehicle.plate)}`}
      subtitle={`Proprietário atual: ${owner?.name ?? "—"}${vehicle.mileage ? ` · ${vehicle.mileage.toLocaleString("pt-BR")} km` : ""}`}
      size="lg"
      onClose={onClose}
      footer={
        <>
          {canManage && !editing && <Button className="mr-auto" icon={<Pencil className="size-4" aria-hidden />} disabled={!online} onClick={() => setEditing(true)}>Editar veículo</Button>}
          <Button onClick={onClose}>Fechar</Button>
          {can("os.create") && (
            <Button variant="primary" icon={<Plus className="size-4" aria-hidden />} disabled={!online} onClick={() => { onClose(); openNewOrder({ customerId: vehicle.customerId, vehicleId: vehicle.id }); }}>
              Nova OS para este veículo
            </Button>
          )}
        </>
      }
    >
      <div className="space-y-4">
        {editing && <VehicleForm customerId={vehicle.customerId} vehicle={vehicle} onDone={() => setEditing(false)} />}
        <section>
          <h3 className="mb-2 text-sm font-semibold">Histórico de manutenção ({orders.length})</h3>
          <OrderHistory orders={orders} onOpen={(id) => { onClose(); openOrder(id); }} />
        </section>
      </div>
    </Dialog>
  );
}

function lastOrderOf(orders: ServiceOrder[], filter: (o: ServiceOrder) => boolean): ServiceOrder | null {
  return orders.filter(filter).reduce<ServiceOrder | null>((last, o) => (!last || o.openedAt > last.openedAt ? o : last), null);
}

export function CustomersPage() {
  const { view, can, online, customerOf } = useApp();
  const [tab, setTab] = useState<"customers" | "vehicles">("customers");
  const [search, setSearch] = useState(takeQueryParam);
  const [customerId, setCustomerId] = useState<ID | "new" | null>(null);
  const [vehicleId, setVehicleId] = useState<ID | null>(null);
  const canManage = can("os.create") || can("os.edit") || can("schedule.manage");

  const q = search.trim().toLowerCase();
  const digits = q.replace(/\D/g, "");
  const alnum = q.replace(/[^a-z0-9]/g, "");

  const customers = useMemo(
    () => view.customers.filter((c) => !q || c.name.toLowerCase().includes(q) || (digits.length >= 3 && c.phone.includes(digits)) || view.vehicles.some((v) => v.customerId === c.id && alnum && v.plate.toLowerCase().includes(alnum))),
    [view, q, digits, alnum],
  );
  const vehicles = useMemo(
    () =>
      view.vehicles.filter((v) => {
        const owner = customerOf(v.customerId);
        return !q || (alnum && v.plate.toLowerCase().includes(alnum)) || `${v.brand} ${v.model}`.toLowerCase().includes(q) || owner?.name.toLowerCase().includes(q) || (digits.length >= 3 && owner?.phone.includes(digits));
      }),
    [view, q, digits, alnum, customerOf],
  );

  const customerColumns = useMemo<DataColumn<Customer>[]>(() => {
    const last = (id: ID) => lastOrderOf(view.orders, (o) => o.customerId === id);
    return [
      { id: "name", header: "Nome", size: 220, hideable: false, sortValue: (c) => c.name.toLowerCase(), cell: (c) => <button type="button" className="font-medium text-primary hover:underline">{c.name}</button> },
      { id: "phone", header: "Telefone", size: 140, sortValue: (c) => c.phone, cell: (c) => formatPhone(c.phone) },
      { id: "vehicles", header: "Veículos", size: 260, cell: (c) => view.vehicles.filter((v) => v.customerId === c.id).map((v) => `${v.model} (${formatPlate(v.plate)})`).join(", ") || "—" },
      { id: "last", header: "Último atendimento", size: 300, sortValue: (c) => last(c.id)?.openedAt ?? "", cell: (c) => { const l = last(c.id); return l ? `${formatDate(l.openedAt)} · ${l.description}` : "—"; } },
      { id: "orders", header: "OS", size: 70, align: "right", sortValue: (c) => view.orders.filter((o) => o.customerId === c.id).length, cell: (c) => view.orders.filter((o) => o.customerId === c.id).length },
    ];
  }, [view]);

  const vehicleColumns = useMemo<DataColumn<Vehicle>[]>(() => {
    const last = (id: ID) => lastOrderOf(view.orders, (o) => o.vehicleId === id);
    const owner = (v: Vehicle) => view.customers.find((c) => c.id === v.customerId)?.name ?? "";
    return [
      { id: "plate", header: "Placa", size: 110, hideable: false, sortValue: (v) => v.plate, cell: (v) => <button type="button" className="font-mono font-semibold text-primary hover:underline">{formatPlate(v.plate)}</button> },
      { id: "brand", header: "Marca", size: 120, sortValue: (v) => v.brand, cell: (v) => v.brand },
      { id: "model", header: "Modelo", size: 140, sortValue: (v) => v.model, cell: (v) => v.model },
      { id: "year", header: "Ano", size: 70, sortValue: (v) => v.year ?? 0, cell: (v) => v.year ?? "—" },
      { id: "owner", header: "Proprietário atual", size: 200, sortValue: (v) => owner(v).toLowerCase(), cell: (v) => owner(v) },
      { id: "mileage", header: "Quilometragem", size: 130, align: "right", sortValue: (v) => v.mileage ?? 0, cell: (v) => (v.mileage ? `${v.mileage.toLocaleString("pt-BR")} km` : "—") },
      { id: "last", header: "Último serviço", size: 280, sortValue: (v) => last(v.id)?.openedAt ?? "", cell: (v) => { const l = last(v.id); return l ? `${formatDate(l.openedAt)} · ${l.description}` : "—"; } },
    ];
  }, [view]);

  const selectedCustomer = customerId && customerId !== "new" ? view.customers.find((c) => c.id === customerId) : null;
  const selectedVehicle = vehicleId ? view.vehicles.find((v) => v.id === vehicleId) : null;

  return (
    <>
      <PageHeader
        title="Clientes e veículos"
        description="Cadastro básico e histórico de manutenção derivado das ordens de serviço."
        actions={canManage && <Button variant="primary" icon={<UserPlus className="size-4" aria-hidden />} disabled={!online} onClick={() => setCustomerId("new")}>Novo cliente</Button>}
      />
      <Card>
        <div className="flex flex-wrap items-end justify-between gap-3 px-3 pt-1">
          <Tabs label="Cadastros" value={tab} onChange={setTab} tabs={[{ value: "customers", label: "Clientes", count: view.customers.length }, { value: "vehicles", label: "Veículos", count: view.vehicles.length }]} />
          <div className="relative mb-2 w-80">
            <Search className="pointer-events-none absolute top-2.5 left-2.5 size-4 text-slate-400" aria-hidden />
            <Input className="pl-8" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por placa, nome ou telefone" aria-label="Buscar clientes e veículos" />
          </div>
        </div>

        {tab === "customers" ? (
          view.customers.length === 0 ? (
            <EmptyState icon={<Users className="size-8" aria-hidden />} title="Nenhum cliente cadastrado" description="Os clientes são criados ao abrir uma OS ou pelo botão Novo cliente." />
          ) : customers.length === 0 ? (
            <EmptyState icon={<SearchX className="size-8" aria-hidden />} title="Nenhum cliente encontrado" description="Tente buscar por outro nome, telefone ou placa." />
          ) : (
            <DataTable prefKey="clientes" label="Clientes" columns={customerColumns} data={customers} rowKey={(c) => c.id} defaultSort={{ id: "name" }} onRowClick={(c) => setCustomerId(c.id)} />
          )
        ) : view.vehicles.length === 0 ? (
          <EmptyState icon={<Car className="size-8" aria-hidden />} title="Nenhum veículo cadastrado" />
        ) : vehicles.length === 0 ? (
          <EmptyState icon={<SearchX className="size-8" aria-hidden />} title="Nenhum veículo encontrado" description="Tente buscar por outra placa, modelo ou proprietário." />
        ) : (
          <DataTable prefKey="veiculos" label="Veículos" columns={vehicleColumns} data={vehicles} rowKey={(v) => v.id} defaultSort={{ id: "plate" }} onRowClick={(v) => setVehicleId(v.id)} />
        )}
      </Card>

      {customerId === "new" && <CustomerDialog customer={null} onClose={() => setCustomerId(null)} />}
      {selectedCustomer && <CustomerDialog key={selectedCustomer.id} customer={selectedCustomer} onClose={() => setCustomerId(null)} />}
      {selectedVehicle && <VehicleDialog key={selectedVehicle.id} vehicle={selectedVehicle} onClose={() => setVehicleId(null)} />}
    </>
  );
}
