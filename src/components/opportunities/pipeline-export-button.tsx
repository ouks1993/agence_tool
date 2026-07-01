"use client";

import { Download } from "lucide-react";
import type { BoardItem } from "@/components/opportunities/pipeline-board";
import { Button } from "@/components/ui/button";
import { OPPORTUNITY_STAGE_META, type OpportunityStage } from "@/lib/domain";

/** Escapes a value for CSV (wraps in quotes, doubles inner quotes). */
function csvCell(value: string | number | null | undefined): string {
  const s = value == null ? "" : String(value);
  return `"${s.replace(/"/g, '""')}"`;
}

/**
 * Client-side CSV export of the currently-loaded pipeline. Derives every column
 * from the real BoardItem data (no fabrication) and never mixes currencies —
 * each row keeps its own currency code alongside its value.
 */
export function PipelineExportButton({ items }: { items: BoardItem[] }) {
  const onExport = () => {
    const header = [
      "Title",
      "Client",
      "Stage",
      "Value",
      "Currency",
      "Probability %",
      "Destination",
      "Owner",
      "Expected close",
    ];
    const lines = items.map((i) =>
      [
        i.title,
        i.clientName ?? "",
        OPPORTUNITY_STAGE_META[i.stage as OpportunityStage]?.label ?? i.stage,
        i.value,
        i.currency,
        i.probability,
        i.destination ?? "",
        i.assigneeName ?? "",
        i.expectedCloseDate
          ? new Date(i.expectedCloseDate).toISOString().slice(0, 10)
          : "",
      ]
        .map(csvCell)
        .join(",")
    );
    const csv = [header.map(csvCell).join(","), ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pipeline-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Button variant="outline" size="sm" onClick={onExport} disabled={items.length === 0}>
      <Download className="mr-2 size-4" />
      Export
    </Button>
  );
}
