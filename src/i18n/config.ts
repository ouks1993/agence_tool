/** Supported locales. `ar` (Arabic) is right-to-left. */
export const LOCALES = ["en", "fr", "ar"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";

/** Cookie that stores the user's chosen locale (read by the i18n request config). */
export const LOCALE_COOKIE = "locale";

export const LOCALE_META: Record<
  Locale,
  { label: string; nativeLabel: string; dir: "ltr" | "rtl"; flag: string }
> = {
  en: { label: "English", nativeLabel: "English", dir: "ltr", flag: "🇬🇧" },
  fr: { label: "French", nativeLabel: "Français", dir: "ltr", flag: "🇫🇷" },
  ar: { label: "Arabic", nativeLabel: "العربية", dir: "rtl", flag: "🇸🇦" },
};

export function isLocale(value: string | undefined | null): value is Locale {
  return !!value && (LOCALES as readonly string[]).includes(value);
}

export function dirFor(locale: Locale): "ltr" | "rtl" {
  return LOCALE_META[locale].dir;
}
