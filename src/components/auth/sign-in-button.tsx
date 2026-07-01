"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { PasswordInput } from "@/components/auth/password-input"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Spinner } from "@/components/ui/spinner"
import { syncLocaleAfterLogin } from "@/lib/actions/settings"
import { signIn, useSession } from "@/lib/auth-client"

export function SignInButton() {
  const { data: session, isPending: sessionPending } = useSession()
  const router = useRouter()
  const t = useTranslations("login")
  const tAuth = useTranslations("auth")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [isPending, setIsPending] = useState(false)

  if (sessionPending) {
    return (
      <div className="flex w-full justify-center py-6">
        <Spinner size="md" />
      </div>
    )
  }

  if (session) {
    return null
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setIsPending(true)

    try {
      const result = await signIn.email({
        email,
        password,
        callbackURL: "/dashboard",
      })

      if (result.error) {
        setError(result.error.message || tAuth("failedSignIn"))
      } else {
        // Inherit the account's stored language on this device before redirecting.
        await syncLocaleAfterLogin()
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
    <form onSubmit={handleSubmit} className="space-y-4 w-full max-w-sm">
      <div className="space-y-2">
        <Label htmlFor="email">{t("email")}</Label>
        <Input
          id="email"
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
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
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">{error}</p>
      )}
      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? tAuth("signingIn") : t("signIn")}
      </Button>
      <div className="text-center text-sm text-muted-foreground">
        <Link href="/forgot-password" className="hover:underline">
          {t("forgot")}
        </Link>
      </div>
      <div className="text-center text-sm text-muted-foreground">
        {t("noAccount")}{" "}
        <Link href="/register" className="text-primary hover:underline">
          {t("signUp")}
        </Link>
      </div>
    </form>
  )
}
