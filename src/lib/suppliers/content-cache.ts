/**
 * Hotel content cache (DB-backed).
 *
 * Hotelbeds splits photos/names/facilities (Content API) from prices
 * (availability API), each with its own quota. Content rarely changes and the
 * photo CDN URLs are public, so we cache content in our own Postgres and serve
 * real hotel photos WITHOUT spending the live quota on every search.
 *
 * - Reads are cache-first, falling back to a live Content call on a miss (and
 *   storing the result, so the next read is free).
 * - `syncDestinationContent` bulk-fills the cache from the Content list endpoint;
 *   run it periodically via scripts/sync-hotel-content.ts.
 *
 * This is shared vendor reference data — intentionally NOT scoped to an agency.
 */
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { hotelContent } from "@/lib/schema";
import {
  estimatedNightly,
  estimatedReviewScore,
  fetchHotelbedsContentPage,
  getHotelbedsContent,
  parseStarsValue,
} from "./hotelbeds";
import { nightsBetween } from "./types";
import type { HotelDetails, HotelImage, HotelOffer, HotelSearchParams } from "./types";

type HotelContentRow = typeof hotelContent.$inferSelect;

function rowToDetails(r: HotelContentRow): HotelDetails {
  return {
    code: r.code,
    name: r.name,
    // The details view derives stars from `category`; "4 STARS" → 4.
    category: r.stars ? `${r.stars} STARS` : undefined,
    hotelType: r.hotelType ?? undefined,
    description: r.description ?? undefined,
    address: r.address ?? undefined,
    city: r.city ?? undefined,
    country: r.country ?? undefined,
    postalCode: r.postalCode ?? undefined,
    phone: undefined,
    email: undefined,
    web: undefined,
    latitude: r.latitude != null ? Number(r.latitude) : undefined,
    longitude: r.longitude != null ? Number(r.longitude) : undefined,
    segments: (r.segments as string[] | null) ?? [],
    facilities: (r.facilities as string[] | null) ?? [],
    images: (r.images as HotelImage[] | null) ?? [],
  };
}

/** Upserts one hotel's content into the cache. */
export async function cacheHotelContent(
  d: HotelDetails,
  destinationCode?: string
): Promise<void> {
  const stars = parseStarsValue(d.category);
  const values = {
    code: d.code,
    name: d.name,
    stars,
    hotelType: d.hotelType ?? null,
    description: d.description ?? null,
    address: d.address ?? null,
    city: d.city ?? null,
    country: d.country ?? null,
    postalCode: d.postalCode ?? null,
    latitude: d.latitude != null ? String(d.latitude) : null,
    longitude: d.longitude != null ? String(d.longitude) : null,
    destinationCode: destinationCode ?? null,
    segments: d.segments,
    facilities: d.facilities,
    images: d.images,
    updatedAt: new Date(),
  };
  await db
    .insert(hotelContent)
    .values(values)
    .onConflictDoUpdate({
      target: hotelContent.code,
      // Don't blank an existing destinationCode if this upsert didn't carry one.
      set: { ...values, destinationCode: destinationCode ?? undefined },
    });
}

/**
 * Returns one hotel's content, cache-first. On a miss it fetches live content
 * and stores it. Returns null only if the hotel can't be found anywhere.
 */
export async function getHotelContentCached(
  code: string
): Promise<HotelDetails | null> {
  const [row] = await db
    .select()
    .from(hotelContent)
    .where(eq(hotelContent.code, code))
    .limit(1);

  if (row) {
    const details = rowToDetails(row);
    // The bulk list endpoint returns facility CODES without names, so synced
    // rows have no facilities. Self-heal once from the detail endpoint (which
    // returns rich facility names) and persist — so the high-volume search path
    // stays quota-free while detail views still show full amenities.
    if (details.facilities.length === 0) {
      try {
        const live = await getHotelbedsContent(code);
        await cacheHotelContent(live, row.destinationCode ?? undefined).catch(() => {});
        return live;
      } catch {
        return details; // detail call unavailable — cached photos still render
      }
    }
    return details;
  }

  try {
    const live = await getHotelbedsContent(code);
    await cacheHotelContent(live).catch(() => {});
    return live;
  } catch {
    return null;
  }
}

/**
 * Builds hotel offers for a destination from the cache (real photos, estimated
 * rates). Returns [] on a cache miss so the caller can fall back to a live call.
 */
export async function listHotelOffersCached(
  params: HotelSearchParams
): Promise<HotelOffer[]> {
  const dest = (params.cityCode || params.city).toUpperCase();
  if (!dest) return [];

  const rows = await db
    .select()
    .from(hotelContent)
    .where(eq(hotelContent.destinationCode, dest))
    .limit(40);
  if (rows.length === 0) return [];

  const nights = nightsBetween(params.checkIn, params.checkOut);
  const rooms = Math.max(1, params.rooms ?? 1);

  return rows
    .filter((r) => Array.isArray(r.images) && (r.images as HotelImage[]).length > 0)
    .map((r) => {
      const images = r.images as HotelImage[];
      const codeNum = Number(r.code) || 0;
      const perNight = estimatedNightly(r.stars, codeNum) * rooms;
      return {
        id: `hotelbeds-ct-${r.code}`,
        source: "hotelbeds" as const,
        name: r.name,
        stars: r.stars,
        city: r.city ?? params.city,
        address: r.address ?? undefined,
        refundable: true,
        pricePerNight: perNight,
        priceTotal: perNight * nights,
        nights,
        currency: params.currency ?? "EUR",
        thumbnail: images[0]?.url,
        hotelType: r.hotelType ?? undefined,
        hotelCode: r.code,
        latitude: r.latitude != null ? Number(r.latitude) : undefined,
        longitude: r.longitude != null ? Number(r.longitude) : undefined,
        reviewScore: estimatedReviewScore(r.stars, codeNum),
        estimated: true,
      };
    })
    .sort((a, b) => b.stars - a.stars);
}

/**
 * Bulk-fills the cache for one destination from the Content list endpoint.
 * Pages in chunks; returns how many hotels were cached.
 */
export async function syncDestinationContent(
  destinationCode: string,
  max = 200
): Promise<number> {
  const PAGE = 50;
  let cached = 0;
  for (let from = 1; from <= max; from += PAGE) {
    const to = Math.min(from + PAGE - 1, max);
    const page = await fetchHotelbedsContentPage(destinationCode, from, to);
    if (page.length === 0) break;
    for (const d of page) {
      try {
        await cacheHotelContent(d, destinationCode);
        cached++;
      } catch {
        // skip a malformed record, keep going
      }
    }
    if (page.length < PAGE) break; // last page
  }
  return cached;
}
