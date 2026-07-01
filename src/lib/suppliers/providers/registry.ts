/**
 * Provider registry + capability guards (the discovery mechanism — still NO
 * provider implementations).
 *
 * Adapters register themselves here at startup instead of being hardcoded into
 * `getFlightSupplier()/getHotelSupplier()`. Resolution is by vertical +
 * capability + priority, so adding Booking.com or Expedia is a one-line
 * `register()` call with zero changes to callers.
 *
 *   // wiring (in a future ./adapters/index.ts — not in this PR):
 *   providerRegistry.register(new HotelbedsProvider());
 *   providerRegistry.register(new TravelgatexProvider());
 *
 *   // calling site (actions / AI tools):
 *   const p = providerRegistry.pick("hotels", "search");
 *   if (p && canSearchHotels(p)) return p.searchHotels(params, ctx);
 */

import type {
  AutocompleteCapable,
  BookingProvider,
  CancelCapable,
  ContentCapable,
  FlightBookingCapable,
  FlightSearchCapable,
  HotelBookingCapable,
  HotelSearchCapable,
  ProviderCapability,
  ProviderId,
  ProviderVertical,
} from "./types";

// --- Capability type guards -------------------------------------------------

export function canSearchHotels(
  p: BookingProvider
): p is BookingProvider & HotelSearchCapable {
  return typeof (p as Partial<HotelSearchCapable>).searchHotels === "function";
}

export function canBookHotels(
  p: BookingProvider
): p is BookingProvider & HotelBookingCapable {
  return typeof (p as Partial<HotelBookingCapable>).bookHotel === "function";
}

export function canSearchFlights(
  p: BookingProvider
): p is BookingProvider & FlightSearchCapable {
  return typeof (p as Partial<FlightSearchCapable>).searchFlights === "function";
}

export function canBookFlights(
  p: BookingProvider
): p is BookingProvider & FlightBookingCapable {
  return typeof (p as Partial<FlightBookingCapable>).bookFlight === "function";
}

export function canCancel(
  p: BookingProvider
): p is BookingProvider & CancelCapable {
  return typeof (p as Partial<CancelCapable>).cancel === "function";
}

export function canProvideContent(
  p: BookingProvider
): p is BookingProvider & ContentCapable {
  return typeof (p as Partial<ContentCapable>).searchHotelsByName === "function";
}

export function canAutocomplete(
  p: BookingProvider
): p is BookingProvider & AutocompleteCapable {
  return typeof (p as Partial<AutocompleteCapable>).searchAirports === "function";
}

// --- Capability → runtime-guard resolution ----------------------------------

/**
 * Maps a (vertical, capability) pair to the runtime type-guard that proves the
 * provider actually implements the underlying method. `search`/`book` resolve to
 * different guards per vertical; `quote` shares the vertical's booking guard
 * (quote lives on the `*BookingCapable` interface alongside `book`). Returns
 * `null` when a capability has no method to probe at runtime.
 */
function runtimeGuardFor(
  vertical: ProviderVertical,
  capability: ProviderCapability
): ((p: BookingProvider) => boolean) | null {
  switch (capability) {
    case "search":
      return vertical === "flights" ? canSearchFlights : canSearchHotels;
    case "book":
    case "quote":
      return vertical === "flights" ? canBookFlights : canBookHotels;
    case "cancel":
      return canCancel;
    case "content":
      return canProvideContent;
    case "autocomplete":
      return canAutocomplete;
    default:
      return null;
  }
}

/**
 * Fails loudly in development when a provider's DECLARED capabilities don't match
 * its actual implementation — e.g. it advertises "book" for hotels but has no
 * `bookHotel` method. Catching the mismatch at register() time (instead of
 * silently at selection time) turns a latent "provisional ref" degradation into
 * an obvious dev-time console error. Never throws in production.
 */
function assertCatalogParity(provider: BookingProvider): void {
  if (process.env.NODE_ENV === "production") return;

  for (const vertical of provider.verticals) {
    for (const capability of provider.capabilities) {
      const guard = runtimeGuardFor(vertical, capability);
      if (guard && !guard(provider)) {
        console.error(
          `[providerRegistry] "${provider.id}" declares "${capability}" for ` +
            `"${vertical}" but does not implement the matching method. It will ` +
            `be skipped for that capability at selection time.`
        );
      }
    }
  }
}

// --- Registry ---------------------------------------------------------------

export interface ProviderRegistry {
  /** Add a provider. Last registration for an id wins. */
  register(provider: BookingProvider): void;
  /** Every registered provider. */
  all(): BookingProvider[];
  byId(id: ProviderId): BookingProvider | undefined;
  /**
   * All providers serving a vertical (optionally filtered by capability and
   * configured-state), highest priority first.
   */
  forVertical(
    vertical: ProviderVertical,
    opts?: { capability?: ProviderCapability; configuredOnly?: boolean }
  ): BookingProvider[];
  /**
   * The single best provider for a vertical+capability (highest priority,
   * configured), or undefined. Callers fall back to the mock when undefined.
   */
  pick(
    vertical: ProviderVertical,
    capability: ProviderCapability
  ): BookingProvider | undefined;
}

export function createProviderRegistry(): ProviderRegistry {
  const byIdMap = new Map<ProviderId, BookingProvider>();

  const forVertical: ProviderRegistry["forVertical"] = (vertical, opts) => {
    const { capability, configuredOnly = false } = opts ?? {};
    // When filtering by capability, require BOTH the declared capability AND the
    // runtime method it implies. A provider that declares "book" but never
    // implements bookHotel/bookFlight would otherwise be picked and then degrade
    // to a provisional ref with no signal — so gate on the type-guard too.
    const guard = capability ? runtimeGuardFor(vertical, capability) : null;
    return [...byIdMap.values()]
      .filter((p) => p.verticals.includes(vertical))
      .filter((p) => (capability ? p.capabilities.includes(capability) : true))
      .filter((p) => (guard ? guard(p) : true))
      .filter((p) => (configuredOnly ? p.isConfigured() : true))
      .sort((a, b) => b.priority - a.priority);
  };

  return {
    register: (provider) => {
      assertCatalogParity(provider);
      byIdMap.set(provider.id, provider);
    },
    all: () => [...byIdMap.values()],
    byId: (id) => byIdMap.get(id),
    forVertical,
    pick: (vertical, capability) =>
      forVertical(vertical, { capability, configuredOnly: true })[0],
  };
}

/**
 * The process-wide registry. Intentionally EMPTY here — adapters register into
 * it during app startup (see module header). No providers are wired in this
 * architecture-only change.
 */
export const providerRegistry: ProviderRegistry = createProviderRegistry();

// --- Provider catalog (metadata only — documents intended support) ----------

export type ProviderStatus = "live" | "legacy" | "planned";

/** Static, logic-free description of a provider for docs/UI and planning. */
export type ProviderCatalogEntry = {
  id: ProviderId;
  label: string;
  verticals: ProviderVertical[];
  capabilities: ProviderCapability[];
  priority: number;
  status: ProviderStatus;
  /** Env vars whose presence means "configured". */
  envVars: string[];
};

/**
 * Declares which providers Atlas intends to support and with what capabilities.
 * `planned` entries have NO implementation yet — they exist so the registry,
 * UI, and docs share one source of truth as adapters land.
 */
export const PROVIDER_CATALOG: ProviderCatalogEntry[] = [
  {
    id: "mock",
    label: "Mock",
    verticals: ["flights", "hotels"],
    capabilities: ["search", "quote", "book", "cancel", "content", "autocomplete"],
    priority: 0,
    status: "live",
    envVars: [],
  },
  {
    id: "duffel",
    label: "Duffel",
    verticals: ["flights"],
    capabilities: ["search", "quote", "book", "cancel", "autocomplete"],
    priority: 50,
    status: "live",
    envVars: ["DUFFEL_API_TOKEN"],
  },
  {
    id: "amadeus",
    label: "Amadeus",
    verticals: ["flights", "hotels"],
    capabilities: ["search"],
    priority: 10,
    status: "legacy",
    envVars: ["AMADEUS_CLIENT_ID", "AMADEUS_CLIENT_SECRET"],
  },
  {
    id: "hotelbeds",
    label: "Hotelbeds",
    verticals: ["hotels"],
    capabilities: ["search", "content", "quote", "book", "cancel"],
    priority: 50,
    status: "live",
    envVars: ["HOTELBEDS_API_KEY", "HOTELBEDS_SECRET"],
  },
  {
    id: "travelgatex",
    label: "TravelgateX",
    verticals: ["hotels", "flights"],
    capabilities: ["search", "quote", "book", "cancel"],
    priority: 40,
    status: "planned",
    envVars: ["TRAVELGATEX_API_KEY"],
  },
  {
    id: "booking_com",
    label: "Booking.com",
    verticals: ["hotels"],
    capabilities: ["search", "content", "book", "cancel"],
    priority: 30,
    status: "planned",
    envVars: ["BOOKING_COM_API_KEY"],
  },
  {
    id: "expedia",
    label: "Expedia (Rapid)",
    verticals: ["hotels"],
    capabilities: ["search", "content", "quote", "book", "cancel"],
    priority: 30,
    status: "planned",
    envVars: ["EXPEDIA_API_KEY", "EXPEDIA_SHARED_SECRET"],
  },
];
