"use client"
import { useState, useRef, useEffect } from "react"
import { format } from "date-fns"
import { fr } from "date-fns/locale"
import { Bell, MapPin, ChevronDown, Check } from "lucide-react"
import { useAuth } from "@/lib/context/AuthContext"
import { useSite } from "@/lib/context/SiteContext"

function SiteSwitcher() {
  const { sites, siteId, currentSite, setSiteId } = useSite()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", onClick)
    return () => document.removeEventListener("mousedown", onClick)
  }, [])

  const label = currentSite?.name ?? "…"

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 rounded-lg px-2 py-1 hover:bg-slate-800 transition-colors"
      >
        <MapPin className="w-4 h-4 text-blue-400" />
        <span className="text-sm font-medium text-white">{label}</span>
        <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 w-52 bg-slate-800 border border-slate-700 rounded-lg shadow-xl py-1 z-50">
          <div className="px-3 py-1.5 text-xs text-slate-500 uppercase tracking-widest font-semibold">
            Parc
          </div>
          {sites.map(site => (
            <button
              key={site.id}
              onClick={() => { setSiteId(site.id); setOpen(false) }}
              className="w-full flex items-center justify-between px-3 py-2 text-sm text-slate-300 hover:bg-slate-700/60 hover:text-white transition-colors"
            >
              <span>{site.name}</span>
              {site.id === siteId && <Check className="w-4 h-4 text-blue-400" />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export function Header() {
  const { user } = useAuth()
  const today = new Date()
  const dateStr = format(today, "EEEE d MMMM yyyy", { locale: fr })
  const dateFormatted = dateStr.charAt(0).toUpperCase() + dateStr.slice(1)
  const displayName = user?.user_metadata?.name ?? user?.email?.split("@")[0] ?? ""

  return (
    <header className="h-14 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-6 flex-shrink-0">
      <div className="flex items-center gap-3">
        <SiteSwitcher />
        <span className="text-slate-700">•</span>
        <span className="text-sm text-slate-400">{dateFormatted}</span>
      </div>

      <div className="flex items-center gap-3">
        <button className="relative text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors">
          <Bell className="w-5 h-5" />
          <span className="absolute top-0.5 right-0.5 w-2 h-2 bg-orange-500 rounded-full" />
        </button>
        {displayName && (
          <div className="flex items-center gap-2 pl-3 border-l border-slate-800">
            <div className="w-7 h-7 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-semibold">
              {displayName.charAt(0).toUpperCase()}
            </div>
            <span className="text-sm text-slate-300">{displayName}</span>
          </div>
        )}
      </div>
    </header>
  )
}
