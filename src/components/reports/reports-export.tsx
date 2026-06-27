"use client";

import { useState } from "react";
import { Download, FileSpreadsheet, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Mirrors the server DATASETS registry (kept in sync manually — small list).
const DATASETS: { key: string; label: string; description: string }[] = [
  { key: "clients", label: "Clients", description: "All client records with source, industry, country" },
  { key: "opportunities", label: "Opportunities", description: "Pipeline deals, stage, value, purpose" },
  { key: "bookings", label: "Bookings", description: "Trips with status, totals, paid & balance" },
  { key: "booking_items", label: "Booking items", description: "Line-level services per booking" },
  { key: "travellers", label: "Travellers", description: "Passengers, nationality, passport" },
  { key: "payments", label: "Payments", description: "All recorded payments" },
  { key: "commissions", label: "Commissions", description: "Supplier & agent commission ledger" },
  { key: "suppliers", label: "Suppliers", description: "Supplier directory" },
];

export function ReportsExport() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const href = (key: string, format: "csv" | "xlsx") => {
    const q = new URLSearchParams({ format });
    if (from) q.set("from", from);
    if (to) q.set("to", to);
    return `/api/export/${key}?${q.toString()}`;
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="flex flex-wrap items-end gap-4 p-4">
          <div className="space-y-1.5">
            <Label htmlFor="from" className="text-xs">From (optional)</Label>
            <Input id="from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-44" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="to" className="text-xs">To (optional)</Label>
            <Input id="to" type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-44" />
          </div>
          <Button asChild className="ms-auto">
            <a href={href("workbook", "xlsx")} download>
              <Download className="mr-2 size-4" /> Full Excel workbook
            </a>
          </Button>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {DATASETS.map((d) => (
          <Card key={d.key}>
            <CardContent className="flex items-center justify-between gap-4 p-4">
              <div className="min-w-0">
                <p className="font-medium">{d.label}</p>
                <p className="text-muted-foreground truncate text-xs">{d.description}</p>
              </div>
              <div className="flex shrink-0 gap-2">
                <Button asChild variant="outline" size="sm">
                  <a href={href(d.key, "csv")} download>
                    <FileText className="mr-1.5 size-3.5" /> CSV
                  </a>
                </Button>
                <Button asChild variant="outline" size="sm">
                  <a href={href(d.key, "xlsx")} download>
                    <FileSpreadsheet className="mr-1.5 size-3.5" /> Excel
                  </a>
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <p className="text-muted-foreground text-xs">
        Every classification field is exported as both a <code>*_code</code> column (stable, for
        Power BI / SQL joins) and a <code>*_label</code> column (human-readable). Amounts are in DZD.
        The date range filters by record creation date where applicable.
      </p>
    </div>
  );
}
