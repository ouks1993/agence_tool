import * as React from "react";
import { ArrowUpDown, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Table — the Atlas deck "data-table" treatment.
 *
 * All base exports (Table / TableHeader / TableBody / TableRow / TableHead /
 * TableCell) keep their original `React.ComponentProps<"…">` signatures, so every
 * existing usage keeps compiling. The deck upgrades are additive and opt-in:
 *
 *   • `<Table zebra>`                        — striped even rows (deck `.table.zebra`).
 *   • `<TableHeader sticky>`                 — header stays pinned while scrolling.
 *   • `<TableHead sortable sortDirection>`   — sortable affordance (chevron + aria-sort).
 *   • `<TableHead numeric>` / `align="right"`— right-aligned, tabular-nums header.
 *   • `<TableCell numeric>` / `align="right"`— right-aligned, tabular-nums cell.
 *   • `<TableSortButton>`                    — standalone sortable-header trigger.
 *
 * The refined header band (uppercase, tracked, `bg-surface-2`) is applied by
 * default to every `TableHead`, matching `atlas-ui.css .table thead th` verbatim
 * without breaking any current markup.
 *
 * ── Mobile card-reflow pattern ────────────────────────────────────────────────
 * Data tables don't reflow well under ~640px. Rather than horizontally scroll,
 * hide the table and render list cards on small screens. Pattern (per screen):
 *
 *   <div className="hidden sm:block">
 *     <Table> … </Table>            // wide screens: full table
 *   </div>
 *   <ul className="space-y-3 sm:hidden">
 *     {rows.map((r) => (
 *       <li key={r.id}>
 *         <Card className="card-elevated p-4"> … stacked key/value pairs … </Card>
 *       </li>
 *     ))}
 *   </ul>
 *
 * Keep the same data + links in both branches so nothing is lost on mobile.
 * ──────────────────────────────────────────────────────────────────────────────
 */

function Table({
  className,
  zebra = false,
  ...props
}: React.ComponentProps<"table"> & {
  /** Stripe even body rows (deck `.table.zebra`). */
  zebra?: boolean;
}) {
  return (
    <div className="relative w-full overflow-x-auto">
      <table
        data-slot="table"
        data-zebra={zebra ? "" : undefined}
        className={cn(
          "w-full caption-bottom text-sm",
          zebra && "[&_tbody_tr:nth-child(even)]:bg-surface-2/60",
          className
        )}
        {...props}
      />
    </div>
  );
}

function TableHeader({
  className,
  sticky = false,
  ...props
}: React.ComponentProps<"thead"> & {
  /**
   * Pin the header row to the top of its scroll container. Pair with a
   * `max-h-*`/`overflow-auto` wrapper so it has something to stick against.
   */
  sticky?: boolean;
}) {
  return (
    <thead
      data-slot="table-header"
      data-sticky={sticky ? "" : undefined}
      className={cn(
        "[&_tr]:border-b",
        sticky && "sticky top-0 z-10 [&_th]:bg-surface-2",
        className
      )}
      {...props}
    />
  );
}

function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return (
    <tbody
      data-slot="table-body"
      className={cn("[&_tr:last-child]:border-0", className)}
      {...props}
    />
  );
}

function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
  return (
    <tr
      data-slot="table-row"
      className={cn(
        "hover:bg-muted/50 data-[state=selected]:bg-muted border-b transition-colors",
        className
      )}
      {...props}
    />
  );
}

/** Sort state for a sortable column header. */
type SortDirection = "asc" | "desc" | false;

function ariaSort(dir: SortDirection): React.AriaAttributes["aria-sort"] {
  if (dir === "asc") return "ascending";
  if (dir === "desc") return "descending";
  return "none";
}

function SortIcon({ direction }: { direction: SortDirection }) {
  if (direction === "asc")
    return <ChevronUp className="size-3.5 shrink-0" aria-hidden />;
  if (direction === "desc")
    return <ChevronDown className="size-3.5 shrink-0" aria-hidden />;
  return (
    <ArrowUpDown
      className="size-3.5 shrink-0 opacity-50 transition-opacity group-hover:opacity-100"
      aria-hidden
    />
  );
}

function TableHead({
  className,
  numeric = false,
  align,
  sortable = false,
  sortDirection = false,
  children,
  onClick,
  ...props
}: React.ComponentProps<"th"> & {
  /** Right-align + tabular-nums for numeric columns. */
  numeric?: boolean;
  /** Explicit alignment; overrides `numeric`'s default right-align. */
  align?: "left" | "center" | "right";
  /**
   * Render a sort affordance (chevron) and set `aria-sort`. Wire `onClick`
   * (or wrap the cell in a link/form) to actually re-order the data.
   */
  sortable?: boolean;
  /** Current sort direction: "asc" | "desc" | false (unsorted). */
  sortDirection?: SortDirection;
}) {
  const resolvedAlign = align ?? (numeric ? "right" : "left");

  return (
    <th
      data-slot="table-head"
      aria-sort={sortable ? ariaSort(sortDirection) : props["aria-sort"]}
      className={cn(
        // Deck header band: filled surface-2, uppercase micro-label, tracked.
        "text-muted-foreground bg-surface-2 h-10 px-4 align-middle text-[11px] font-semibold tracking-wider whitespace-nowrap uppercase",
        resolvedAlign === "right" && "text-right",
        resolvedAlign === "center" && "text-center",
        resolvedAlign === "left" && "text-left",
        numeric && "tabular-nums",
        sortable &&
          "hover:text-foreground group cursor-pointer select-none transition-colors",
        className
      )}
      onClick={onClick}
      {...props}
    >
      {sortable ? (
        <span
          className={cn(
            "inline-flex items-center gap-1.5",
            resolvedAlign === "right" && "flex-row-reverse",
            resolvedAlign === "center" && "justify-center"
          )}
        >
          {children}
          <SortIcon direction={sortDirection} />
        </span>
      ) : (
        children
      )}
    </th>
  );
}

function TableCell({
  className,
  numeric = false,
  align,
  ...props
}: React.ComponentProps<"td"> & {
  /** Right-align + tabular-nums for numeric values (money, counts). */
  numeric?: boolean;
  /** Explicit alignment; overrides `numeric`'s default right-align. */
  align?: "left" | "center" | "right";
}) {
  const resolvedAlign = align ?? (numeric ? "right" : undefined);

  return (
    <td
      data-slot="table-cell"
      className={cn(
        "px-4 py-3 align-middle",
        resolvedAlign === "right" && "text-right",
        resolvedAlign === "center" && "text-center",
        resolvedAlign === "left" && "text-left",
        numeric && "tabular-nums",
        className
      )}
      {...props}
    />
  );
}

/**
 * TableSortButton — a standalone sortable-header trigger for when a `<TableHead>`
 * needs to wrap a real `<button>` (e.g. server-action / router-driven sorting)
 * rather than rely on the `sortable` prop's cell-level click. Renders the label
 * plus a direction-aware chevron; caller owns the click handler.
 *
 *   <TableHead>
 *     <TableSortButton direction={dir} onClick={() => toggle("name")}>
 *       Name
 *     </TableSortButton>
 *   </TableHead>
 */
function TableSortButton({
  className,
  direction = false,
  align = "left",
  children,
  ...props
}: React.ComponentProps<"button"> & {
  direction?: SortDirection;
  align?: "left" | "center" | "right";
}) {
  return (
    <button
      type="button"
      data-slot="table-sort-button"
      aria-label={typeof children === "string" ? `Sort by ${children}` : undefined}
      className={cn(
        "text-muted-foreground hover:text-foreground group focus-visible:focus-ring inline-flex items-center gap-1.5 rounded-sm text-[11px] font-semibold tracking-wider uppercase transition-colors outline-none",
        align === "right" && "flex-row-reverse",
        align === "center" && "justify-center",
        className
      )}
      {...props}
    >
      {children}
      <SortIcon direction={direction} />
    </button>
  );
}

export {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  TableSortButton,
};
export type { SortDirection };
