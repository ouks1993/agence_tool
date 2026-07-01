import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, desc, eq } from "drizzle-orm";
import { ArrowLeft, CreditCard, Eye, Mail, Users } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/app/page-header";
import { StatusBadge, StatusPill } from "@/components/app/status-badge";
import { AgencyStatusControls } from "@/components/platform/agency-status-controls";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { viewAsAgency, viewAsUser } from "@/lib/actions/platform";
import { db } from "@/lib/db";
import { USER_ROLE_META, USER_ROLE_TONE, type UserRole } from "@/lib/domain";
import { formatDate } from "@/lib/format";
import { requirePlatformAdmin } from "@/lib/permissions";
import { agency, agencyInvite, user } from "@/lib/schema";

/** Human label for a subscription status (Stripe values are snake_case). */
function subscriptionLabel(status: string | null, none: string): string {
  if (!status) return none;
  return status.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

export default async function AgencyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  // Guard: only the platform super-admin may view agency details.
  await requirePlatformAdmin();
  const { id } = await params;
  const t = await getTranslations("platform.detail");

  const ag = await db.query.agency.findFirst({
    where: eq(agency.id, id),
  });
  if (!ag) notFound();

  // The agency's team and its still-pending invites (scoped to this agency).
  const [members, pendingInvites] = await Promise.all([
    db
      .select({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        active: user.active,
      })
      .from(user)
      .where(eq(user.agencyId, id))
      .orderBy(asc(user.name)),
    db
      .select({
        id: agencyInvite.id,
        email: agencyInvite.email,
        role: agencyInvite.role,
        expiresAt: agencyInvite.expiresAt,
      })
      .from(agencyInvite)
      .where(
        and(eq(agencyInvite.agencyId, id), eq(agencyInvite.status, "pending"))
      )
      .orderBy(desc(agencyInvite.createdAt)),
  ]);

  const isActive = ag.status === "active";

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-8 sm:px-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href="/platform">
          <ArrowLeft className="mr-1 size-4" />
          {t("back")}
        </Link>
      </Button>

      <PageHeader title={ag.name} description={ag.slug}>
        <StatusBadge
          label={isActive ? t("activeLabel") : "Suspended"}
          variant={isActive ? "success" : "danger"}
          dot
        />
        <StatusPill
          domain="subscription"
          status={ag.subscriptionStatus}
          label={subscriptionLabel(ag.subscriptionStatus, t("noSubscription"))}
        />
        <form action={viewAsAgency.bind(null, ag.id)}>
          <Button type="submit" size="sm" variant="outline">
            <Eye className="mr-1 size-4" /> {t("viewApp")}
          </Button>
        </form>
        <AgencyStatusControls agencyId={ag.id} status={ag.status} />
      </PageHeader>

      <Card>
        <CardHeader>
          <CardTitle>{t("details")}</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-3">
          <div className="space-y-1">
            <p className="text-muted-foreground text-xs">{t("slug")}</p>
            <p className="font-mono text-sm font-medium">{ag.slug}</p>
          </div>
          <div className="space-y-1">
            <p className="text-muted-foreground text-xs">{t("status")}</p>
            <p className="font-medium capitalize">{ag.status}</p>
          </div>
          <div className="space-y-1">
            <p className="text-muted-foreground text-xs">{t("created")}</p>
            <p className="font-medium">{formatDate(ag.createdAt)}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="size-4" /> {t("subscription")}
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-3">
          <div className="space-y-1">
            <p className="text-muted-foreground text-xs">{t("status")}</p>
            <p className="font-medium">
              {subscriptionLabel(ag.subscriptionStatus, t("noSubscription"))}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-muted-foreground text-xs">
              {ag.subscriptionStatus === "trialing"
                ? t("trialEnds")
                : t("renews")}
            </p>
            <p className="font-medium">
              {ag.subscriptionStatus === "trialing"
                ? ag.trialEndsAt
                  ? formatDate(ag.trialEndsAt)
                  : "—"
                : ag.currentPeriodEnd
                  ? formatDate(ag.currentPeriodEnd)
                  : "—"}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-muted-foreground text-xs">
              {t("stripeCustomer")}
            </p>
            <p
              className="truncate font-mono text-xs font-medium"
              title={ag.stripeCustomerId ?? undefined}
            >
              {ag.stripeCustomerId ?? t("notProvisioned")}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="size-4" /> {t("members")} ({members.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {members.length === 0 ? (
            <p className="text-muted-foreground px-6 py-8 text-sm">
              {t("noMembers")}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("member")}</TableHead>
                  <TableHead>{t("role")}</TableHead>
                  <TableHead>{t("access")}</TableHead>
                  <TableHead align="right">{t("actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((m) => (
                  <TableRow key={m.id} className={m.active ? "" : "opacity-60"}>
                    <TableCell>
                      <p className="font-medium">{m.name}</p>
                      <p className="text-muted-foreground text-xs">{m.email}</p>
                    </TableCell>
                    <TableCell>
                      <StatusBadge
                        label={USER_ROLE_META[m.role as UserRole].label}
                        variant={USER_ROLE_TONE[m.role as UserRole]}
                      />
                    </TableCell>
                    <TableCell>
                      <StatusBadge
                        label={m.active ? t("activeLabel") : t("inactiveLabel")}
                        variant={m.active ? "success" : "danger"}
                        dot
                      />
                    </TableCell>
                    <TableCell align="right">
                      <form action={viewAsUser.bind(null, m.id)} className="inline">
                        <Button type="submit" variant="outline" size="sm">
                          <Eye className="mr-1 size-4" /> {t("viewAs")}
                        </Button>
                      </form>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="size-4" /> {t("pendingInvites")} (
            {pendingInvites.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {pendingInvites.length === 0 ? (
            <p className="text-muted-foreground px-6 py-8 text-sm">
              {t("noInvites")}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("email")}</TableHead>
                  <TableHead>{t("role")}</TableHead>
                  <TableHead>{t("expires")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingInvites.map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell className="font-medium">{inv.email}</TableCell>
                    <TableCell>
                      <StatusBadge
                        label={USER_ROLE_META[inv.role as UserRole].label}
                        variant={USER_ROLE_TONE[inv.role as UserRole]}
                      />
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(inv.expiresAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
