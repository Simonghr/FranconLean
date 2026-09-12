import { AuthProvider } from "@/lib/context/AuthContext"
import { SiteProvider } from "@/lib/context/SiteContext"
import { AppShell } from "@/components/layout/AppShell"

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <SiteProvider>
        <AppShell>{children}</AppShell>
      </SiteProvider>
    </AuthProvider>
  )
}
