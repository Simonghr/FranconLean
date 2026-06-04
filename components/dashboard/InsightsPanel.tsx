import { AlertTriangle, TrendingUp, Info, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Insight } from "@/lib/types"

const insightConfig = {
  warning: {
    icon: AlertTriangle,
    color: "text-orange-400",
    bg: "bg-orange-400/10",
    border: "border-orange-500/20",
    dot: "bg-orange-400",
  },
  improvement: {
    icon: TrendingUp,
    color: "text-green-400",
    bg: "bg-green-400/10",
    border: "border-green-500/20",
    dot: "bg-green-400",
  },
  info: {
    icon: Info,
    color: "text-blue-400",
    bg: "bg-blue-400/10",
    border: "border-blue-500/20",
    dot: "bg-blue-400",
  },
}

interface InsightsPanelProps {
  insights: Insight[]
}

export function InsightsPanel({ insights }: InsightsPanelProps) {
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl">
      <div className="flex items-center gap-2.5 px-5 py-4 border-b border-slate-700">
        <Sparkles className="w-4 h-4 text-blue-400" />
        <h3 className="font-semibold text-white">Insights Lean</h3>
        <span className="ml-auto text-xs text-slate-500">Analyse automatique</span>
      </div>
      <div className="divide-y divide-slate-700/50">
        {insights.map(insight => {
          const cfg = insightConfig[insight.type]
          const Icon = cfg.icon
          return (
            <div key={insight.id} className={cn("flex items-start gap-3 px-5 py-4", cfg.bg)}>
              <div className={cn("mt-0.5 p-1.5 rounded-lg", cfg.bg)}>
                <Icon className={cn("w-4 h-4", cfg.color)} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-slate-200 leading-relaxed">{insight.message}</p>
                <div className="flex items-center gap-2 mt-1.5">
                  <div className={cn("w-1.5 h-1.5 rounded-full", cfg.dot)} />
                  <span className="text-xs text-slate-500 capitalize">{insight.category}</span>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
