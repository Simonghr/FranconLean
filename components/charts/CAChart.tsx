"use client"
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ReferenceLine, Area, ComposedChart
} from "recharts"
import { format } from "date-fns"
import { fr } from "date-fns/locale"
import type { Sale } from "@/lib/types"

interface CAChartProps {
  sales: Sale[]
  title?: string
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const amount = payload.find((p: any) => p.dataKey === "amount")
    const target = payload.find((p: any) => p.dataKey === "target")
    const above = amount?.value >= (target?.value ?? 0)
    return (
      <div className="bg-slate-900 border border-slate-700 rounded-xl p-3 shadow-xl text-xs">
        <div className="font-medium text-white mb-2">{label}</div>
        <div className={`flex items-center gap-2 ${above ? "text-green-400" : "text-red-400"}`}>
          <span className="w-2 h-2 rounded-full bg-current" />
          CA: {amount?.value?.toLocaleString("fr-FR")} €
        </div>
        <div className="flex items-center gap-2 text-slate-400 mt-1">
          <span className="w-2 h-2 rounded-full bg-slate-400" />
          Objectif: {target?.value?.toLocaleString("fr-FR", { maximumFractionDigits: 0 })} €
        </div>
        {target && amount && (
          <div className={`mt-2 font-medium ${above ? "text-green-400" : "text-red-400"}`}>
            {above ? "+" : ""}{(amount.value - target.value).toLocaleString("fr-FR", { maximumFractionDigits: 0 })} €
          </div>
        )}
      </div>
    )
  }
  return null
}

export function CAChart({ sales, title = "CA vs Objectif" }: CAChartProps) {
  const data = sales.slice(-14).map(s => ({
    date: format(new Date(s.date), "dd/MM", { locale: fr }),
    amount: Math.round(s.amount),
    target: Math.round(s.target),
    above: s.amount >= s.target,
  }))

  const maxVal = Math.max(...data.map(d => Math.max(d.amount, d.target))) * 1.05
  const minVal = Math.min(...data.map(d => Math.min(d.amount, d.target))) * 0.95

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-white">{title}</h3>
        <div className="flex items-center gap-3 text-xs">
          <div className="flex items-center gap-1.5 text-green-400">
            <div className="w-3 h-0.5 bg-green-400 rounded" />
            CA réel
          </div>
          <div className="flex items-center gap-1.5 text-slate-400">
            <div className="w-3 h-0.5 bg-slate-500 rounded border-dashed border-t border-slate-400" />
            Objectif
          </div>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <ComposedChart data={data} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
          <XAxis
            dataKey="date"
            tick={{ fill: "#94a3b8", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: "#94a3b8", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={v => `${(v / 1000).toFixed(0)}k`}
            domain={[minVal, maxVal]}
            width={36}
          />
          <Tooltip content={<CustomTooltip />} />
          <Line
            type="monotone"
            dataKey="target"
            stroke="#64748b"
            strokeWidth={1.5}
            strokeDasharray="5 3"
            dot={false}
          />
          <Line
            type="monotone"
            dataKey="amount"
            stroke="#22c55e"
            strokeWidth={2.5}
            dot={(props: any) => {
              const { cx, cy, payload } = props
              return (
                <circle
                  key={payload.date}
                  cx={cx}
                  cy={cy}
                  r={3}
                  fill={payload.above ? "#22c55e" : "#ef4444"}
                  stroke="none"
                />
              )
            }}
            activeDot={{ r: 5, fill: "#22c55e" }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
