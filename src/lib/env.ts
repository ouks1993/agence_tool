import { z } from "zod";

/**
 * Server-side environment variables schema.
 * These variables are only available on the server.
 */
const serverEnvSchema = z.object({
  // Database
  POSTGRES_URL: z.string().url("Invalid database URL"),

  // Authentication
  BETTER_AUTH_SECRET: z
    .string()
    .min(32, "BETTER_AUTH_SECRET must be at least 32 characters"),

  // OAuth
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),

  // AI — Gemini is the primary provider; OpenRouter is the automatic fallback.
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().default("gemini-2.5-flash"),
  OPENROUTER_API_KEY: z.string().optional(),
  OPENROUTER_MODEL: z.string().default("openai/gpt-5-mini"),

  // Storage
  BLOB_READ_WRITE_TOKEN: z.string().optional(),

  // Email (Resend)
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().optional(),

  // Billing (Stripe — vendor bills agencies)
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_PRICE_ID: z.string().optional(),

  // Payments (Stripe Connect — traveler → agency, with a platform fee)
  STRIPE_CONNECT_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_PLATFORM_FEE_PERCENT: z.coerce.number().default(5),

  // Travel suppliers (flights via Duffel, hotels via Hotelbeds)
  DUFFEL_API_TOKEN: z.string().optional(),
  DUFFEL_VERSION: z.string().optional(),
  // Legacy flights provider (Amadeus self-service is decommissioned 2026-07-17)
  AMADEUS_CLIENT_ID: z.string().optional(),
  AMADEUS_CLIENT_SECRET: z.string().optional(),
  AMADEUS_HOSTNAME: z.string().optional(),
  HOTELBEDS_API_KEY: z.string().optional(),
  HOTELBEDS_SECRET: z.string().optional(),
  HOTELBEDS_HOSTNAME: z.string().optional(),

  // Scheduled jobs (Vercel Cron sends this as a Bearer token to /api/cron/*)
  CRON_SECRET: z.string().optional(),

  // App
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
});

/**
 * Client-side environment variables schema.
 * These variables are exposed to the browser via NEXT_PUBLIC_ prefix.
 */
const clientEnvSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;
export type ClientEnv = z.infer<typeof clientEnvSchema>;

/**
 * Validates and returns server-side environment variables.
 * Throws an error if validation fails.
 */
export function getServerEnv(): ServerEnv {
  const parsed = serverEnvSchema.safeParse(process.env);

  if (!parsed.success) {
    console.error(
      "Invalid server environment variables:",
      parsed.error.flatten().fieldErrors
    );
    throw new Error("Invalid server environment variables");
  }

  return parsed.data;
}

/**
 * Validates and returns client-side environment variables.
 * Throws an error if validation fails.
 */
export function getClientEnv(): ClientEnv {
  const parsed = clientEnvSchema.safeParse({
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  });

  if (!parsed.success) {
    console.error(
      "Invalid client environment variables:",
      parsed.error.flatten().fieldErrors
    );
    throw new Error("Invalid client environment variables");
  }

  return parsed.data;
}

/**
 * Checks if required environment variables are set.
 * Logs warnings for missing optional variables.
 */
export function checkEnv(): void {
  const warnings: string[] = [];

  // Check required variables
  if (!process.env.POSTGRES_URL) {
    throw new Error("POSTGRES_URL is required");
  }

  if (!process.env.BETTER_AUTH_SECRET) {
    throw new Error("BETTER_AUTH_SECRET is required");
  }

  // Check optional variables and warn
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    warnings.push("Google OAuth is not configured. Social login will be disabled.");
  }

  if (!process.env.GEMINI_API_KEY && !process.env.OPENROUTER_API_KEY) {
    warnings.push(
      "No AI provider configured. Set GEMINI_API_KEY (primary) or OPENROUTER_API_KEY (fallback). AI features will not work."
    );
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    warnings.push("BLOB_READ_WRITE_TOKEN is not set. Using local storage for file uploads.");
  }

  if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM) {
    warnings.push("RESEND_API_KEY / EMAIL_FROM are not set. Emails will be logged to the console instead of sent.");
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    warnings.push("STRIPE_SECRET_KEY is not set. SaaS subscription billing is disabled.");
  }

  if (!process.env.DUFFEL_API_TOKEN && !process.env.AMADEUS_CLIENT_ID) {
    warnings.push("DUFFEL_API_TOKEN is not set. Flight search uses sample data.");
  }

  if (!process.env.HOTELBEDS_API_KEY || !process.env.HOTELBEDS_SECRET) {
    warnings.push("Hotelbeds keys are not set. Hotel search uses sample data.");
  }

  if (!process.env.CRON_SECRET) {
    warnings.push("CRON_SECRET is not set. The scheduled cleanup job (/api/cron/cleanup) will return 503.");
  }

  // Log warnings in development
  if (process.env.NODE_ENV === "development" && warnings.length > 0) {
    console.warn("\n⚠️  Environment warnings:");
    warnings.forEach((w) => console.warn(`   - ${w}`));
    console.warn("");
  }
}
