import { AuthBrand } from "@/components/auth/auth-brand"

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="auth-bg flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center gap-8 p-4">
      <AuthBrand />
      {children}
    </div>
  )
}
