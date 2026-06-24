import { inferAdditionalFields } from "better-auth/client/plugins"
import { createAuthClient } from "better-auth/react"

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
  plugins: [
    // Mirror the server-side additional user fields so the client session is typed.
    inferAdditionalFields({
      user: {
        agencyId: { type: "string", input: false },
        isPlatformAdmin: { type: "boolean", input: false },
        role: { type: "string", input: false },
        active: { type: "boolean", input: false },
      },
    }),
  ],
})

export const {
  signIn,
  signOut,
  signUp,
  useSession,
  getSession,
  requestPasswordReset,
  resetPassword,
  sendVerificationEmail,
} = authClient
