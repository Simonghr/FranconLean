"use client"
import { useState, useEffect } from "react"
import { Plus, Lightbulb, TrendingUp } from "lucide-react"
import { format } from "date-fns"
import { fr } from "date-fns/locale"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import * as kaizenRepo from "@/lib/repositories/kaizen"
import type { Kaizen, KaizenStatus } from "@/lib/types"

const SITE_ID = '00000000-0000-0000-0000-000000000001'

const statusConfig: Record<KaizenStatus, { label: string; variant: "default" | "warning" | "success" | "destructive" | "info" }> = {
  idea: { label: "Idée", variant: "info" },
  in_progress: { label: "En cours", variant: "warning" },
  implemented: { label: "Implémenté", variant: "success" },
  rejected: { label: "Rejeté", variant: "destructive" },
}

function KaizenCard({ kaizen }: { kaizen: Kaizen }) {
  const cfg = statusConfig[kaizen.status]
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
      <div className="flex items-start justify-between mb-3">
        <Badge variant={cfg.variant}>{cfg.label}</Badge>
        <span className="text-xs text-slate-500">
          {format(new Date(kaizen.created_at), "dd/MM/yy", { locale: fr })}
        </span>
      </div>
      <p className="text-sm text-slate-200 leading-relaxed mb-4">{kaizen.description}</p>
      <div className="flex items-center justify-between pt-3 border-t border-slate-700/50">
        <div className="flex items-center gap-1.5 text-xs text-slate-500">
          <div className="w-5 h-5 rounded-full bg-slate-600 flex items-center justify-center text-white text-xs">
            {kaizen.author.charAt(0)}
          </div>
          {kaizen.author}
        </div>
        <div className="text-right">
          {kaizen.real_gain ? (
            <div className="text-green-400 font-semibold text-sm">
              +{kaizen.real_gain.toLocaleString("fr-FR")} €
            </div>
          ) : (
            <div className="text-slate-400 text-xs">
              ~{kaizen.estimated_gain.toLocaleString("fr-FR")} € estimés
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function KaizenPage() {
  const [kaizenList, setKaizenList] = useState<Kaizen[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState({ description: "", estimated_gain: "", author: "" })

  useEffect(() => {
    kaizenRepo.getAll(SITE_ID)
      .then(setKaizenList)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const handleAdd = async () => {
    if (!form.description || !form.author) return
    try {
      const newK = await kaizenRepo.create({
        site_id: SITE_ID,
        author: form.author,
        description: form.description,
        estimated_gain: parseFloat(form.estimated_gain) || 0,
        status: "idea",
      })
      setKaizenList(prev => [newK, ...prev])
      setForm({ description: "", estimated_gain: "", author: "" })
      setDialogOpen(false)
    } catch (err) {
      console.error('Failed to create kaizen', err)
    }
  }

  const columns: KaizenStatus[] = ["idea", "in_progress", "implemented", "rejected"]
  const totalRealGain = kaizenList.filter(k => k.real_gain).reduce((s, k) => s + (k.real_gain ?? 0), 0)
  const totalEstimated = kaizenList.filter(k => !k.real_gain).reduce((s, k) => s + k.estimated_gain, 0)

  return (
    <div className="space-y-6 max-w-[1400px]">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Kaizen</h1>
          <p className="text-slate-400 text-sm mt-1">Idées d'amélioration continue</p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="w-4 h-4" />
          Nouvelle idée
        </Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {columns.map(status => {
          const cfg = statusConfig[status]
          const count = kaizenList.filter(k => k.status === status).length
          return (
            <div key={status} className="bg-slate-800 border border-slate-700 rounded-xl p-4">
              <div className="text-2xl font-bold text-white">{count}</div>
              <div className="text-xs text-slate-400 mt-1">{cfg.label}</div>
            </div>
          )
        })}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-slate-800 border border-green-500/20 rounded-xl p-4 flex items-center gap-3">
          <TrendingUp className="w-8 h-8 text-green-400" />
          <div>
            <div className="text-xl font-bold text-green-400">{totalRealGain.toLocaleString("fr-FR")} €</div>
            <div className="text-xs text-slate-400">Gains réalisés</div>
          </div>
        </div>
        <div className="bg-slate-800 border border-blue-500/20 rounded-xl p-4 flex items-center gap-3">
          <Lightbulb className="w-8 h-8 text-blue-400" />
          <div>
            <div className="text-xl font-bold text-blue-400">~{totalEstimated.toLocaleString("fr-FR")} €</div>
            <div className="text-xs text-slate-400">Gains potentiels</div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center text-slate-500 py-12">Chargement…</div>
      ) : (
        /* Kanban columns */
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          {columns.map(status => {
            const cfg = statusConfig[status]
            const items = kaizenList.filter(k => k.status === status)
            return (
              <div key={status}>
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 mb-3">
                  <Badge variant={cfg.variant}>{cfg.label}</Badge>
                  <span className="ml-auto text-xs text-slate-500">{items.length}</span>
                </div>
                <div className="space-y-3">
                  {items.map(k => <KaizenCard key={k.id} kaizen={k} />)}
                  {items.length === 0 && (
                    <div className="text-center py-8 text-slate-600 text-sm">Aucune idée</div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nouvelle idée Kaizen</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Description de l'amélioration *</Label>
              <Textarea
                placeholder="Décrivez votre idée d'amélioration..."
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Auteur *</Label>
                <Input
                  placeholder="Votre prénom"
                  value={form.author}
                  onChange={e => setForm(f => ({ ...f, author: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Gain estimé (€)</Label>
                <Input
                  type="number"
                  placeholder="500"
                  value={form.estimated_gain}
                  onChange={e => setForm(f => ({ ...f, estimated_gain: e.target.value }))}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Annuler</Button>
            <Button onClick={handleAdd} disabled={!form.description || !form.author}>
              Soumettre
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
