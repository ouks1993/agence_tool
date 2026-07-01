import { Suspense } from "react"
import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { ResetPasswordForm } from "@/components/auth/reset-password-form"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Spinner } from "@/components/ui/spinner"
import { auth } from "@/lib/auth"

export default async function ResetPasswordPage() {
  const session = await auth.api.getSession({ headers: await headers() })

  if (session) {
    redirect("/dashboard")
  }

  const t = await getTranslations("resetPassword")

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl tracking-tight">{t("title")}</CardTitle>
        <CardDescription>{t("subtitle")}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col items-center">
        <Suspense
          fallback={
            <div className="flex w-full justify-center py-6">
              <Spinner size="md" />
            </div>
          }
        >
          <ResetPasswordForm />
        </Suspense>
      </CardContent>
    </Card>
  )
}
