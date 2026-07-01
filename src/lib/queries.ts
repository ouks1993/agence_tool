import { and, asc, count, desc, eq, ne } from "drizzle-orm";
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

/** All active team members in the agency, for assignment/owner dropdowns. */
export async function listTeamMembers(agencyId: string): Promise<TeamMember[]> {
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
    .where(and(eq(user.agencyId, agencyId), eq(user.active, true)))
    .orderBy(asc(user.name));
}

export type ClientOption = { id: string; name: string };

/** Minimal client list for pickers. */
export async function listClientOptions(
  agencyId: string
): Promise<ClientOption[]> {
  return db
    .select({ id: client.id, name: client.name })
    .from(client)
    .where(eq(client.agencyId, agencyId))
    .orderBy(asc(client.name));
}

export type OpportunityOption = { id: string; title: string };

/** Opportunity list for pickers (optionally filtered to one client). */
export async function listOpportunityOptions(
  agencyId: string,
  clientId?: string
): Promise<OpportunityOption[]> {
  return db
    .select({ id: opportunity.id, title: opportunity.title })
    .from(opportunity)
    .where(
      clientId
        ? and(
            eq(opportunity.agencyId, agencyId),
            eq(opportunity.clientId, clientId)
          )
        : eq(opportunity.agencyId, agencyId)
    )
    .orderBy(desc(opportunity.updatedAt))
    .limit(100);
}

export type BookingOption = { id: string; label: string };

/** Active (non-cancelled) bookings, for the "add to booking" picker. */
export async function listOpenBookings(
  agencyId: string
): Promise<BookingOption[]> {
  const rows = await db
    .select({
      id: booking.id,
      reference: booking.reference,
      destination: booking.destination,
    })
    .from(booking)
    .where(and(eq(booking.agencyId, agencyId), ne(booking.status, "cancelled")))
    .orderBy(desc(booking.createdAt))
    .limit(50);
  return rows.map((r) => ({
    id: r.id,
    label: `${r.reference}${r.destination ? ` · ${r.destination}` : ""}`,
  }));
}

export type DraftOption = { id: string; label: string };

/** Draft proposals, for the "add to proposal" picker. */
export async function listDraftProposals(
  agencyId: string
): Promise<DraftOption[]> {
  const rows = await db
    .select({
      id: product.id,
      reference: product.reference,
      title: product.title,
    })
    .from(product)
    .where(and(eq(product.agencyId, agencyId), eq(product.status, "draft")))
    .orderBy(desc(product.createdAt))
    .limit(50);
  return rows.map((r) => ({ id: r.id, label: `${r.reference} · ${r.title}` }));
}

/** Live nav count badges for the app shell — cheap COUNT(*) queries only. */
export async function getShellNavCounts(
  agencyId: string
): Promise<{ proposals: number; bookings: number }> {
  const [proposals, bookings] = await Promise.all([
    db
      .select({ n: count() })
      .from(product)
      .where(and(eq(product.agencyId, agencyId), eq(product.status, "draft"))),
    db
      .select({ n: count() })
      .from(booking)
      .where(
        and(eq(booking.agencyId, agencyId), ne(booking.status, "cancelled"))
      ),
  ]);
  return {
    proposals: proposals[0]?.n ?? 0,
    bookings: bookings[0]?.n ?? 0,
  };
}

/** Recent proposals (any status) for the command-palette jump list. */
export async function listProposalOptions(
  agencyId: string
): Promise<{ id: string; label: string }[]> {
  const rows = await db
    .select({
      id: product.id,
      reference: product.reference,
      title: product.title,
    })
    .from(product)
    .where(eq(product.agencyId, agencyId))
    .orderBy(desc(product.createdAt))
    .limit(50);
  return rows.map((r) => ({ id: r.id, label: `${r.reference} · ${r.title}` }));
}
