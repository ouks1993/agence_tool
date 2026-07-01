import { getTranslations } from "next-intl/server"
import { APP_NAME, APP_TAGLINE } from "@/lib/config"

/**
 * Atlas brand lockup for the auth surfaces: a gradient compass logo-mark chip +
 * the product wordmark and a muted tagline. Rendered once by the (auth) layout
 * so every auth/invite screen inherits identical branding.
 */
export async function AuthBrand() {
  const t = await getTranslations("auth")

  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <div
        className="flex size-14 items-center justify-center rounded-xl text-white shadow-lg"
        style={{
          background: "linear-gradient(150deg, #2B59C3, #3B5B9A)",
          boxShadow: "0 16px 40px rgba(43, 89, 195, 0.45)",
        }}
      >
        <svg viewBox="0 0 24 24" className="size-7" aria-hidden="true">
          <path
            d="M12 4l2 6 6 2-6 2-2 6-2-6-6-2 6-2z"
            fill="currentColor"
          />
        </svg>
      </div>
      <div className="space-y-1">
        <div className="text-2xl font-bold tracking-tight text-foreground">
          {APP_NAME}{" "}
          <span className="text-muted-foreground font-semibold">
            {APP_TAGLINE}
          </span>
        </div>
        <p className="text-muted-foreground text-sm">{t("tagline")}</p>
      </div>
    </div>
  )
}
