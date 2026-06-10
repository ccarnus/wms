// Shared UI kit: badges, cards, page headers, filter toolbar controls,
// modal, and a sortable/paginated DataTable used across all screens.

import React, { useEffect, useMemo, useState } from "react";

/* ── Formatters ───────────────────────────────────────────────────── */

export const formatNumber = (value) => Number(value || 0).toLocaleString();

export const formatDateTime = (value) => {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);
  return parsed.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
};

export const toTitleCase = (value) =>
  String(value || "")
    .split("_")
    .filter(Boolean)
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
    .join(" ");

/* ── Badge ────────────────────────────────────────────────────────── */

const BADGE_TONES = {
  green: "border-emerald-200 bg-emerald-50 text-emerald-700",
  red: "border-red-200 bg-red-50 text-red-700",
  blue: "border-blue-200 bg-blue-50 text-blue-700",
  amber: "border-amber-200 bg-amber-50 text-amber-700",
  purple: "border-purple-200 bg-purple-50 text-purple-700",
  cyan: "border-cyan-200 bg-cyan-50 text-cyan-700",
  teal: "border-teal-200 bg-teal-50 text-teal-700",
  rose: "border-rose-200 bg-rose-50 text-rose-700",
  gray: "border-slate-200 bg-slate-100 text-slate-600",
  accent: "border-accent/30 bg-accent/10 text-accent-700"
};

export function Badge({ children, tone = "gray", className = "" }) {
  return (
    <span className={`inline-block whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-semibold ${BADGE_TONES[tone] || BADGE_TONES.gray} ${className}`}>
      {children}
    </span>
  );
}

/* ── Page header & sections ───────────────────────────────────────── */

export function PageHeader({ eyebrow, title, subtitle, actions }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-3">
      <div>
        {eyebrow && (
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">{eyebrow}</p>
        )}
        <h1 className="mt-1 text-2xl font-black tracking-tight text-ink sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-black/55">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

export function Section({ title, meta, toolbar, children, className = "" }) {
  return (
    <section className={`rounded-2xl border border-black/10 bg-white p-4 shadow-sm ${className}`}>
      {(title || meta) && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-black text-ink">{title}</h2>
          {meta && <div className="text-xs text-black/55">{meta}</div>}
        </div>
      )}
      {toolbar && <div className="mb-4 flex flex-wrap items-center gap-2">{toolbar}</div>}
      {children}
    </section>
  );
}

export function StatCard({ label, value, hint, tone, loading }) {
  if (loading) {
    return <article className="h-28 animate-pulse rounded-2xl border border-black/10 bg-white p-4" />;
  }
  const valueClass = tone === "signal" ? "text-signal" : tone === "accent" ? "text-accent-700" : "text-ink";
  return (
    <article className="rounded-2xl border border-black/10 bg-white p-4 shadow-sm transition hover:shadow-md">
      <p className="text-xs font-semibold uppercase tracking-wide text-black/50">{label}</p>
      <p className={`mt-2 text-3xl font-black ${valueClass}`}>{value}</p>
      {hint && <p className="mt-1 text-xs text-black/45">{hint}</p>}
    </article>
  );
}

export function ErrorBanner({ message }) {
  if (!message) return null;
  return (
    <div className="rounded-xl border border-signal/30 bg-signal/10 px-4 py-3 text-sm text-signal">
      {message}
    </div>
  );
}

export function SuccessBanner({ message }) {
  if (!message) return null;
  return (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
      {message}
    </div>
  );
}

/* ── Toolbar controls ─────────────────────────────────────────────── */

const controlClass =
  "rounded-lg border border-black/15 bg-white px-3 py-1.5 text-sm text-ink placeholder:text-black/40 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent";

export function SearchInput({ value, onChange, placeholder = "Search…", className = "" }) {
  return (
    <div className={`relative ${className}`}>
      <svg
        className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-black/35"
        viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      >
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`${controlClass} w-full pl-8 ${value ? "pr-7" : ""}`}
      />
      {value && (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => onChange("")}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-black/35 hover:text-black/70"
        >
          &times;
        </button>
      )}
    </div>
  );
}

// options: array of strings or { value, label } objects.
export function FilterSelect({ value, onChange, options, allLabel = "All", className = "" }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className={`${controlClass} ${className}`}>
      <option value="">{allLabel}</option>
      {options.map((opt) => {
        const optionValue = typeof opt === "object" ? opt.value : opt;
        const optionLabel = typeof opt === "object" ? opt.label : opt;
        return <option key={optionValue} value={optionValue}>{optionLabel}</option>;
      })}
    </select>
  );
}

export function ClearFiltersButton({ visible, onClear }) {
  if (!visible) return null;
  return (
    <button type="button" onClick={onClear} className="text-xs font-semibold text-accent hover:underline">
      Clear filters
    </button>
  );
}

/* ── Pagination ───────────────────────────────────────────────────── */

export function Pagination({ page, totalPages, totalItems, pageSize, onPageChange, label = "items" }) {
  if (totalItems <= pageSize) {
    return (
      <div className="mt-3 text-xs text-black/55">
        {totalItems} {label}
      </div>
    );
  }
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, totalItems);
  return (
    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-black/10 pt-3 text-xs text-black/55">
      <p>Showing {from}–{to} of {totalItems} {label}</p>
      <div className="flex items-center gap-1">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          className="rounded-lg border border-black/15 bg-white px-3 py-1.5 font-semibold hover:bg-canvas disabled:opacity-40"
        >
          Previous
        </button>
        <span className="px-2">{page} / {totalPages}</span>
        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          className="rounded-lg border border-black/15 bg-white px-3 py-1.5 font-semibold hover:bg-canvas disabled:opacity-40"
        >
          Next
        </button>
      </div>
    </div>
  );
}

/* ── Loading & empty states ───────────────────────────────────────── */

export function SkeletonRows({ count = 4, height = "h-14" }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className={`${height} animate-pulse rounded-xl bg-canvas`} />
      ))}
    </div>
  );
}

export function EmptyState({ title, hint }) {
  return (
    <div className="py-8 text-center">
      <p className="text-sm font-semibold text-black/50">{title}</p>
      {hint && <p className="mt-1 text-xs text-black/35">{hint}</p>}
    </div>
  );
}

export function Spinner() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
    </div>
  );
}

/* ── Modal ────────────────────────────────────────────────────────── */

export function Modal({ title, onClose, children, wide }) {
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className={`max-h-[90vh] w-full ${wide ? "max-w-2xl" : "max-w-lg"} overflow-y-auto rounded-2xl bg-white p-6 shadow-xl`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold text-gray-900">{title}</h3>
          <button type="button" onClick={onClose} aria-label="Close" className="text-xl leading-none text-gray-400 hover:text-gray-600">&times;</button>
        </div>
        {children}
      </div>
    </div>
  );
}

/* ── Sortable DataTable ───────────────────────────────────────────── */

const compareValues = (a, b) => {
  const aMissing = a === null || a === undefined || a === "";
  const bMissing = b === null || b === undefined || b === "";
  if (aMissing && bMissing) return 0;
  if (aMissing) return 1; // missing values sort last
  if (bMissing) return -1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  if (typeof a === "boolean" && typeof b === "boolean") return a === b ? 0 : a ? -1 : 1;
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: "base" });
};

function SortIcon({ direction }) {
  return (
    <span className="ml-1 inline-flex flex-col text-[8px] leading-[7px]">
      <span className={direction === "asc" ? "text-accent" : "text-black/25"}>▲</span>
      <span className={direction === "desc" ? "text-accent" : "text-black/25"}>▼</span>
    </span>
  );
}

/**
 * Sortable, optionally paginated table.
 *
 * columns: [{
 *   key,                  — unique id; also default accessor into the row
 *   label,
 *   sortable = true,      — set false to disable sorting for the column
 *   sortValue?(row),      — custom sort accessor
 *   render?(row),         — custom cell renderer
 *   align?: "left"|"center"|"right",
 *   headerClassName?, cellClassName?
 * }]
 */
export function DataTable({
  columns,
  rows,
  rowKey,
  loading = false,
  emptyTitle = "Nothing here yet",
  emptyHint,
  initialSort = null, // { key, dir: "asc" | "desc" }
  pageSize = 0, // 0 = no pagination
  paginationLabel = "items",
  minWidth = "min-w-[640px]"
}) {
  const [sort, setSort] = useState(initialSort);
  const [page, setPage] = useState(1);

  const sortedRows = useMemo(() => {
    if (!sort) return rows;
    const column = columns.find((c) => c.key === sort.key);
    if (!column) return rows;
    const accessor = column.sortValue || ((row) => row[column.key]);
    const direction = sort.dir === "desc" ? -1 : 1;
    return [...rows].sort((a, b) => direction * compareValues(accessor(a), accessor(b)));
  }, [rows, sort, columns]);

  const totalPages = pageSize > 0 ? Math.max(1, Math.ceil(sortedRows.length / pageSize)) : 1;
  const safePage = Math.min(page, totalPages);
  const visibleRows = pageSize > 0
    ? sortedRows.slice((safePage - 1) * pageSize, safePage * pageSize)
    : sortedRows;

  // Snap back into range when filters shrink the data set.
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const handleSort = (column) => {
    if (column.sortable === false) return;
    setSort((current) => {
      if (current?.key !== column.key) return { key: column.key, dir: "asc" };
      if (current.dir === "asc") return { key: column.key, dir: "desc" };
      return null; // third click clears the sort
    });
    setPage(1);
  };

  const alignClass = (align) =>
    align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left";

  if (loading) {
    return <SkeletonRows count={5} />;
  }

  if (rows.length === 0) {
    return <EmptyState title={emptyTitle} hint={emptyHint} />;
  }

  return (
    <>
      <div className="overflow-auto">
        <table className={`${minWidth} w-full text-left text-sm`}>
          <thead>
            <tr className="border-b border-black/10 bg-canvas/60 text-xs font-semibold uppercase tracking-wide text-black/50">
              {columns.map((column) => {
                const isSorted = sort?.key === column.key;
                const sortableColumn = column.sortable !== false;
                return (
                  <th key={column.key} className={`px-3 py-2.5 ${alignClass(column.align)} ${column.headerClassName || ""}`}>
                    {sortableColumn ? (
                      <button
                        type="button"
                        onClick={() => handleSort(column)}
                        className={`inline-flex select-none items-center font-semibold uppercase tracking-wide transition hover:text-ink ${isSorted ? "text-ink" : ""}`}
                      >
                        {column.label}
                        <SortIcon direction={isSorted ? sort.dir : null} />
                      </button>
                    ) : (
                      column.label
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row) => (
              <tr key={rowKey(row)} className="border-b border-black/5 transition last:border-0 hover:bg-canvas/60">
                {columns.map((column) => (
                  <td key={column.key} className={`px-3 py-2.5 ${alignClass(column.align)} ${column.cellClassName || ""}`}>
                    {column.render ? column.render(row) : row[column.key] ?? "—"}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {pageSize > 0 && (
        <Pagination
          page={safePage}
          totalPages={totalPages}
          totalItems={sortedRows.length}
          pageSize={pageSize}
          onPageChange={setPage}
          label={paginationLabel}
        />
      )}
    </>
  );
}

/* ── Buttons ──────────────────────────────────────────────────────── */

export const primaryButtonClass =
  "rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-50";

export const secondaryButtonClass =
  "rounded-lg border border-black/10 bg-white px-4 py-2 text-sm font-semibold text-ink transition hover:bg-canvas disabled:opacity-50";
