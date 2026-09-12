"use client"
import { useState, useEffect } from "react"
import { Sidebar } from "@/components/layout/Sidebar"
import { Header } from "@/components/layout/Header"

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
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
