"use client"
import { format } from "date-fns"
import { fr } from "date-fns/locale"
import { Bell, MapPin } from "lucide-react"

interface HeaderProps {
  siteName?: string
  userName?: string
}

export function Header({ siteName = "Franconville", userName = "Simon Gohier" }: HeaderProps) {
  const today = new Date()
  const dateStr = format(today, "EEEE d MMMM yyyy", { locale: fr })
  const dateFormatted = dateStr.charAt(0).toUpperCase() + dateStr.slice(1)

  return (
    <header className="h-14 bg-slate-900 border-b border-slate-700/50 flex items-center justify-between px-6 flex-shrink-0">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5 text-slate-400">
          <MapPin className="w-4 h-4 text-blue-400" />
          <span className="text-sm font-medium text-white">{siteName}</span>
        </div>
        <span className="text-slate-600">•</span>
        <span className="text-sm text-slate-400">{dateFormatted}</span>
      </div>

      <div className="flex items-center gap-3">
        <button className="relative text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors">
          <Bell className="w-5 h-5" />
          <span className="absolute top-0.5 right-0.5 w-2 h-2 bg-orange-500 rounded-full"></span>
        </button>
        <div className="flex items-center gap-2 pl-3 border-l border-slate-700">
          <div className="w-7 h-7 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-semibold">
            {userName.charAt(0)}
          </div>
          <span className="text-sm text-slate-300">{userName}</span>
        </div>
      </div>
    </header>
  )
}
