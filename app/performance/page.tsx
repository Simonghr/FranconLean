"use client"
import { useState } from "react"
import {
  ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend
} from "recharts"
import { format, subDays, startOfWeek, endOfWeek } from "date-fns"
import { fr } from "date-fns/locale"
import { TrendingUp, TrendingDown, Target, Euro } from "lucide-react"
import { mockSales } from "@/lib/mockData"

type Period = "day" | "week" | "month"

function formatEur(n: number) {
  return n.toLocaleString("fr-FR") + " €"
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const ca = payload.find((p: any) => p.dataKey === "amount")
    const target = payload.find((p: any) => p.dataKey === "target")
    return (
      <div className="bg-slate-900 border border-slate-700 rounded-xl p-3 shadow-xl text-xs">
        <div className="font-semibold text-white mb-2">{label}</div>
        {ca && <div className="text-green-400">CA : {formatEur(ca.value)}</div>}
        {target && <div className="text-slate-400 mt-1">Objectif : {formatEur(Math.round(target.value))}</div>}
      </div>
    )
  }
  return null
}

export default function PerformancePage() {
  const [period, setPeriod] = useState<Period>("day")

  const data = mockSales.slice(-30).map(s => ({
    date: format(new Date(s.date), "dd/MM", { locale: fr }),
    amount: Math.round(s.amount),
    target: Math.round(s.target),
    gap: Math.round(s.amount - s.target),
  }))

  const totalCA = data.reduce((sum, d) => sum + d.amount, 0)
  const totalTarget = data.reduce((sum, d) => sum + d.target, 0)
  const achievementRate = Math.round((totalCA / totalTarget) * 100)
  const daysAbove = data.filter(d => d.amount >= d.target).length

  return (
    <div className="space-y-6 max-w-[1400px]">
      <div>
        <h1 className="text-2xl font-bold text-white">Performance CA</h1>
        <p className="text-slate-400 text-sm mt-1">Suivi du chiffre d'affaires vs objectifs</p>
      </div>

      {/* Period selector */}
      <div className="flex items-center gap-2">
        {(["day", "week", "month"] as Period[]).map(p => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              period === p
                ? "bg-blue-600 text-white"
                : "bg-slate-800 text-slate-400 hover:text-white border border-slate-700"
            }`}
          >
            {p === "day" ? "Journalier" : p === "week" ? "Hebdo" : "Mensuel"}
          </button>
        ))}
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: "CA Total (30j)",
            value: formatEur(totalCA),
            icon: Euro,
            color: "text-green-400",
            sub: `Objectif: ${formatEur(totalTarget)}`,
          },
          {
            label: "Taux d'atteinte",
            value: `${achievementRate}%`,
            icon: Target,
            color: achievementRate >= 100 ? "text-green-400" : "text-orange-400",
            sub: achievementRate >= 100 ? "Objectif atteint" : `${100 - achievementRate}% de l'objectif`,
          },
          {
            label: "Jours > Objectif",
            value: `${daysAbove}/30`,
            icon: TrendingUp,
            color: "text-blue-400",
            sub: `${Math.round((daysAbove / 30) * 100)}% des jours`,
          },
          {
            label: "CA Moyen/jour",
            value: formatEur(Math.round(totalCA / 30)),
            icon: TrendingDown,
            color: "text-slate-300",
            sub: `Obj. moy: ${formatEur(Math.round(totalTarget / 30))}`,
          },
        ].map(({ label, value, icon: Icon, color, sub }) => (
          <div key={label} className="bg-slate-800 border border-slate-700 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-slate-400 uppercase tracking-widest font-semibold">{label}</span>
              <Icon className={`w-4 h-4 ${color}`} />
            </div>
            <div className={`text-2xl font-bold ${color}`}>{value}</div>
            <div className="text-xs text-slate-500 mt-1">{sub}</div>
          </div>
        ))}
      </div>

      {/* Main chart */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
        <h3 className="font-semibold text-white mb-4">CA vs Objectif — 30 derniers jours</h3>
        <ResponsiveContainer width="100%" height={320}>
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
              width={36}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
            <Bar dataKey="amount" fill="#22c55e" opacity={0.7} radius={[3, 3, 0, 0]} name="CA" />
            <Line
              type="monotone"
              dataKey="target"
              stroke="#f97316"
              strokeWidth={2}
              strokeDasharray="5 3"
              dot={false}
              name="Objectif"
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Daily breakdown table */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-700">
          <h3 className="font-semibold text-white">Détail journalier</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="text-left px-5 py-3 text-xs text-slate-400 font-semibold uppercase tracking-widest">Date</th>
                <th className="text-right px-5 py-3 text-xs text-slate-400 font-semibold uppercase tracking-widest">CA Réel</th>
                <th className="text-right px-5 py-3 text-xs text-slate-400 font-semibold uppercase tracking-widest">Objectif</th>
                <th className="text-right px-5 py-3 text-xs text-slate-400 font-semibold uppercase tracking-widest">Écart</th>
                <th className="text-right px-5 py-3 text-xs text-slate-400 font-semibold uppercase tracking-widest">Performance</th>
              </tr>
            </thead>
            <tbody>
              {[...data].reverse().map((row, i) => {
                const rate = Math.round((row.amount / row.target) * 100)
                const above = row.amount >= row.target
                return (
                  <tr key={i} className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors">
                    <td className="px-5 py-3 text-slate-300">{row.date}</td>
                    <td className="px-5 py-3 text-right font-medium text-white">{formatEur(row.amount)}</td>
                    <td className="px-5 py-3 text-right text-slate-400">{formatEur(row.target)}</td>
                    <td className={`px-5 py-3 text-right font-medium ${above ? "text-green-400" : "text-red-400"}`}>
                      {above ? "+" : ""}{formatEur(row.gap)}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        rate >= 100 ? "bg-green-500/10 text-green-400 border border-green-500/20"
                        : rate >= 90 ? "bg-orange-500/10 text-orange-400 border border-orange-500/20"
                        : "bg-red-500/10 text-red-400 border border-red-500/20"
                      }`}>
                        {rate}%
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
