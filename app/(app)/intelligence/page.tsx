"use client"
import { useState, useEffect } from "react"
import { Brain, TrendingUp, TrendingDown, AlertTriangle, Lightbulb, Activity, ChevronRight, RefreshCw } from "lucide-react"
import { format } from "date-fns"
import { fr } from "date-fns/locale"
import * as incidentsRepo from "@/lib/repositories/incidents"
import * as salesRepo from "@/lib/repositories/sales"
import * as feedbackRepo from "@/lib/repositories/feedback"
import * as kaizenRepo from "@/lib/repositories/kaizen"
import * as gxRepo from "@/lib/repositories/gx"
import { generateInsights } from "@/lib/services/insightsService"
import type { Incident, Sale, CustomerFeedback, Kaizen, Insight, GxScore } from "@/lib/types"
import { useSite } from "@/lib/context/SiteContext"

const insightConfig = {
  warning: { icon: AlertTriangle, color: "text-orange-400", bg: "bg-orange-500/10", border: "border-orange-500/20", label: "Alerte" },
  improvement: { icon: TrendingUp, color: "text-green-400", bg: "bg-green-500/10", border: "border-green-500/20", label: "Amélioration" },
  info: { icon: Activity, color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/20", label: "Info" },
}

function InsightCard({ insight }: { insight: Insight }) {
  const cfg = insightConfig[insight.type as keyof typeof insightConfig] ?? insightConfig.info
  const Icon = cfg.icon
  return (
    <div className={`bg-slate-800 border ${cfg.border} rounded-xl p-5 flex gap-4`}>
      <div className={`w-10 h-10 rounded-xl ${cfg.bg} flex items-center justify-center flex-shrink-0`}>
        <Icon className={`w-5 h-5 ${cfg.color}`} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1.5">
          <span className={`text-xs font-semibold uppercase tracking-widest ${cfg.color}`}>{cfg.label}</span>
          <span className="text-xs text-slate-600">·</span>
          <span className="text-xs text-slate-500 capitalize">{insight.category}</span>
        </div>
        <p className="text-sm text-slate-200 leading-relaxed">{insight.message}</p>
        <p className="text-xs text-slate-500 mt-2">
          {format(new Date(insight.created_at), "dd/MM/yyyy à HH:mm", { locale: fr })}
        </p>
      </div>
    </div>
  )
}

interface TrendStat {
  label: string
  current: number
  previous: number
  unit: string
  good: "up" | "down"
}

function TrendCard({ stat }: { stat: TrendStat }) {
  const delta = stat.current - stat.previous
  const pct = stat.previous > 0 ? Math.round((delta / stat.previous) * 100) : 0
  const isUp = delta > 0
  const isGood = (stat.good === "up" && isUp) || (stat.good === "down" && !isUp)
  const color = delta === 0 ? "text-slate-400" : isGood ? "text-green-400" : "text-red-400"
  const TrendIcon = isUp ? TrendingUp : TrendingDown

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
      <div className="text-xs text-slate-400 mb-2 uppercase tracking-widest">{stat.label}</div>
      <div className="flex items-end gap-3">
        <div className="text-2xl font-bold text-white">
          {stat.current.toLocaleString("fr-FR")}{stat.unit}
        </div>
        {delta !== 0 && (
          <div className={`flex items-center gap-1 text-sm font-medium mb-0.5 ${color}`}>
            <TrendIcon className="w-4 h-4" />
            {isUp ? "+" : ""}{pct}%
          </div>
        )}
      </div>
      <div className="text-xs text-slate-500 mt-1">
        Période précédente : {stat.previous.toLocaleString("fr-FR")}{stat.unit}
      </div>
    </div>
  )
}

const ballePrinciples = [
  { principle: "Aller voir", desc: "Chaque données anormale est une invitation à aller observer sur le terrain.", icon: "👁" },
  { principle: "Demander pourquoi", desc: "Remonter à la cause racine plutôt que de traiter le symptôme.", icon: "❓" },
  { principle: "Respecter les gens", desc: "Les problèmes révèlent des opportunités d'apprentissage, pas des fautes.", icon: "🤝" },
  { principle: "Améliorer le flux", desc: "Réduire les obstacles entre la demande client et la livraison.", icon: "→" },
]

export default function IntelligencePage() {
  const { siteId: SITE_ID } = useSite()
  const [insights, setInsights] = useState<Insight[]>([])
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [sales, setSales] = useState<Sale[]>([])
  const [gxScores, setGxScores] = useState<GxScore[]>([])
  const [loading, setLoading] = useState(true)
  const [lastRefresh, setLastRefresh] = useState(new Date())

  const load = async () => {
    setLoading(true)
    try {
      const [inc, sal, fb, kz, gx] = await Promise.all([
        incidentsRepo.getAll(SITE_ID),
        salesRepo.getAll(SITE_ID),
        feedbackRepo.getAll(SITE_ID),
        kaizenRepo.getAll(SITE_ID),
        gxRepo.getAll(SITE_ID),
      ])
      setIncidents(inc)
      setSales(sal)
      setGxScores(gx)
      setInsights(generateInsights(inc, sal, fb, kz, SITE_ID))
      setLastRefresh(new Date())
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load() }, [SITE_ID])

  // Compute trend stats (last 14 days vs previous 14 days)
  const now = new Date()
  const mid = new Date(now.getTime() - 14 * 86400_000)
  const start = new Date(now.getTime() - 28 * 86400_000)

  const incRecent = incidents.filter(i => new Date(i.created_at) >= mid).length
  const incPrev = incidents.filter(i => { const d = new Date(i.created_at); return d >= start && d < mid }).length

  const recentSales = sales.filter(s => s.date >= mid.toISOString().split("T")[0])
  const prevSales = sales.filter(s => { const d = s.date; return d >= start.toISOString().split("T")[0] && d < mid.toISOString().split("T")[0] })
  const caRecent = Math.round(recentSales.reduce((s, x) => s + x.amount, 0))
  const caPrev = Math.round(prevSales.reduce((s, x) => s + x.amount, 0))

  const gxRecent = gxScores.filter(g => g.date >= mid.toISOString().split("T")[0])
  const gxPrev = gxScores.filter(g => { const d = g.date; return d >= start.toISOString().split("T")[0] && d < mid.toISOString().split("T")[0] })
  const avgGxRecent = gxRecent.length ? Math.round(gxRecent.reduce((s, g) => s + g.score, 0) / gxRecent.length) : 0
  const avgGxPrev = gxPrev.length ? Math.round(gxPrev.reduce((s, g) => s + g.score, 0) / gxPrev.length) : 0

  const trendStats: TrendStat[] = [
    { label: "CA (14 derniers jours)", current: caRecent, previous: caPrev, unit: " €", good: "up" },
    { label: "GX Score moyen", current: avgGxRecent, previous: avgGxPrev, unit: " pts", good: "up" },
    { label: "Incidents ouverts", current: incRecent, previous: incPrev, unit: "", good: "down" },
  ]

  const warningInsights = insights.filter(i => i.type === "warning")
  const improvInsights = insights.filter(i => i.type === "improvement")
  const infoInsights = insights.filter(i => i.type === "info")

  return (
    <div className="space-y-8 max-w-[1400px]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Brain className="w-6 h-6 text-purple-400" />
            Intelligence Lean
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Analyse automatique · Détection de tendances · Corrélations
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-500">
            Mis à jour à {format(lastRefresh, "HH:mm", { locale: fr })}
          </span>
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-2 text-sm text-slate-400 hover:text-white bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            Actualiser
          </button>
        </div>
      </div>

      {/* Trend stats */}
      <div>
        <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">
          Tendances 14 jours vs 14 jours précédents
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {trendStats.map(stat => <TrendCard key={stat.label} stat={stat} />)}
        </div>
      </div>

      {/* Insights */}
      {loading ? (
        <div className="text-center py-16 text-slate-500">Analyse en cours…</div>
      ) : insights.length === 0 ? (
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-8 text-center">
          <div className="w-12 h-12 rounded-xl bg-green-500/10 border border-green-500/20 flex items-center justify-center mx-auto mb-3">
            <TrendingUp className="w-6 h-6 text-green-400" />
          </div>
          <h3 className="font-semibold text-white mb-1">Tout est nominal</h3>
          <p className="text-sm text-slate-400">Aucune anomalie détectée sur les données disponibles.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {warningInsights.length > 0 && (
            <div>
              <h2 className="text-xs font-semibold text-orange-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                <AlertTriangle className="w-3.5 h-3.5" />
                Alertes ({warningInsights.length})
              </h2>
              <div className="space-y-3">
                {warningInsights.map(i => <InsightCard key={i.id} insight={i} />)}
              </div>
            </div>
          )}
          {improvInsights.length > 0 && (
            <div>
              <h2 className="text-xs font-semibold text-green-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                <TrendingUp className="w-3.5 h-3.5" />
                Améliorations ({improvInsights.length})
              </h2>
              <div className="space-y-3">
                {improvInsights.map(i => <InsightCard key={i.id} insight={i} />)}
              </div>
            </div>
          )}
          {infoInsights.length > 0 && (
            <div>
              <h2 className="text-xs font-semibold text-blue-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                <Activity className="w-3.5 h-3.5" />
                Informations ({infoInsights.length})
              </h2>
              <div className="space-y-3">
                {infoInsights.map(i => <InsightCard key={i.id} insight={i} />)}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Lean Principles */}
      <div>
        <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
          <Lightbulb className="w-3.5 h-3.5" />
          Principes Lean (Michael Ballé)
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {ballePrinciples.map(({ principle, desc, icon }) => (
            <div key={principle} className="bg-slate-800 border border-slate-700 rounded-xl p-4 group hover:border-slate-600 transition-colors">
              <div className="text-2xl mb-2">{icon}</div>
              <div className="font-semibold text-white text-sm mb-1">{principle}</div>
              <p className="text-xs text-slate-400 leading-relaxed">{desc}</p>
              <div className="flex items-center gap-1 text-slate-600 group-hover:text-slate-400 transition-colors mt-3">
                <span className="text-xs">Explorer</span>
                <ChevronRight className="w-3 h-3" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
