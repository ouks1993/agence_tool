import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { SignInButton } from "@/components/auth/sign-in-button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { auth } from "@/lib/auth"

/** Friendly messages for the `?error=` codes redirected here by the auth guards. */
const ERROR_MESSAGES: Record<string, string> = {
  account_disabled:
    "Your account has been deactivated. Contact your administrator.",
  agency_suspended:
    "Your agency has been suspended. Contact your administrator.",
  subscription_inactive:
    "Your agency's subscription is inactive. Ask an admin to update billing.",
  no_agency: "Your account isn't linked to an agency yet.",
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ reset?: string; error?: string }>
}) {
  const session = await auth.api.getSession({ headers: await headers() })

  if (session) {
    redirect("/dashboard")
  }

  const t = await getTranslations("login")

  const { reset, error } = await searchParams
  const errorMessage = error ? ERROR_MESSAGES[error] : undefined

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle>{t("welcome")}</CardTitle>
          <CardDescription>{t("subtitle")}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center">
          {reset === "success" && (
            <p className="mb-4 text-sm text-green-600 dark:text-green-400">
              Password reset successfully. Please sign in with your new password.
            </p>
          )}
          {errorMessage && (
            <p className="mb-4 text-sm text-destructive">{errorMessage}</p>
          )}
          <SignInButton />
        </CardContent>
      </Card>
    </div>
  )
}
