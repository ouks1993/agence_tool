"use client"

import * as React from "react"
import { Eye, EyeOff } from "lucide-react"
import { useTranslations } from "next-intl"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

/**
 * Password field with an inline show/hide toggle. Wraps the shared Input and
 * keeps the same tokens (destructive ring via aria-invalid, focus ring), adding
 * an Eye/EyeOff affordance so users can verify what they typed.
 */
export function PasswordInput({
  className,
  ...props
}: React.ComponentProps<typeof Input>) {
  const t = useTranslations("auth")
  const [visible, setVisible] = React.useState(false)

  return (
    <div className="relative">
      <Input
        type={visible ? "text" : "password"}
        className={cn("pe-10", className)}
        {...props}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        disabled={props.disabled}
        aria-label={visible ? t("hidePassword") : t("showPassword")}
        className="text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 absolute inset-y-0 end-0 flex items-center pe-3 outline-none focus-visible:ring-2 disabled:pointer-events-none disabled:opacity-50"
        tabIndex={-1}
      >
        {visible ? (
          <EyeOff className="size-4" aria-hidden="true" />
        ) : (
          <Eye className="size-4" aria-hidden="true" />
        )}
      </button>
    </div>
  )
}
