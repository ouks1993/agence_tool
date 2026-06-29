/**
 * Best-effort country → flag emoji. Returns null when we can't confidently map
 * the input, so callers simply omit the flag rather than show a wrong one.
 *
 * The destination field is free text (a city or country), so we match a small
 * set of common travel countries by name. No fabricated data — an unknown
 * destination yields no flag.
 */
const NAME_TO_ISO: Record<string, string> = {
  algeria: "DZ",
  "united arab emirates": "AE",
  uae: "AE",
  dubai: "AE",
  "abu dhabi": "AE",
  france: "FR",
  paris: "FR",
  qatar: "QA",
  doha: "QA",
  turkey: "TR",
  türkiye: "TR",
  istanbul: "TR",
  "united kingdom": "GB",
  uk: "GB",
  england: "GB",
  london: "GB",
  "saudi arabia": "SA",
  morocco: "MA",
  tunisia: "TN",
  egypt: "EG",
  spain: "ES",
  italy: "IT",
  germany: "DE",
  switzerland: "CH",
  "united states": "US",
  usa: "US",
  canada: "CA",
  maldives: "MV",
  thailand: "TH",
  malaysia: "MY",
  indonesia: "ID",
  singapore: "SG",
  japan: "JP",
  "south africa": "ZA",
  greece: "GR",
  portugal: "PT",
  netherlands: "NL",
  belgium: "BE",
  austria: "AT",
};

function isoToEmoji(iso: string): string {
  return iso
    .toUpperCase()
    .replace(/./g, (ch) =>
      String.fromCodePoint(127397 + ch.charCodeAt(0))
    );
}

/** Returns a flag emoji for a destination/country string, or null if unknown. */
export function flagFor(input: string | null | undefined): string | null {
  if (!input) return null;
  const key = input.trim().toLowerCase();
  // Try the whole string, then the leading token (e.g. "Dubai · 5 nights").
  const direct = NAME_TO_ISO[key];
  if (direct) return isoToEmoji(direct);
  const first = key.split(/[\s·,(]/)[0];
  if (first && NAME_TO_ISO[first]) return isoToEmoji(NAME_TO_ISO[first]);
  return null;
}
