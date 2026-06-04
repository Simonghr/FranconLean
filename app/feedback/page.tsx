"use client"
import { useState, useEffect } from "react"
import { Plus, Search, ThumbsUp, ThumbsDown, Minus } from "lucide-react"
import { format } from "date-fns"
import { fr } from "date-fns/locale"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { FeedbackChart } from "@/components/charts/FeedbackChart"
import * as feedbackRepo from "@/lib/repositories/feedback"
import type { CustomerFeedback, FeedbackCategory, FeedbackSentiment } from "@/lib/types"

const SITE_ID = '00000000-0000-0000-0000-000000000001'

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

export default function FeedbackPage() {
  const [feedbacks, setFeedbacks] = useState<CustomerFeedback[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [filterSentiment, setFilterSentiment] = useState("all")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState({
    description: "", category: "compliment", sentiment: "positive",
  })

  useEffect(() => {
    feedbackRepo.getAll(SITE_ID)
      .then(setFeedbacks)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

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

  const positiveCount = feedbacks.filter(f => f.sentiment === "positive").length
  const negativeCount = feedbacks.filter(f => f.sentiment === "negative").length
  const neutralCount = feedbacks.filter(f => f.sentiment === "neutral").length

  return (
    <div className="space-y-6 max-w-[1400px]">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Retours Clients</h1>
          <p className="text-slate-400 text-sm mt-1">Satisfaction et réclamations clients</p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="w-4 h-4" />
          Ajouter un retour
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 grid grid-cols-3 gap-3">
          {[
            { label: "Positifs", value: positiveCount, color: "text-green-400", border: "border-green-500/20", icon: <ThumbsUp className="w-5 h-5 text-green-400" /> },
            { label: "Neutres", value: neutralCount, color: "text-slate-300", border: "border-slate-600", icon: <Minus className="w-5 h-5 text-slate-400" /> },
            { label: "Négatifs", value: negativeCount, color: "text-red-400", border: "border-red-500/20", icon: <ThumbsDown className="w-5 h-5 text-red-400" /> },
          ].map(({ label, value, color, border, icon }) => (
            <div key={label} className={`bg-slate-800 border ${border} rounded-xl p-4 flex items-center gap-3`}>
              <div>{icon}</div>
              <div>
                <div className={`text-2xl font-bold ${color}`}>{value}</div>
                <div className="text-xs text-slate-400">{label}</div>
              </div>
            </div>
          ))}
        </div>
        <FeedbackChart feedback={feedbacks} title="Répartition" />
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
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

      {/* Cards grid */}
      {loading ? (
        <div className="text-center text-slate-500 py-12">Chargement…</div>
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

      {/* Add Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ajouter un retour client</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Description *</Label>
              <Textarea
                placeholder="Décrivez le retour client..."
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
