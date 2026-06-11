"use client"
import { format } from "date-fns"
import { fr } from "date-fns/locale"
import { Users, CheckCircle2, Calendar } from "lucide-react"
import type { DailyBriefing } from "@/lib/types"

interface BriefingHeaderProps {
  briefing: DailyBriefing
  siteName: string
}

function Avatar({ name, role, present, color = "bg-blue-600" }: {
  name: string; role: string; present: boolean; color?: string
}) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative">
        <div className={`w-10 h-10 rounded-full ${present ? color : "bg-slate-600"} flex items-center justify-center text-white text-sm font-semibold`}>
          {name.charAt(0)}
        </div>
        <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-slate-800 ${present ? "bg-green-400" : "bg-slate-500"}`} />
      </div>
      <div className="text-center">
        <div className="text-xs font-medium text-white leading-none">{name}</div>
        <div className="text-xs text-slate-400 leading-none mt-0.5">{role}</div>
      </div>
    </div>
  )
}

export function BriefingHeader({ briefing, siteName }: BriefingHeaderProps) {
  const dateStr = format(new Date(briefing.date), "EEEE d MMMM", { locale: fr })
  const dateFormatted = dateStr.charAt(0).toUpperCase() + dateStr.slice(1)

  const caisse = briefing.team.filter(m => m.role.includes("Caisse"))
  const trampoline = briefing.team.filter(m => m.role.includes("Trampoline"))
  const anniversaire = briefing.team.filter(m => m.role.includes("Anniversaire"))
  const restauration = briefing.team.filter(m => m.role.includes("Restauration"))
  const management = briefing.team.filter(m =>
    m.role === "Directeur" || m.role === "Adjointe" || m.role === "Resp. Zone"
  )

  const presentCount = briefing.team.filter(m => m.present).length

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
      {/* Site & date bar */}
      <div className="flex items-center justify-between px-5 py-3 bg-slate-900/60 border-b border-slate-700">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          <h1 className="text-lg font-bold text-white tracking-tight">{siteName}</h1>
          <span className="text-slate-400">—</span>
          <span className="text-sm text-slate-300">{dateFormatted}</span>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <div className="flex items-center gap-1.5 text-slate-400">
            <Users className="w-4 h-4" />
            <span>{presentCount}/{briefing.team.length} présents</span>
          </div>
        </div>
      </div>

      <div className="p-5">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Management */}
          <div>
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">
              Management
            </div>
            <div className="flex items-start gap-4 flex-wrap">
              {management.map(m => (
                <Avatar
                  key={m.name}
                  name={m.name}
                  role={m.role}
                  present={m.present}
                  color={m.role === "Directeur" ? "bg-blue-600" : m.role === "Adjointe" ? "bg-indigo-500" : "bg-violet-500"}
                />
              ))}
            </div>
          </div>

          {/* Equipes */}
          <div>
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">
              Équipes opérationnelles
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-slate-500 w-20 flex-shrink-0">Trampoline</span>
                <div className="flex gap-2">
                  {trampoline.map(m => (
                    <Avatar key={m.name} name={m.name} role={m.role} present={m.present} color="bg-teal-600" />
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-slate-500 w-20 flex-shrink-0">Caisse</span>
                <div className="flex gap-2">
                  {caisse.map(m => (
                    <Avatar key={m.name} name={m.name} role={m.role} present={m.present} color="bg-orange-600" />
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-slate-500 w-20 flex-shrink-0">Anniversaire</span>
                <div className="flex gap-2">
                  {anniversaire.map(m => (
                    <Avatar key={m.name} name={m.name} role={m.role} present={m.present} color="bg-pink-600" />
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-slate-500 w-20 flex-shrink-0">Restauration</span>
                <div className="flex gap-2">
                  {restauration.map(m => (
                    <Avatar key={m.name} name={m.name} role={m.role} present={m.present} color="bg-yellow-600" />
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Objectifs du jour */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-widest">
                Objectifs du jour
              </span>
            </div>
            <ul className="space-y-2">
              {briefing.objectives.map((obj, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <CheckCircle2 className="w-4 h-4 text-slate-600 flex-shrink-0 mt-0.5" />
                  <span className="text-slate-300">{obj}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
