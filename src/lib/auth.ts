import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { APIError } from "better-auth/api"
import { APP_NAME } from "./config"
import { db } from "./db"
import { findPendingInviteByEmail, markInviteAccepted } from "./invites"
import { sendEmail } from "./notifications/email"
import { actionEmailHtml } from "./notifications/templates"

// Canonical app URL — used as the auth base and trusted origin. Falls back to
// the public app URL (set per-environment) and finally localhost for dev.
const baseURL =
  process.env.BETTER_AUTH_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  "http://localhost:3000"

export const auth = betterAuth({
  baseURL,
  trustedOrigins: [baseURL],
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
      // No agency context here, so we send directly without a notification row
      // (the notification log requires an agencyId). Falls back to console when
      // RESEND_API_KEY is unset.
      await sendEmail({
        to: user.email,
        subject: `Reset your ${APP_NAME} password`,
        text: `We received a request to reset your password.\n\nReset it here:\n${url}\n\nIf you didn't request this, you can safely ignore this email.`,
        html: actionEmailHtml({
          heading: "Reset your password",
          intro: "We received a request to reset your password. Click below to choose a new one.",
          url,
          cta: "Reset password",
          footnote: "If you didn't request this, you can safely ignore this email.",
        }),
      })
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    sendVerificationEmail: async ({ user, url }) => {
      await sendEmail({
        to: user.email,
        subject: `Verify your ${APP_NAME} email`,
        text: `Welcome to ${APP_NAME}!\n\nVerify your email address here:\n${url}`,
        html: actionEmailHtml({
          heading: "Verify your email",
          intro: `Welcome to ${APP_NAME}! Confirm your email address to finish setting up your account.`,
          url,
          cta: "Verify email",
        }),
      })
    },
  },
})
