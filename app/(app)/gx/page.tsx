"use client"
import { useState, useEffect } from "react"
import { Plus, Search, ThumbsUp, ThumbsDown, Minus, Star } from "lucide-react"
import { format } from "date-fns"
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
import type { CustomerFeedback, FeedbackCategory, FeedbackSentiment, GxScore } from "@/lib/types"

const SITE_ID = '00000000-0000-0000-0000-000000000001'

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
  const [feedbacks, setFeedbacks] = useState<CustomerFeedback[]>([])
  const [gxScores, setGxScores] = useState<GxScore[]>([])
  const [reviews, setReviews] = useState<GxReview[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [filterSentiment, setFilterSentiment] = useState("all")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState({
    description: "", category: "compliment", sentiment: "positive",
  })

  useEffect(() => {
    Promise.all([
      feedbackRepo.getAll(SITE_ID),
      gxRepo.getAll(SITE_ID),
      gxReviewsRepo.getWithComments(SITE_ID),
    ])
      .then(([fb, gx, rev]) => { setFeedbacks(fb); setGxScores(gx); setReviews(rev) })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  // ── GX KPIs ────────────────────────────────────────────────────────────────
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

  // ── Feedback filters ───────────────────────────────────────────────────────
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
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="w-4 h-4" />
          Ajouter un commentaire
        </Button>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {[
          {
            label: "Score (30 dernières)",
            value: last30Score ? `${last30Score.score} pts` : "–",
            sub: last30Score ? `${last30Score.total} réponses` : "Pas de données",
            color: scoreColor(last30Score?.score ?? null),
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

      {/* Roller reviews with comments */}
      {reviews.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-white flex items-center gap-2">
              <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
              Avis clients Roller
            </h2>
            <span className="text-xs text-slate-500">{reviews.length} avec commentaire</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {reviews.map(r => {
              const stars = r.overall_rating ?? (r.is_fan ? 5 : r.is_critic ? 2 : 3)
              const color = r.is_fan ? "border-green-500/30 bg-green-500/5" : r.is_critic ? "border-red-500/30 bg-red-500/5" : "border-slate-700"
              return (
                <div key={r.id} className={`bg-slate-800 border ${color} rounded-xl p-4 space-y-3`}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      {r.guest_name && (
                        <p className="text-sm font-semibold text-white">{r.guest_name}</p>
                      )}
                      <div className="flex items-center gap-0.5 mt-1">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star key={i} className={`w-3.5 h-3.5 ${i < stars ? "text-amber-400 fill-amber-400" : "text-slate-600"}`} />
                        ))}
                      </div>
                    </div>
                    <span className="text-xs text-slate-500 shrink-0">
                      {format(new Date(r.date), "dd/MM/yyyy", { locale: fr })}
                    </span>
                  </div>
                  <p className="text-sm text-slate-200 leading-relaxed">"{r.comment}"</p>
                  <div className="flex items-center gap-2">
                    {r.is_fan && <span className="text-xs text-green-400 flex items-center gap-1"><ThumbsUp className="w-3 h-3" /> Fan</span>}
                    {r.is_critic && <span className="text-xs text-red-400 flex items-center gap-1"><ThumbsDown className="w-3 h-3" /> Critique</span>}
                  </div>
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
