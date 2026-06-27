/**
 * Seeds the Demo Agency with a RICH, realistic dataset for customer demos.
 *
 * Idempotent: wipes the Demo Agency's business data (clients, suppliers,
 * opportunities, products, bookings + children, payments, commissions,
 * notifications, activity) — but KEEPS the agency and its users — then reseeds a
 * large curated set. Safe to re-run to reset before a demo.
 *
 * Everything is denominated in DZD (Algerian Dinar).
 *
 * Run: npx tsx --env-file=.env scripts/seed-demo-data.ts
 */
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { assertSafeDestructiveTarget } from "./guard";
import {
  account,
  activityLog,
  booking,
  bookingDay,
  bookingItem,
  bookingTraveller,
  client,
  clientContact,
  commission,
  notification,
  opportunity,
  payment,
  product,
  productItem,
  supplier,
  supplierContract,
  supplierRate,
  user,
} from "@/lib/schema";

const DEMO = "00000000-0000-0000-0000-000000000001";
const CUR = "DZD";
const DAY = 864e5;
const now = Date.now();
const d = (offsetDays: number) => new Date(now + offsetDays * DAY);
const money = (n: number) => n.toFixed(2);
const pick = <T,>(arr: T[], i: number): T => arr[i % arr.length]!;
const round = (n: number) => Math.round(n);

// Deterministic PRNG so re-runs produce the same demo data.
let _s = 1337;
const rnd = () => {
  _s = (_s * 1103515245 + 12345) & 0x7fffffff;
  return _s / 0x7fffffff;
};
const between = (lo: number, hi: number) => lo + (hi - lo) * rnd();
const choice = <T,>(arr: T[]): T => arr[Math.floor(rnd() * arr.length)]!;

async function main() {
  assertSafeDestructiveTarget("the demo-data seed");

  // --- 1. Ensure a full team (keep existing manager/finance/support, add agents) ---
  const ctx = await (auth as any).$context;
  const agents = [
    { email: "karim@demo.test", name: "Karim Haddad" },
    { email: "lina@demo.test", name: "Lina Cherif" },
    { email: "omar@demo.test", name: "Omar Belkacem" },
    { email: "yacine@demo.test", name: "Yacine Mansouri" },
    { email: "nour@demo.test", name: "Nour Saadi" },
  ];
  for (const a of agents) {
    let u = await db.query.user.findFirst({ where: eq(user.email, a.email), columns: { id: true } });
    if (!u) {
      const id = crypto.randomUUID();
      await db.insert(user).values({ id, name: a.name, email: a.email, agencyId: DEMO, role: "agent", emailVerified: true, commissionRatePercent: String(round(between(3, 7))) });
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
  await db.delete(commission).where(eq(commission.agencyId, DEMO));
  await db.delete(notification).where(eq(notification.agencyId, DEMO));
  await db.delete(booking).where(eq(booking.agencyId, DEMO));
  await db.delete(product).where(eq(product.agencyId, DEMO));
  await db.delete(opportunity).where(eq(opportunity.agencyId, DEMO));
  await db.delete(supplierContract).where(eq(supplierContract.agencyId, DEMO));
  await db.delete(supplier).where(eq(supplier.agencyId, DEMO));
  await db.delete(client).where(eq(client.agencyId, DEMO));
  await db.delete(activityLog).where(eq(activityLog.agencyId, DEMO));

  // --- 3. Suppliers + contracts + rates ---
  const supplierSpecs = [
    { name: "Turkish Airlines", type: "airline", country: "Turkey", basis: "percent", rate: 6 },
    { name: "Air Algérie", type: "airline", country: "Algeria", basis: "percent", rate: 5 },
    { name: "Qatar Airways", type: "airline", country: "Qatar", basis: "percent", rate: 7 },
    { name: "Emirates", type: "airline", country: "UAE", basis: "percent", rate: 6.5 },
    { name: "Hilton Hotels & Resorts", type: "hotel", country: "Global", basis: "percent", rate: 12 },
    { name: "Rixos Hotels", type: "hotel", country: "Turkey", basis: "percent", rate: 14 },
    { name: "Jaz Hotel Group", type: "hotel", country: "Egypt", basis: "percent", rate: 15 },
    { name: "Marriott International", type: "hotel", country: "Global", basis: "percent", rate: 11 },
    { name: "Al Tayyar DMC", type: "dmc", country: "Saudi Arabia", basis: "percent", rate: 10 },
    { name: "Istanbul Tours DMC", type: "dmc", country: "Turkey", basis: "percent", rate: 18 },
    { name: "Sahara Excursions", type: "dmc", country: "Algeria", basis: "percent", rate: 20 },
    { name: "Allianz Travel", type: "insurance", country: "Global", basis: "percent", rate: 25 },
    { name: "Europ Assistance", type: "insurance", country: "France", basis: "percent", rate: 22 },
    { name: "Med Transfers", type: "transfer", country: "Tunisia", basis: "fixed", rate: 8 },
  ];
  const supplierIds: Record<string, string> = {};
  const supplierByType: Record<string, string[]> = {};
  for (let i = 0; i < supplierSpecs.length; i++) {
    const s = supplierSpecs[i]!;
    const [row] = await db.insert(supplier).values({
      agencyId: DEMO,
      name: s.name,
      type: s.type,
      status: i % 9 === 8 ? "inactive" : "active",
      email: `contact@${s.name.toLowerCase().replace(/[^a-z]/g, "")}.com`,
      phone: `+213 5${round(between(10, 99))} ${round(between(100, 999))} ${round(between(100, 999))}`,
      website: `https://www.${s.name.toLowerCase().replace(/[^a-z]/g, "")}.com`,
      city: s.country,
      country: s.country,
      contactName: choice(["Mehdi Larbi", "Sami Toumi", "Rania Aziz", "Khaled Brahimi", "Yasmin Fares"]),
      createdById: seller(i),
      createdAt: d(-200 + i * 6),
    }).returning();
    supplierIds[s.name] = row!.id;
    (supplierByType[s.type] ??= []).push(row!.id);

    const [contract] = await db.insert(supplierContract).values({
      supplierId: row!.id,
      agencyId: DEMO,
      name: `${s.name} ${2026} Commercial Agreement`,
      reference: `CTR-${100 + i}`,
      commissionBasis: s.basis,
      commissionRate: money(s.rate),
      currency: CUR,
      validFrom: d(-180),
      validTo: d(185),
      status: i % 11 === 10 ? "expired" : "active",
      notes: "Standard annual rate agreement with override tiers on volume.",
      createdAt: d(-180 + i * 5),
    }).returning();

    const rateCount = 2 + (i % 2);
    const rates = Array.from({ length: rateCount }).map((_, j) => {
      const net = round(between(20000, 180000));
      return {
        contractId: contract!.id,
        description: choice([
          "Standard double room, BB",
          "Economy class return fare",
          "All-inclusive package rate",
          "Half-board family room",
          "Private airport transfer",
          "Guided city tour (per pax)",
        ]) + ` — tier ${j + 1}`,
        netRate: money(net),
        sellRate: money(round(net * between(1.15, 1.4))),
        currency: CUR,
        validFrom: d(-180),
        validTo: d(185),
      };
    });
    await db.insert(supplierRate).values(rates);
  }
  const anySupplier = (type: string, i: number) => {
    const list = supplierByType[type];
    return list && list.length ? pick(list, i) : null;
  };

  // --- 4. Clients (100) + contacts ---
  const firstNames = [
    "Amine", "Sara", "Karim", "Lina", "Omar", "Yasmine", "Hassan", "Nadia", "Sofiane", "Imane",
    "Bilal", "Meriem", "Rachid", "Asma", "Walid", "Khadija", "Sami", "Leila", "Mourad", "Hanane",
    "Tarek", "Salima", "Nabil", "Wassila", "Adel", "Farida", "Reda", "Houda", "Younes", "Selma",
    "Idris", "Amira", "Fares", "Dalia", "Sofia", "Riad", "Nour", "Anis", "Maya", "Zineb",
  ];
  const lastNames = [
    "Benali", "Cherif", "Haddad", "Belkacem", "Mansouri", "Saadi", "Boumediene", "Khelifi", "Bouzid", "Meziane",
    "Toumi", "Larbi", "Brahimi", "Hamdi", "Ferhat", "Bouchama", "Slimani", "Aziz", "Madani", "Benyahia",
    "Zerrouki", "Belkadi", "Ouali", "Guerroudj", "Rahmani", "Selmani", "Naceri", "Lounis", "Tahar", "Djebbar",
  ];
  const dzCities = [
    "Algiers", "Oran", "Constantine", "Annaba", "Blida", "Sétif", "Batna", "Tlemcen", "Béjaïa", "Tizi Ouzou",
    "Djelfa", "Sidi Bel Abbès", "Biskra", "Tébessa", "Ouargla", "Béchar", "Mostaganem", "Bordj Bou Arréridj",
  ];
  const intlCities: [string, string][] = [
    ["Paris", "France"], ["Lyon", "France"], ["Marseille", "France"], ["Montreal", "Canada"],
    ["London", "United Kingdom"], ["Istanbul", "Turkey"], ["Dubai", "UAE"], ["Tunis", "Tunisia"],
  ];
  const companies = [
    "Atlas Tech SARL", "Sahara Logistics", "Médina Hospitality", "Le Comptoir du Voyage",
    "Sonatrach Services", "Cevital Group", "Djezzy Telecom", "Condor Electronics",
    "Biopharm SPA", "Ooredoo Algérie", "NCA-Rouiba", "Mobilis Corporate", "Hassi Energy", "Numidia Bank",
  ];
  const statuses = ["active", "active", "active", "active", "lead", "lead", "inactive"];
  // LEAD_SOURCES codes.
  const sources = ["referral", "website", "instagram", "walk_in", "outbound", "partner", "event", "facebook"];
  // INDUSTRIES codes (for corporate clients).
  const industries = ["tourism", "energy", "technology", "finance", "retail", "construction", "public_sector", "health", "telecom", "logistics"];
  // TRAVEL_PURPOSES / TRIP_TYPES / TITLES / GENDERS / LOST_REASONS codes.
  const travelPurposes = ["leisure", "business", "honeymoon", "family", "group", "umrah", "hajj", "medical"];
  const tripTypes = ["one_way", "round_trip", "multi_city"];
  const titles = ["mr", "mrs", "ms", "dr"];
  const genders = ["male", "female"];
  const lostReasonCodes = ["price", "timing", "competitor", "no_response", "postponed", "budget"];

  const clientIds: string[] = [];
  const clientNames: string[] = [];
  const clientEmails: string[] = [];
  const clientRows: (typeof client.$inferInsert)[] = [];
  const contactRows: (typeof clientContact.$inferInsert)[] = [];
  // We need ids before contacts; insert clients individually-batched then contacts after.
  for (let i = 0; i < 100; i++) {
    const isCorp = i % 7 === 0;
    let name: string, company: string | null, city: string, country: string, email: string;
    if (isCorp) {
      company = pick(companies, i / 7);
      name = company;
      const [c, ctry] = i % 2 ? ["Algiers", "Algeria"] : pick(intlCities, i);
      city = c; country = ctry;
      email = `travel@${company.toLowerCase().replace(/[^a-z]/g, "")}.dz`;
    } else {
      const fn = pick(firstNames, i * 3 + 1);
      const ln = pick(lastNames, i * 5 + 2);
      name = `${fn} ${ln}`;
      company = null;
      if (i % 4 === 0) { const [c, ctry] = pick(intlCities, i); city = c; country = ctry; }
      else { city = pick(dzCities, i); country = "Algeria"; }
      email = `${fn.toLowerCase()}.${ln.toLowerCase()}${i}@example.com`;
    }
    clientNames.push(name);
    clientEmails.push(email);
    clientRows.push({
      agencyId: DEMO,
      name,
      type: isCorp ? "corporate" : "individual",
      status: pick(statuses, i),
      email,
      phone: `+213 ${choice(["5", "6", "7"])}${round(between(10, 99))} ${round(between(100, 999))} ${round(between(100, 999))}`,
      company,
      city,
      country,
      source: pick(sources, i),
      industry: isCorp ? pick(industries, i) : null,
      ownerId: seller(i),
      createdById: seller(i),
      createdAt: d(-220 + i * 2),
    });
  }
  // Batch insert clients, capture ids in order.
  const insertedClients = await db.insert(client).values(clientRows).returning({ id: client.id });
  for (const c of insertedClients) clientIds.push(c.id);
  // Corporate contacts.
  for (let i = 0; i < clientIds.length; i++) {
    if (clientRows[i]!.type !== "corporate") continue;
    const n = 1 + (i % 2);
    for (let j = 0; j < n; j++) {
      contactRows.push({
        clientId: clientIds[i]!,
        name: `${pick(firstNames, i + j)} ${pick(lastNames, i + j + 3)}`,
        jobTitle: choice(["Travel Manager", "Office Manager", "Executive Assistant", "Procurement Lead"]),
        email: clientEmails[i]!,
        phone: `+213 770 ${round(between(100, 999))} ${round(between(100, 999))}`,
        isPrimary: j === 0,
      });
    }
  }
  if (contactRows.length) await db.insert(clientContact).values(contactRows);

  // --- Destinations & pricing (DZD) ---
  type Dest = { dest: string; tier: "domestic" | "maghreb" | "europe" | "gulf" | "umrah" | "luxury" | "asia" };
  const destinations: Dest[] = [
    { dest: "Istanbul, Turkey", tier: "europe" },
    { dest: "Antalya, Turkey", tier: "europe" },
    { dest: "Paris, France", tier: "europe" },
    { dest: "Barcelona, Spain", tier: "europe" },
    { dest: "Rome, Italy", tier: "europe" },
    { dest: "Tunis, Tunisia", tier: "maghreb" },
    { dest: "Djerba, Tunisia", tier: "maghreb" },
    { dest: "Hammamet, Tunisia", tier: "maghreb" },
    { dest: "Dubai, UAE", tier: "gulf" },
    { dest: "Doha, Qatar", tier: "gulf" },
    { dest: "Mecca, Saudi Arabia", tier: "umrah" },
    { dest: "Medina, Saudi Arabia", tier: "umrah" },
    { dest: "Cairo, Egypt", tier: "maghreb" },
    { dest: "Sharm El Sheikh, Egypt", tier: "maghreb" },
    { dest: "Maldives", tier: "luxury" },
    { dest: "Bali, Indonesia", tier: "asia" },
    { dest: "Kuala Lumpur, Malaysia", tier: "asia" },
    { dest: "Bangkok, Thailand", tier: "asia" },
    { dest: "Djanet, Algeria", tier: "domestic" },
    { dest: "Tamanrasset, Algeria", tier: "domestic" },
    { dest: "Oran, Algeria", tier: "domestic" },
  ];
  // Per-person price ranges in DZD.
  const tierPrice: Record<Dest["tier"], [number, number]> = {
    domestic: [35000, 120000],
    maghreb: [90000, 240000],
    europe: [180000, 480000],
    gulf: [220000, 620000],
    umrah: [380000, 1200000],
    luxury: [1200000, 3800000],
    asia: [350000, 950000],
  };
  const perPax = (tier: Dest["tier"]) => round(between(...tierPrice[tier]) / 1000) * 1000;

  // --- 5. Opportunities (40 across stages) ---
  const stages = ["lead", "qualified", "proposal", "booked", "won", "lost"];
  const oppRows: (typeof opportunity.$inferInsert)[] = [];
  for (let i = 0; i < 40; i++) {
    const dst = pick(destinations, i * 3);
    const pax = 1 + Math.floor(rnd() * 6);
    const stage = pick(stages, i);
    const value = perPax(dst.tier) * pax;
    oppRows.push({
      agencyId: DEMO,
      title: `${choice(["Honeymoon", "Family trip", "City break", "Group tour", "Business trip", "Umrah package", "Anniversary", "Holiday"])} — ${dst.dest.split(",")[0]}`,
      clientId: pick(clientIds, i + 1),
      stage,
      value: money(value),
      currency: CUR,
      probability: stage === "won" ? 100 : stage === "lost" ? 0 : round(between(15, 80)),
      destination: dst.dest,
      travelPurpose: pick(travelPurposes, i),
      travelStartDate: d(15 + i * 5),
      travelEndDate: d(22 + i * 5),
      paxCount: pax,
      expectedCloseDate: d(-15 + i * 4),
      lostReason: stage === "lost" ? pick(lostReasonCodes, i) : null,
      assignedToId: seller(i),
      createdById: seller(i),
      createdAt: d(-160 + i * 3),
    });
  }
  await db.insert(opportunity).values(oppRows);

  // --- 6. Products / proposals (25) + items ---
  const prodStatuses = ["draft", "sent", "sent", "accepted", "accepted", "rejected", "expired"];
  let prdRef = 2001;
  for (let i = 0; i < 25; i++) {
    const dst = pick(destinations, i * 2 + 1);
    const pax = 2 + (i % 4);
    const status = pick(prodStatuses, i);
    const cost = perPax(dst.tier) * pax;
    const markup = round(between(12, 25));
    const price = round(cost * (1 + markup / 100));
    const accepted = status === "accepted";
    const [row] = await db.insert(product).values({
      agencyId: DEMO,
      reference: `PRD-${prdRef++}`,
      title: `${dst.dest.split(",")[0]} ${choice(["Discovery", "Escape", "Experience", "Package", "Getaway"])}`,
      clientId: pick(clientIds, i),
      status,
      destination: dst.dest,
      startDate: d(25 + i * 7),
      endDate: d(32 + i * 7),
      paxCount: pax,
      currency: CUR,
      markupPercent: money(markup),
      totalCost: money(cost),
      totalPrice: money(price),
      summary: `Tailor-made ${dst.dest} itinerary including flights, hand-picked hotels and curated experiences for ${pax} travellers.`,
      validUntil: d(15 + i * 3),
      shareToken: `demo-prop-${i}-${prdRef}`,
      acceptedAt: accepted ? d(-5 - i) : null,
      signerName: accepted ? pick(clientNames, i) : null,
      signerEmail: accepted ? pick(clientEmails, i) : null,
      signatureData: accepted ? pick(clientNames, i) : null,
      signerIp: accepted ? "41.200.10.5" : null,
      createdById: seller(i),
      createdAt: d(-100 + i * 4),
    }).returning();
    const items = [
      { type: "flight", title: `Return flights to ${dst.dest.split(",")[0]}`, supplierType: "airline", frac: 0.35 },
      { type: "hotel", title: "Hotel accommodation", supplierType: "hotel", frac: 0.45 },
      { type: "activity", title: "Guided experiences & transfers", supplierType: "dmc", frac: 0.2 },
    ];
    await db.insert(productItem).values(items.map((it, j) => {
      const unit = round(cost * it.frac);
      return {
        productId: row!.id,
        supplierId: anySupplier(it.supplierType, i + j),
        type: it.type,
        title: it.title,
        supplier: supplierSpecs.find((s) => s.type === it.supplierType)?.name ?? null,
        quantity: 1,
        unitCost: money(unit),
        unitPrice: money(round(unit * (1 + markup / 100))),
        currency: CUR,
        startDate: d(25 + i * 7),
        endDate: d(30 + i * 7),
        sortOrder: j,
      };
    }));
  }

  // --- 7. Bookings (80) + travellers/items/payments/days/commissions/notifications ---
  const bookingStatuses = [
    "confirmed", "confirmed", "ticketed", "ticketed", "completed", "completed",
    "awaiting_payment", "draft", "cancelled",
  ];
  const payMethods = ["card", "transfer", "cash", "manual"];
  const natList = ["Algerian", "Algerian", "Algerian", "French", "Tunisian", "Moroccan"];
  const commissionRows: (typeof commission.$inferInsert)[] = [];
  const notificationRows: (typeof notification.$inferInsert)[] = [];
  let bk = 1001;
  for (let i = 0; i < 80; i++) {
    const dst = pick(destinations, i * 2);
    const status = pick(bookingStatuses, i);
    const pax = 1 + Math.floor(rnd() * 5);
    const isPast = status === "completed";
    const depart = isPast ? -round(between(10, 120)) : round(between(3, 160));
    const createdAt = new Date(now - round(between(5, 180)) * DAY);
    const sellerId = seller(i);

    const ppax = perPax(dst.tier);
    const itemDefs = [
      { type: "flight", title: `Flights to ${dst.dest.split(",")[0]}`, supplierType: "airline", amount: round(ppax * 0.4), qty: pax },
      { type: "hotel", title: `Hotel — ${3 + (i % 5)} nights`, supplierType: "hotel", amount: round(ppax * 0.5 * pax), qty: 1 },
      ...(i % 2 === 0 ? [{ type: "excursion", title: "Guided day tour", supplierType: "dmc", amount: round(ppax * 0.1), qty: pax }] : []),
      ...(i % 3 === 0 ? [{ type: "insurance", title: "Travel insurance", supplierType: "insurance", amount: round(between(4000, 12000)), qty: pax }] : []),
    ];
    const total = itemDefs.reduce((s, it) => s + it.amount * it.qty, 0);

    const [row] = await db.insert(booking).values({
      agencyId: DEMO,
      reference: `BKG-${bk++}`,
      clientId: pick(clientIds, i),
      status,
      destination: dst.dest,
      departDate: d(depart),
      returnDate: d(depart + 5 + (i % 5)),
      travelPurpose: pick(travelPurposes, i),
      tripType: pick(tripTypes, i),
      currency: CUR,
      notes: i % 4 === 0 ? "VIP client — confirm airport transfer." : null,
      totalAmount: money(total),
      shareToken: `demo-share-${bk}-${i}`,
      createdById: sellerId,
      createdAt,
    }).returning();
    const bookingId = row!.id;

    // Travellers.
    const travellers = Array.from({ length: pax }).map((_, t) => {
      const soonExpiry = i % 5 === 0 && t === 0;
      return {
        bookingId,
        fullName: `${pick(firstNames, i + t)} ${pick(lastNames, i + t + 1)}`,
        title: pick(titles, i + t),
        gender: pick(genders, i + t),
        passportNumber: `${choice(["A", "B", "X"])}${round(between(1000000, 9999999))}`,
        passportExpiry: soonExpiry ? d(depart + round(between(20, 120))) : d(round(between(400, 2000))),
        nationality: pick(natList, i + t),
        dateOfBirth: new Date(1975 + ((i + t) % 30), (i + t) % 12, 1 + ((i + t) % 27)),
        isLead: t === 0,
        sortOrder: t,
      };
    });
    await db.insert(bookingTraveller).values(travellers);

    // Items (capture ids for supplier commissions).
    const insertedItems = await db.insert(bookingItem).values(
      itemDefs.map((it, j) => ({
        bookingId,
        supplierId: anySupplier(it.supplierType, i + j),
        type: it.type,
        title: it.title,
        supplier: supplierSpecs.find((s) => s.type === it.supplierType)?.name ?? null,
        bookingRef: `${it.type.slice(0, 2).toUpperCase()}-${1000 + i * 5 + j}`,
        startDate: d(depart),
        endDate: d(depart + 5),
        quantity: it.qty,
        amount: money(it.amount),
        currency: CUR,
        itemStatus: status === "ticketed" || status === "completed" ? "ticketed" : status === "confirmed" ? "confirmed" : "pending",
        confirmationNumber: status === "ticketed" || status === "completed" ? `CNF${100000 + i * 7 + j}` : null,
        sortOrder: j,
      }))
    ).returning({ id: bookingItem.id, type: bookingItem.type, amount: bookingItem.amount, supplierId: bookingItem.supplierId });

    // Payments.
    const depositFrac = status === "cancelled" ? 0.3 : status === "draft" ? 0 : status === "awaiting_payment" ? choice([0.2, 0.3]) : choice([0.5, 1]);
    if (depositFrac > 0) {
      const paid = round(total * depositFrac);
      await db.insert(payment).values({
        bookingId,
        amount: money(paid),
        currency: CUR,
        kind: depositFrac >= 1 ? "payment" : "deposit",
        method: pick(payMethods, i),
        status: "completed",
        reference: `PAY-${i}-1`,
        note: depositFrac >= 1 ? "Paid in full" : "Deposit received",
        createdById: sellerId,
        createdAt: new Date(createdAt.getTime() + 2 * DAY),
      });
      if (depositFrac > 0 && depositFrac < 1 && i % 2 === 0) {
        await db.insert(payment).values({
          bookingId,
          amount: money(round(total * 0.3)),
          currency: CUR,
          kind: "installment",
          method: pick(payMethods, i + 1),
          status: "completed",
          reference: `PAY-${i}-2`,
          createdById: sellerId,
          createdAt: new Date(createdAt.getTime() + 18 * DAY),
        });
      }
    }

    // Itinerary days for confirmed/ticketed/completed.
    if (["confirmed", "ticketed", "completed"].includes(status)) {
      const dayTitles = ["Arrival & check-in", "Guided exploration", "Leisure & activities", "Free day & departure"];
      await db.insert(bookingDay).values(
        dayTitles.slice(0, 3 + (i % 2)).map((title, dayI) => ({
          bookingId,
          dayIndex: dayI,
          title,
          notes: dayI === 0 ? "Private transfer from airport." : null,
        }))
      );
    }

    // Commissions (only for revenue-generating bookings).
    if (["confirmed", "ticketed", "completed"].includes(status)) {
      // Supplier → agency, per item with a supplier.
      for (const it of insertedItems) {
        if (!it.supplierId) continue;
        const base = parseFloat(it.amount) * (it.type === "hotel" ? 1 : 1);
        const rate = round(between(6, 16));
        commissionRows.push({
          agencyId: DEMO,
          bookingId,
          bookingItemId: it.id,
          supplierId: it.supplierId,
          type: "supplier_to_agency",
          basis: "percent",
          rate: money(rate),
          baseAmount: money(base),
          amount: money(round(base * rate / 100)),
          currency: CUR,
          status: status === "completed" ? "paid" : choice(["earned", "invoiced", "earned"]),
          createdById: sellerId,
          createdAt,
        });
      }
      // Agency → agent.
      const agRate = round(between(3, 7));
      commissionRows.push({
        agencyId: DEMO,
        bookingId,
        agentUserId: sellerId,
        type: "agency_to_agent",
        basis: "percent",
        rate: money(agRate),
        baseAmount: money(total),
        amount: money(round(total * agRate / 100)),
        currency: CUR,
        status: status === "completed" ? "paid" : "pending",
        createdById: manager,
        createdAt,
      });
    }

    // Notifications (communications log).
    if (status !== "draft") {
      const recip = clientEmails[i % clientEmails.length]!;
      notificationRows.push({
        agencyId: DEMO,
        bookingId,
        channel: "email",
        recipient: recip,
        subject: `Booking ${row!.reference} confirmation`,
        body: `Your trip to ${dst.dest} is confirmed.`,
        kind: "confirmation",
        status: "sent",
        createdById: sellerId,
        createdAt: new Date(createdAt.getTime() + 1 * DAY),
      });
      if (["ticketed", "completed"].includes(status)) {
        notificationRows.push({
          agencyId: DEMO,
          bookingId,
          channel: "email",
          recipient: recip,
          subject: `Travel documents — ${row!.reference}`,
          body: "Please find your vouchers and e-tickets attached.",
          kind: "voucher",
          status: "sent",
          createdById: sellerId,
          createdAt: new Date(createdAt.getTime() + 4 * DAY),
        });
      }
    }
  }
  if (commissionRows.length) await db.insert(commission).values(commissionRows);
  if (notificationRows.length) await db.insert(notification).values(notificationRows);

  // --- 8. Activity log (spread across the team and time) ---
  const actDefs = [
    { action: "created", entity: "booking" },
    { action: "status_changed", entity: "booking" },
    { action: "created", entity: "client" },
    { action: "stage_changed", entity: "opportunity" },
    { action: "sent", entity: "product" },
    { action: "updated", entity: "booking" },
    { action: "created", entity: "opportunity" },
  ];
  const actRows = Array.from({ length: 40 }).map((_, i) => {
    const def = pick(actDefs, i);
    return {
      agencyId: DEMO,
      userId: seller(i),
      action: def.action,
      entityType: def.entity,
      entityLabel: def.entity === "client" ? pick(clientNames, i) : def.entity === "booking" ? `BKG-${1001 + (i % 80)}` : def.entity === "product" ? `PRD-${2001 + (i % 25)}` : pick(destinations, i).dest,
      createdAt: d(-40 + i),
    };
  });
  await db.insert(activityLog).values(actRows);

  // --- Summary ---
  const counts = await Promise.all([
    db.$count(client, eq(client.agencyId, DEMO)),
    db.$count(supplier, eq(supplier.agencyId, DEMO)),
    db.$count(opportunity, eq(opportunity.agencyId, DEMO)),
    db.$count(product, eq(product.agencyId, DEMO)),
    db.$count(booking, eq(booking.agencyId, DEMO)),
    db.$count(commission, eq(commission.agencyId, DEMO)),
    db.$count(notification, eq(notification.agencyId, DEMO)),
  ]);
  console.log("✓ Demo Agency seeded (all amounts in DZD):");
  console.log(`  team: ${team.length} users (${agentIds.length} agents)`);
  console.log(`  clients: ${counts[0]}  suppliers: ${counts[1]}  opportunities: ${counts[2]}`);
  console.log(`  proposals: ${counts[3]}  bookings: ${counts[4]}  commissions: ${counts[5]}  notifications: ${counts[6]}`);
  process.exit(0);
}

main().catch((e) => {
  console.error("Seed failed:", e instanceof Error ? e.message : e);
  process.exit(1);
});
