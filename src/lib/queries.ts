import { asc, desc, eq, ne } from "drizzle-orm";
import { db } from "@/lib/db";
import { booking, client, opportunity, product, user } from "@/lib/schema";

export type TeamMember = {
  id: string;
  name: string;
  email: string;
  role: string;
  active: boolean;
  image: string | null;
};

/** All active team members, for assignment/owner dropdowns. */
export async function listTeamMembers(): Promise<TeamMember[]> {
  return db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      active: user.active,
      image: user.image,
    })
    .from(user)
    .where(eq(user.active, true))
    .orderBy(asc(user.name));
}

export type ClientOption = { id: string; name: string };

/** Minimal client list for pickers. */
export async function listClientOptions(): Promise<ClientOption[]> {
  return db
    .select({ id: client.id, name: client.name })
    .from(client)
    .orderBy(asc(client.name));
}

export type OpportunityOption = { id: string; title: string };

/** Opportunity list for pickers (optionally filtered to one client). */
export async function listOpportunityOptions(
  clientId?: string
): Promise<OpportunityOption[]> {
  return db
    .select({ id: opportunity.id, title: opportunity.title })
    .from(opportunity)
    .where(clientId ? eq(opportunity.clientId, clientId) : undefined)
    .orderBy(desc(opportunity.updatedAt))
    .limit(100);
}

export type BookingOption = { id: string; label: string };

/** Active (non-cancelled) bookings, for the "add to booking" picker. */
export async function listOpenBookings(): Promise<BookingOption[]> {
  const rows = await db
    .select({
      id: booking.id,
      reference: booking.reference,
      destination: booking.destination,
    })
    .from(booking)
    .where(ne(booking.status, "cancelled"))
    .orderBy(desc(booking.createdAt))
    .limit(50);
  return rows.map((r) => ({
    id: r.id,
    label: `${r.reference}${r.destination ? ` · ${r.destination}` : ""}`,
  }));
}

export type DraftOption = { id: string; label: string };

/** Draft proposals, for the "add to proposal" picker. */
export async function listDraftProposals(): Promise<DraftOption[]> {
  const rows = await db
    .select({
      id: product.id,
      reference: product.reference,
      title: product.title,
    })
    .from(product)
    .where(eq(product.status, "draft"))
    .orderBy(desc(product.createdAt))
    .limit(50);
  return rows.map((r) => ({ id: r.id, label: `${r.reference} · ${r.title}` }));
}
