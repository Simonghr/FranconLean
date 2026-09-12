"use client"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  LayoutDashboard, TrendingUp, AlertTriangle, Star,
  Layers, MapPin, Settings, Activity, LogOut, Brain, ListChecks, ClipboardList,
  ChevronsLeft, ChevronsRight
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useAuth } from "@/lib/context/AuthContext"
import { isPathAllowed } from "@/lib/access"

const navItems = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Tableau de bord" },
  { href: "/ameliorations", icon: ListChecks, label: "Anniversaire" },
  { href: "/performance", icon: TrendingUp, label: "Performance CA" },
  { href: "/cadencier", icon: ClipboardList, label: "Cadencier" },
  { href: "/incidents", icon: AlertTriangle, label: "Incidents" },
  { href: "/gx", icon: Star, label: "GX Score" },
  { href: "/lean", icon: Layers, label: "Lean Tools" },
  { href: "/intelligence", icon: Brain, label: "Intelligence" },
  { href: "/sites", icon: MapPin, label: "Sites" },
  { href: "/settings", icon: Settings, label: "Paramètres" },
]

interface Props {
  open?: boolean
  onClose?: () => void
  collapsed?: boolean          // icon-only rail on desktop
  onToggleCollapse?: () => void
}

export function Sidebar({ open = false, onClose, collapsed = false, onToggleCollapse }: Props) {
  const pathname = usePathname()
  const router = useRouter()
  const { user, role, signOut } = useAuth()

  const handleSignOut = async () => {
    await signOut()
    router.push("/login")
  }

  const displayName = user?.user_metadata?.name
    ?? user?.email?.split("@")[0]
    ?? "Utilisateur"
  const initial = displayName.charAt(0).toUpperCase()

  // `collapsed` only applies on md+ (mobile always shows the full drawer).
  const hideOnCollapse = collapsed ? "md:hidden" : ""

  return (
    <>
      {/* Mobile backdrop */}
      <div
        onClick={onClose}
        className={cn(
          "fixed inset-0 z-40 bg-black/60 md:hidden transition-opacity",
          open ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
      />
    <aside className={cn(
      "flex flex-col w-64 bg-slate-900 border-r border-slate-800 flex-shrink-0 z-50",
      "fixed inset-y-0 left-0 h-full transform transition-all duration-200 md:static md:h-auto md:min-h-screen md:translate-x-0",
      open ? "translate-x-0" : "-translate-x-full",
      collapsed ? "md:w-16" : "md:w-64"
    )}>
      {/* Logo */}
      <div className={cn("flex items-center gap-3 px-5 py-5 border-b border-slate-800", collapsed && "md:px-0 md:justify-center")}>
        <div className="w-9 h-9 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
          <Activity className="w-5 h-5 text-white" />
        </div>
        <div className={hideOnCollapse}>
          <div className="font-bold text-white text-base leading-tight">FranconLean</div>
          <div className="text-xs text-slate-500">Management Visuel</div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {navItems.filter(item => isPathAllowed(role, item.href)).map(({ href, icon: Icon, label }) => {
          const isActive = pathname === href || (href !== "/dashboard" && pathname.startsWith(href))
          return (
            <Link
              key={href}
              href={href}
              onClick={onClose}
              title={label}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
                collapsed && "md:justify-center md:px-0",
                isActive
                  ? "bg-blue-600/20 text-blue-400 border border-blue-500/30"
                  : "text-slate-400 hover:text-white hover:bg-slate-800/60"
              )}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              <span className={hideOnCollapse}>{label}</span>
            </Link>
          )
        })}
      </nav>

      {/* Collapse toggle (desktop only) */}
      {onToggleCollapse && (
        <button
          onClick={onToggleCollapse}
          title={collapsed ? "Déplier le menu" : "Réduire le menu"}
          className={cn(
            "hidden md:flex items-center gap-3 mx-3 mb-1 px-3 py-2 rounded-lg text-sm font-medium text-slate-500 hover:text-white hover:bg-slate-800/60 transition-colors",
            collapsed && "md:justify-center md:px-0"
          )}
        >
          {collapsed ? <ChevronsRight className="w-4 h-4 flex-shrink-0" /> : <ChevronsLeft className="w-4 h-4 flex-shrink-0" />}
          <span className={hideOnCollapse}>Réduire</span>
        </button>
      )}

      {/* Bottom user section */}
      <div className="px-3 py-4 border-t border-slate-800">
        <div className={cn("flex items-center gap-3 px-3 py-2.5 rounded-lg", collapsed && "md:px-0 md:justify-center")}>
          <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white text-sm font-semibold flex-shrink-0">
            {initial}
          </div>
          <div className={cn("flex-1 min-w-0", hideOnCollapse)}>
            <div className="text-sm font-medium text-white truncate">{displayName}</div>
            <div className="text-xs text-slate-400 truncate">{user?.email ?? ""}</div>
          </div>
          <button
            onClick={handleSignOut}
            className={cn("text-slate-500 hover:text-slate-300 transition-colors p-1", collapsed && "md:hidden")}
            title="Se déconnecter"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
    </>
  )
}
