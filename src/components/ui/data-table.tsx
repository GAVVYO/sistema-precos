"use client";

import {
  columnResizingFeature, columnSizingFeature, columnVisibilityFeature, createColumnHelper, createSortedRowModel, functionalUpdate,
  rowSortingFeature, sortFns, tableFeatures, useTable,
  type ColumnSizingState, type ColumnVisibilityState, type SortingState,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ChevronsUpDown, Columns3, RotateCcw } from "lucide-react";
import { ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { usePref } from "@/lib/prefs";
import { cx } from "./primitives";

/**
 * Tabela de dados com ordenação por coluna, largura ajustável (arrastar a
 * borda do cabeçalho, como no Finder) e colunas que podem ser ocultadas.
 * As preferências ficam salvas por usuário. Mantém o visual de `.data-table`.
 *
 * Teclado: o cabeçalho ordena com Enter/Espaço; a borda de redimensionar
 * aceita ← → (WCAG 2.5.7) e duplo clique volta à largura padrão.
 */

export interface DataColumn<T> {
  id: string;
  header: string;
  cell: (row: T) => ReactNode;
  /** Valor usado para ordenar. Sem ele a coluna não é ordenável. */
  sortValue?: (row: T) => string | number;
  /** Largura inicial em px. */
  size?: number;
  minSize?: number;
  align?: "left" | "right";
  /** false impede ocultar (ex.: identificação da linha, ações). */
  hideable?: boolean;
  className?: string;
}

interface Prefs {
  sorting: SortingState;
  sizing: ColumnSizingState;
  hidden: ColumnVisibilityState;
}

const features = tableFeatures({
  columnSizingFeature,
  columnResizingFeature,
  columnVisibilityFeature,
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
  sortFns,
});

const helper = createColumnHelper<typeof features, object>();

export function DataTable<T extends object>({
  prefKey,
  columns,
  data,
  rowKey,
  defaultSort,
  maxHeight,
  label,
  onRowClick,
}: {
  prefKey: string;
  columns: DataColumn<T>[];
  data: T[];
  rowKey: (row: T) => string;
  defaultSort?: { id: string; desc?: boolean };
  /** Altura máxima com cabeçalho fixo (ex.: "calc(100vh - 330px)"). */
  maxHeight?: string;
  label: string;
  /** Linha clicável; a célula principal deve conter um botão para o teclado. */
  onRowClick?: (row: T) => void;
}) {
  const fallback = useMemo<Prefs>(
    () => ({ sorting: defaultSort ? [{ id: defaultSort.id, desc: !!defaultSort.desc }] : [], sizing: {}, hidden: {} }),
    // padrão fixo por tabela
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const [prefs, setPrefs, resetPrefs] = usePref<Prefs>(`tabela:${prefKey}`, fallback);

  const tableColumns = useMemo(
    () =>
      helper.columns(columns.map((c) =>
        helper.accessor((row) => (c.sortValue ? c.sortValue(row as T) : ""), {
          id: c.id,
          header: c.header,
          size: c.size ?? 140,
          minSize: c.minSize ?? 60,
          enableSorting: !!c.sortValue,
          enableHiding: c.hideable !== false,
          sortFn: "alphanumeric",
        }),
      )),
    [columns],
  );
  const byId = useMemo(() => new Map(columns.map((c) => [c.id, c])), [columns]);

  const table = useTable({
    features,
    columns: tableColumns,
    data: data as object[],
    getRowId: (row) => rowKey(row as T),
    columnResizeMode: "onChange",
    enableSortingRemoval: true,
    state: { sorting: prefs.sorting, columnSizing: prefs.sizing, columnVisibility: prefs.hidden },
    onSortingChange: (u) => setPrefs((p) => ({ ...p, sorting: functionalUpdate(u, p.sorting) })),
    onColumnSizingChange: (u) => setPrefs((p) => ({ ...p, sizing: functionalUpdate(u, p.sizing) })),
    onColumnVisibilityChange: (u) => setPrefs((p) => ({ ...p, hidden: functionalUpdate(u, p.hidden) })),
  });

  const headers = table.getHeaderGroups()[0]?.headers ?? [];
  const rows = table.getRowModel().rows;
  const customized = prefs.sorting !== fallback.sorting || Object.keys(prefs.sizing).length > 0 || Object.values(prefs.hidden).some((v) => v === false);

  const resizeBy = (id: string, delta: number) =>
    setPrefs((p) => {
      const col = table.getColumn(id);
      const min = byId.get(id)?.minSize ?? 60;
      const current = col?.getSize() ?? 140;
      return { ...p, sizing: { ...p.sizing, [id]: Math.max(min, current + delta) } };
    });

  return (
    <div>
      <div className="flex items-center justify-end gap-1 border-b border-line px-2 py-1">
        {customized && (
          <button type="button" onClick={resetPrefs} className="flex items-center gap-1 rounded px-1.5 py-1 text-xs text-muted hover:bg-slate-100 hover:text-ink">
            <RotateCcw className="size-3.5" aria-hidden /> Restaurar colunas
          </button>
        )}
        <ColumnsMenu
          items={table.getAllLeafColumns().filter((c) => c.getCanHide()).map((c) => ({ id: c.id, label: byId.get(c.id)?.header ?? c.id, visible: c.getIsVisible(), toggle: () => c.toggleVisibility() }))}
        />
      </div>
      <div className="overflow-auto" style={maxHeight ? { maxHeight } : undefined}>
        <table className="data-table" style={{ tableLayout: "fixed", width: table.getTotalSize(), minWidth: "100%" }} aria-label={label}>
          <colgroup>
            {headers.map((h) => <col key={h.id} style={{ width: h.getSize() }} />)}
          </colgroup>
          <thead className={cx(maxHeight && "sticky top-0 z-10")}>
            <tr>
              {headers.map((h) => {
                const c = byId.get(h.column.id)!;
                const sorted = h.column.getIsSorted();
                const sortable = h.column.getCanSort();
                return (
                  <th
                    key={h.id}
                    aria-sort={sorted === "asc" ? "ascending" : sorted === "desc" ? "descending" : undefined}
                    className={cx("group/th relative select-none", c.align === "right" && "num")}
                  >
                    {sortable ? (
                      <button
                        type="button"
                        onClick={h.column.getToggleSortingHandler()}
                        className={cx("inline-flex max-w-full items-center gap-1 rounded hover:text-ink", c.align === "right" && "flex-row-reverse", sorted && "text-ink")}
                        title="Ordenar"
                      >
                        <span className="truncate">{c.header}</span>
                        {sorted === "asc" ? <ArrowUp className="size-3 shrink-0" aria-hidden /> : sorted === "desc" ? <ArrowDown className="size-3 shrink-0" aria-hidden /> : <ChevronsUpDown className="size-3 shrink-0 opacity-0 group-hover/th:opacity-60" aria-hidden />}
                      </button>
                    ) : (
                      <span className="block truncate">{c.header}</span>
                    )}
                    {h.column.getCanResize() && (
                      <span
                        role="separator"
                        aria-orientation="vertical"
                        aria-label={`Largura da coluna ${c.header}`}
                        aria-valuenow={h.getSize()}
                        tabIndex={0}
                        onMouseDown={h.getResizeHandler()}
                        onTouchStart={h.getResizeHandler()}
                        onDoubleClick={() => h.column.resetSize()}
                        onKeyDown={(e) => {
                          if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
                            e.preventDefault();
                            resizeBy(h.column.id, e.key === "ArrowLeft" ? -16 : 16);
                          }
                        }}
                        className={cx(
                          "absolute top-1 right-0 bottom-1 w-1.5 cursor-col-resize touch-none rounded-full",
                          "opacity-0 group-hover/th:bg-slate-300 group-hover/th:opacity-100 hover:!bg-primary focus-visible:bg-primary focus-visible:opacity-100",
                          h.column.getIsResizing() && "bg-primary opacity-100",
                        )}
                      />
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className={cx(onRowClick && "cursor-pointer")} onClick={onRowClick && (() => onRowClick(r.original as T))}>
                {r.getVisibleCells().map((cell) => {
                  const c = byId.get(cell.column.id)!;
                  return (
                    <td key={cell.id} className={cx("truncate", c.align === "right" && "num", c.className)}>
                      {c.cell(r.original as T)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ColumnsMenu({ items }: { items: { id: string; label: string; visible: boolean; toggle: () => void }[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  if (items.length === 0) return null;
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1 rounded px-1.5 py-1 text-xs text-muted hover:bg-slate-100 hover:text-ink"
      >
        <Columns3 className="size-3.5" aria-hidden /> Colunas
      </button>
      {open && (
        <fieldset className="absolute top-full right-0 z-30 mt-1 min-w-48 rounded-md border border-line bg-surface py-1 shadow-lg">
          <legend className="sr-only">Colunas visíveis</legend>
          {items.map((i) => (
            <label key={i.id} className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-[13px] hover:bg-slate-50">
              <input type="checkbox" checked={i.visible} onChange={i.toggle} className="accent-[var(--primary)]" />
              {i.label}
            </label>
          ))}
        </fieldset>
      )}
    </div>
  );
}
