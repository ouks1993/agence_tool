import Link from "next/link"
import { eq } from "drizzle-orm"
import { AcceptInviteForm } from "@/components/auth/accept-invite-form"
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

  if (!invite) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle>Invite not found</CardTitle>
            <CardDescription>
              This invite is invalid or has expired.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Link href="/login" className="text-primary text-sm hover:underline">
              Go to sign in
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
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle>Join {agencyName}</CardTitle>
          <CardDescription>
            You&apos;ve been invited to join as{" "}
            <span className="font-medium">{roleLabel}</span>. Set up your account
            to get started.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center">
          <AcceptInviteForm email={invite.email} />
        </CardContent>
      </Card>
    </div>
  )
}
