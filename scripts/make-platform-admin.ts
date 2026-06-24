/**
 * Promotes an existing account to the platform super-admin (the vendor).
 *
 * The platform admin lives ABOVE all tenants: isPlatformAdmin = true and
 * agencyId = null, so they are routed to /platform instead of a tenant app.
 *
 * Usage:
 *   npx tsx --env-file=.env scripts/make-platform-admin.ts <email>
 */
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { user } from "@/lib/schema";

async function main() {
  const email = process.argv[2]?.trim().toLowerCase();
  if (!email) {
    console.error("Usage: tsx scripts/make-platform-admin.ts <email>");
    process.exit(1);
  }

  const existing = await db.query.user.findFirst({
    where: eq(user.email, email),
    columns: { id: true, name: true, email: true },
  });
  if (!existing) {
    console.error(`No account found for ${email}. They must register first.`);
    process.exit(1);
  }

  await db
    .update(user)
    .set({ isPlatformAdmin: true, agencyId: null, active: true })
    .where(eq(user.id, existing.id));

  console.log(
    `✓ ${existing.name} <${existing.email}> is now the platform super-admin (agencyId cleared).`
  );
  console.log("They will be routed to /platform on next sign-in.");
  process.exit(0);
}

main().catch((e) => {
  console.error("Failed:", e instanceof Error ? e.message : e);
  process.exit(1);
});
