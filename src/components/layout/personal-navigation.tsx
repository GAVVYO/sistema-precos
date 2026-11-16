"use client";

import { closestCenter, DndContext, DragOverlay, PointerSensor, useDraggable, useDroppable, useSensor, useSensors } from "@dnd-kit/core";
import { ArrowLeft, ArrowRight, BarChart3, Boxes, CalendarDays, Check, CircleDollarSign, ClipboardList, GripVertical, LayoutDashboard, RotateCcw, Settings2, SlidersHorizontal, Users } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useSyncExternalStore } from "react";
import { Button, cx } from "@/components/ui/primitives";
import { toast } from "@/components/ui/toast";
import type { ModuleInfo } from "@/domain/permissions";

const icons = { dashboard: LayoutDashboard, orders: ClipboardList, stock: Boxes, finance: CircleDollarSign, schedule: CalendarDays, customers: Users, reports: BarChart3, settings: Settings2 };
const subscribe = (cb: () => void) => { window.addEventListener("gavyo-navigation", cb); window.addEventListener("storage", cb); return () => { window.removeEventListener("gavyo-navigation", cb); window.removeEventListener("storage", cb); }; };

function NavigationItem({ item, editing, active, index, count, move }: { item: ModuleInfo; editing: boolean; active: boolean; index: number; count: number; move: (from: number, to: number) => void }) {
  const { setNodeRef: setDragRef, attributes, listeners, isDragging } = useDraggable({ id: item.key, disabled: !editing });
  const { setNodeRef: setDropRef, isOver } = useDroppable({ id: item.key, disabled: !editing });
  const Icon = icons[item.key];
  return <div ref={setDropRef} className={cx("personal-nav-item", active && "is-active", editing && "is-editing", isOver && "is-over", isDragging && "is-dragging")}>
    {editing ? <>
      <button ref={setDragRef} type="button" className="personal-nav-drag" aria-label={`Arrastar ${item.label}`} {...attributes} {...listeners}><GripVertical size={14} aria-hidden /><Icon size={17} aria-hidden />{item.label}</button>
      <div className="personal-nav-arrows"><button type="button" disabled={index === 0} aria-label={`Mover ${item.label} para a esquerda`} onClick={() => move(index, index - 1)}><ArrowLeft size={13} aria-hidden /></button><button type="button" disabled={index === count - 1} aria-label={`Mover ${item.label} para a direita`} onClick={() => move(index, index + 1)}><ArrowRight size={13} aria-hidden /></button></div>
    </> : <Link href={item.href} aria-current={active ? "page" : undefined}><span className="personal-nav-icon"><Icon size={18} aria-hidden /></span>{item.label}</Link>}
  </div>;
}

export function PersonalNavigation({ modules, preferenceKey }: { modules: ModuleInfo[]; preferenceKey: string }) {
  const pathname = usePathname();
  const key = `gavyo:navigation:v1:${preferenceKey}`;
  const raw = useSyncExternalStore(subscribe, () => { try { return localStorage.getItem(key) ?? ""; } catch { return ""; } }, () => "");
  let saved: string[] = [];
  try { const parsed: unknown = JSON.parse(raw); if (Array.isArray(parsed)) saved = parsed.filter((v): v is string => typeof v === "string"); } catch { /* Ordem padrão quando a preferência estiver indisponível. */ }
  const ordered = [...modules].sort((a, b) => { const ai = saved.indexOf(a.key), bi = saved.indexOf(b.key); return (ai < 0 ? 999 : ai) - (bi < 0 ? 999 : bi); });
  const [editing, setEditing] = useState(false);
  const [dragged, setDragged] = useState<ModuleInfo | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const persist = (keys: string[]) => { try { localStorage.setItem(key, JSON.stringify(keys)); window.dispatchEvent(new Event("gavyo-navigation")); return true; } catch { toast("error", "Não foi possível salvar a ordem neste navegador."); return false; } };
  const move = (from: number, to: number) => {
    if (from < 0 || to < 0 || to >= ordered.length || from === to) return;
    const next = [...ordered]; const [item] = next.splice(from, 1); next.splice(to, 0, item);
    const hidden = saved.filter(k => !modules.some(m => m.key === k));
    if (persist([...next.map(m => m.key), ...hidden])) setAnnouncement(`${item.label} movido para a posição ${to + 1}.`);
  };
  return <div className={cx("personal-navigation bg-surface text-ink", editing && "organizing")}>
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={({ active }) => setDragged(ordered.find(m => m.key === active.id) ?? null)} onDragCancel={() => setDragged(null)} onDragEnd={({ active, over }) => { setDragged(null); if (over) move(ordered.findIndex(m => m.key === active.id), ordered.findIndex(m => m.key === over.id)); }}>
      <div className="personal-nav-inner">
        <nav aria-label="Navegação principal" className="personal-nav-track">{ordered.map((m, i) => <NavigationItem key={m.key} item={m} editing={editing} active={pathname === m.href || pathname.startsWith(`${m.href}/`)} index={i} count={ordered.length} move={move} />)}</nav>
        <Button size="sm" variant={editing ? "primary" : "ghost"} className="shrink-0" icon={editing ? <Check size={16} aria-hidden /> : <SlidersHorizontal size={16} aria-hidden />} onClick={() => setEditing(!editing)}>{editing ? "Concluir" : "Organizar"}</Button>
      </div>
      {editing && <div className="personal-nav-help"><span>Arraste os módulos para os lados ou use as setas. A ordem fica salva neste navegador.</span><button type="button" onClick={() => { if (persist([])) setAnnouncement("Ordem original restaurada."); }}><RotateCcw size={14} aria-hidden />Restaurar ordem</button></div>}
      <DragOverlay>{dragged && <div className="personal-nav-preview"><GripVertical size={16} aria-hidden />{dragged.label}</div>}</DragOverlay>
    </DndContext>
    <span className="sr-only" role="status">{announcement}</span>
  </div>;
}
