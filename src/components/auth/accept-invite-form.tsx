"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { toast } from "sonner"
import { PasswordInput } from "@/components/auth/password-input"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { signUp } from "@/lib/auth-client"
import { MIN_PASSWORD_LENGTH } from "@/lib/config"

/**
 * Sign-up form for accepting an invite. The email is fixed by the invite (the
 * server-side signup hook requires it to match a pending invite), so it is
 * shown read-only and the user only chooses a name + password.
 */
export function AcceptInviteForm({ email }: { email: string }) {
  const router = useRouter()
  const t = useTranslations("invite")
  const tAuth = useTranslations("auth")
  const [name, setName] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [error, setError] = useState("")
  const [isPending, setIsPending] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    if (password !== confirmPassword) {
      setError(tAuth("passwordsDoNotMatch"))
      return
    }

    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(tAuth("passwordTooShort"))
      return
    }

    setIsPending(true)

    try {
      const result = await signUp.email({ name, email, password })

      if (result.error) {
        setError(result.error.message || t("failed"))
      } else {
        toast.success(t("welcome"))
        router.push("/dashboard")
        router.refresh()
      }
    } catch {
      setError(tAuth("unexpectedError"))
    } finally {
      setIsPending(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">{t("email")}</Label>
        <Input id="email" type="email" value={email} readOnly disabled />
      </div>
      <div className="space-y-2">
        <Label htmlFor="name">{t("name")}</Label>
        <Input
          id="name"
          type="text"
          placeholder={t("namePlaceholder")}
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          disabled={isPending}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">{t("password")}</Label>
        <PasswordInput
          id="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          disabled={isPending}
          aria-invalid={error ? true : undefined}
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
          aria-invalid={error ? true : undefined}
        />
      </div>
      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? t("creating") : t("accept")}
      </Button>
    </form>
  )
}
