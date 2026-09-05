"use client"
import { useState, useEffect } from "react"
import { Plus, Search, ThumbsUp, ThumbsDown, Minus, Star } from "lucide-react"
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns"
import { fr } from "date-fns/locale"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { GxChart } from "@/components/charts/GxChart"
import * as feedbackRepo from "@/lib/repositories/feedback"
import * as gxRepo from "@/lib/repositories/gx"
import * as gxReviewsRepo from "@/lib/repositories/gxReviews"
import type { GxReview } from "@/lib/repositories/gxReviews"
import { translateTag } from "@/lib/gxTagTranslations"
import type { CustomerFeedback, FeedbackCategory, FeedbackSentiment, GxScore } from "@/lib/types"
import { useSite } from "@/lib/context/SiteContext"


const gxCalc = (fans: number, critics: number, total: number) =>
  total ? Math.round(fans / total * 100) - Math.round(critics / total * 100) : 0

const categoryLabels: Record<FeedbackCategory, string> = {
  compliment: "Compliment",
  positive_experience: "Expérience positive",
  complaint: "Plainte",
  remark: "Remarque",
  quality_issue: "Problème qualité",
  service_issue: "Problème service",
}

const sentimentIcon = {
  positive: <ThumbsUp className="w-4 h-4 text-green-400" />,
  neutral: <Minus className="w-4 h-4 text-slate-400" />,
  negative: <ThumbsDown className="w-4 h-4 text-red-400" />,
}

const sentimentVariants: Record<FeedbackSentiment, "success" | "default" | "destructive"> = {
  positive: "success",
  neutral: "default",
  negative: "destructive",
}

const sentimentLabels: Record<FeedbackSentiment, string> = {
  positive: "Positif",
  neutral: "Neutre",
  negative: "Négatif",
}

export default function GxScorePage() {
  const { siteId: SITE_ID } = useSite()
  const [feedbacks, setFeedbacks] = useState<CustomerFeedback[]>([])
  const [gxScores, setGxScores] = useState<GxScore[]>([])
  const [reviews, setReviews] = useState<GxReview[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [filterSentiment, setFilterSentiment] = useState("all")
  const [filterReviews, setFilterReviews] = useState<"all" | "fan" | "critic">("all")
  const [periodReviews, setPeriodReviews] = useState<"day" | "week" | "month">("month")
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split("T")[0])
  const [selectedWeekDate, setSelectedWeekDate] = useState(() => new Date().toISOString().split("T")[0])
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().toISOString().slice(0, 7))
  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState({
    description: "", category: "compliment", sentiment: "positive",
  })

  useEffect(() => {
    Promise.all([
      feedbackRepo.getAll(SITE_ID),
      gxRepo.getAll(SITE_ID),
      gxReviewsRepo.getRecent(SITE_ID, 500),
    ])
      .then(([fb, gx, rev]) => { setFeedbacks(fb); setGxScores(gx); setReviews(rev) })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [SITE_ID])

  const last30Score = (() => {
    if (!gxScores.length) return null
    const sorted = [...gxScores].sort((a, b) => b.date.localeCompare(a.date))
    let fans = 0, critics = 0, total = 0
    for (const g of sorted) {
      const remaining = 30 - total
      if (remaining <= 0) break
      const take = Math.min(remaining, g.responses_count)
      const ratio = take / g.responses_count
      fans += Math.round((g.fans_count ?? 0) * ratio)
      critics += Math.round((g.critics_count ?? 0) * ratio)
      total += take
    }
    return total ? { score: gxCalc(fans, critics, total), total, fans, critics } : null
  })()

  const periodScore = (() => {
    if (periodReviews === "day") {
      const g = gxScores.find(g => g.date === selectedDate)
      if (!g) return null
      return { score: g.score, total: g.responses_count, fans: g.fans_count, critics: g.critics_count }
    }
    if (!gxScores.length) return null
    let fromStr: string, toStr: string
    if (periodReviews === "week") {
      if (!selectedWeekDate) return null
      const ref = new Date(selectedWeekDate)
      fromStr = startOfWeek(ref, { weekStartsOn: 1 }).toISOString().split("T")[0]
      toStr = endOfWeek(ref, { weekStartsOn: 1 }).toISOString().split("T")[0]
    } else {
      if (!selectedMonth) return null
      const ref = new Date(selectedMonth + "-01")
      fromStr = startOfMonth(ref).toISOString().split("T")[0]
      toStr = endOfMonth(ref).toISOString().split("T")[0]
    }
    const days = gxScores.filter(g => g.date >= fromStr && g.date <= toStr)
    if (!days.length) return null
    const fans = days.reduce((s, g) => s + (g.fans_count ?? 0), 0)
    const critics = days.reduce((s, g) => s + (g.critics_count ?? 0), 0)
    const total = days.reduce((s, g) => s + g.responses_count, 0)
    return total ? { score: gxCalc(fans, critics, total), total, fans, critics } : null
  })()

  const periodScoreLabel = periodReviews === "day"
    ? `Score (${selectedDate ? format(new Date(selectedDate), "dd/MM", { locale: fr }) : "--/--"})`
    : periodReviews === "week"
    ? `Score (semaine du ${selectedWeekDate ? format(startOfWeek(new Date(selectedWeekDate), { weekStartsOn: 1 }), "dd/MM", { locale: fr }) : "--/--"})`
    : `Score (${selectedMonth ? format(new Date(selectedMonth + "-01"), "MMMM yyyy", { locale: fr }) : "--"})`

  const lastWeekendScore = (() => {
    if (!gxScores.length) return null
    const today = new Date()
    const dow = today.getDay()
    const lastSun = new Date(today); lastSun.setDate(today.getDate() - (dow === 0 ? 7 : dow))
    const lastSat = new Date(lastSun); lastSat.setDate(lastSun.getDate() - 1)
    const satStr = lastSat.toISOString().split("T")[0]
    const sunStr = lastSun.toISOString().split("T")[0]
    const days = gxScores.filter(g => g.date === satStr || g.date === sunStr)
    if (!days.length) return null
    const fans = days.reduce((s, g) => s + (g.fans_count ?? 0), 0)
    const critics = days.reduce((s, g) => s + (g.critics_count ?? 0), 0)
    const total = days.reduce((s, g) => s + g.responses_count, 0)
    return { score: gxCalc(fans, critics, total), total, satStr }
  })()

  const totalResponsesMonth = (() => {
    const monthStart = new Date(); monthStart.setDate(1)
    const monthStr = monthStart.toISOString().split("T")[0]
    return gxScores
      .filter(g => g.date >= monthStr)
      .reduce((s, g) => s + g.responses_count, 0)
  })()

  const overallFanPct = last30Score && last30Score.total
    ? Math.round(last30Score.fans / last30Score.total * 100)
    : null
  const overallCriticPct = last30Score && last30Score.total
    ? Math.round(last30Score.critics / last30Score.total * 100)
    : null

  const filteredReviews = (() => {
    if (periodReviews === "day") {
      return reviews.filter(r => r.date === selectedDate)
    } else if (periodReviews === "week") {
      if (!selectedWeekDate) return []
      const ref = new Date(selectedWeekDate)
      const weekStart = startOfWeek(ref, { weekStartsOn: 1 }).toISOString().split("T")[0]
      const weekEnd = endOfWeek(ref, { weekStartsOn: 1 }).toISOString().split("T")[0]
      return reviews.filter(r => r.date >= weekStart && r.date <= weekEnd)
    } else {
      if (!selectedMonth) return []
      const ref = new Date(selectedMonth + "-01")
      const monthStart = startOfMonth(ref).toISOString().split("T")[0]
      const monthEnd = endOfMonth(ref).toISOString().split("T")[0]
      return reviews.filter(r => r.date >= monthStart && r.date <= monthEnd)
    }
  })()

  const tagSynthesis = (() => {
    const fanTags: Record<string, number> = {}
    const criticTags: Record<string, number> = {}
    for (const r of filteredReviews) {
      const allReasons = [
        ...(r.service_rating_reasons ?? []),
        ...(r.safety_rating_reasons ?? []),
        ...(r.facilities_rating_reasons ?? []),
        ...(r.value_rating_reasons ?? []),
      ]
      const target = r.is_fan ? fanTags : r.is_critic ? criticTags : null
      if (!target) continue
      for (const tag of allReasons) {
        target[tag] = (target[tag] ?? 0) + 1
      }
    }
    const toSorted = (obj: Record<string, number>) =>
      Object.entries(obj).sort((a, b) => b[1] - a[1]).slice(0, 8)
    return { fans: toSorted(fanTags), critics: toSorted(criticTags) }
  })()
  const filtered = feedbacks.filter(f => {
    const matchSearch = f.description.toLowerCase().includes(search.toLowerCase())
    const matchSentiment = filterSentiment === "all" || f.sentiment === filterSentiment
    return matchSearch && matchSentiment
  })

  const handleAdd = async () => {
    if (!form.description) return
    try {
      const newFb = await feedbackRepo.create({
        site_id: SITE_ID,
        type: ["compliment", "positive_experience"].includes(form.category) ? "satisfaction" : "complaint",
        category: form.category as FeedbackCategory,
        description: form.description,
        sentiment: form.sentiment as FeedbackSentiment,
      })
      setFeedbacks(prev => [newFb, ...prev])
      setForm({ description: "", category: "compliment", sentiment: "positive" })
      setDialogOpen(false)
    } catch (err) {
      console.error('Failed to create feedback', err)
    }
  }

  const scoreColor = (score: number | null) =>
    score === null ? "text-slate-400"
    : score >= 50 ? "text-green-400"
    : score >= 0 ? "text-amber-400"
    : "text-red-400"

  return (
    <div className="space-y-6 max-w-[1400px]">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Star className="w-6 h-6 text-amber-400 fill-amber-400" />
            GX Score
          </h1>
          <p className="text-slate-400 text-sm mt-1">Guest Experience · Données Roller</p>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {[
          {
            label: periodScoreLabel,
            value: periodScore ? `${periodScore.score} pts` : "–",
            sub: periodScore ? `${periodScore.total} réponses` : "Pas de données",
            color: scoreColor(periodScore?.score ?? null),
          },
          {
            label: "Score Week-end",
            value: lastWeekendScore ? `${lastWeekendScore.score} pts` : "–",
            sub: lastWeekendScore
              ? `${lastWeekendScore.total} avis · ${format(new Date(lastWeekendScore.satStr), "dd/MM", { locale: fr })}`
              : "Pas de données",
            color: scoreColor(lastWeekendScore?.score ?? null),
          },
          {
            label: "Réponses ce mois",
            value: totalResponsesMonth,
            sub: "depuis le 1er",
            color: "text-blue-400",
          },
          {
            label: "% Fans (30 dern.)",
            value: overallFanPct !== null ? `${overallFanPct} %` : "–",
            sub: "Note 4 ou 5 étoiles",
            color: "text-green-400",
          },
          {
            label: "% Critics (30 dern.)",
            value: overallCriticPct !== null ? `${overallCriticPct} %` : "–",
            sub: "Note 1, 2 ou 3 étoiles",
            color: "text-red-400",
          },
        ].map(({ label, value, sub, color }) => (
          <div key={label} className="bg-slate-800 border border-slate-700 rounded-xl p-4">
            <div className="text-xs text-slate-400 mb-1">{label}</div>
            <div className={`text-2xl font-bold ${color}`}>{loading ? "…" : value}</div>
            <div className="text-xs text-slate-500 mt-0.5">{sub}</div>
          </div>
        ))}
      </div>

      {/* GX Evolution chart */}
      <GxChart scores={gxScores} title="Évolution GX Score (30 derniers jours)" />

      {/* Tag synthesis */}
      {(tagSynthesis.fans.length > 0 || tagSynthesis.critics.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Fans */}
          <div className="bg-slate-800 border border-green-500/20 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-green-400 flex items-center gap-2 mb-4">
              <ThumbsUp className="w-4 h-4" /> Ce qui plaît (Fans)
            </h3>
            {tagSynthesis.fans.length === 0
              ? <p className="text-xs text-slate-500">Pas encore de données</p>
              : <div className="space-y-2">
                  {tagSynthesis.fans.map(([tag, count]) => {
                    const pct = Math.round(count / tagSynthesis.fans[0][1] * 100)
                    return (
                      <div key={tag}>
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="text-slate-200">{translateTag(tag, true)}</span>
                          <span className="text-slate-400">{count}</span>
                        </div>
                        <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                          <div className="h-full bg-green-500 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
            }
          </div>

          {/* Critics */}
          <div className="bg-slate-800 border border-red-500/20 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-red-400 flex items-center gap-2 mb-4">
              <ThumbsDown className="w-4 h-4" /> Ce qui déplaît (Critiques)
            </h3>
            {tagSynthesis.critics.length === 0
              ? <p className="text-xs text-slate-500">Pas encore de données</p>
              : <div className="space-y-2">
                  {tagSynthesis.critics.map(([tag, count]) => {
                    const pct = Math.round(count / tagSynthesis.critics[0][1] * 100)
                    return (
                      <div key={tag}>
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="text-slate-200">{translateTag(tag, false)}</span>
                          <span className="text-slate-400">{count}</span>
                        </div>
                        <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                          <div className="h-full bg-red-500 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
            }
          </div>
        </div>
      )}

      {/* Roller reviews */}
      {reviews.length > 0 && (
        <div>
          {/* Period filter */}
          <div className="flex items-center gap-2 mb-3">
            {([
              { value: "day", label: "Journalier" },
              { value: "week", label: "Hebdo" },
              { value: "month", label: "Mensuel" },
            ] as const).map(({ value, label }) => (
              <button key={value} onClick={() => setPeriodReviews(value)}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                  periodReviews === value
                    ? "bg-amber-500/20 text-amber-400 border border-amber-500/40"
                    : "bg-slate-800 text-slate-400 border border-slate-700 hover:text-white"
                }`}>
                {label}
              </button>
            ))}
            {periodReviews === "day" && (
              <Input
                type="date"
                value={selectedDate}
                onChange={e => setSelectedDate(e.target.value)}
                className="w-auto h-7 text-xs px-2 py-1"
              />
            )}
            {periodReviews === "week" && (
              <Input
                type="date"
                value={selectedWeekDate}
                onChange={e => setSelectedWeekDate(e.target.value)}
                className="w-auto h-7 text-xs px-2 py-1"
              />
            )}
            {periodReviews === "month" && (
              <Input
                type="month"
                value={selectedMonth}
                onChange={e => setSelectedMonth(e.target.value)}
                className="w-auto h-7 text-xs px-2 py-1"
              />
            )}
          </div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-white flex items-center gap-2">
              <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
              Avis clients Roller
            </h2>
            <div className="flex items-center gap-2">
              {(["all", "fan", "critic"] as const).map(f => (
                <button key={f} onClick={() => setFilterReviews(f)}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                    filterReviews === f
                      ? f === "fan" ? "bg-green-500/20 text-green-400 border border-green-500/40"
                        : f === "critic" ? "bg-red-500/20 text-red-400 border border-red-500/40"
                        : "bg-slate-600 text-white border border-slate-500"
                      : "bg-slate-800 text-slate-400 border border-slate-700 hover:text-white"
                  }`}>
                  {f === "all" ? `Tous (${filteredReviews.length})` : f === "fan" ? `👍 Fans (${filteredReviews.filter(r => r.is_fan).length})` : `👎 Critiques (${filteredReviews.filter(r => r.is_critic).length})`}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredReviews.filter(r => filterReviews === "all" || (filterReviews === "fan" ? r.is_fan : r.is_critic)).map(r => {
              const overallStars = r.overall_rating ?? (r.is_fan ? 5 : r.is_critic ? 2 : 3)
              const borderColor = r.is_fan ? "border-green-500/30 bg-green-500/5" : r.is_critic ? "border-red-500/30 bg-red-500/5" : "border-slate-700"
              const ratingRows: { label: string; val: number; reasons?: string[]; color: string }[] = [
                { label: "Expérience", val: overallStars, color: "text-amber-400 fill-amber-400" },
                ...(r.service_rating != null ? [{ label: "Service", val: r.service_rating, reasons: r.service_rating_reasons, color: "text-blue-400 fill-blue-400" }] : []),
                ...(r.safety_rating != null ? [{ label: "Sécurité", val: r.safety_rating, reasons: r.safety_rating_reasons, color: "text-green-400 fill-green-400" }] : []),
                ...(r.facilities_rating != null ? [{ label: "Installations", val: r.facilities_rating, reasons: r.facilities_rating_reasons, color: "text-purple-400 fill-purple-400" }] : []),
                ...(r.value_rating != null ? [{ label: "Rapport qualité/prix", val: r.value_rating, reasons: r.value_rating_reasons, color: "text-orange-400 fill-orange-400" }] : []),
              ]
              return (
                <div key={r.id} className={`bg-slate-800 border ${borderColor} rounded-xl p-4 space-y-3`}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      {r.is_fan
                        ? <span className="text-xs font-semibold text-green-400 flex items-center gap-1"><ThumbsUp className="w-3 h-3" /> Fan</span>
                        : r.is_critic
                        ? <span className="text-xs font-semibold text-red-400 flex items-center gap-1"><ThumbsDown className="w-3 h-3" /> Critique</span>
                        : null
                      }
                    </div>
                    <span className="text-xs text-slate-500 shrink-0">
                      {format(new Date(r.date), "dd/MM/yyyy", { locale: fr })}
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    {ratingRows.map(({ label, val, reasons, color }) => (
                      <div key={label}>
                        <div className="flex items-center gap-1.5">
                          <div className="flex items-center gap-0.5">
                            {Array.from({ length: 5 }).map((_, i) => (
                              <Star key={i} className={`w-3 h-3 ${i < val ? color : "text-slate-600"}`} />
                            ))}
                          </div>
                          <span className="text-xs text-slate-400">{label}</span>
                        </div>
                        {reasons && reasons.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1 ml-0.5">
                            {reasons.map((tag, i) => (
                              <span key={i} className="text-xs px-1.5 py-0.5 rounded-full bg-slate-700 text-slate-400 border border-slate-600">
                                {translateTag(tag, r.is_fan)}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {r.comment && (
                    <p className="text-sm text-slate-200 leading-relaxed border-t border-slate-700 pt-3">
                      "{r.comment}"
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Comments section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-white">Commentaires clients</h2>
          <span className="text-xs text-slate-500">{feedbacks.length} entrée{feedbacks.length !== 1 ? "s" : ""}</span>
        </div>

        <div className="flex items-center gap-3 mb-4">
          <div className="relative flex-1 min-w-48 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Rechercher..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={filterSentiment} onValueChange={setFilterSentiment}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Sentiment" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous</SelectItem>
              <SelectItem value="positive">Positif</SelectItem>
              <SelectItem value="neutral">Neutre</SelectItem>
              <SelectItem value="negative">Négatif</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <div className="text-center text-slate-500 py-12">Chargement…</div>
        ) : filtered.length === 0 ? (
          <div className="text-center text-slate-500 py-12">
            {feedbacks.length === 0 ? "Aucun commentaire — ajoutez le premier !" : "Aucun résultat pour ce filtre."}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(fb => (
              <div key={fb.id} className="bg-slate-800 border border-slate-700 rounded-xl p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    {sentimentIcon[fb.sentiment]}
                    <Badge variant={sentimentVariants[fb.sentiment]}>{sentimentLabels[fb.sentiment]}</Badge>
                  </div>
                  <span className="text-xs text-slate-500">
                    {format(new Date(fb.created_at), "dd/MM", { locale: fr })}
                  </span>
                </div>
                <p className="text-sm text-slate-200 leading-relaxed mb-3">"{fb.description}"</p>
                <div className="flex items-center gap-2">
                  <Badge variant="default" className="text-xs">{categoryLabels[fb.category]}</Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ajouter un commentaire client</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Commentaire *</Label>
              <Textarea
                placeholder="Retranscrivez le commentaire client..."
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Catégorie</Label>
                <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(categoryLabels).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Sentiment</Label>
                <Select value={form.sentiment} onValueChange={v => setForm(f => ({ ...f, sentiment: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="positive">Positif</SelectItem>
                    <SelectItem value="neutral">Neutre</SelectItem>
                    <SelectItem value="negative">Négatif</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Annuler</Button>
            <Button onClick={handleAdd} disabled={!form.description}>Enregistrer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
