"use client"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard, TrendingUp, AlertTriangle, MessageSquare,
  Layers, MapPin, Settings, Activity, LogOut
} from "lucide-react"
import { cn } from "@/lib/utils"

const navItems = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Tableau de bord" },
  { href: "/performance", icon: TrendingUp, label: "Performance CA" },
  { href: "/incidents", icon: AlertTriangle, label: "Incidents" },
  { href: "/feedback", icon: MessageSquare, label: "Retours Clients" },
  { href: "/lean", icon: Layers, label: "Lean Tools" },
  { href: "/sites", icon: MapPin, label: "Sites" },
  { href: "/settings", icon: Settings, label: "Paramètres" },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="flex flex-col w-64 min-h-screen bg-slate-900 border-r border-slate-700/50">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-slate-700/50">
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
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                isActive
                  ? "bg-blue-600/20 text-blue-400 border border-blue-500/30"
                  : "text-slate-400 hover:text-white hover:bg-slate-800"
              )}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {label}
              {href === "/incidents" && (
                <span className="ml-auto bg-orange-500 text-white text-xs rounded-full px-1.5 py-0.5 leading-none">
                  3
                </span>
              )}
            </Link>
          )
        })}
      </nav>

      {/* Bottom user section */}
      <div className="px-3 py-4 border-t border-slate-700/50">
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg">
          <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white text-sm font-semibold flex-shrink-0">
            S
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-white truncate">Simon Gohier</div>
            <div className="text-xs text-slate-400 truncate">Directeur</div>
          </div>
          <button className="text-slate-500 hover:text-slate-300">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  )
}
