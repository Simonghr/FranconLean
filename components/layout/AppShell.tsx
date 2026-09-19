"use client"
import { useState, useEffect } from "react"
import { Eye, X } from "lucide-react"
import { Sidebar } from "@/components/layout/Sidebar"
import { Header } from "@/components/layout/Header"
import { useAuth } from "@/lib/context/AuthContext"

const VIEW_LABELS: Record<string, string> = {
  admin: "Admin", direction: "Direction", manager: "Manager", staff: "Staff",
}

function PreviewBanner() {
  const { viewRole, setViewRole, isAdmin } = useAuth()
  if (!isAdmin || !viewRole) return null
  return (
    <div className="bg-amber-500/15 border-b border-amber-500/40 text-amber-200 text-sm px-4 py-1.5 flex items-center justify-center gap-3">
      <Eye className="w-4 h-4 flex-shrink-0" />
      <span>Aperçu en tant que <span className="font-semibold">{VIEW_LABELS[viewRole] ?? viewRole}</span></span>
      <button onClick={() => setViewRole(null)} className="inline-flex items-center gap-1 text-amber-100 hover:text-white underline">
        <X className="w-3.5 h-3.5" /> Revenir en Admin
      </button>
    </div>
  )
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false)   // mobile drawer
  const [collapsed, setCollapsed] = useState(true)  // desktop icon rail (default: minimised)

  useEffect(() => {
    try {
      const v = localStorage.getItem("sidebarCollapsed")
      if (v !== null) setCollapsed(v === "1")
    } catch { /* ignore */ }
  }, [])

  const toggleCollapsed = () => setCollapsed(c => {
    const next = !c
    try { localStorage.setItem("sidebarCollapsed", next ? "1" : "0") } catch { /* ignore */ }
    return next
  })

  return (
    <div className="flex h-screen bg-slate-950 overflow-hidden">
      <Sidebar open={menuOpen} onClose={() => setMenuOpen(false)} collapsed={collapsed} onToggleCollapse={toggleCollapsed} />
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <Header onMenu={() => setMenuOpen(true)} />
        <PreviewBanner />
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
