import { TrendingUp, TrendingDown, Minus } from "lucide-react"
import { cn } from "@/lib/utils"

interface KPICardProps {
  title: string
  value: string | number
  subtitle?: string
  trend?: number // percentage change
  trendLabel?: string
  status?: "good" | "warning" | "critical" | "neutral"
  icon?: React.ReactNode
  footer?: string
}

const statusConfig = {
  good: { dot: "bg-green-400", text: "text-green-400", bg: "bg-green-400/10", border: "border-green-500/20" },
  warning: { dot: "bg-orange-400", text: "text-orange-400", bg: "bg-orange-400/10", border: "border-orange-500/20" },
  critical: { dot: "bg-red-400", text: "text-red-400", bg: "bg-red-400/10", border: "border-red-500/20" },
  neutral: { dot: "bg-slate-400", text: "text-slate-400", bg: "bg-slate-400/10", border: "border-slate-500/20" },
}

export function KPICard({ title, value, subtitle, trend, trendLabel, status = "neutral", icon, footer }: KPICardProps) {
  const cfg = statusConfig[status]
  const TrendIcon = trend === undefined ? Minus : trend > 0 ? TrendingUp : trend < 0 ? TrendingDown : Minus
  const trendColor = trend === undefined ? "text-slate-400" : trend > 0 ? "text-green-400" : trend < 0 ? "text-red-400" : "text-slate-400"

  return (
    <div className={cn("bg-slate-800 border rounded-xl p-5", cfg.border)}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1">{title}</div>
          {subtitle && <div className="text-xs text-slate-500">{subtitle}</div>}
        </div>
        <div className="flex items-center gap-2">
          <div className={cn("w-2 h-2 rounded-full", cfg.dot)} />
          {icon && <div className="text-slate-400">{icon}</div>}
        </div>
      </div>

      <div className="mb-3">
        <span className="text-3xl font-bold text-white tracking-tight">{value}</span>
      </div>

      {trend !== undefined && (
        <div className={cn("flex items-center gap-1.5 text-sm", trendColor)}>
          <TrendIcon className="w-4 h-4" />
          <span>{trend > 0 ? "+" : ""}{trend}%</span>
          {trendLabel && <span className="text-slate-500 text-xs">{trendLabel}</span>}
        </div>
      )}

      {footer && (
        <div className="mt-2 text-xs text-slate-500">{footer}</div>
      )}
    </div>
  )
}
