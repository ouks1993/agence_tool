import Link from "next/link"
import { eq } from "drizzle-orm"
import { getTranslations } from "next-intl/server"
import { AcceptInviteForm } from "@/components/auth/accept-invite-form"
import { AuthBrand } from "@/components/auth/auth-brand"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { db } from "@/lib/db"
import { USER_ROLE_META } from "@/lib/domain"
import type { UserRole } from "@/lib/domain"
import { findPendingInviteByToken } from "@/lib/invites"
import { agency } from "@/lib/schema"

export const metadata = { title: "Accept invite" }

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const invite = await findPendingInviteByToken(token)
  const t = await getTranslations("invite")

  if (!invite) {
    return (
      <div className="auth-bg flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center gap-8 p-4">
        <AuthBrand />
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl tracking-tight">
              {t("notFoundTitle")}
            </CardTitle>
            <CardDescription>{t("notFoundBody")}</CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Link href="/login" className="text-primary text-sm hover:underline">
              {t("goToSignIn")}
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  const ag = await db.query.agency.findFirst({
    where: eq(agency.id, invite.agencyId),
    columns: { name: true },
  })
  const agencyName = ag?.name ?? "your agency"
  const roleLabel = USER_ROLE_META[invite.role as UserRole].label

  return (
    <div className="auth-bg flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center gap-8 p-4">
      <AuthBrand />
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl tracking-tight">
            {t("joinTitle", { agency: agencyName })}
          </CardTitle>
          <CardDescription>
            {t.rich("joinBody", {
              role: () => <span className="font-medium">{roleLabel}</span>,
            })}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center">
          <AcceptInviteForm email={invite.email} />
        </CardContent>
      </Card>
    </div>
  )
}
