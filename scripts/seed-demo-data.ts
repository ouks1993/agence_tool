/**
 * Seeds the Demo Agency with a rich, realistic dataset for customer demos.
 *
 * Idempotent: wipes the Demo Agency's business data (clients, opportunities,
 * products, bookings + children, payments, activity) — but KEEPS the agency and
 * its users — then reseeds a curated set. Safe to re-run to reset before a demo.
 *
 * Run: npx tsx --env-file=.env scripts/seed-demo-data.ts
 */
import { eq, inArray } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  account,
  activityLog,
  booking,
  bookingDay,
  bookingItem,
  bookingTraveller,
  client,
  clientContact,
  opportunity,
  payment,
  product,
  productItem,
  user,
} from "@/lib/schema";

const DEMO = "00000000-0000-0000-0000-000000000001";
const DAY = 864e5;
const now = Date.now();
const d = (offsetDays: number) => new Date(now + offsetDays * DAY);
const money = (n: number) => n.toFixed(2);
const pick = <T,>(arr: T[], i: number): T => arr[i % arr.length]!;

async function main() {
  // --- 1. Ensure a full team (keep existing manager/finance/support, add agents) ---
  const ctx = await (auth as any).$context;
  const agents = [
    { email: "karim@demo.test", name: "Karim Haddad" },
    { email: "lina@demo.test", name: "Lina Cherif" },
    { email: "omar@demo.test", name: "Omar Belkacem" },
  ];
  for (const a of agents) {
    let u = await db.query.user.findFirst({ where: eq(user.email, a.email), columns: { id: true } });
    if (!u) {
      const id = crypto.randomUUID();
      await db.insert(user).values({ id, name: a.name, email: a.email, agencyId: DEMO, role: "agent", emailVerified: true });
      u = { id };
    } else {
      await db.update(user).set({ agencyId: DEMO, role: "agent", active: true }).where(eq(user.id, u.id));
    }
    const hash = await ctx.password.hash("Agent!2026");
    const cred = await db.query.account.findFirst({ where: eq(account.userId, u.id), columns: { id: true } });
    if (cred) await db.update(account).set({ password: hash }).where(eq(account.id, cred.id));
    else await db.insert(account).values({ id: crypto.randomUUID(), accountId: u.id, providerId: "credential", userId: u.id, password: hash });
  }

  const team = await db.query.user.findMany({ where: eq(user.agencyId, DEMO), columns: { id: true, name: true, role: true } });
  const byRole = (r: string) => team.find((t) => t.role === r)?.id ?? team[0]!.id;
  const manager = byRole("manager");
  const agentIds = team.filter((t) => t.role === "agent").map((t) => t.id);
  const sellers = [...agentIds, manager];
  const seller = (i: number) => pick(sellers, i);

  // --- 2. Wipe existing Demo Agency business data (cascades clear children) ---
  await db.delete(booking).where(eq(booking.agencyId, DEMO));
  await db.delete(product).where(eq(product.agencyId, DEMO));
  await db.delete(opportunity).where(eq(opportunity.agencyId, DEMO));
  await db.delete(client).where(eq(client.agencyId, DEMO));
  await db.delete(activityLog).where(eq(activityLog.agencyId, DEMO));

  // --- 3. Clients ---
  const clientSpecs = [
    { name: "Amine & Sara Benali", type: "individual", status: "active", city: "Algiers", country: "Algeria", email: "benali.family@example.com", phone: "+213 555 102 003", source: "referral" },
    { name: "Claire Dubois", type: "individual", status: "active", city: "Lyon", country: "France", email: "claire.dubois@example.fr", phone: "+33 6 12 44 88 21", source: "website" },
    { name: "James Carter", type: "individual", status: "active", city: "London", country: "United Kingdom", email: "j.carter@example.co.uk", phone: "+44 7700 900123", source: "website" },
    { name: "Sofia Rossi", type: "individual", status: "lead", city: "Milan", country: "Italy", email: "sofia.rossi@example.it", phone: "+39 333 778 1200", source: "instagram" },
    { name: "Hassan El Amrani", type: "individual", status: "active", city: "Casablanca", country: "Morocco", email: "h.elamrani@example.ma", phone: "+212 661 223 344", source: "walk-in" },
    { name: "Thomas Müller", type: "individual", status: "inactive", city: "Munich", country: "Germany", email: "t.mueller@example.de", phone: "+49 151 23456789", source: "referral" },
    { name: "Aisha Khan", type: "individual", status: "lead", city: "Dubai", country: "UAE", email: "aisha.khan@example.ae", phone: "+971 50 123 4567", source: "website" },
    { name: "Atlas Tech SARL", type: "corporate", status: "active", company: "Atlas Tech SARL", city: "Algiers", country: "Algeria", email: "travel@atlastech.dz", phone: "+213 770 998 100", source: "outbound" },
    { name: "Médina Hospitality Group", type: "corporate", status: "active", company: "Médina Hospitality", city: "Marrakech", country: "Morocco", email: "events@medinahg.ma", phone: "+212 524 100 200", source: "referral" },
    { name: "Sahara Logistics", type: "corporate", status: "lead", company: "Sahara Logistics", city: "Tunis", country: "Tunisia", email: "ops@saharalog.tn", phone: "+216 71 800 900", source: "event" },
    { name: "Le Comptoir du Voyage", type: "corporate", status: "active", company: "Le Comptoir", city: "Paris", country: "France", email: "groupes@comptoir.fr", phone: "+33 1 80 04 22 10", source: "partner" },
    { name: "Nadia Bensalah", type: "individual", status: "active", city: "Oran", country: "Algeria", email: "nadia.bensalah@example.com", phone: "+213 556 700 800", source: "referral" },
  ];
  const clientIds: string[] = [];
  for (let i = 0; i < clientSpecs.length; i++) {
    const s = clientSpecs[i]!;
    const [row] = await db.insert(client).values({
      agencyId: DEMO,
      name: s.name,
      type: s.type,
      status: s.status,
      email: s.email,
      phone: s.phone,
      company: (s as any).company ?? null,
      city: s.city,
      country: s.country,
      source: s.source,
      ownerId: seller(i),
      createdById: seller(i),
      createdAt: d(-150 + i * 9),
    }).returning();
    clientIds.push(row!.id);
    if (s.type === "corporate") {
      await db.insert(clientContact).values({
        clientId: row!.id,
        name: ["Lead Coordinator", "Travel Manager", "Office Manager"][i % 3]!,
        jobTitle: "Travel Coordinator",
        email: s.email,
        phone: s.phone,
        isPrimary: true,
      });
    }
  }

  // --- 4. Opportunities (across pipeline stages) ---
  const oppSpecs = [
    { title: "Honeymoon — Maldives 10 nights", stage: "won", value: 8400, dest: "Maldives", pax: 2, prob: 100 },
    { title: "Family summer — Turkey", stage: "proposal", value: 5200, dest: "Istanbul, Turkey", pax: 4, prob: 60 },
    { title: "Corporate offsite — Barcelona", stage: "qualified", value: 18500, dest: "Barcelona, Spain", pax: 22, prob: 45 },
    { title: "City break — Rome", stage: "booked", value: 2300, dest: "Rome, Italy", pax: 2, prob: 90 },
    { title: "Safari — Cape Town & Kruger", stage: "lead", value: 11200, dest: "Cape Town, South Africa", pax: 2, prob: 20 },
    { title: "Group umrah package", stage: "proposal", value: 26000, dest: "Jeddah, Saudi Arabia", pax: 30, prob: 55 },
    { title: "Ski week — Swiss Alps", stage: "lost", value: 6900, dest: "Zermatt, Switzerland", pax: 4, prob: 0, lost: "Chose a competitor" },
    { title: "Anniversary — Santorini", stage: "won", value: 4700, dest: "Santorini, Greece", pax: 2, prob: 100 },
    { title: "Business trip — Dubai expo", stage: "qualified", value: 3800, dest: "Dubai, UAE", pax: 3, prob: 50 },
    { title: "Cultural tour — Japan", stage: "lead", value: 14500, dest: "Tokyo, Japan", pax: 2, prob: 15 },
  ];
  const currencies = ["EUR", "EUR", "EUR", "USD", "GBP", "EUR"];
  for (let i = 0; i < oppSpecs.length; i++) {
    const o = oppSpecs[i]!;
    await db.insert(opportunity).values({
      agencyId: DEMO,
      title: o.title,
      clientId: pick(clientIds, i + 1),
      stage: o.stage,
      value: money(o.value),
      currency: pick(currencies, i),
      probability: o.prob,
      destination: o.dest,
      travelStartDate: d(20 + i * 12),
      travelEndDate: d(27 + i * 12),
      paxCount: o.pax,
      expectedCloseDate: d(-10 + i * 6),
      lostReason: (o as any).lost ?? null,
      assignedToId: seller(i),
      createdById: seller(i),
      createdAt: d(-120 + i * 10),
    });
  }

  // --- 5. Products / proposals ---
  const productSpecs = [
    { title: "Maldives Overwater Escape", status: "accepted", dest: "Maldives", price: 8400, cost: 6900 },
    { title: "Istanbul Family Discovery", status: "sent", dest: "Istanbul, Turkey", price: 5200, cost: 4300 },
    { title: "Barcelona Corporate Offsite", status: "draft", dest: "Barcelona, Spain", price: 18500, cost: 15800 },
    { title: "Rome Weekend for Two", status: "accepted", dest: "Rome, Italy", price: 2300, cost: 1850 },
    { title: "Santorini Anniversary", status: "sent", dest: "Santorini, Greece", price: 4700, cost: 3900 },
    { title: "Cape Town & Safari", status: "draft", dest: "Cape Town, South Africa", price: 11200, cost: 9400 },
  ];
  for (let i = 0; i < productSpecs.length; i++) {
    const p = productSpecs[i]!;
    const [row] = await db.insert(product).values({
      agencyId: DEMO,
      reference: `PRD-${2001 + i}`,
      title: p.title,
      clientId: pick(clientIds, i),
      status: p.status,
      destination: p.dest,
      startDate: d(30 + i * 14),
      endDate: d(37 + i * 14),
      paxCount: 2 + (i % 4),
      currency: "EUR",
      markupPercent: "18.00",
      totalCost: money(p.cost),
      totalPrice: money(p.price),
      summary: `Tailor-made ${p.dest} itinerary including flights, hand-picked hotels and curated experiences.`,
      validUntil: d(20 + i * 5),
      createdById: seller(i),
      createdAt: d(-90 + i * 9),
    }).returning();
    const items = [
      { type: "flight", title: "Return flights", supplier: "Air Partner", unit: p.cost * 0.35 },
      { type: "hotel", title: "Boutique hotel — 5 nights", supplier: "Leading Hotels", unit: p.cost * 0.45 },
      { type: "activity", title: "Private guided experiences", supplier: "Local DMC", unit: p.cost * 0.2 },
    ];
    for (let j = 0; j < items.length; j++) {
      const it = items[j]!;
      await db.insert(productItem).values({
        productId: row!.id,
        type: it.type,
        title: it.title,
        supplier: it.supplier,
        quantity: 1,
        unitCost: money(it.unit),
        unitPrice: money(it.unit * 1.18),
        currency: "EUR",
        startDate: d(30 + i * 14),
        endDate: d(35 + i * 14),
        sortOrder: j,
      });
    }
  }

  // --- 6. Bookings (varied destinations, statuses, dates) + travellers/items/payments ---
  const bookingSpecs = [
    { dest: "Marrakech, Morocco", status: "confirmed", depart: 18, pax: 2, createdM: -1, payMethod: "card", deposit: 0.4 },
    { dest: "Paris, France", status: "ticketed", depart: 9, pax: 2, createdM: -1, payMethod: "transfer", deposit: 1 },
    { dest: "Istanbul, Turkey", status: "awaiting_payment", depart: 26, pax: 4, createdM: 0, payMethod: "manual", deposit: 0.25 },
    { dest: "Dubai, UAE", status: "completed", depart: -20, pax: 3, createdM: -3, payMethod: "card", deposit: 1 },
    { dest: "Cairo, Egypt", status: "confirmed", depart: 42, pax: 2, createdM: 0, payMethod: "transfer", deposit: 0.5 },
    { dest: "Barcelona, Spain", status: "ticketed", depart: 14, pax: 6, createdM: -2, payMethod: "card", deposit: 1 },
    { dest: "Rome, Italy", status: "completed", depart: -35, pax: 2, createdM: -4, payMethod: "card", deposit: 1 },
    { dest: "Bangkok, Thailand", status: "draft", depart: 70, pax: 2, createdM: 0, payMethod: "manual", deposit: 0 },
    { dest: "Lisbon, Portugal", status: "confirmed", depart: 30, pax: 2, createdM: -1, payMethod: "transfer", deposit: 0.5 },
    { dest: "Santorini, Greece", status: "ticketed", depart: 21, pax: 2, createdM: -2, payMethod: "card", deposit: 1 },
    { dest: "Maldives", status: "completed", depart: -10, pax: 2, createdM: -5, payMethod: "transfer", deposit: 1 },
    { dest: "Istanbul, Turkey", status: "cancelled", depart: 5, pax: 3, createdM: -2, payMethod: "card", deposit: 0.3 },
    { dest: "Cape Town, South Africa", status: "awaiting_payment", depart: 55, pax: 2, createdM: 0, payMethod: "manual", deposit: 0.2 },
    { dest: "Tokyo, Japan", status: "confirmed", depart: 48, pax: 2, createdM: -1, payMethod: "card", deposit: 0.5 },
  ];
  const firstNames = ["Amine", "Sara", "Claire", "James", "Sofia", "Hassan", "Aisha", "Thomas", "Nadia", "Omar", "Leïla", "Karim"];
  const lastNames = ["Benali", "Dubois", "Carter", "Rossi", "El Amrani", "Khan", "Müller", "Bensalah", "Haddad"];
  let bk = 1005;
  for (let i = 0; i < bookingSpecs.length; i++) {
    const b = bookingSpecs[i]!;
    const created = new Date(now + b.createdM * 30 * DAY + (i % 7) * DAY);
    // Items: a flight + hotel + maybe an activity, amounts scale with pax.
    const base = 250 + (i % 5) * 80;
    const itemDefs = [
      { type: "flight", title: `Flights to ${b.dest.split(",")[0]}`, supplier: "Air Partner", amount: base, qty: b.pax },
      { type: "hotel", title: "Hotel — 5 nights", supplier: "Partner Hotels", amount: base * 1.6, qty: 1 },
      ...(i % 2 === 0 ? [{ type: "excursion", title: "Guided day tour", supplier: "Local DMC", amount: 120, qty: b.pax }] : []),
    ];
    const total = itemDefs.reduce((s, it) => s + it.amount * it.qty, 0);

    const [row] = await db.insert(booking).values({
      agencyId: DEMO,
      reference: `BKG-${bk++}`,
      clientId: pick(clientIds, i),
      status: b.status,
      destination: b.dest,
      departDate: d(b.depart),
      returnDate: d(b.depart + 6),
      currency: "EUR",
      notes: i % 3 === 0 ? "VIP client — confirm airport transfer." : null,
      totalAmount: money(total),
      shareToken: `demo-share-${bk}-${i}`,
      createdById: seller(i),
      createdAt: created,
    }).returning();
    const bookingId = row!.id;

    // Travellers (lead + companions); make one passport expire soon for alerts.
    for (let t = 0; t < b.pax; t++) {
      const soonExpiry = i % 4 === 0 && t === 0;
      await db.insert(bookingTraveller).values({
        bookingId,
        fullName: `${pick(firstNames, i + t)} ${pick(lastNames, i + t + 1)}`,
        passportNumber: `P${(1000000 + i * 13 + t).toString()}`,
        passportExpiry: soonExpiry ? d(b.depart + 60) : d(900 + i * 10),
        nationality: pick(["Algerian", "French", "British", "Moroccan", "Emirati"], i + t),
        dateOfBirth: new Date(1985 + ((i + t) % 20), (i + t) % 12, 1 + ((i + t) % 27)),
        isLead: t === 0,
        sortOrder: t,
      });
    }

    // Items
    for (let j = 0; j < itemDefs.length; j++) {
      const it = itemDefs[j]!;
      await db.insert(bookingItem).values({
        bookingId,
        type: it.type,
        title: it.title,
        supplier: it.supplier,
        bookingRef: `${it.type.slice(0, 2).toUpperCase()}-${1000 + i * 5 + j}`,
        startDate: d(b.depart),
        endDate: d(b.depart + 5),
        quantity: it.qty,
        amount: money(it.amount),
        currency: "EUR",
        itemStatus: b.status === "ticketed" || b.status === "completed" ? "ticketed" : b.status === "confirmed" ? "confirmed" : "pending",
        confirmationNumber: b.status === "ticketed" || b.status === "completed" ? `CNF${100000 + i * 7 + j}` : null,
        sortOrder: j,
      });
    }

    // Payments (skip drafts/cancelled fully unpaid)
    if (b.deposit > 0) {
      const paid = Math.round(total * b.deposit * 100) / 100;
      await db.insert(payment).values({
        bookingId,
        amount: money(paid),
        currency: "EUR",
        kind: b.deposit >= 1 ? "payment" : "deposit",
        method: b.payMethod,
        status: "completed",
        reference: `PAY-${i}-1`,
        note: b.deposit >= 1 ? "Paid in full" : "Deposit received",
        createdById: seller(i),
        createdAt: new Date(created.getTime() + 2 * DAY),
      });
      // A second installment for some
      if (b.deposit > 0 && b.deposit < 1 && i % 2 === 0) {
        await db.insert(payment).values({
          bookingId,
          amount: money(Math.round(total * 0.3 * 100) / 100),
          currency: "EUR",
          kind: "installment",
          method: b.payMethod,
          status: "completed",
          reference: `PAY-${i}-2`,
          createdById: seller(i),
          createdAt: new Date(created.getTime() + 15 * DAY),
        });
      }
    }

    // Itinerary days for a couple of confirmed/ticketed trips
    if (b.status === "ticketed" || b.status === "confirmed") {
      for (let dayI = 0; dayI < 3; dayI++) {
        await db.insert(bookingDay).values({
          bookingId,
          dayIndex: dayI,
          title: ["Arrival & check-in", "Guided exploration", "Free day & departure"][dayI]!,
          notes: dayI === 0 ? "Private transfer from airport." : null,
        });
      }
    }
  }

  // --- 7. Activity log (spread across the team and time) ---
  const acts = [
    { action: "created", entity: "booking", label: "BKG-1005 · Marrakech" },
    { action: "status_changed", entity: "booking", label: "BKG-1006 · Paris" },
    { action: "created", entity: "client", label: "Atlas Tech SARL" },
    { action: "stage_changed", entity: "opportunity", label: "Honeymoon — Maldives" },
    { action: "sent", entity: "product", label: "PRD-2002 · Istanbul" },
    { action: "created", entity: "opportunity", label: "Corporate offsite — Barcelona" },
    { action: "updated", entity: "booking", label: "BKG-1010 · Santorini" },
    { action: "created", entity: "booking", label: "BKG-1009 · Lisbon" },
    { action: "status_changed", entity: "booking", label: "BKG-1004 · Dubai" },
    { action: "created", entity: "client", label: "Le Comptoir du Voyage" },
    { action: "sent", entity: "product", label: "PRD-2005 · Santorini" },
    { action: "stage_changed", entity: "opportunity", label: "Anniversary — Santorini" },
  ];
  for (let i = 0; i < acts.length; i++) {
    const a = acts[i]!;
    await db.insert(activityLog).values({
      agencyId: DEMO,
      userId: seller(i),
      action: a.action,
      entityType: a.entity,
      entityLabel: a.label,
      createdAt: d(-30 + i * 2 + (i % 3)),
    });
  }

  // --- Summary ---
  const counts = await Promise.all(
    [client, opportunity, product, booking].map((t) => db.$count(t, eq((t as any).agencyId, DEMO)))
  );
  console.log("✓ Demo Agency seeded:");
  console.log(`  team: ${team.length} users (manager, finance, support, ${agentIds.length} agents)`);
  console.log(`  clients: ${counts[0]}  opportunities: ${counts[1]}  products: ${counts[2]}  bookings: ${counts[3]}`);
  console.log("  agent logins: karim@demo.test / lina@demo.test / omar@demo.test — all Agent!2026");
  process.exit(0);
}

main().catch((e) => {
  console.error("Seed failed:", e instanceof Error ? e.message : e);
  process.exit(1);
});
