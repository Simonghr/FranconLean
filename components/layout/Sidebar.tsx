"use client"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  LayoutDashboard, TrendingUp, AlertTriangle, Star,
  Layers, MapPin, Settings, Activity, LogOut, Brain, ListChecks
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useAuth } from "@/lib/context/AuthContext"

const navItems = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Tableau de bord" },
  { href: "/ameliorations", icon: ListChecks, label: "Anniversaire" },
  { href: "/performance", icon: TrendingUp, label: "Performance CA" },
  { href: "/incidents", icon: AlertTriangle, label: "Incidents" },
  { href: "/gx", icon: Star, label: "GX Score" },
  { href: "/lean", icon: Layers, label: "Lean Tools" },
  { href: "/intelligence", icon: Brain, label: "Intelligence" },
  { href: "/sites", icon: MapPin, label: "Sites" },
  { href: "/settings", icon: Settings, label: "Paramètres" },
]

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { user, signOut } = useAuth()

  const handleSignOut = async () => {
    await signOut()
    router.push("/login")
  }

  const displayName = user?.user_metadata?.name
    ?? user?.email?.split("@")[0]
    ?? "Utilisateur"
  const initial = displayName.charAt(0).toUpperCase()

  return (
    <aside className="flex flex-col w-64 min-h-screen bg-slate-900 border-r border-slate-800 flex-shrink-0">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-slate-800">
        <div className="w-9 h-9 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
          <Activity className="w-5 h-5 text-white" />
        </div>
        <div>
          <div className="font-bold text-white text-base leading-tight">FranconLean</div>
          <div className="text-xs text-slate-500">Management Visuel</div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {navItems.map(({ href, icon: Icon, label }) => {
          const isActive = pathname === href || (href !== "/dashboard" && pathname.startsWith(href))
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
                isActive
                  ? "bg-blue-600/20 text-blue-400 border border-blue-500/30"
                  : "text-slate-400 hover:text-white hover:bg-slate-800/60"
              )}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {label}
            </Link>
          )
        })}
      </nav>

      {/* Bottom user section */}
      <div className="px-3 py-4 border-t border-slate-800">
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg">
          <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white text-sm font-semibold flex-shrink-0">
            {initial}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-white truncate">{displayName}</div>
            <div className="text-xs text-slate-400 truncate">{user?.email ?? ""}</div>
          </div>
          <button
            onClick={handleSignOut}
            className="text-slate-500 hover:text-slate-300 transition-colors p-1"
            title="Se déconnecter"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  )
}
