"use server";

import { revalidatePath } from "next/cache";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { generateObject, generateText, type LanguageModel } from "ai";
import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";
import type { ActionResult } from "@/lib/actions/types";
import { db } from "@/lib/db";
import { requireAgencyUser } from "@/lib/permissions";
import { booking, bookingDay } from "@/lib/schema";

/**
 * Gemini models tried in order. Each free-tier model has its OWN rate/quota
 * bucket, so when the primary is throttled the call rolls over to the next
 * Gemini model before ever leaving the provider. The primary is configurable
 * via GEMINI_MODEL; the rest are lighter flash models that share the same key.
 */
const GEMINI_FALLBACK_CHAIN = [
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
  "gemini-2.0-flash",
];

/**
 * Ordered list of AI models to try. Google Gemini first — the primary model,
 * then its lighter siblings as free-tier-quota fallbacks — then OpenRouter if a
 * key is configured. Every candidate is attempted in turn by `withAiFallback`,
 * so a throttled/failed model transparently rolls over to the next.
 */
function aiModels(): LanguageModel[] {
  const models: LanguageModel[] = [];

  const geminiKey = process.env.GEMINI_API_KEY;
  if (geminiKey) {
    const google = createGoogleGenerativeAI({ apiKey: geminiKey });
    const primary = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";
    const chain = [...new Set([primary, ...GEMINI_FALLBACK_CHAIN])];
    for (const id of chain) models.push(google(id));
  }

  const openrouterKey = process.env.OPENROUTER_API_KEY;
  if (openrouterKey) {
    const openrouter = createOpenRouter({ apiKey: openrouterKey });
    models.push(openrouter(process.env.OPENROUTER_MODEL ?? "openai/gpt-4.1-mini"));
  }

  if (models.length === 0) {
    throw new Error(
      "No AI provider configured. Set GEMINI_API_KEY (primary) or OPENROUTER_API_KEY (fallback)."
    );
  }
  return models;
}

/**
 * Run an AI SDK call against the primary model, transparently falling back to the
 * next configured provider if it throws (rate limit, quota, transient error, …).
 */
async function withAiFallback<T>(
  run: (model: LanguageModel) => Promise<T>
): Promise<T> {
  const models = aiModels();
  let lastError: unknown;
  for (let i = 0; i < models.length; i++) {
    try {
      return await run(models[i]!);
    } catch (error) {
      lastError = error;
      if (i < models.length - 1) {
        console.warn(
          `AI provider ${i + 1}/${models.length} failed; falling back to the next.`,
          error instanceof Error ? error.message : error
        );
      }
    }
  }
  throw lastError;
}

// ---------------------------------------------------------------------------
// 1. Generate itinerary
// ---------------------------------------------------------------------------

const itinerarySchema = z.object({
  days: z.array(
    z.object({
      dayIndex: z.number().int().min(0),
      title: z.string().max(120),
      notes: z.string().max(600),
    })
  ),
});

/**
 * Generate a day-by-day itinerary from the booking's items and save it to
 * booking_day rows (upsert: existing custom titles are overwritten).
 */
export async function generateItinerary(
  bookingId: string
): Promise<ActionResult<{ dayCount: number }>> {
  const user = await requireAgencyUser();

  const b = await db.query.booking.findFirst({
    where: and(eq(booking.id, bookingId), eq(booking.agencyId, user.agencyId)),
    with: { items: { orderBy: (t) => [asc(t.sortOrder)] } },
  });
  if (!b) return { ok: false, error: "Booking not found." };
  if (b.items.length === 0) {
    return { ok: false, error: "Add at least one flight or hotel before generating an itinerary." };
  }

  const itemsSummary = b.items
    .map((i) => `Day index ${i.dayIndex ?? "?"}: ${i.type} — ${i.title}${i.supplier ? ` (${i.supplier})` : ""}${i.startDate ? ` on ${new Date(i.startDate).toDateString()}` : ""}`)
    .join("\n");

  const departStr = b.departDate ? new Date(b.departDate).toDateString() : "unknown";
  const returnStr = b.returnDate ? new Date(b.returnDate).toDateString() : "unknown";

  try {
    const { object } = await withAiFallback((m) => generateObject({
      model: m,
      schema: itinerarySchema,
      prompt: `You are a travel itinerary writer for a professional travel agency.

Booking: "${b.destination ?? "unknown destination"}"
Departure: ${departStr} | Return: ${returnStr}

Booking items:
${itemsSummary}

Write a concise day-by-day itinerary. Each day should have:
- dayIndex: integer starting at 0 for the departure day
- title: short title e.g. "Departure · Paris → Marrakech"
- notes: 1–3 sentences describing the day's programme, referencing the actual booking items

Only generate days that have activity. Keep notes professional and engaging.`,
    }));

    for (const day of object.days) {
      const existing = await db.query.bookingDay.findFirst({
        where: and(
          eq(bookingDay.bookingId, bookingId),
          eq(bookingDay.dayIndex, day.dayIndex)
        ),
      });
      if (existing) {
        await db
          .update(bookingDay)
          .set({ title: day.title, notes: day.notes })
          .where(eq(bookingDay.id, existing.id));
      } else {
        await db.insert(bookingDay).values({
          bookingId,
          dayIndex: day.dayIndex,
          title: day.title,
          notes: day.notes,
        });
      }
    }

    revalidatePath(`/bookings/${bookingId}/itinerary`);
    return { ok: true, data: { dayCount: object.days.length } };
  } catch (err) {
    console.error("generateItinerary failed", err);
    return { ok: false, error: "AI generation failed. Check that OPENROUTER_API_KEY is set." };
  }
}

// ---------------------------------------------------------------------------
// 2. Build quote (proposal line items)
// ---------------------------------------------------------------------------

const quoteSchema = z.object({
  title: z.string().max(120),
  destination: z.string().max(120).optional(),
  items: z.array(
    z.object({
      type: z.enum(["flight", "hotel", "activity", "transfer", "insurance", "other"]),
      title: z.string().max(200),
      supplier: z.string().max(120).optional(),
      quantity: z.number().int().min(1),
      unitCost: z.number().min(0),
      description: z.string().max(300).optional(),
    })
  ),
});

export type QuoteResult = z.infer<typeof quoteSchema>;

/**
 * Generate proposal line items from a natural-language brief.
 * Returns structured data for the UI to pre-fill the new-product form.
 */
export async function buildQuote(
  brief: string,
  currency: string,
  paxCount: number
): Promise<ActionResult<QuoteResult>> {
  await requireAgencyUser();

  if (!brief.trim()) return { ok: false, error: "Please describe the trip." };

  try {
    const { object } = await withAiFallback((m) => generateObject({
      model: m,
      schema: quoteSchema,
      prompt: `You are a travel agency quote builder.

Client brief: "${brief.trim()}"
Currency: ${currency}
Number of travellers: ${paxCount}

Build a realistic travel package quote. Return:
- title: a short package title
- destination: main destination
- items: list of line items (flights, hotels, transfers, activities, fees)
  - type: one of flight/hotel/activity/transfer/insurance/other
  - title: descriptive item name
  - supplier: likely supplier name (optional)
  - quantity: number of units (use ${paxCount} for per-person items, 1 for shared)
  - unitCost: estimated cost per unit in ${currency} (realistic market rates)
  - description: brief note (optional)

Use reasonable market estimates. Keep item titles concise and professional.`,
    }));

    return { ok: true, data: object };
  } catch (err) {
    console.error("buildQuote failed", err);
    return { ok: false, error: "AI generation failed. Check that OPENROUTER_API_KEY is set." };
  }
}

// ---------------------------------------------------------------------------
// 3. Draft email
// ---------------------------------------------------------------------------

export type EmailDraftResult = { subject: string; body: string };

/**
 * Draft a client email for a booking (confirmation, follow-up, reminder, custom).
 */
export async function draftEmail(
  bookingId: string,
  kind: "confirmation" | "voucher" | "followup" | "custom",
  customInstruction?: string
): Promise<ActionResult<EmailDraftResult>> {
  const user = await requireAgencyUser();

  const b = await db.query.booking.findFirst({
    where: and(eq(booking.id, bookingId), eq(booking.agencyId, user.agencyId)),
    with: {
      client: { columns: { name: true, email: true } },
      items: { orderBy: (t) => [asc(t.sortOrder)] },
      travellers: true,
    },
  });
  if (!b) return { ok: false, error: "Booking not found." };

  const clientName = b.client?.name ?? "Valued Client";
  const destination = b.destination ?? "your destination";
  const departStr = b.departDate ? new Date(b.departDate).toDateString() : "your departure date";
  const totalStr = b.totalAmount ? `${parseFloat(b.totalAmount).toLocaleString()} ${b.currency}` : "";

  const kindPrompt = {
    confirmation: `Write a warm booking confirmation email. Confirm the trip details, remind them to check their passport, and let them know the team will be in touch with tickets and documents.`,
    voucher: `Write an email attaching/accompanying the travel voucher for this booking. Mention the booking reference, destination, dates, and wish them a wonderful trip.`,
    followup: `Write a friendly follow-up email to check the client is happy with their upcoming trip. Mention the departure date and offer to answer any questions.`,
    custom: customInstruction ?? "Write a professional travel agency email for this booking.",
  }[kind];

  const itemsList = b.items
    .slice(0, 6)
    .map((i) => `- ${i.title} (${i.type})`)
    .join("\n");

  try {
    const { text } = await withAiFallback((m) => generateText({
      model: m,
      prompt: `You are writing on behalf of a professional travel agency.

Client: ${clientName}
Booking ref: ${b.reference}
Destination: ${destination}
Departure: ${departStr}
Total: ${totalStr}
Items:
${itemsList || "- (no items yet)"}

Task: ${kindPrompt}

Write ONLY the email in this format:
SUBJECT: <subject line>
---
<email body>

Keep it professional, warm, and concise (under 200 words). Use the client's first name.`,
    }));

    const [subjectLine, ...bodyLines] = text.split("\n---\n");
    const subject = (subjectLine ?? "").replace(/^SUBJECT:\s*/i, "").trim();
    const body = bodyLines.join("\n---\n").trim();

    if (!subject || !body) {
      return { ok: false, error: "Could not parse AI response. Try again." };
    }

    return { ok: true, data: { subject, body } };
  } catch (err) {
    console.error("draftEmail failed", err);
    return { ok: false, error: "AI generation failed. Check that OPENROUTER_API_KEY is set." };
  }
}

// ---------------------------------------------------------------------------
// 4. Visa requirements check
// ---------------------------------------------------------------------------

export type VisaResult = {
  destination: string;
  requirements: Array<{ nationality: string; summary: string }>;
  disclaimer: string;
};

/**
 * Check visa requirements for travellers on a booking.
 * Returns a per-nationality summary based on the AI's training data.
 */
export async function checkVisa(bookingId: string): Promise<ActionResult<VisaResult>> {
  const user = await requireAgencyUser();

  const b = await db.query.booking.findFirst({
    where: and(eq(booking.id, bookingId), eq(booking.agencyId, user.agencyId)),
    with: { travellers: true },
  });
  if (!b) return { ok: false, error: "Booking not found." };
  if (!b.destination) {
    return { ok: false, error: "Add a destination to the booking first." };
  }

  const nationalities = [
    ...new Set(
      b.travellers
        .map((t) => t.nationality)
        .filter((n): n is string => Boolean(n))
    ),
  ];

  if (nationalities.length === 0) {
    return {
      ok: false,
      error: "No nationalities found on travellers. Add passport details first.",
    };
  }

  const visaSchema = z.object({
    destination: z.string(),
    requirements: z.array(
      z.object({
        nationality: z.string(),
        summary: z.string().max(400),
      })
    ),
    disclaimer: z.string(),
  });

  try {
    const { object } = await withAiFallback((m) => generateObject({
      model: m,
      schema: visaSchema,
      prompt: `You are a travel visa information assistant for a professional travel agency.

Destination country: ${b.destination}
Traveller nationalities: ${nationalities.join(", ")}

For each nationality, provide:
- A concise visa requirement summary (e.g. "Visa on arrival available for up to 30 days. Passport must be valid for 6 months beyond entry.")
- Mention if a visa is required in advance, available on arrival, or not required.
- Note any key requirements (passport validity, return ticket, proof of funds).

Also provide a short disclaimer reminding agents to verify with official government sources.

Be accurate based on your training data. Use the country name from the destination field as-is.`,
    }));

    return { ok: true, data: object };
  } catch (err) {
    console.error("checkVisa failed", err);
    return { ok: false, error: "AI generation failed. Check that OPENROUTER_API_KEY is set." };
  }
}
