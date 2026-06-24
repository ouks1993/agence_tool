/**
 * Cross-tenant isolation harness (Wave 6).
 *
 * Seeds two full agencies (A and B) with rows in every tenant table + child
 * tables, then asserts that:
 *   1. Every agency-root query scoped to A excludes B's rows (and vice-versa).
 *   2. The exact `findFirst(id=B, agencyId=A)` pattern the actions/pages use
 *      returns nothing (no cross-tenant read by guessed id).
 *   3. Child rows can't be reached via the other agency's parent (the
 *      double-constraint pattern used by booking/product child mutations).
 *   4. References are unique PER agency — the same "BKG-5001" inserts cleanly
 *      into both agencies (would collide under the old global unique).
 *   5. The activity log and notifications are agency-scoped.
 *
 * Always cleans up its two test agencies (cascade) at the end.
 *
 * Run: npx tsx --env-file=.env scripts/test-tenant-isolation.ts
 */
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  agency,
  agencyInvite,
  activityLog,
  booking,
  bookingItem,
  client,
  notification,
  opportunity,
  product,
  user,
} from "@/lib/schema";

const TA = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const TB = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

const results: { name: string; pass: boolean }[] = [];
function check(name: string, pass: boolean) {
  results.push({ name, pass });
}

type Seeded = {
  clientId: string;
  oppId: string;
  productId: string;
  bookingId: string;
  bookingItemId: string;
};

async function seedAgency(id: string, slug: string): Promise<Seeded> {
  await db.insert(agency).values({ id, name: `Test ${slug}`, slug, status: "active" });
  await db.insert(user).values({
    id: `user-${slug}`,
    name: `Owner ${slug}`,
    email: `owner@${slug}.test`,
    agencyId: id,
    role: "admin",
  });
  const [c] = await db.insert(client).values({ agencyId: id, name: `Client ${slug}` }).returning();
  if (!c) throw new Error("seed: client insert failed");
  const [o] = await db
    .insert(opportunity)
    .values({ agencyId: id, title: `Opp ${slug}`, clientId: c.id })
    .returning();
  if (!o) throw new Error("seed: opportunity insert failed");
  // Same reference in both agencies — must be allowed (per-agency unique).
  const [p] = await db
    .insert(product)
    .values({ agencyId: id, reference: "PRD-5001", title: `Product ${slug}`, clientId: c.id })
    .returning();
  if (!p) throw new Error("seed: product insert failed");
  const [b] = await db
    .insert(booking)
    .values({ agencyId: id, reference: "BKG-5001", status: "confirmed", currency: "EUR" })
    .returning();
  if (!b) throw new Error("seed: booking insert failed");
  const [bi] = await db
    .insert(bookingItem)
    .values({ bookingId: b.id, type: "hotel", title: `Item ${slug}`, amount: "100", currency: "EUR" })
    .returning();
  if (!bi) throw new Error("seed: bookingItem insert failed");
  await db
    .insert(notification)
    .values({ agencyId: id, bookingId: b.id, recipient: `to@${slug}.test`, channel: "email" });
  await db
    .insert(activityLog)
    .values({ agencyId: id, userId: `user-${slug}`, action: "created", entityType: "booking", entityId: b.id });
  await db.insert(agencyInvite).values({
    agencyId: id,
    email: `invitee@${slug}.test`,
    role: "agent",
    token: `tok-${slug}`,
    expiresAt: new Date(Date.now() + 7 * 864e5),
  });
  return { clientId: c.id, oppId: o.id, productId: p.id, bookingId: b.id, bookingItemId: bi.id };
}

async function main() {
  // Clean any leftovers from a previous failed run.
  await db.delete(agency).where(eq(agency.id, TA));
  await db.delete(agency).where(eq(agency.id, TB));

  const a = await seedAgency(TA, "alpha");
  const b = await seedAgency(TB, "beta");

  check("per-agency reference: same PRD-5001 & BKG-5001 in both agencies", true); // seedAgency(B) didn't throw

  // 1. Agency-root list queries exclude the other agency's rows.
  const aClients = await db.query.client.findMany({ where: eq(client.agencyId, TA) });
  check("clients(A) excludes B's client", !aClients.some((x) => x.id === b.clientId));
  check("clients(A) includes A's own client", aClients.some((x) => x.id === a.clientId));

  const aOpps = await db.query.opportunity.findMany({ where: eq(opportunity.agencyId, TA) });
  check("opportunities(A) excludes B's opp", !aOpps.some((x) => x.id === b.oppId));

  const aProducts = await db.query.product.findMany({ where: eq(product.agencyId, TA) });
  check("products(A) excludes B's product", !aProducts.some((x) => x.id === b.productId));

  const aBookings = await db.query.booking.findMany({ where: eq(booking.agencyId, TA) });
  check("bookings(A) excludes B's booking", !aBookings.some((x) => x.id === b.bookingId));

  const aNotifs = await db.query.notification.findMany({ where: eq(notification.agencyId, TA) });
  check("notifications(A) excludes B's notification", aNotifs.every((n) => n.bookingId !== b.bookingId));

  const aActivity = await db.query.activityLog.findMany({ where: eq(activityLog.agencyId, TA) });
  check("activity(A) excludes B's activity", aActivity.every((x) => x.entityId !== b.bookingId));

  const aInvites = await db.query.agencyInvite.findMany({ where: eq(agencyInvite.agencyId, TA) });
  check("invites(A) excludes B's invite", aInvites.every((i) => i.token !== "tok-beta"));

  const aTeam = await db.query.user.findMany({ where: eq(user.agencyId, TA) });
  check("team(A) excludes B's user", !aTeam.some((u) => u.id === "user-beta"));

  // 2. The detail-page / action pattern: findFirst(id = B's row, agencyId = A) => undefined.
  const leakBooking = await db.query.booking.findFirst({
    where: and(eq(booking.id, b.bookingId), eq(booking.agencyId, TA)),
  });
  check("findFirst(booking=B, agency=A) => undefined (no cross-tenant read by id)", leakBooking === undefined);

  const leakClient = await db.query.client.findFirst({
    where: and(eq(client.id, b.clientId), eq(client.agencyId, TA)),
  });
  check("findFirst(client=B, agency=A) => undefined", leakClient === undefined);

  const leakProduct = await db.query.product.findFirst({
    where: and(eq(product.id, b.productId), eq(product.agencyId, TA)),
  });
  check("findFirst(product=B, agency=A) => undefined", leakProduct === undefined);

  // 3. Child double-constraint: B's booking item can't be reached via A's booking id.
  const leakChild = await db.query.bookingItem.findFirst({
    where: and(eq(bookingItem.id, b.bookingItemId), eq(bookingItem.bookingId, a.bookingId)),
  });
  check("bookingItem(B child + A booking id) => undefined (child mutation guard)", leakChild === undefined);

  // Sanity: each agency CAN read its own.
  const ownBooking = await db.query.booking.findFirst({
    where: and(eq(booking.id, a.bookingId), eq(booking.agencyId, TA)),
  });
  check("findFirst(booking=A, agency=A) => found (own data still reachable)", ownBooking?.id === a.bookingId);

  // Cleanup (cascade removes all seeded rows).
  await db.delete(agency).where(eq(agency.id, TA));
  await db.delete(agency).where(eq(agency.id, TB));

  let ok = true;
  for (const r of results) {
    console.log(`${r.pass ? "PASS" : "FAIL"}  ${r.name}`);
    if (!r.pass) ok = false;
  }
  console.log(`\n${ok ? "✓ ALL TENANT-ISOLATION CHECKS PASSED" : "✗ ISOLATION FAILURES DETECTED"} (${results.filter((r) => r.pass).length}/${results.length})`);
  process.exit(ok ? 0 : 1);
}

main().catch(async (e) => {
  console.error("ERROR:", e instanceof Error ? e.message : e);
  try {
    await db.delete(agency).where(eq(agency.id, TA));
    await db.delete(agency).where(eq(agency.id, TB));
  } catch {}
  process.exit(1);
});
