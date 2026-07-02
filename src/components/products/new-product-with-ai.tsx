"use client";

import { useState } from "react";
import { AiQuoteBuilder } from "@/components/products/ai-quote-builder";
import { ProductForm } from "@/components/products/product-form";
import type { QuoteResult } from "@/lib/actions/ai";
import type { ClientOption, OpportunityOption } from "@/lib/queries";

type ProductFormInitial = React.ComponentProps<typeof ProductForm>["initial"];

/**
 * Wraps the new-proposal form with an AI quote builder. Accepting a generated
 * quote pre-fills the form's headline fields and lists the items in the summary;
 * the agent reviews them, then adds line items after creating the proposal.
 */
export function NewProductWithAi({
  clients,
  opportunities,
  agencyDepositPercent,
  initial,
}: {
  clients: ClientOption[];
  opportunities: OpportunityOption[];
  agencyDepositPercent: number;
  initial?: ProductFormInitial;
}) {
  const [formInitial, setFormInitial] = useState<ProductFormInitial>(initial);
  // Bump the key to remount ProductForm so it re-reads `initial` after a quote.
  const [formKey, setFormKey] = useState(0);

  const applyQuote = (quote: QuoteResult) => {
    const itemLines = quote.items
      .map((it) => `• ${it.title} — ${it.quantity} × ${it.unitCost.toLocaleString()}`)
      .join("\n");

    setFormInitial((prev) => ({
      ...prev,
      title: quote.title,
      ...(quote.destination ? { destination: quote.destination } : {}),
      summary: itemLines,
    }));
    setFormKey((k) => k + 1);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <AiQuoteBuilder onQuote={applyQuote} />
      </div>
      <ProductForm
        key={formKey}
        mode="create"
        clients={clients}
        opportunities={opportunities}
        agencyDepositPercent={agencyDepositPercent}
        {...(formInitial ? { initial: formInitial } : {})}
      />
    </div>
  );
}
