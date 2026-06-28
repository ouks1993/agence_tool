/**
 * Provider environment configuration.
 *
 * Single entry point for all environment → provider resolution. No other file
 * should read process.env for supplier credentials — always call these functions.
 *
 * Environment tier is controlled by ATLAS_ENV:
 *   (unset / "development") → mock providers, no credentials needed
 *   "sandbox"               → Duffel sandbox token + Hotelbeds test hostname
 *   "production"            → Duffel production token + Hotelbeds production hostname
 *
 * Swapping sandbox → production is a single env-var change. No business logic
 * differs between tiers — only credentials and hostnames change.
 */

export type EnvironmentTier = "development" | "sandbox" | "production";

export type FlightProviderConfig =
  | { provider: "duffel"; token: string; version: string; mode: EnvironmentTier }
  | { provider: "mock"; version: string; mode: "development" };

export type HotelProviderConfig =
  | { provider: "hotelbeds"; apiKey: string; secret: string; hostname: string; mode: EnvironmentTier }
  | { provider: "mock"; hostname: string; mode: "development" };

/** Resolves the runtime environment tier from ATLAS_ENV. Defaults to "development". */
export function resolveEnvironmentTier(): EnvironmentTier {
  const env = process.env.ATLAS_ENV;
  if (env === "production") return "production";
  if (env === "sandbox") return "sandbox";
  return "development";
}

/**
 * Returns the resolved flight provider configuration.
 *
 * When DUFFEL_API_TOKEN is set the Duffel provider is used regardless of tier —
 * the token itself determines whether calls hit sandbox or production (Duffel
 * uses the same API surface for both; the token encodes the environment).
 */
export function getFlightProviderConfig(): FlightProviderConfig {
  const token = process.env.DUFFEL_API_TOKEN;
  const version = process.env.DUFFEL_VERSION ?? "v2";
  const mode = resolveEnvironmentTier();

  if (token) {
    return { provider: "duffel", token, version, mode };
  }

  return { provider: "mock", version, mode: "development" };
}

/**
 * Returns the resolved hotel provider configuration.
 *
 * Hotelbeds uses different hostnames for test and production:
 *   test:       https://api.test.hotelbeds.com  (default)
 *   production: https://api.hotelbeds.com
 *
 * Set HOTELBEDS_HOSTNAME explicitly to override.
 */
export function getHotelProviderConfig(): HotelProviderConfig {
  const apiKey = process.env.HOTELBEDS_API_KEY;
  const secret = process.env.HOTELBEDS_SECRET;
  const mode = resolveEnvironmentTier();

  const defaultHostname =
    mode === "production"
      ? "https://api.hotelbeds.com"
      : "https://api.test.hotelbeds.com";

  const hostname = process.env.HOTELBEDS_HOSTNAME ?? defaultHostname;

  if (apiKey && secret) {
    return { provider: "hotelbeds", apiKey, secret, hostname, mode };
  }

  return { provider: "mock", hostname, mode: "development" };
}
