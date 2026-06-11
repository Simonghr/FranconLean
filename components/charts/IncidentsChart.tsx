"use client"
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell } from "recharts"
import type { Incident } from "@/lib/types"

interface IncidentsChartProps {
  incidents: Incident[]
  title?: string
}

const categoryLabels: Record<string, string> = {
  technique: "Technique",
  operationnel: "Opérationnel",
  blessure: "Blessure",
  service_client: "Service client",
  other: "Autre",
}

const categoryColors: Record<string, string> = {
  technique: "#06b6d4",
  operationnel: "#3b82f6",
  blessure: "#ef4444",
  service_client: "#8b5cf6",
  other: "#64748b",
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-900 border border-slate-700 rounded-xl p-3 shadow-xl text-xs">
        <div className="font-medium text-white">{label}</div>
        <div className="text-slate-300 mt-1">{payload[0]?.value} incidents</div>
      </div>
    )
  }
  return null
}

export function IncidentsChart({ incidents, title = "Incidents par type" }: IncidentsChartProps) {
  const counts: Record<string, number> = {}
  incidents.forEach(inc => {
    const key = inc.incident_type ?? "other"
    counts[key] = (counts[key] ?? 0) + 1
  })

  const data = Object.entries(counts).map(([cat, count]) => ({
    category: categoryLabels[cat] ?? cat,
    count,
    key: cat,
  })).sort((a, b) => b.count - a.count)

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
      <h3 className="font-semibold text-white mb-4">{title}</h3>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
          <XAxis
            dataKey="category"
            tick={{ fill: "#94a3b8", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: "#94a3b8", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            allowDecimals={false}
            width={24}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
          <Bar dataKey="count" radius={[4, 4, 0, 0]}>
            {data.map(entry => (
              <Cell key={entry.key} fill={categoryColors[entry.key] ?? "#64748b"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
