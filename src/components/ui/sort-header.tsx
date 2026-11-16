"use client";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import type { ReactNode } from "react";

export interface TableSort<K extends string> { key: K; desc: boolean }
export function SortHeader<K extends string>({ field, sort, onSort, children, numeric = false }: {
  field: K; sort: TableSort<K>; onSort: (sort: TableSort<K>) => void; children: ReactNode; numeric?: boolean;
}) {
  const selected = sort.key === field;
  const Icon = selected ? sort.desc ? ArrowDown : ArrowUp : ArrowUpDown;
  return <th className={numeric ? "num" : undefined} aria-sort={selected ? sort.desc ? "descending" : "ascending" : "none"}>
    <button type="button" className="inline-flex items-center gap-1.5 rounded hover:text-primary" onClick={() => onSort({ key: field, desc: selected ? !sort.desc : false })}>{children}<Icon className="size-3" aria-hidden /></button>
  </th>;
}
