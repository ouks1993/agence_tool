/**
 * Syncs Hotelbeds hotel CONTENT (photos, names, facilities, coordinates) into
 * the local `hotel_content` cache table.
 *
 * Why: content rarely changes and the photo CDN URLs are public, so caching it
 * lets the app show real hotel photos without spending the live Content API
 * quota on every search. Run this occasionally (e.g. weekly), not per request.
 *
 * Run (all default destinations):
 *   npx tsx --env-file=.env scripts/sync-hotel-content.ts
 * Run for specific Hotelbeds destination codes:
 *   npx tsx --env-file=.env scripts/sync-hotel-content.ts BCN MAD RAK
 * Cap hotels per destination (default 80):
 *   SYNC_MAX=200 npx tsx --env-file=.env scripts/sync-hotel-content.ts BCN
 */
import { isHotelbedsConfigured } from "@/lib/suppliers";
import { syncDestinationContent } from "@/lib/suppliers/content-cache";

/** Curated destinations matching the app's hotel autocomplete list. */
const DEFAULT_DESTINATIONS = [
  "BCN", "MAD", "PMI", "AGP", "IBZ", "VLC", "SVQ", "PAR", "NCE", "MRS",
  "LON", "DUB", "AMS", "LIS", "BER", "VIE", "ATH", "IST", "DXB", "BKK",
  "SIN", "NYC", "LAX", "MIA", "RAK", "AGA", "FEZ", "ALG", "DJE",
];

async function main(): Promise<void> {
  if (!isHotelbedsConfigured()) {
    console.error(
      "HOTELBEDS_API_KEY / HOTELBEDS_SECRET are not set — nothing to sync."
    );
    process.exit(1);
  }

  const args = process.argv.slice(2).map((s) => s.toUpperCase());
  const destinations = args.length > 0 ? args : DEFAULT_DESTINATIONS;
  const max = Number(process.env.SYNC_MAX ?? 80);

  console.log(
    `Syncing ${destinations.length} destination(s), up to ${max} hotels each…`
  );

  let total = 0;
  for (const dest of destinations) {
    try {
      const n = await syncDestinationContent(dest, max);
      total += n;
      console.log(`  ${dest}: cached ${n} hotels`);
    } catch (error) {
      console.error(
        `  ${dest}: failed —`,
        error instanceof Error ? error.message : error
      );
    }
  }

  console.log(`Done. ${total} hotels cached in hotel_content.`);
  process.exit(0);
}

void main();
