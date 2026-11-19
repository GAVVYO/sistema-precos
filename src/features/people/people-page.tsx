"use client";

import { Car, DeviceMobileCamera, DeviceTablet, IdentificationBadge, MagnifyingGlass, Plus, UsersThree } from "@phosphor-icons/react";
import { useMemo, useState } from "react";
import { useApp } from "@/app-state/app-context";
import { ChoiceGroup, MoreDetails } from "@/components/ui/choice";
import { CountUp } from "@/components/ui/count-up";
import { Dialog } from "@/components/ui/dialog";
import { Pager, usePager } from "@/components/ui/pager";
import { PersonAvatar } from "@/components/ui/person-avatar";
import { Button, EmptyState, Field, Input, PageHeader } from "@/components/ui/primitives";
import { motionReduced } from "@/lib/view-transition";
import { initialQuery } from "@/lib/query";
import { PERMISSIONS, ROLE_LABELS, ROLE_TEMPLATES } from "@/domain/permissions";
import type { ID, PermissionKey, Role, WorkshopMembership } from "@/domain/types";
import { MiniPlate } from "@/features/dashboard/yard";
import { CustomerDialog, VehicleDialog } from "@/features/customers/customers-page";
import { vehicleLabel } from "@/features/orders/shared";
import { formatDate, formatPhone, formatPlate } from "@/lib/format";
import { addMember, setMemberPin, updateMember, updateMemberProfile } from "@/services/admin";
import { createCustomer, saveVehicle } from "@/services/customers";
import { BadgeCard, PhotoPicker } from "./badge-card";
import { PairingQr } from "./pairing-qr";
import { maskDigits, maskEmail, maskPhone, maskPlate } from "@/lib/masks";

/**
 * Pessoas (decisão 62): clientes, funcionários e carros num lugar só, no mesmo
 * esquema de Serviços (abas grandes + cartões). Cadastro novo com crachá que se
 * preenche enquanto digita e carimbo "Cadastro concluído" ao salvar.
 */

const ROLES = Object.keys(ROLE_LABELS) as Role[];
const ROLE_HINTS: Record<Role, string> = {
  owner: "Vê e faz tudo",
  receptionist: "Balcão, agenda e receber",
  mechanic: "Os carros do quadro",
  financial: "Dinheiro e contas",
};
export const roleOptions = (canOwner: boolean) => ROLES.map((r) => ({ value: r, label: ROLE_LABELS[r], hint: ROLE_HINTS[r], disabled: r === "owner" && !canOwner }));

type Tab = "customers" | "staff" | "vehicles";

/** Depois do carimbo, espera a pessoa ver e fecha. */
function stampThenClose(setStamped: (v: boolean) => void, onClose: () => void) {
  setStamped(true);
  window.setTimeout(onClose, motionReduced() ? 1100 : 1900);
}

function NewCustomerDialog({ onClose }: { onClose: () => void }) {
  const { act, online } = useApp();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [plate, setPlate] = useState("");
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [stamped, setStamped] = useState(false);
  const save = () => {
    const hasCar = plate.trim() !== "";
    const r = act((db, ctx) => {
      const c = createCustomer(db, ctx, { name, phone });
      if (hasCar) saveVehicle(db, ctx, c.id, { plate, brand, model, year: null, mileage: null });
      return c;
    });
    if (r.ok) stampThenClose(setStamped, onClose);
  };
  return (
    <Dialog title="Novo cliente" subtitle="Só o nome e o telefone. O carro pode vir depois." size="lg" className="badge-dialog" onClose={onClose}
      footer={<><Button onClick={onClose}>Cancelar</Button><Button variant="primary" disabled={!online || stamped} onClick={save}>Salvar cadastro</Button></>}>
      <div className="badge-layout">
        <BadgeCard kind="customer" name={name} phone={phone} plate={plate.replace(/[^a-z0-9]/gi, "").length >= 7 ? plate : undefined} stamped={stamped} />
        <form className="badge-form" onSubmit={(e) => { e.preventDefault(); save(); }}>
          <Field label="Nome do cliente">{(p) => <Input {...p} value={name} onChange={(e) => setName(e.target.value)} autoFocus autoComplete="off" />}</Field>
          <Field label="Telefone (WhatsApp)" hint="Com DDD. Ex.: (85) 98888-7777">{(p) => <Input {...p} value={phone} onChange={(e) => setPhone(maskPhone(e.target.value))} inputMode="tel" />}</Field>
          <MoreDetails summary="Carro do cliente (opcional)">
            <Field label="Placa">{(p) => <Input {...p} value={plate} onChange={(e) => setPlate(maskPlate(e.target.value))} maxLength={8} />}</Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Marca">{(p) => <Input {...p} value={brand} onChange={(e) => setBrand(e.target.value)} />}</Field>
              <Field label="Modelo">{(p) => <Input {...p} value={model} onChange={(e) => setModel(e.target.value)} />}</Field>
            </div>
          </MoreDetails>
          <button type="submit" hidden />
          {stamped && <p className="sr-only" role="status">Cadastro concluído.</p>}
        </form>
      </div>
    </Dialog>
  );
}

function StaffDialog({ member, onClose }: { member: WorkshopMembership | null; onClose: () => void }) {
  const { act, online, userOf, user, membership: mine } = useApp();
  const target = member ? userOf(member.userId) : null;
  const [name, setName] = useState(target?.name ?? "");
  const [phone, setPhone] = useState(target?.phone ? formatPhone(target.phone) : "");
  const [email, setEmail] = useState(target?.email ?? "");
  const [photo, setPhoto] = useState<string | null>(target?.photo ?? null);
  const [role, setRole] = useState<Role>(member?.role ?? "mechanic");
  const [active, setActive] = useState(member?.active ?? true);
  const [permissions, setPermissions] = useState<PermissionKey[]>(member?.permissions ?? []);
  const [stamped, setStamped] = useState(false);
  const [pin, setPin] = useState("");
  const [pinTouched, setPinTouched] = useState(false);
  // Depois de salvar (ou ao tocar em "Conectar celular"): mostra o QR do celular da pessoa (decisão 76).
  const [qrFor, setQrFor] = useState<ID | null>(null);
  const isSelf = member?.userId === user.id;
  const groups = [...new Set(PERMISSIONS.map((p) => p.group))];
  const grantable = (key: PermissionKey) => !!member?.permissions.includes(key) || mine.permissions.includes(key);
  const toggle = (key: PermissionKey, on: boolean) => setPermissions(on ? [...permissions, key] : permissions.filter((p) => p !== key));

  const save = () => {
    if (!member) {
      // Funcionário novo já sai com PIN próprio: nada de PIN padrão conhecido por todos.
      if (!/^\d{4}$/.test(pin)) { setPinTouched(true); return; }
      let created: ID | null = null;
      const r = act((db, ctx) => {
        const m = addMember(db, ctx, { name, email, role, phone, photo });
        setMemberPin(db, ctx, m.id, pin);
        created = m.id;
      });
      // Carimbo no crachá e, em seguida, o QR para já conectar o celular da pessoa.
      if (r.ok) { setStamped(true); window.setTimeout(() => setQrFor(created), motionReduced() ? 900 : 1600); }
      return;
    }
    const r = act((db, ctx) => {
      updateMemberProfile(db, ctx, member.id, { name, phone, photo });
      if (pin) setMemberPin(db, ctx, member.id, pin);
      if (!isSelf) updateMember(db, ctx, member.id, { role, active, permissions });
    }, "Cadastro atualizado.");
    if (r.ok) onClose();
  };

  if (qrFor) {
    return (
      <Dialog
        title={member ? `Conectar o celular de ${name.split(" ")[0]}` : "Cadastro concluído"}
        subtitle={member ? "Mostre este QR para a pessoa." : `Agora conecte o celular de ${name.split(" ")[0]}. Se preferir, faça isso depois pela ficha.`}
        size="lg"
        className="pair-dialog"
        onClose={onClose}
        footer={<>{member && <Button onClick={() => setQrFor(null)}>Voltar para a ficha</Button>}<Button variant="primary" onClick={onClose}>{member ? "Fechar" : "Pronto"}</Button></>}
      >
        <PairingQr key={qrFor} input={{ kind: "person", membershipId: qrFor }} who={name.split(" ")[0]} />
      </Dialog>
    );
  }

  return (
    <Dialog
      title={member ? target?.name ?? "Funcionário" : "Novo funcionário"}
      subtitle={member ? `${target?.email}${isSelf ? " · você" : ""}` : "Nome, e-mail para entrar no sistema e a função. Foto e telefone são opcionais."}
      size="lg"
      className="badge-dialog"
      onClose={onClose}
      footer={<>
        {member?.active && <Button className="mr-auto" icon={<DeviceMobileCamera size={18} weight="duotone" aria-hidden />} onClick={() => setQrFor(member.id)}>Conectar celular</Button>}
        <Button onClick={onClose}>Cancelar</Button><Button variant="primary" disabled={!online || stamped} onClick={save}>{member ? "Salvar alterações" : "Salvar cadastro"}</Button>
      </>}
    >
      <div className="badge-layout">
        <BadgeCard kind="staff" name={name} phone={phone} roleLabel={ROLE_LABELS[role]} photo={photo} stamped={stamped} />
        <form className="badge-form" onSubmit={(e) => { e.preventDefault(); save(); }}>
          <Field label="Nome do funcionário">{(p) => <Input {...p} value={name} onChange={(e) => setName(e.target.value)} autoFocus={!member} autoComplete="off" />}</Field>
          {!member && <Field label="E-mail (para entrar no sistema)" hint="Ex.: joao@suaoficina.com">{(p) => <Input {...p} type="email" inputMode="email" autoCapitalize="none" spellCheck={false} value={email} onChange={(e) => setEmail(maskEmail(e.target.value))} />}</Field>}
          <Field label="Telefone" optional hint="Com DDD.">{(p) => <Input {...p} value={phone} onChange={(e) => setPhone(maskPhone(e.target.value))} inputMode="tel" />}</Field>
          <PhotoPicker value={photo} onChange={setPhoto} />
          <Field
            label={member ? "Trocar o PIN de entrada" : "PIN de entrada"}
            optional={!!member}
            hint={member ? "4 números. Em branco, continua o mesmo." : "4 números que só a pessoa vai saber. Ela entra tocando no nome e digitando o PIN."}
            error={(pin || pinTouched) && !/^\d{4}$/.test(pin) ? "O PIN tem 4 números." : undefined}
          >
            {(p) => <Input {...p} value={pin} onChange={(e) => setPin(maskDigits(e.target.value, 4))} inputMode="numeric" autoComplete="off" maxLength={4} className="max-w-40 tracking-[.4em]" />}
          </Field>
          {isSelf && <p className="rounded-xl bg-warning-soft px-3 py-2 text-sm text-warning">Sua própria função e acesso só outro proprietário muda.</p>}
          <fieldset disabled={isSelf} className="grid gap-4">
            <ChoiceGroup label="Qual a função?" value={role} onChange={(r) => { setRole(r); if (member) setPermissions(ROLE_TEMPLATES[r].filter(grantable)); }} options={roleOptions(mine.role === "owner")} columns={2} />
            {member && (
              <>
                <ChoiceGroup label="Pode entrar no sistema?" value={active ? "1" : "0"} onChange={(v) => setActive(v === "1")} columns={2} options={[{ value: "1", label: "Sim, ativo" }, { value: "0", label: "Não, sem acesso" }]} />
                <MoreDetails summary={`O que pode fazer no sistema (${permissions.length} permissões)`}>
                  <p className="choice-help">A função já marca o que precisa. Ajuste aqui só se quiser algo diferente.</p>
                  <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
                    {groups.map((g) => (
                      <fieldset key={g}>
                        <legend className="mb-1 text-sm font-semibold">{g}</legend>
                        {PERMISSIONS.filter((p) => p.group === g).map((p) => (
                          <label key={p.key} className="flex min-h-9 items-center gap-2.5 text-[.9375rem]">
                            <input type="checkbox" className="size-5 accent-(--primary)" checked={permissions.includes(p.key)} disabled={!grantable(p.key)} onChange={(e) => toggle(p.key, e.target.checked)} />
                            {p.label}
                          </label>
                        ))}
                      </fieldset>
                    ))}
                  </div>
                </MoreDetails>
              </>
            )}
          </fieldset>
          <button type="submit" hidden />
          {stamped && <p className="sr-only" role="status">Cadastro concluído.</p>}
        </form>
      </div>
    </Dialog>
  );
}

function PeopleTab({ id, label, sub, count, icon, tone, active, onSelect }: { id: Tab; label: string; sub: string; count: number; icon: React.ReactNode; tone: string; active: boolean; onSelect: () => void }) {
  return (
    <button type="button" role="tab" id={`people-tab-${id}`} aria-selected={active} aria-controls="people-panel" tabIndex={active ? 0 : -1} className="stage-tab" style={{ ["--st" as string]: tone }} onClick={onSelect}>
      <span className="stage-tab-icon" aria-hidden>{icon}</span>
      <span className="stage-tab-text"><span className="stage-tab-label">{label}</span><span className="stage-tab-sub">{sub}</span></span>
      <span className="stage-tab-count"><CountUp value={count} /></span>
    </button>
  );
}

export function PeoplePage() {
  const { view, can, online, userOf, user, customerOf } = useApp();
  const canStaff = can("staff.manage");
  const canCustomers = can("customers.view");
  const canManage = can("os.create") || can("os.edit") || can("schedule.manage");
  const tabs: Tab[] = [...(canCustomers ? (["customers"] as const) : []), ...(canStaff ? (["staff"] as const) : []), ...(canCustomers ? (["vehicles"] as const) : [])];
  const [tab, setTab] = useState<Tab>(tabs[0] ?? "customers");
  const [search, setSearch] = useState(initialQuery);
  const [open, setOpen] = useState<{ kind: Tab; id: ID | "new" } | null>(null);
  const [deviceQr, setDeviceQr] = useState(false);

  const q = search.trim().toLocaleLowerCase("pt-BR");
  const digits = q.replace(/\D/g, "");
  const alnum = q.replace(/[^a-z0-9]/g, "");
  const customers = useMemo(() => [...view.customers]
    .filter((c) => !q || c.name.toLocaleLowerCase("pt-BR").includes(q) || (digits.length >= 3 && c.phone.includes(digits)) || view.vehicles.some((v) => v.customerId === c.id && alnum && v.plate.toLowerCase().includes(alnum)))
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR")), [view, q, digits, alnum]);
  const staff = useMemo(() => view.memberships
    .filter((m) => { const u = userOf(m.userId); return !q || (u?.name.toLocaleLowerCase("pt-BR").includes(q) ?? false) || ROLE_LABELS[m.role].toLowerCase().includes(q); })
    .sort((a, b) => Number(b.active) - Number(a.active) || (userOf(a.userId)?.name ?? "").localeCompare(userOf(b.userId)?.name ?? "", "pt-BR")), [view, q, userOf]);
  const vehicles = useMemo(() => view.vehicles.filter((v) => {
    const owner = customerOf(v.customerId);
    return !q || (alnum && v.plate.toLowerCase().includes(alnum)) || `${v.brand} ${v.model}`.toLowerCase().includes(q) || (owner?.name.toLocaleLowerCase("pt-BR").includes(q) ?? false);
  }), [view, q, alnum, customerOf]);

  const pageKey = `${tab}|${search}`;
  const customerPager = usePager(customers, 12, pageKey);
  const staffPager = usePager(staff, 12, pageKey);
  const vehiclePager = usePager(vehicles, 12, pageKey);
  const lastOf = (pred: (o: { customerId: ID; vehicleId: ID }) => boolean) => view.orders.filter(pred).reduce<string | null>((l, o) => (!l || o.openedAt > l ? o.openedAt : l), null);
  const tabKey = (e: React.KeyboardEvent) => {
    const i = tabs.indexOf(tab);
    const to = e.key === "ArrowRight" ? tabs[(i + 1) % tabs.length] : e.key === "ArrowLeft" ? tabs[(i + tabs.length - 1) % tabs.length] : null;
    if (!to) return;
    e.preventDefault(); setTab(to);
    window.setTimeout(() => document.getElementById(`people-tab-${to}`)?.focus(), 0);
  };
  const activeStaff = view.memberships.filter((m) => m.active).length;
  const newLabel = tab === "staff" ? "Novo funcionário" : "Novo cliente";
  const canNew = tab === "staff" ? canStaff : canManage;

  return (
    <div className="module-page module-people">
      <PageHeader
        title="Pessoas"
        description="Clientes, funcionários e carros da oficina. Clique numa pessoa para abrir a ficha."
        actions={<>
          {tab === "staff" && canStaff && <Button className="rounded-full" icon={<DeviceTablet size={18} weight="duotone" aria-hidden />} onClick={() => setDeviceQr(true)}>Conectar aparelho da oficina</Button>}
          {canNew && tab !== "vehicles" && <Button variant="primary" className="rounded-full" icon={<Plus size={18} weight="bold" aria-hidden />} disabled={!online} onClick={() => setOpen({ kind: tab, id: "new" })}>{newLabel}</Button>}
        </>}
      />
      <div className="svc-toolbar">
        <label className="svc-search">
          <MagnifyingGlass size={20} weight="duotone" aria-hidden />
          <span className="sr-only">Buscar pessoas</span>
          <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={tab === "staff" ? "Nome ou função" : "Nome, telefone ou placa"} />
        </label>
      </div>

      <div className="svc-stage">
        <div className="stage-tabs" role="tablist" aria-label="Quem você procura" onKeyDown={tabKey} style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}>
          {canCustomers && <PeopleTab id="customers" label="Clientes" sub={`${view.vehicles.length} carros cadastrados`} count={customers.length} icon={<UsersThree weight="duotone" />} tone="#2563eb" active={tab === "customers"} onSelect={() => setTab("customers")} />}
          {canStaff && <PeopleTab id="staff" label="Funcionários" sub={`${activeStaff} com acesso`} count={staff.length} icon={<IdentificationBadge weight="duotone" />} tone="#0f766e" active={tab === "staff"} onSelect={() => setTab("staff")} />}
          {canCustomers && <PeopleTab id="vehicles" label="Carros" sub="pela placa" count={vehicles.length} icon={<Car weight="duotone" />} tone="#b45309" active={tab === "vehicles"} onSelect={() => setTab("vehicles")} />}
        </div>

        <div id="people-panel" role="tabpanel" aria-labelledby={`people-tab-${tab}`} className="svc-list">
          {tab === "customers" && (customers.length === 0 ? (
            <EmptyState title={q ? "Ninguém com esse nome, telefone ou placa" : "Nenhum cliente ainda"} description={q ? "Confira o que foi digitado." : "O cliente é cadastrado sozinho ao abrir um serviço, ou pelo botão Novo cliente."} />
          ) : (
            <><ul className="svc-rows people-rows">
              {customerPager.items.map((c) => {
                const cars = view.vehicles.filter((v) => v.customerId === c.id);
                const count = view.orders.filter((o) => o.customerId === c.id).length;
                const last = lastOf((o) => o.customerId === c.id);
                return (
                  <li key={c.id} className="person-row">
                    <button type="button" className="person-open" onClick={() => setOpen({ kind: "customers", id: c.id })} aria-label={`Abrir ficha de ${c.name}`}>
                      <PersonAvatar name={c.name} size={48} />
                      <span className="person-main">
                        <span className="person-name">{c.name}</span>
                        <span className="person-sub">{formatPhone(c.phone)}</span>
                        <span className="svc-meta">
                          <span className="svc-chip">{count} {count === 1 ? "serviço" : "serviços"}</span>
                          {last && <span className="svc-chip">Último em {formatDate(last).slice(0, 5)}</span>}
                        </span>
                      </span>
                      <span className="person-cars">
                        {cars.slice(0, 2).map((v) => <MiniPlate key={v.id} plate={v.plate} />)}
                        {cars.length > 2 && <span className="svc-chip">+{cars.length - 2}</span>}
                        {cars.length === 0 && <span className="person-muted">Sem carro</span>}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
            <Pager pager={customerPager} label="clientes" noun="clientes" /></>
          ))}

          {tab === "staff" && (
            <><ul className="svc-rows people-rows">
              {staff.length === 0 && <EmptyState title="Ninguém com esse nome ou função" description="Confira o que foi digitado." />}
              {staffPager.items.map((m) => {
                const u = userOf(m.userId);
                if (!u) return null;
                return (
                  <li key={m.id} className="person-row" data-inactive={!m.active || undefined}>
                    <button type="button" className="person-open" onClick={() => setOpen({ kind: "staff", id: m.id })} aria-label={`Abrir ficha de ${u.name}`}>
                      <PersonAvatar name={u.name} photo={u.photo} size={48} />
                      <span className="person-main">
                        <span className="person-name">{u.name}{m.userId === user.id && <span className="person-you"> (você)</span>}</span>
                        <span className="person-sub">{u.phone ? formatPhone(u.phone) : u.email}</span>
                        <span className="svc-meta">
                          <span className="svc-chip is-role">{ROLE_LABELS[m.role]}</span>
                          <span className="svc-chip" data-off={!m.active || undefined}>{m.active ? "Com acesso" : "Sem acesso"}</span>
                        </span>
                      </span>
                      <span className="person-go">Abrir ficha</span>
                    </button>
                  </li>
                );
              })}
            </ul>
            <Pager pager={staffPager} label="funcionários" noun="funcionários" /></>
          )}

          {tab === "vehicles" && (vehicles.length === 0 ? (
            <EmptyState title={q ? "Nenhum carro com essa placa ou modelo" : "Nenhum carro ainda"} description={q ? "Confira o que foi digitado." : "O carro é cadastrado sozinho ao abrir um serviço com a placa."} />
          ) : (
            <><ul className="svc-rows people-rows">
              {vehiclePager.items.map((v) => {
                const owner = customerOf(v.customerId);
                const last = lastOf((o) => o.vehicleId === v.id);
                return (
                  <li key={v.id} className="person-row">
                    <button type="button" className="person-open" onClick={() => setOpen({ kind: "vehicles", id: v.id })} aria-label={`Abrir ${vehicleLabel(v)} placa ${formatPlate(v.plate)}`}>
                      <MiniPlate plate={v.plate} />
                      <span className="person-main">
                        <span className="person-name">{vehicleLabel(v)}{v.year ? ` ${v.year}` : ""}</span>
                        <span className="person-sub">{owner?.name ?? "Sem dono"}</span>
                        <span className="svc-meta">
                          {v.mileage ? <span className="svc-chip">{v.mileage.toLocaleString("pt-BR")} km</span> : null}
                          {last && <span className="svc-chip">Último serviço em {formatDate(last).slice(0, 5)}</span>}
                        </span>
                      </span>
                      <span className="person-go">Ver histórico</span>
                    </button>
                  </li>
                );
              })}
            </ul>
            <Pager pager={vehiclePager} label="carros" noun="carros" /></>
          ))}
        </div>
      </div>

      {open?.kind === "customers" && open.id === "new" && <NewCustomerDialog onClose={() => setOpen(null)} />}
      {open?.kind === "customers" && open.id !== "new" && (() => { const c = view.customers.find((x) => x.id === open.id); return c ? <CustomerDialog key={c.id} customer={c} onClose={() => setOpen(null)} /> : null; })()}
      {deviceQr && (
        <Dialog title="Conectar o aparelho da oficina" subtitle="Para o celular ou tablet do balcão, que várias pessoas usam." size="lg" className="pair-dialog" onClose={() => setDeviceQr(false)} footer={<Button variant="primary" onClick={() => setDeviceQr(false)}>Fechar</Button>}>
          <PairingQr input={{ kind: "device" }} who="" />
        </Dialog>
      )}
      {open?.kind === "staff" && (open.id === "new" ? <StaffDialog member={null} onClose={() => setOpen(null)} /> : (() => { const m = view.memberships.find((x) => x.id === open.id); return m ? <StaffDialog key={m.id} member={m} onClose={() => setOpen(null)} /> : null; })())}
      {open?.kind === "vehicles" && open.id !== "new" && (() => { const v = view.vehicles.find((x) => x.id === open.id); return v ? <VehicleDialog key={v.id} vehicle={v} onClose={() => setOpen(null)} /> : null; })()}
    </div>
  );
}

