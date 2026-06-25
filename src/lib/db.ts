import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { getServerEnv } from "./env";
import * as schema from "./schema";

// Validate through the zod schema so a missing/malformed POSTGRES_URL (or other
// required server env) fails fast with a clear message instead of a raw driver
// error deep in the first query.
const { POSTGRES_URL: connectionString } = getServerEnv();

const client = postgres(connectionString);
export const db = drizzle(client, { schema });
