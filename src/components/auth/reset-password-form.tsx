"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useTranslations } from "next-intl"
import { PasswordInput } from "@/components/auth/password-input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { resetPassword } from "@/lib/auth-client"
import { MIN_PASSWORD_LENGTH } from "@/lib/config"

export function ResetPasswordForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get("token")
  const error = searchParams.get("error")
  const t = useTranslations("resetPassword")
  const tAuth = useTranslations("auth")

  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [formError, setFormError] = useState("")
  const [isPending, setIsPending] = useState(false)

  if (error === "invalid_token" || !token) {
    return (
      <div className="w-full max-w-sm space-y-4 text-center">
        <p role="alert" className="text-destructive text-sm">
          {error === "invalid_token" ? t("invalidTitle") : t("noToken")}
        </p>
        <Button asChild variant="outline" className="w-full">
          <Link href="/forgot-password">{t("requestNew")}</Link>
        </Button>
      </div>
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError("")

    if (password !== confirmPassword) {
      setFormError(tAuth("passwordsDoNotMatch"))
      return
    }

    if (password.length < MIN_PASSWORD_LENGTH) {
      setFormError(tAuth("passwordTooShort"))
      return
    }

    setIsPending(true)

    try {
      const result = await resetPassword({
        newPassword: password,
        token,
      })

      if (result.error) {
        setFormError(result.error.message || t("failed"))
      } else {
        router.push("/login?reset=success")
      }
    } catch {
      setFormError(tAuth("unexpectedError"))
    } finally {
      setIsPending(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
      <div className="space-y-2">
        <Label htmlFor="password">{t("newPassword")}</Label>
        <PasswordInput
          id="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          disabled={isPending}
          aria-invalid={formError ? true : undefined}
        />
        <p className="text-muted-foreground text-xs">{tAuth("passwordHint")}</p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirmPassword">{t("confirmPassword")}</Label>
        <PasswordInput
          id="confirmPassword"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
          disabled={isPending}
          aria-invalid={formError ? true : undefined}
        />
      </div>
      {formError && (
        <p role="alert" className="text-destructive text-sm">
          {formError}
        </p>
      )}
      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? t("submitting") : t("submit")}
      </Button>
    </form>
  )
}
