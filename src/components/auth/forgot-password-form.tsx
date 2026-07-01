"use client"

import { useState } from "react"
import Link from "next/link"
import { MailCheck } from "lucide-react"
import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { requestPasswordReset } from "@/lib/auth-client"

export function ForgotPasswordForm() {
  const t = useTranslations("forgotPassword")
  const tAuth = useTranslations("auth")
  const [email, setEmail] = useState("")
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)
  const [isPending, setIsPending] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setIsPending(true)

    try {
      const result = await requestPasswordReset({
        email,
        redirectTo: "/reset-password",
      })

      if (result.error) {
        setError(result.error.message || t("failed"))
      } else {
        setSuccess(true)
      }
    } catch {
      setError(tAuth("unexpectedError"))
    } finally {
      setIsPending(false)
    }
  }

  if (success) {
    return (
      <div className="w-full max-w-sm space-y-4 text-center">
        <div className="bg-success-soft text-success mx-auto flex size-12 items-center justify-center rounded-full">
          <MailCheck className="size-6" aria-hidden="true" />
        </div>
        <div className="space-y-1">
          <p className="font-semibold">{t("sentTitle")}</p>
          <p className="text-muted-foreground text-sm">{t("sentBody")}</p>
        </div>
        <Button asChild variant="outline" className="w-full">
          <Link href="/login">{tAuth("backToSignIn")}</Link>
        </Button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">{t("email")}</Label>
        <Input
          id="email"
          type="email"
          placeholder={t("emailPlaceholder")}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          disabled={isPending}
          aria-invalid={error ? true : undefined}
        />
      </div>
      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? t("sending") : t("send")}
      </Button>
      <div className="text-muted-foreground text-center text-sm">
        {t("remember")}{" "}
        <Link href="/login" className="text-primary hover:underline">
          {t("signIn")}
        </Link>
      </div>
    </form>
  )
}
