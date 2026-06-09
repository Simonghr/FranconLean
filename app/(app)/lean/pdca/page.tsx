"use client"
import { useState, useEffect } from "react"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import * as pdcaRepo from "@/lib/repositories/pdca"
import type { PDCA, PDCAStatus } from "@/lib/types"
import { format } from "date-fns"
import { fr } from "date-fns/locale"

const SITE_ID = '00000000-0000-0000-0000-000000000001'

const statusConfig: Record<PDCAStatus, { label: string; color: string; bg: string; border: string }> = {
  plan: { label: "PLAN", color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/30" },
  do: { label: "DO", color: "text-yellow-400", bg: "bg-yellow-500/10", border: "border-yellow-500/30" },
  check: { label: "CHECK", color: "text-orange-400", bg: "bg-orange-500/10", border: "border-orange-500/30" },
  act: { label: "ACT", color: "text-green-400", bg: "bg-green-500/10", border: "border-green-500/30" },
}

const nextStatus: Record<PDCAStatus, PDCAStatus | null> = {
  plan: "do",
  do: "check",
  check: "act",
  act: null,
}

function PDCACard({ pdca, onAdvance }: { pdca: PDCA; onAdvance: (pdca: PDCA) => void }) {
  const cfg = statusConfig[pdca.status]
  const next = nextStatus[pdca.status]
  return (
    <div className={`bg-slate-800 border ${cfg.border} rounded-xl p-4`}>
      <div className="flex items-start justify-between mb-3">
        <div className={`px-2 py-0.5 rounded text-xs font-bold ${cfg.color} ${cfg.bg}`}>
          {cfg.label}
        </div>
        <span className="text-xs text-slate-500">
          {format(new Date(pdca.created_at), "dd/MM/yy", { locale: fr })}
        </span>
      </div>
      <div className="space-y-2 text-sm">
        <div>
          <span className="text-xs text-slate-500 uppercase tracking-wider">Problème</span>
          <p className="text-white font-medium mt-0.5">{pdca.problem}</p>
        </div>
        <div>
          <span className="text-xs text-slate-500 uppercase tracking-wider">Objectif</span>
          <p className="text-slate-300 mt-0.5">{pdca.objective}</p>
        </div>
        <div>
          <span className="text-xs text-slate-500 uppercase tracking-wider">Action</span>
          <p className="text-slate-300 mt-0.5">{pdca.action}</p>
        </div>
        {pdca.result && (
          <div>
            <span className="text-xs text-slate-500 uppercase tracking-wider">Résultat</span>
            <p className="text-slate-300 mt-0.5">{pdca.result}</p>
          </div>
        )}
        {pdca.standardization && (
          <div>
            <span className="text-xs text-slate-500 uppercase tracking-wider">Standardisation</span>
            <p className="text-green-400 mt-0.5">{pdca.standardization}</p>
          </div>
        )}
      </div>
      {next && (
        <div className="mt-3 pt-3 border-t border-slate-700/50">
          <Button size="sm" variant="ghost" className="text-xs h-7 px-2 w-full" onClick={() => onAdvance(pdca)}>
            Avancer vers {statusConfig[next].label}
          </Button>
        </div>
      )}
    </div>
  )
}

export default function PDCAPage() {
  const [pdcas, setPdcas] = useState<PDCA[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState({ problem: "", objective: "", action: "" })

  useEffect(() => {
    pdcaRepo.getAll(SITE_ID)
      .then(setPdcas)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const handleAdd = async () => {
    if (!form.problem || !form.objective || !form.action) return
    try {
      const newPDCA = await pdcaRepo.create({
        site_id: SITE_ID,
        problem: form.problem,
        objective: form.objective,
        action: form.action,
        result: "",
        standardization: "",
        status: "plan",
      })
      setPdcas(prev => [newPDCA, ...prev])
      setForm({ problem: "", objective: "", action: "" })
      setDialogOpen(false)
    } catch (err) {
      console.error('Failed to create PDCA', err)
    }
  }

  const handleAdvance = async (pdca: PDCA) => {
    const next = nextStatus[pdca.status]
    if (!next) return
    try {
      const updated = await pdcaRepo.update(pdca.id, { status: next })
      setPdcas(prev => prev.map(p => p.id === updated.id ? updated : p))
    } catch (err) {
      console.error('Failed to update PDCA', err)
    }
  }

  const columns: PDCAStatus[] = ["plan", "do", "check", "act"]

  return (
    <div className="space-y-6 max-w-[1400px]">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">PDCA</h1>
          <p className="text-slate-400 text-sm mt-1">Cycles Plan — Do — Check — Act</p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="w-4 h-4" />
          Nouveau PDCA
        </Button>
      </div>

      {loading ? (
        <div className="text-center text-slate-500 py-12">Chargement…</div>
      ) : (
        /* Kanban board */
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          {columns.map(status => {
            const cfg = statusConfig[status]
            const items = pdcas.filter(p => p.status === status)
            return (
              <div key={status}>
                <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${cfg.bg} border ${cfg.border} mb-3`}>
                  <span className={`font-bold text-sm ${cfg.color}`}>{cfg.label}</span>
                  <span className="ml-auto text-xs text-slate-500">{items.length}</span>
                </div>
                <div className="space-y-3">
                  {items.map(pdca => (
                    <PDCACard key={pdca.id} pdca={pdca} onAdvance={handleAdvance} />
                  ))}
                  {items.length === 0 && (
                    <div className="text-center py-8 text-slate-600 text-sm">
                      Aucun PDCA
                    </div>
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
            <DialogTitle>Nouveau cycle PDCA</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Problème identifié *</Label>
              <Textarea
                placeholder="Quel est le problème ?"
                value={form.problem}
                onChange={e => setForm(f => ({ ...f, problem: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Objectif *</Label>
              <Input
                placeholder="Quel résultat attendez-vous ?"
                value={form.objective}
                onChange={e => setForm(f => ({ ...f, objective: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Action planifiée *</Label>
              <Textarea
                placeholder="Quelle action allez-vous mener ?"
                value={form.action}
                onChange={e => setForm(f => ({ ...f, action: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Annuler</Button>
            <Button onClick={handleAdd} disabled={!form.problem || !form.objective || !form.action}>
              Créer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
