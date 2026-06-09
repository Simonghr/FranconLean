"use client"
import { useState, useEffect } from "react"
import {
  ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip
} from "recharts"
import { format, startOfWeek, startOfMonth } from "date-fns"
import { fr } from "date-fns/locale"
import { TrendingUp, TrendingDown, Target, Euro } from "lucide-react"
import * as salesRepo from "@/lib/repositories/sales"
import type { Sale } from "@/lib/types"

const SITE_ID = '00000000-0000-0000-0000-000000000001'

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

function getDateRange(period: Period): { start: string; end: string } {
  const today = new Date()
  const todayStr = today.toLocaleDateString("en-CA", { timeZone: "Europe/Paris" })

  if (period === "day") {
    return { start: todayStr, end: todayStr }
  }
  if (period === "week") {
    const mon = startOfWeek(today, { weekStartsOn: 1 })
    return {
      start: mon.toLocaleDateString("en-CA"),
      end: todayStr,
    }
  }
  // month
  const first = startOfMonth(today)
  return {
    start: first.toLocaleDateString("en-CA"),
    end: todayStr,
  }
}

export default function PerformancePage() {
  const [period, setPeriod] = useState<Period>("month")
  const [sales, setSales] = useState<Sale[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    salesRepo.getAll(SITE_ID)
      .then(setSales)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const { start, end } = getDateRange(period)
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Paris" })

  const data = sales
    .filter(s => s.period === "day" && s.date >= start && s.date <= end && s.date <= today)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(s => ({
      dateRaw: s.date,
      date: format(new Date(s.date), period === "day" ? "HH:mm" : "dd/MM", { locale: fr }),
      amount: Math.round(s.amount),
      target: s.target > 0 ? Math.round(s.target) : null,
      gap: s.target > 0 ? Math.round(s.amount - s.target) : null,
    }))

  const totalCA = data.reduce((sum, d) => sum + d.amount, 0)
  const totalTarget = data.reduce((sum, d) => sum + (d.target ?? 0), 0)
  const achievementRate = totalTarget > 0 ? Math.round((totalCA / totalTarget) * 100) : 0
  const daysAbove = data.filter(d => d.target != null && d.amount >= d.target).length
  const n = data.length || 1

  const periodLabel = period === "day"
    ? `Aujourd'hui (${format(new Date(today), "dd/MM", { locale: fr })})`
    : period === "week"
    ? `Cette semaine (lun. ${format(new Date(start), "dd/MM", { locale: fr })} → aujourd'hui)`
    : `Ce mois (${format(new Date(start), "'1er' MMMM", { locale: fr })} → aujourd'hui)`

  if (loading) return <div className="text-center py-20 text-slate-500">Chargement…</div>

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
        <span className="text-xs text-slate-500 ml-2">{periodLabel}</span>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: period === "day" ? "CA Aujourd'hui" : period === "week" ? "CA Cette semaine" : "CA Ce mois",
            value: formatEur(totalCA),
            icon: Euro,
            color: "text-green-400",
            sub: `Objectif : ${formatEur(totalTarget)}`,
          },
          {
            label: "Taux d'atteinte",
            value: `${achievementRate}%`,
            icon: Target,
            color: achievementRate >= 100 ? "text-green-400" : "text-orange-400",
            sub: achievementRate >= 100 ? "Objectif atteint" : `${100 - achievementRate}% restants`,
          },
          {
            label: period === "day" ? "—" : "Jours > Objectif",
            value: period === "day" ? "—" : `${daysAbove}/${n}`,
            icon: TrendingUp,
            color: "text-blue-400",
            sub: period === "day" ? "" : `${Math.round((daysAbove / n) * 100)}% des jours`,
          },
          {
            label: period === "day" ? "Objectif du jour" : "CA Moyen/jour",
            value: period === "day" ? formatEur(totalTarget) : formatEur(Math.round(totalCA / n)),
            icon: TrendingDown,
            color: "text-slate-300",
            sub: period === "day" ? (totalCA >= totalTarget && totalTarget > 0 ? "✓ Atteint" : "") : `Obj. moy : ${formatEur(Math.round(totalTarget / n))}`,
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
        <h3 className="font-semibold text-white mb-4">CA vs Objectif — {periodLabel}</h3>
        {data.length === 0
          ? <div className="text-center text-slate-500 py-12">Aucune donnée pour cette période</div>
          : <ResponsiveContainer width="100%" height={320}>
              <ComposedChart data={data} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="date" tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} tickLine={false}
                  tickFormatter={v => `${(v / 1000).toFixed(0)}k`} width={36} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
                <Bar dataKey="amount" fill="#22c55e" opacity={0.7} radius={[3, 3, 0, 0]} name="CA" />
                <Line type="monotone" dataKey="target" stroke="#f97316" strokeWidth={2}
                  strokeDasharray="5 3" dot={false} name="Objectif" />
              </ComposedChart>
            </ResponsiveContainer>
        }
      </div>

      {/* Breakdown table */}
      {period !== "day" && (
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
                  const hasTarget = row.target != null && row.target > 0
                  const rate = hasTarget ? Math.round((row.amount / row.target!) * 100) : null
                  const above = hasTarget && row.amount >= row.target!
                  return (
                    <tr key={i} className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors">
                      <td className="px-5 py-3 text-slate-300">{row.date}</td>
                      <td className="px-5 py-3 text-right font-medium text-white">{formatEur(row.amount)}</td>
                      <td className="px-5 py-3 text-right text-slate-400">{hasTarget ? formatEur(row.target!) : "—"}</td>
                      <td className={`px-5 py-3 text-right font-medium ${above ? "text-green-400" : hasTarget ? "text-red-400" : "text-slate-500"}`}>
                        {row.gap != null ? `${above ? "+" : ""}${formatEur(row.gap)}` : "—"}
                      </td>
                      <td className="px-5 py-3 text-right">
                        {rate != null ? (
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                            rate >= 100 ? "bg-green-500/10 text-green-400 border border-green-500/20"
                            : rate >= 90 ? "bg-orange-500/10 text-orange-400 border border-orange-500/20"
                            : "bg-red-500/10 text-red-400 border border-red-500/20"
                          }`}>{rate}%</span>
                        ) : <span className="text-slate-600 text-xs">—</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
