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

/** Maps `?error=` codes redirected here by the auth guards to i18n keys. */
const ERROR_KEYS: Record<string, string> = {
  account_disabled: "errorAccountDisabled",
  agency_suspended: "errorAgencySuspended",
  subscription_inactive: "errorSubscriptionInactive",
  no_agency: "errorNoAgency",
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
  const tAuth = await getTranslations("auth")

  const { reset, error } = await searchParams
  const errorKey = error ? ERROR_KEYS[error] : undefined

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl tracking-tight">{t("welcome")}</CardTitle>
        <CardDescription>{t("subtitle")}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col items-center">
        {reset === "success" && (
          <p className="mb-4 text-sm text-success">{tAuth("resetSuccess")}</p>
        )}
        {errorKey && (
          <p className="mb-4 text-sm text-destructive">{tAuth(errorKey)}</p>
        )}
        <SignInButton />
      </CardContent>
    </Card>
  )
}
