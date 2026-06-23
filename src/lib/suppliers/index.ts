import { AmadeusSupplier } from "./amadeus";
import { MockSupplier } from "./mock";
import type { SupplierProvider } from "./types";

export * from "./types";

/** True when live Amadeus credentials are configured. */
export function isLiveSupplierConfigured(): boolean {
  return Boolean(
    process.env.AMADEUS_CLIENT_ID && process.env.AMADEUS_CLIENT_SECRET
  );
}

let cached: SupplierProvider | null = null;

/**
 * Returns the active supplier: Amadeus when credentials exist, otherwise the
 * mock provider with realistic sample data.
 */
export function getSupplier(): SupplierProvider {
  if (cached) return cached;
  cached = isLiveSupplierConfigured()
    ? new AmadeusSupplier()
    : new MockSupplier();
  return cached;
}

/**
 * Runs a supplier search but never throws — on any live-provider error it falls
 * back to the mock so the UI/AI always get usable results.
 */
export async function safeSearch<T>(
  run: (provider: SupplierProvider) => Promise<T[]>,
  fallback: (provider: SupplierProvider) => Promise<T[]>
): Promise<{ results: T[]; source: string; degraded: boolean }> {
  const provider = getSupplier();
  try {
    const results = await run(provider);
    return { results, source: provider.label, degraded: false };
  } catch (error) {
    console.error("Supplier search failed, falling back to mock:", error);
    const mock = new MockSupplier();
    try {
      const results = await fallback(mock);
      return { results, source: mock.label, degraded: true };
    } catch (fallbackError) {
      console.error("Mock fallback also failed:", fallbackError);
      return { results: [], source: mock.label, degraded: true };
    }
  }
}
