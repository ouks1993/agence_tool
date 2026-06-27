/**
 * Normalizes free-text country values on existing records to the canonical ISO
 * names used by the country picker (e.g. "USA" → "United States", "Turkey" →
 * "Türkiye"). Idempotent and safe to re-run.
 *
 * Covers client.country and supplier.country. Unmappable values are left as-is
 * and logged so they can be reviewed.
 *
 * Run: npx tsx --env-file=.env scripts/backfill-countries.ts
 * Prod: ALLOW_PROD=1 POSTGRES_URL=<prod> npx tsx scripts/backfill-countries.ts
 */
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { countryByName, normalizeCountry } from "@/lib/reference/countries";
import { client, supplier } from "@/lib/schema";
import { assertSafeDestructiveTarget } from "./guard";

async function main() {
  assertSafeDestructiveTarget("the country backfill");

  let updated = 0;
  const unmapped = new Set<string>();

  const clients = await db
    .select({ id: client.id, country: client.country })
    .from(client);
  for (const c of clients) {
    if (!c.country) continue;
    const norm = normalizeCountry(c.country);
    if (norm && norm !== c.country) {
      await db.update(client).set({ country: norm }).where(eq(client.id, c.id));
      updated++;
    }
    if (norm && !countryByName(norm)) unmapped.add(c.country);
  }

  const suppliers = await db
    .select({ id: supplier.id, country: supplier.country })
    .from(supplier);
  for (const s of suppliers) {
    if (!s.country) continue;
    const norm = normalizeCountry(s.country);
    if (norm && norm !== s.country) {
      await db.update(supplier).set({ country: norm }).where(eq(supplier.id, s.id));
      updated++;
    }
    if (norm && !countryByName(norm)) unmapped.add(s.country);
  }

  console.log(`✓ Country backfill complete — ${updated} record(s) normalized.`);
  if (unmapped.size) {
    console.log("  Unmapped values (left as-is, review manually):");
    for (const v of unmapped) console.log(`   - ${v}`);
  }
  process.exit(0);
}

main().catch((e) => {
  console.error("Backfill failed:", e instanceof Error ? e.message : e);
  process.exit(1);
});
