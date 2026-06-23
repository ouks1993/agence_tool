import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { db } from "./db"
import { user as userTable } from "./schema"

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
  }),
  user: {
    // Expose our application columns to BetterAuth so they ride along on the session.
    // `input: false` prevents clients from setting these during sign-up.
    additionalFields: {
      role: {
        type: "string",
        required: false,
        defaultValue: "agent",
        input: false,
      },
      active: {
        type: "boolean",
        required: false,
        defaultValue: true,
        input: false,
      },
    },
  },
  databaseHooks: {
    user: {
      create: {
        before: async (newUser) => {
          // The very first account to register becomes the manager (the agency owner).
          // Everyone after them is an agent by default; the manager can promote others.
          const existing = await db.$count(userTable)
          return {
            data: {
              ...newUser,
              role: existing === 0 ? "manager" : "agent",
              active: true,
            },
          }
        },
      },
    },
  },
  emailAndPassword: {
    enabled: true,
    sendResetPassword: async ({ user, url }) => {
      // Log password reset URL to terminal (no email integration yet)
      // eslint-disable-next-line no-console
      console.log(`\n${"=".repeat(60)}\nPASSWORD RESET REQUEST\nUser: ${user.email}\nReset URL: ${url}\n${"=".repeat(60)}\n`)
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    sendVerificationEmail: async ({ user, url }) => {
      // Log verification URL to terminal (no email integration yet)
      // eslint-disable-next-line no-console
      console.log(`\n${"=".repeat(60)}\nEMAIL VERIFICATION\nUser: ${user.email}\nVerification URL: ${url}\n${"=".repeat(60)}\n`)
    },
  },
})
