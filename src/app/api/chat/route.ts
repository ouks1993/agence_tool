import { headers } from "next/headers";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import {
  streamText,
  UIMessage,
  convertToModelMessages,
  tool,
  stepCountIs,
} from "ai";
import { desc, ilike } from "drizzle-orm";
import { z } from "zod";
import { createBooking, addBookingItem, addTraveller } from "@/lib/actions/bookings";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { client as clientTable, booking as bookingTable } from "@/lib/schema";
import { safeSearch, type FlightOffer, type HotelOffer } from "@/lib/suppliers";

const messagePartSchema = z.object({
  type: z.string(),
  text: z.string().max(10000, "Message text too long").optional(),
});

const messageSchema = z.object({
  id: z.string().optional(),
  role: z.enum(["user", "assistant", "system"]),
  parts: z.array(messagePartSchema).optional(),
  content: z.union([z.string(), z.array(messagePartSchema)]).optional(),
});

const chatRequestSchema = z.object({
  messages: z.array(messageSchema).max(100, "Too many messages"),
});

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return jsonError("Unauthorized", 401);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid JSON", 400);
  }

  const parsed = chatRequestSchema.safeParse(body);
  if (!parsed.success) {
    return new Response(
      JSON.stringify({ error: "Invalid request", details: parsed.error.flatten().fieldErrors }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const { messages }: { messages: UIMessage[] } = parsed.data as { messages: UIMessage[] };

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return jsonError("OpenRouter API key not configured", 500);
  }

  const openrouter = createOpenRouter({ apiKey });
  const today = new Date().toISOString().slice(0, 10);

  const result = streamText({
    model: openrouter(process.env.OPENROUTER_MODEL || "openai/gpt-5-mini"),
    system: SYSTEM_PROMPT(today, session.user.name),
    messages: convertToModelMessages(messages),
    stopWhen: stepCountIs(6),
    tools: {
      searchFlights: tool({
        description:
          "Search flights between two airports/cities. Use IATA codes (e.g. CDG, RAK). Returns the cheapest options with prices.",
        inputSchema: z.object({
          origin: z.string().describe("Origin IATA code, e.g. CDG"),
          destination: z.string().describe("Destination IATA code, e.g. RAK"),
          departDate: z.string().describe("Departure date yyyy-mm-dd"),
          returnDate: z.string().optional().describe("Return date yyyy-mm-dd for round trips"),
          adults: z.number().int().min(1).max(9).default(1),
          cabin: z.enum(["economy", "premium", "business", "first"]).optional(),
        }),
        execute: async (a) => {
          const params = { ...a, currency: "EUR" };
          const { results, source } = await safeSearch<FlightOffer>(
            (p) => p.searchFlights(params),
            (m) => m.searchFlights(params)
          );
          return {
            source,
            offers: results.slice(0, 5).map((o) => ({
              airline: o.airlineName,
              price: o.priceTotal,
              currency: o.currency,
              cabin: o.cabin,
              stops: o.stops,
              durationMinutes: o.durationMinutes,
            })),
          };
        },
      }),

      searchHotels: tool({
        description:
          "Search hotels in a city for given dates. Returns options sorted by price with star ratings.",
        inputSchema: z.object({
          city: z.string().describe("City name, e.g. Marrakech"),
          checkIn: z.string().describe("Check-in date yyyy-mm-dd"),
          checkOut: z.string().describe("Check-out date yyyy-mm-dd"),
          adults: z.number().int().min(1).max(9).default(2),
          rooms: z.number().int().min(1).max(9).default(1),
        }),
        execute: async (a) => {
          const params = { ...a, currency: "EUR" };
          const { results, source } = await safeSearch<HotelOffer>(
            (p) => p.searchHotels(params),
            (m) => m.searchHotels(params)
          );
          return {
            source,
            hotels: results.slice(0, 6).map((h) => ({
              name: h.name,
              stars: h.stars,
              pricePerNight: h.pricePerNight,
              priceTotal: h.priceTotal,
              currency: h.currency,
              board: h.boardType,
              nights: h.nights,
            })),
          };
        },
      }),

      findClients: tool({
        description: "Look up clients in the agency CRM by name (or list recent clients).",
        inputSchema: z.object({
          query: z.string().optional().describe("Name to search for"),
        }),
        execute: async (a) => {
          const rows = await db
            .select({ id: clientTable.id, name: clientTable.name, email: clientTable.email })
            .from(clientTable)
            .where(a.query ? ilike(clientTable.name, `%${a.query}%`) : undefined)
            .orderBy(desc(clientTable.updatedAt))
            .limit(10);
          return { clients: rows };
        },
      }),

      bookingsSummary: tool({
        description: "Get a summary of bookings: counts by status and total value.",
        inputSchema: z.object({}),
        execute: async () => {
          const rows = await db
            .select({ status: bookingTable.status, total: bookingTable.totalAmount })
            .from(bookingTable);
          const byStatus: Record<string, number> = {};
          let activeValue = 0;
          for (const r of rows) {
            byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;
            if (r.status !== "cancelled") activeValue += parseFloat(r.total || "0");
          }
          return { totalBookings: rows.length, byStatus, activeValueEUR: activeValue };
        },
      }),

      createBooking: tool({
        description:
          "Create a booking file from purchased items (flights, hotels, excursions, fees) and optional travellers. Returns a link the agent can open. Only create when the agent explicitly asks to build/save a booking.",
        inputSchema: z.object({
          clientId: z.string().optional().describe("Client id from findClients, if known"),
          destination: z.string().optional(),
          currency: z.string().default("EUR"),
          travellers: z
            .array(
              z.object({
                fullName: z.string(),
                passportNumber: z.string().optional(),
                nationality: z.string().optional(),
              })
            )
            .optional(),
          items: z
            .array(
              z.object({
                type: z.enum([
                  "flight",
                  "hotel",
                  "transfer",
                  "excursion",
                  "insurance",
                  "fee",
                  "other",
                ]),
                title: z.string(),
                supplier: z.string().optional(),
                quantity: z.number().int().min(1).default(1),
                amount: z.number().min(0),
                description: z.string().optional(),
              })
            )
            .min(1),
        }),
        execute: async (a) => {
          const created = await createBooking({
            clientId: a.clientId,
            destination: a.destination,
            currency: a.currency,
          });
          if (!created.ok || !created.data) {
            return { ok: false, error: created.ok ? "Failed" : created.error };
          }
          for (const t of a.travellers ?? []) {
            await addTraveller(created.data.id, t);
          }
          for (const item of a.items) {
            await addBookingItem(created.data.id, { ...item, currency: a.currency });
          }
          return {
            ok: true,
            bookingId: created.data.id,
            url: `/bookings/${created.data.id}`,
            message: "Booking created. Open it to add passport details and confirm.",
          };
        },
      }),
    },
  });

  return (
    result as unknown as { toUIMessageStreamResponse: () => Response }
  ).toUIMessageStreamResponse();
}

function jsonError(error: string, status: number): Response {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function SYSTEM_PROMPT(today: string, agentName: string): string {
  return `You are the AI assistant inside Atlas, a travel agency management tool. You help travel agents (you are currently helping ${agentName}) plan trips, source flights and hotels, gather and compare prices, build itineraries, and assemble booking files.

Today's date is ${today}. All prices are in EUR unless stated otherwise.

You can:
- Search flights and hotels with the search tools and compare prices for the agent.
- Build multi-day itineraries: suggest flights, hotels and excursions that fit the client's brief and budget.
- Look up clients and summarise bookings.
- Create a booking file with createBooking when the agent asks to build/save one (flights, hotels, excursions and fees, plus any travellers).

Guidelines:
- When searching, infer sensible IATA codes from city names (e.g. Marrakech -> RAK, Paris -> CDG) but state the codes you used.
- Always show prices clearly and call out the best value. The search results may come from sample data — if so, mention that the figures are indicative.
- Be concise and practical, like a knowledgeable colleague. Use markdown (tables, bullets) for itineraries and options.
- Never invent supplier confirmations or PNRs — you assemble the booking; the agent confirms and collects passport details. Only create a booking when explicitly asked.`;
}
