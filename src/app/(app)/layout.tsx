import { AppShell } from "@/components/app/app-shell";
import { requireUser } from "@/lib/permissions";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();

  return (
    <AppShell
      user={{
        id: user.id,
        name: user.name,
        email: user.email,
        image: user.image,
        role: user.role,
      }}
    >
      {children}
    </AppShell>
  );
}
