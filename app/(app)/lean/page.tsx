"use client"
import { useState, useEffect, useCallback } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { RefreshCw, Lightbulb, Plus, Pencil, Trash2, ArrowRight, ChevronRight, CheckCircle2 } from "lucide-react"
import { format } from "date-fns"
import { fr } from "date-fns/locale"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import * as pdcaRepo from "@/lib/repositories/pdca"
import * as kaizenRepo from "@/lib/repositories/kaizen"
import type { PDCA, PDCAStatus, Kaizen, KaizenStatus } from "@/lib/types"

const SITE_ID = '00000000-0000-0000-0000-000000000001'

// ── PDCA ────────────────────────────────────────────────────────────────────

const PDCA_STATUSES: PDCAStatus[] = ['plan', 'do', 'check', 'act']

const pdcaStatusConfig: Record<PDCAStatus, { label: string; color: string; bg: string; border: string; headerBg: string }> = {
  plan:  { label: "PLAN",  color: "text-blue-400",   bg: "bg-blue-500/10",   border: "border-blue-500/30",   headerBg: "bg-blue-600" },
  do:    { label: "DO",    color: "text-yellow-400",  bg: "bg-yellow-500/10", border: "border-yellow-500/30", headerBg: "bg-yellow-500" },
  check: { label: "CHECK", color: "text-orange-400",  bg: "bg-orange-500/10", border: "border-orange-500/30", headerBg: "bg-orange-500" },
  act:   { label: "ACT",   color: "text-green-400",   bg: "bg-green-500/10",  border: "border-green-500/30",  headerBg: "bg-green-600" },
}

const pdcaStatusDesc: Record<PDCAStatus, string> = {
  plan:  "Identifier le problème & planifier",
  do:    "Mettre en œuvre l'action",
  check: "Vérifier les résultats",
  act:   "Standardiser & pérenniser",
}

const nextPdcaStatus = (s: PDCAStatus): PDCAStatus | null => {
  const idx = PDCA_STATUSES.indexOf(s)
  return idx < PDCA_STATUSES.length - 1 ? PDCA_STATUSES[idx + 1] : null
}

const blankPdca = (overrides?: Partial<PDCAFormState>): PDCAFormState => ({
  problem: "", objective: "", action: "", result: "", standardization: "", status: "plan",
  origin_label: "", origin_id: "",
  ...overrides,
})

type PDCAFormState = {
  problem: string; objective: string; action: string; result: string; standardization: string
  status: PDCAStatus; origin_label?: string; origin_id?: string
}

// ── Kaizen ──────────────────────────────────────────────────────────────────

const kaizenStatusConfig: Record<KaizenStatus, { label: string; color: string; bg: string }> = {
  idea:        { label: "Idée",         color: "text-yellow-400",  bg: "bg-yellow-500/10" },
  in_progress: { label: "En cours",     color: "text-blue-400",    bg: "bg-blue-500/10" },
  implemented: { label: "Implémentée",  color: "text-green-400",   bg: "bg-green-500/10" },
  rejected:    { label: "Rejetée",      color: "text-slate-400",   bg: "bg-slate-500/10" },
}

type KaizenFormState = {
  description: string; estimated_gain: string; status: KaizenStatus; author: string
}
const blankKaizen = (): KaizenFormState => ({ description: "", estimated_gain: "0", status: "idea", author: "" })

// ── Component ────────────────────────────────────────────────────────────────

export default function LeanPage() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [pdcas, setPdcas] = useState<PDCA[]>([])
  const [kaizens, setKaizens] = useState<Kaizen[]>([])
  const [loading, setLoading] = useState(true)

  // PDCA modal
  const [pdcaOpen, setPdcaOpen] = useState(false)
  const [pdcaForm, setPdcaForm] = useState<PDCAFormState>(blankPdca())
  const [editingPdca, setEditingPdca] = useState<PDCA | null>(null)
  const [savingPdca, setSavingPdca] = useState(false)
  const [deletingPdcaId, setDeletingPdcaId] = useState<string | null>(null)

  // Kaizen modal
  const [kaizenOpen, setKaizenOpen] = useState(false)
  const [kaizenForm, setKaizenForm] = useState<KaizenFormState>(blankKaizen())
  const [editingKaizen, setEditingKaizen] = useState<Kaizen | null>(null)
  const [savingKaizen, setSavingKaizen] = useState(false)
  const [deletingKaizenId, setDeletingKaizenId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [p, k] = await Promise.all([pdcaRepo.getAll(SITE_ID), kaizenRepo.getAll(SITE_ID)])
      setPdcas(p)
      setKaizens(k)
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  // Auto-open PDCA modal if URL params present (from incident or kaizen)
  useEffect(() => {
    const problem = searchParams.get("problem")
    const origin_label = searchParams.get("origin_label")
    const origin_id = searchParams.get("origin_id")
    if (problem) {
      setPdcaForm(blankPdca({ problem, origin_label: origin_label ?? "", origin_id: origin_id ?? "" }))
      setEditingPdca(null)
      setPdcaOpen(true)
      // Clean URL without navigation
      const url = new URL(window.location.href)
      url.searchParams.delete("problem")
      url.searchParams.delete("origin_label")
      url.searchParams.delete("origin_id")
      window.history.replaceState({}, "", url.toString())
    }
  }, [searchParams])

  // ── PDCA handlers ──────────────────────────────────────────────────────────

  const openNewPdca = () => {
    setEditingPdca(null)
    setPdcaForm(blankPdca())
    setPdcaOpen(true)
  }

  const openEditPdca = (p: PDCA) => {
    setEditingPdca(p)
    setPdcaForm({
      problem: p.problem, objective: p.objective, action: p.action,
      result: p.result, standardization: p.standardization, status: p.status,
      origin_label: p.origin_label ?? "", origin_id: p.origin_id ?? "",
    })
    setPdcaOpen(true)
  }

  const savePdca = async () => {
    setSavingPdca(true)
    try {
      const payload = {
        site_id: SITE_ID,
        problem: pdcaForm.problem,
        objective: pdcaForm.objective,
        action: pdcaForm.action,
        result: pdcaForm.result,
        standardization: pdcaForm.standardization,
        status: pdcaForm.status,
        origin_label: pdcaForm.origin_label || undefined,
        origin_id: pdcaForm.origin_id || undefined,
      }
      if (editingPdca) {
        await pdcaRepo.update(editingPdca.id, payload)
      } else {
        await pdcaRepo.create(payload)
      }
      setPdcaOpen(false)
      await load()
    } catch (err) { console.error(err) }
    finally { setSavingPdca(false) }
  }

  const deletePdca = async (id: string) => {
    setDeletingPdcaId(id)
    try { await pdcaRepo.remove(id); await load() }
    catch (err) { console.error(err) }
    finally { setDeletingPdcaId(null) }
  }

  const advancePdca = async (p: PDCA) => {
    const next = nextPdcaStatus(p.status)
    if (!next) return
    await pdcaRepo.update(p.id, { status: next })
    await load()
  }

  // ── Kaizen handlers ────────────────────────────────────────────────────────

  const openNewKaizen = () => {
    setEditingKaizen(null)
    setKaizenForm(blankKaizen())
    setKaizenOpen(true)
  }

  const openEditKaizen = (k: Kaizen) => {
    setEditingKaizen(k)
    setKaizenForm({
      description: k.description, estimated_gain: String(k.estimated_gain),
      status: k.status, author: k.author,
    })
    setKaizenOpen(true)
  }

  const saveKaizen = async () => {
    setSavingKaizen(true)
    try {
      const payload = {
        site_id: SITE_ID,
        description: kaizenForm.description,
        estimated_gain: Number(kaizenForm.estimated_gain) || 0,
        status: kaizenForm.status,
        author: kaizenForm.author,
      }
      if (editingKaizen) {
        await kaizenRepo.update(editingKaizen.id, payload)
      } else {
        await kaizenRepo.create(payload)
      }
      setKaizenOpen(false)
      await load()
    } catch (err) { console.error(err) }
    finally { setSavingKaizen(false) }
  }

  const deleteKaizen = async (id: string) => {
    setDeletingKaizenId(id)
    try { await kaizenRepo.remove(id); await load() }
    catch (err) { console.error(err) }
    finally { setDeletingKaizenId(null) }
  }

  const kaizenToPdca = (k: Kaizen) => {
    const params = new URLSearchParams({
      problem: k.description,
      origin_label: `Amélioration continue : ${k.description.slice(0, 60)}`,
      origin_id: k.id,
    })
    router.push(`/lean?${params.toString()}`)
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const pdcaByStatus = (s: PDCAStatus) => pdcas.filter(p => p.status === s)

  return (
    <div className="space-y-8 max-w-[1600px]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <RefreshCw className="w-6 h-6 text-blue-400" />
            Lean Tools
          </h1>
          <p className="text-slate-400 text-sm mt-1">PDCA · Amélioration continue — Approche Michael Ballé</p>
        </div>
      </div>

      {/* ── PDCA Section ── */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-white">PDCA — Résolution de problèmes</h2>
            <p className="text-xs text-slate-400 mt-0.5">Plan · Do · Check · Act</p>
          </div>
          <Button onClick={openNewPdca} size="sm" className="bg-blue-600 hover:bg-blue-700 text-white gap-2">
            <Plus className="w-4 h-4" /> Nouveau PDCA
          </Button>
        </div>

        {loading ? (
          <div className="text-center py-10 text-slate-500">Chargement…</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {PDCA_STATUSES.map(status => {
              const cfg = pdcaStatusConfig[status]
              const items = pdcaByStatus(status)
              return (
                <div key={status} className={`bg-slate-800 border ${cfg.border} rounded-xl overflow-hidden`}>
                  <div className={`${cfg.headerBg} px-4 py-2.5 flex items-center justify-between`}>
                    <span className="text-sm font-bold text-white">{cfg.label}</span>
                    <span className="text-xs text-white/70 bg-white/20 rounded-full px-2 py-0.5">{items.length}</span>
                  </div>
                  <div className="text-xs text-slate-500 px-4 py-2 border-b border-slate-700/50">{pdcaStatusDesc[status]}</div>
                  <div className="p-3 space-y-2 min-h-[120px]">
                    {items.length === 0 && (
                      <p className="text-xs text-slate-600 text-center py-4">Aucun PDCA</p>
                    )}
                    {items.map(p => (
                      <PDCACard
                        key={p.id}
                        pdca={p}
                        onEdit={() => openEditPdca(p)}
                        onDelete={() => deletePdca(p.id)}
                        onAdvance={() => advancePdca(p)}
                        deleting={deletingPdcaId === p.id}
                      />
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* ── Améliorations Continues Section ── */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <Lightbulb className="w-5 h-5 text-yellow-400" />
              Améliorations Continues
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">Idées de petites améliorations — Kaizen</p>
          </div>
          <Button onClick={openNewKaizen} size="sm" className="bg-yellow-600 hover:bg-yellow-700 text-white gap-2">
            <Plus className="w-4 h-4" /> Nouvelle idée
          </Button>
        </div>

        {loading ? (
          <div className="text-center py-10 text-slate-500">Chargement…</div>
        ) : kaizens.length === 0 ? (
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-8 text-center">
            <Lightbulb className="w-8 h-8 text-yellow-400/40 mx-auto mb-2" />
            <p className="text-sm text-slate-400">Aucune idée d'amélioration pour le moment.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {kaizens.map(k => (
              <KaizenCard
                key={k.id}
                kaizen={k}
                onEdit={() => openEditKaizen(k)}
                onDelete={() => deleteKaizen(k.id)}
                onToPdca={() => kaizenToPdca(k)}
                deleting={deletingKaizenId === k.id}
              />
            ))}
          </div>
        )}
      </section>

      {/* ── PDCA Modal ── */}
      <Dialog open={pdcaOpen} onOpenChange={setPdcaOpen}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingPdca ? "Modifier le PDCA" : "Nouveau PDCA"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {pdcaForm.origin_label && (
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg px-3 py-2 text-xs text-blue-300">
                Origine : {pdcaForm.origin_label}
              </div>
            )}
            <div className="space-y-1.5">
              <Label className="text-slate-300">Problème <span className="text-red-400">*</span></Label>
              <Textarea
                className="bg-slate-800 border-slate-700 text-white resize-none"
                rows={3}
                placeholder="Décrivez le problème observé…"
                value={pdcaForm.problem}
                onChange={e => setPdcaForm(f => ({ ...f, problem: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-300">Objectif (PLAN)</Label>
              <Textarea
                className="bg-slate-800 border-slate-700 text-white resize-none"
                rows={2}
                placeholder="Quel est l'objectif visé ?"
                value={pdcaForm.objective}
                onChange={e => setPdcaForm(f => ({ ...f, objective: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-300">Action mise en place (DO)</Label>
              <Textarea
                className="bg-slate-800 border-slate-700 text-white resize-none"
                rows={2}
                placeholder="Qu'est-ce qui a été mis en place ?"
                value={pdcaForm.action}
                onChange={e => setPdcaForm(f => ({ ...f, action: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-300">Résultats observés (CHECK)</Label>
              <Textarea
                className="bg-slate-800 border-slate-700 text-white resize-none"
                rows={2}
                placeholder="Quels résultats a-t-on observé ?"
                value={pdcaForm.result}
                onChange={e => setPdcaForm(f => ({ ...f, result: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-300">Standardisation (ACT)</Label>
              <Textarea
                className="bg-slate-800 border-slate-700 text-white resize-none"
                rows={2}
                placeholder="Qu'est-ce qui est standardisé ? (ou pourquoi on ne standardise pas)"
                value={pdcaForm.standardization}
                onChange={e => setPdcaForm(f => ({ ...f, standardization: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-300">Étape</Label>
              <Select value={pdcaForm.status} onValueChange={v => setPdcaForm(f => ({ ...f, status: v as PDCAStatus }))}>
                <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700 text-white">
                  {PDCA_STATUSES.map(s => (
                    <SelectItem key={s} value={s}>{pdcaStatusConfig[s].label} — {pdcaStatusDesc[s]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPdcaOpen(false)} className="border-slate-700 text-slate-300">
              Annuler
            </Button>
            <Button
              onClick={savePdca}
              disabled={savingPdca || !pdcaForm.problem.trim()}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {savingPdca ? "Enregistrement…" : editingPdca ? "Mettre à jour" : "Créer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Kaizen Modal ── */}
      <Dialog open={kaizenOpen} onOpenChange={setKaizenOpen}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-md">
          <DialogHeader>
            <DialogTitle>{editingKaizen ? "Modifier l'amélioration" : "Nouvelle idée d'amélioration"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-slate-300">Description <span className="text-red-400">*</span></Label>
              <Textarea
                className="bg-slate-800 border-slate-700 text-white resize-none"
                rows={3}
                placeholder="Décrivez l'idée d'amélioration…"
                value={kaizenForm.description}
                onChange={e => setKaizenForm(f => ({ ...f, description: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-300">Auteur</Label>
              <Input
                className="bg-slate-800 border-slate-700 text-white"
                placeholder="Nom de l'auteur"
                value={kaizenForm.author}
                onChange={e => setKaizenForm(f => ({ ...f, author: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-300">Gain estimé (€)</Label>
              <Input
                type="number"
                className="bg-slate-800 border-slate-700 text-white"
                placeholder="0"
                value={kaizenForm.estimated_gain}
                onChange={e => setKaizenForm(f => ({ ...f, estimated_gain: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-300">Statut</Label>
              <Select value={kaizenForm.status} onValueChange={v => setKaizenForm(f => ({ ...f, status: v as KaizenStatus }))}>
                <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700 text-white">
                  {(Object.keys(kaizenStatusConfig) as KaizenStatus[]).map(s => (
                    <SelectItem key={s} value={s}>{kaizenStatusConfig[s].label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setKaizenOpen(false)} className="border-slate-700 text-slate-300">
              Annuler
            </Button>
            <Button
              onClick={saveKaizen}
              disabled={savingKaizen || !kaizenForm.description.trim()}
              className="bg-yellow-600 hover:bg-yellow-700 text-white"
            >
              {savingKaizen ? "Enregistrement…" : editingKaizen ? "Mettre à jour" : "Créer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ── Sub-components ───────────────────────────────────────────────────────────

function PDCACard({ pdca, onEdit, onDelete, onAdvance, deleting }: {
  pdca: PDCA; onEdit: () => void; onDelete: () => void; onAdvance: () => void; deleting: boolean
}) {
  const next = nextPdcaStatus(pdca.status)
  return (
    <div className="bg-slate-900/60 border border-slate-700/50 rounded-lg p-3 space-y-2">
      {pdca.origin_label && (
        <div className="text-xs text-blue-400/70 truncate">↩ {pdca.origin_label}</div>
      )}
      <p className="text-xs text-slate-200 line-clamp-3 leading-relaxed">{pdca.problem}</p>
      <p className="text-xs text-slate-500">{format(new Date(pdca.created_at), "dd/MM/yy", { locale: fr })}</p>
      <div className="flex items-center gap-1 pt-1">
        <button
          onClick={onEdit}
          className="p-1 text-slate-500 hover:text-blue-400 transition-colors"
          title="Modifier"
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={onDelete}
          disabled={deleting}
          className="p-1 text-slate-500 hover:text-red-400 transition-colors"
          title="Supprimer"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
        {next && (
          <button
            onClick={onAdvance}
            className="ml-auto flex items-center gap-1 text-xs text-slate-400 hover:text-green-400 transition-colors"
            title={`Passer à ${pdcaStatusConfig[next].label}`}
          >
            <span>{pdcaStatusConfig[next].label}</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        )}
        {!next && (
          <span className="ml-auto flex items-center gap-1 text-xs text-green-400">
            <CheckCircle2 className="w-3 h-3" /> Terminé
          </span>
        )}
      </div>
    </div>
  )
}

function KaizenCard({ kaizen, onEdit, onDelete, onToPdca, deleting }: {
  kaizen: Kaizen; onEdit: () => void; onDelete: () => void; onToPdca: () => void; deleting: boolean
}) {
  const cfg = kaizenStatusConfig[kaizen.status]
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.color}`}>
          {cfg.label}
        </span>
        <div className="flex items-center gap-1">
          <button onClick={onEdit} className="p-1 text-slate-500 hover:text-blue-400 transition-colors">
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button onClick={onDelete} disabled={deleting} className="p-1 text-slate-500 hover:text-red-400 transition-colors">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      <p className="text-sm text-slate-200 leading-relaxed">{kaizen.description}</p>
      <div className="flex items-center justify-between text-xs text-slate-500">
        <span>{kaizen.author || "—"}</span>
        {kaizen.estimated_gain > 0 && (
          <span className="text-green-400/80">~{kaizen.estimated_gain.toLocaleString("fr-FR")} €</span>
        )}
      </div>
      <div className="pt-1 border-t border-slate-700/50">
        <button
          onClick={onToPdca}
          className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 transition-colors"
        >
          <RefreshCw className="w-3 h-3" />
          Traiter en PDCA
          <ChevronRight className="w-3 h-3" />
        </button>
      </div>
    </div>
  )
}
