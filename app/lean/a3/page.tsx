"use client"
import { useState } from "react"
import { Plus, ChevronDown, ChevronUp } from "lucide-react"
import { format } from "date-fns"
import { fr } from "date-fns/locale"
import { mockA3Reports } from "@/lib/mockData"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import type { A3Report } from "@/lib/types"

function A3Card({ report }: { report: A3Report }) {
  const [expanded, setExpanded] = useState(false)
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
      <button
        className="w-full flex items-start justify-between p-5 text-left hover:bg-slate-700/30 transition-colors"
        onClick={() => setExpanded(e => !e)}
      >
        <div className="flex-1 min-w-0 pr-4">
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="info">A3</Badge>
            <span className="text-xs text-slate-500">
              {format(new Date(report.created_at), "dd/MM/yyyy", { locale: fr })}
            </span>
          </div>
          <h3 className="font-semibold text-white">{report.title}</h3>
          <p className="text-sm text-slate-400 mt-1 line-clamp-2">{report.context}</p>
        </div>
        {expanded ? (
          <ChevronUp className="w-5 h-5 text-slate-400 flex-shrink-0 mt-1" />
        ) : (
          <ChevronDown className="w-5 h-5 text-slate-400 flex-shrink-0 mt-1" />
        )}
      </button>

      {expanded && (
        <div className="px-5 pb-5 border-t border-slate-700">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mt-4">
            <div className="space-y-4">
              <div>
                <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2">Contexte</h4>
                <p className="text-sm text-slate-300">{report.context}</p>
              </div>
              <div>
                <h4 className="text-xs font-semibold text-red-400 uppercase tracking-widest mb-2">État actuel</h4>
                <p className="text-sm text-slate-300">{report.current_state}</p>
              </div>
              <div>
                <h4 className="text-xs font-semibold text-green-400 uppercase tracking-widest mb-2">État cible</h4>
                <p className="text-sm text-slate-300">{report.target_state}</p>
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <h4 className="text-xs font-semibold text-orange-400 uppercase tracking-widest mb-2">Causes racines</h4>
                <ul className="space-y-1">
                  {report.root_causes.map((c, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
                      <span className="text-orange-400 mt-0.5">•</span>
                      {c}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h4 className="text-xs font-semibold text-blue-400 uppercase tracking-widest mb-2">5 Pourquoi</h4>
                <ol className="space-y-1">
                  {report.five_whys.map((w, i) => (
                    <li key={i} className="text-sm text-slate-300 flex items-start gap-2">
                      <span className="text-blue-400 font-mono flex-shrink-0">{i + 1}.</span>
                      {w}
                    </li>
                  ))}
                </ol>
              </div>
              <div>
                <h4 className="text-xs font-semibold text-purple-400 uppercase tracking-widest mb-2">Plan d'action</h4>
                <ul className="space-y-1">
                  {report.action_plan.map((a, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
                      <span className="text-purple-400 mt-0.5">→</span>
                      {a}
                    </li>
                  ))}
                </ul>
              </div>
              {report.results && (
                <div>
                  <h4 className="text-xs font-semibold text-green-400 uppercase tracking-widest mb-2">Résultats</h4>
                  <p className="text-sm text-slate-300">{report.results}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function A3Page() {
  const [reports] = useState<A3Report[]>(mockA3Reports)

  return (
    <div className="space-y-6 max-w-[1400px]">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Rapports A3</h1>
          <p className="text-slate-400 text-sm mt-1">Résolution structurée de problèmes complexes</p>
        </div>
        <Button>
          <Plus className="w-4 h-4" />
          Nouveau A3
        </Button>
      </div>

      {/* A3 structure info */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
        <h3 className="font-semibold text-white mb-3">Structure d'un rapport A3</h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: "Contexte", desc: "Pourquoi ce problème est-il important ?", color: "text-blue-400" },
            { label: "Causes racines", desc: "5 Pourquoi pour trouver la vraie cause", color: "text-orange-400" },
            { label: "Plan d'action", desc: "Actions concrètes avec responsables", color: "text-purple-400" },
            { label: "Résultats", desc: "Mesure des améliorations obtenues", color: "text-green-400" },
          ].map(({ label, desc, color }) => (
            <div key={label} className="bg-slate-900/50 rounded-lg p-3">
              <div className={`text-sm font-semibold ${color} mb-1`}>{label}</div>
              <div className="text-xs text-slate-400">{desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Reports list */}
      <div className="space-y-4">
        {reports.map(r => (
          <A3Card key={r.id} report={r} />
        ))}
        {reports.length === 0 && (
          <div className="text-center py-12 text-slate-500">
            Aucun rapport A3 pour l'instant.
          </div>
        )}
      </div>
    </div>
  )
}
