import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { APIError } from "better-auth/api"
import { db } from "./db"
import { findPendingInviteByEmail, markInviteAccepted } from "./invites"

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
  }),
  user: {
    // Expose our application columns to BetterAuth so they ride along on the session.
    // `input: false` prevents clients from setting these during sign-up.
    additionalFields: {
      // The tenant this user belongs to. NULL for the platform super-admin (vendor).
      agencyId: {
        type: "string",
        required: false,
        input: false,
      },
      // The platform owner (vendor) who provisions and manages agencies.
      isPlatformAdmin: {
        type: "boolean",
        required: false,
        defaultValue: false,
        input: false,
      },
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
          // Registration is invitation-only. A new account may only be created
          // if a pending invite matches the email — that invite determines which
          // agency the user joins and with which role. This is the enforcement
          // point: it also blocks direct calls to the public sign-up endpoint.
          const invite = await findPendingInviteByEmail(newUser.email)
          if (!invite) {
            throw new APIError("FORBIDDEN", {
              message:
                "Registration is by invitation only. Ask your agency admin for an invite.",
            })
          }
          return {
            data: {
              ...newUser,
              agencyId: invite.agencyId,
              role: invite.role,
              isPlatformAdmin: false,
              active: true,
            },
          }
        },
        after: async (newUser) => {
          // Consume the invite once the account exists.
          await markInviteAccepted(newUser.email)
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
