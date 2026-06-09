"use client"
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ReferenceLine
} from "recharts"
import { format } from "date-fns"
import { fr } from "date-fns/locale"
import type { GxScore } from "@/lib/types"

interface GxChartProps {
  scores: GxScore[]
  title?: string
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const score = payload[0]?.value as number
    const responses = payload[0]?.payload?.responses
    const color = score >= 50 ? "#22c55e" : score >= 0 ? "#f59e0b" : "#ef4444"
    return (
      <div className="bg-slate-900 border border-slate-700 rounded-xl p-3 shadow-xl text-xs">
        <div className="font-medium text-white mb-2">{label}</div>
        <div className="flex items-center gap-2" style={{ color }}>
          <span className="w-2 h-2 rounded-full bg-current" />
          Score GX : {score} pts
        </div>
        {responses != null && (
          <div className="text-slate-400 mt-1">{responses} réponses</div>
        )}
      </div>
    )
  }
  return null
}

export function GxChart({ scores, title = "Évolution GX Score" }: GxChartProps) {
  const data = [...scores]
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-30)
    .map(s => ({
      date: format(new Date(s.date), "dd/MM", { locale: fr }),
      score: s.score,
      responses: s.responses_count,
    }))

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-white">{title}</h3>
        <div className="flex items-center gap-3 text-xs">
          <div className="flex items-center gap-1.5 text-green-400">
            <div className="w-3 h-0.5 bg-green-400 rounded" />
            ≥ 50 pts
          </div>
          <div className="flex items-center gap-1.5 text-amber-400">
            <div className="w-3 h-0.5 bg-amber-400 rounded" />
            0–49 pts
          </div>
          <div className="flex items-center gap-1.5 text-red-400">
            <div className="w-3 h-0.5 bg-red-400 rounded" />
            &lt; 0 pts
          </div>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={data} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
          <XAxis
            dataKey="date"
            tick={{ fill: "#94a3b8", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            domain={[-100, 100]}
            tick={{ fill: "#94a3b8", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={v => `${v}`}
            width={32}
          />
          <Tooltip content={<CustomTooltip />} />
          <ReferenceLine y={0} stroke="#64748b" strokeDasharray="4 2" />
          <ReferenceLine y={50} stroke="#22c55e" strokeDasharray="4 2" strokeOpacity={0.3} />
          <Line
            type="monotone"
            dataKey="score"
            stroke="#60a5fa"
            strokeWidth={2.5}
            dot={(props: any) => {
              const { cx, cy, payload } = props
              const color = payload.score >= 50 ? "#22c55e" : payload.score >= 0 ? "#f59e0b" : "#ef4444"
              return <circle key={payload.date} cx={cx} cy={cy} r={4} fill={color} stroke="none" />
            }}
            activeDot={{ r: 6, fill: "#60a5fa" }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
