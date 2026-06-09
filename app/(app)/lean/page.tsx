"use client"
import { useState, useEffect, useCallback, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { RefreshCw, Lightbulb, Plus, Pencil, Trash2, ChevronRight, CheckCircle2 } from "lucide-react"
import { format } from "date-fns"
import { fr } from "date-fns/locale"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import * as pdcaRepo from "@/lib/repositories/pdca"
import * as kaizenRepo from "@/lib/repositories/kaizen"
import type { PDCA, PDCAStatus, PDCAPriority, Kaizen, KaizenStatus } from "@/lib/types"

const SITE_ID = '00000000-0000-0000-0000-000000000001'

// ── PDCA statuses ─────────────────────────────────────────────────────────────

const PDCA_STATUSES: PDCAStatus[] = ['plan', 'do', 'check', 'act']

const statusConfig: Record<PDCAStatus, { dot: string; label: string; next: string }> = {
  plan:  { dot: "bg-slate-400",  label: "En recherche de solution", next: "→ En test" },
  do:    { dot: "bg-orange-400", label: "En test",                  next: "→ En cours de validation" },
  check: { dot: "bg-blue-500",   label: "En cours de validation",   next: "→ Validé / Standardisé" },
  act:   { dot: "bg-green-600",  label: "Validé / Standardisé",     next: "" },
}

// Post-it color = priority (importance)
const PDCA_PRIORITIES: PDCAPriority[] = ['low', 'medium', 'urgent', 'investment']

const priorityColor: Record<PDCAPriority, { bg: string; border: string; label: string; dot: string }> = {
  low:        { bg: "bg-[#bbf7d0]", border: "border-green-300",  label: "Faible",               dot: "bg-green-600" },
  medium:     { bg: "bg-[#fed7aa]", border: "border-orange-300", label: "Moyen",                dot: "bg-orange-500" },
  urgent:     { bg: "bg-[#fecaca]", border: "border-red-300",    label: "Urgent",               dot: "bg-red-600" },
  investment: { bg: "bg-[#bfdbfe]", border: "border-blue-300",   label: "Gros investissement",  dot: "bg-blue-600" },
}

const nextPdcaStatus = (s: PDCAStatus): PDCAStatus | null => {
  const idx = PDCA_STATUSES.indexOf(s)
  return idx < PDCA_STATUSES.length - 1 ? PDCA_STATUSES[idx + 1] : null
}

type PDCAFormState = {
  problem: string; action: string; result: string; standardization: string
  status: PDCAStatus; priority: PDCAPriority; budget: string
  origin_label?: string; origin_id?: string
}
const blankPdca = (o?: Partial<PDCAFormState>): PDCAFormState => ({
  problem: "", action: "", result: "", standardization: "", status: "plan", priority: "medium", budget: "",
  origin_label: "", origin_id: "", ...o,
})

// ── Kaizen ────────────────────────────────────────────────────────────────────

const kaizenStickyColor: Record<KaizenStatus, { bg: string; border: string; dot: string; label: string }> = {
  idea:        { bg: "bg-[#fef9c3]", border: "border-yellow-200",  dot: "bg-yellow-400",  label: "Idée" },
  in_progress: { bg: "bg-[#dbeafe]", border: "border-blue-200",    dot: "bg-blue-500",    label: "En cours" },
  implemented: { bg: "bg-[#dcfce7]", border: "border-green-200",   dot: "bg-green-500",   label: "Implémentée" },
  rejected:    { bg: "bg-[#f1f5f9]", border: "border-slate-200",   dot: "bg-slate-400",   label: "Rejetée" },
}

type KaizenFormState = { description: string; estimated_gain: string; status: KaizenStatus; author: string }
const blankKaizen = (): KaizenFormState => ({ description: "", estimated_gain: "0", status: "idea", author: "" })

// ── Page ──────────────────────────────────────────────────────────────────────

export default function LeanPage() {
  return (
    <Suspense>
      <LeanPageInner />
    </Suspense>
  )
}

function LeanPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [pdcas, setPdcas] = useState<PDCA[]>([])
  const [kaizens, setKaizens] = useState<Kaizen[]>([])
  const [loading, setLoading] = useState(true)

  const [pdcaOpen, setPdcaOpen] = useState(false)
  const [pdcaForm, setPdcaForm] = useState<PDCAFormState>(blankPdca())
  const [editingPdca, setEditingPdca] = useState<PDCA | null>(null)
  const [savingPdca, setSavingPdca] = useState(false)
  const [deletingPdcaId, setDeletingPdcaId] = useState<string | null>(null)

  const [kaizenOpen, setKaizenOpen] = useState(false)
  const [kaizenForm, setKaizenForm] = useState<KaizenFormState>(blankKaizen())
  const [editingKaizen, setEditingKaizen] = useState<Kaizen | null>(null)
  const [savingKaizen, setSavingKaizen] = useState(false)
  const [deletingKaizenId, setDeletingKaizenId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [p, k] = await Promise.all([pdcaRepo.getAll(SITE_ID), kaizenRepo.getAll(SITE_ID)])
      setPdcas(p); setKaizens(k)
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    const problem = searchParams.get("problem")
    const origin_label = searchParams.get("origin_label")
    const origin_id = searchParams.get("origin_id")
    if (problem) {
      setPdcaForm(blankPdca({ problem, origin_label: origin_label ?? "", origin_id: origin_id ?? "" }))
      setEditingPdca(null)
      setPdcaOpen(true)
      const url = new URL(window.location.href)
      url.searchParams.delete("problem"); url.searchParams.delete("origin_label"); url.searchParams.delete("origin_id")
      window.history.replaceState({}, "", url.toString())
    }
  }, [searchParams])

  // ── PDCA handlers ─────────────────────────────────────────────────────────

  const openEditPdca = (p: PDCA) => {
    setEditingPdca(p)
    setPdcaForm({ problem: p.problem, action: p.action, result: p.result, standardization: p.standardization, status: p.status, priority: p.priority ?? "medium", budget: p.budget ? String(p.budget) : "", origin_label: p.origin_label ?? "", origin_id: p.origin_id ?? "" })
    setPdcaOpen(true)
  }

  const savePdca = async () => {
    setSavingPdca(true)
    try {
      const payload = { site_id: SITE_ID, problem: pdcaForm.problem, objective: "", action: pdcaForm.action, result: pdcaForm.result, standardization: pdcaForm.standardization, status: pdcaForm.status, priority: pdcaForm.priority, budget: pdcaForm.budget ? Number(pdcaForm.budget) : undefined, origin_label: pdcaForm.origin_label || undefined, origin_id: pdcaForm.origin_id || undefined }
      editingPdca ? await pdcaRepo.update(editingPdca.id, payload) : await pdcaRepo.create(payload)
      setPdcaOpen(false); await load()
    } catch (err) { console.error(err) }
    finally { setSavingPdca(false) }
  }

  const advancePdca = async (p: PDCA) => {
    const next = nextPdcaStatus(p.status)
    if (!next) return
    await pdcaRepo.update(p.id, { status: next }); await load()
  }

  const deletePdca = async (id: string) => {
    setDeletingPdcaId(id)
    try { await pdcaRepo.remove(id); await load() }
    catch (err) { console.error(err) }
    finally { setDeletingPdcaId(null) }
  }

  // ── Kaizen handlers ───────────────────────────────────────────────────────

  const openEditKaizen = (k: Kaizen) => {
    setEditingKaizen(k)
    setKaizenForm({ description: k.description, estimated_gain: String(k.estimated_gain), status: k.status, author: k.author })
    setKaizenOpen(true)
  }

  const saveKaizen = async () => {
    setSavingKaizen(true)
    try {
      const payload = { site_id: SITE_ID, description: kaizenForm.description, estimated_gain: Number(kaizenForm.estimated_gain) || 0, status: kaizenForm.status, author: kaizenForm.author }
      editingKaizen ? await kaizenRepo.update(editingKaizen.id, payload) : await kaizenRepo.create(payload)
      setKaizenOpen(false); await load()
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
    const params = new URLSearchParams({ problem: k.description, origin_label: `Amélioration : ${k.description.slice(0, 60)}`, origin_id: k.id })
    router.push(`/lean?${params.toString()}`)
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-10 max-w-[1600px]">

      {/* ── PDCA Board ── */}
      <section>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <RefreshCw className="w-6 h-6 text-blue-400" />
              PDCA — Résolution de problèmes
            </h1>
            <p className="text-slate-400 text-sm mt-1">1 problème = 1 post-it · Cliquez sur la flèche pour faire avancer le sujet</p>
          </div>
          <Button
            onClick={() => { setEditingPdca(null); setPdcaForm(blankPdca()); setPdcaOpen(true) }}
            size="sm"
            className="bg-blue-600 hover:bg-blue-700 text-white gap-2"
          >
            <Plus className="w-4 h-4" /> Nouveau problème
          </Button>
        </div>

        {loading ? (
          <div className="text-center py-16 text-slate-500">Chargement…</div>
        ) : pdcas.length === 0 ? (
          <div className="border-2 border-dashed border-slate-700 rounded-2xl p-12 text-center">
            <p className="text-slate-500 text-sm">Aucun problème en cours. Créez votre premier post-it !</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {pdcas.map(p => (
              <StickyPDCA
                key={p.id}
                pdca={p}
                onEdit={() => openEditPdca(p)}
                onDelete={() => deletePdca(p.id)}
                onAdvance={() => advancePdca(p)}
                deleting={deletingPdcaId === p.id}
              />
            ))}
          </div>
        )}
      </section>

      {/* ── Améliorations Continues ── */}
      <section>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Lightbulb className="w-5 h-5 text-yellow-400" />
              Améliorations Continues
            </h2>
            <p className="text-slate-400 text-sm mt-1">Idées Kaizen · Petits changements, grands résultats</p>
          </div>
          <Button
            onClick={() => { setEditingKaizen(null); setKaizenForm(blankKaizen()); setKaizenOpen(true) }}
            size="sm"
            className="bg-yellow-500 hover:bg-yellow-400 text-slate-900 gap-2 font-semibold"
          >
            <Plus className="w-4 h-4" /> Nouvelle idée
          </Button>
        </div>

        {loading ? (
          <div className="text-center py-10 text-slate-500">Chargement…</div>
        ) : kaizens.length === 0 ? (
          <div className="border-2 border-dashed border-slate-700 rounded-2xl p-12 text-center">
            <Lightbulb className="w-8 h-8 text-yellow-400/30 mx-auto mb-2" />
            <p className="text-slate-500 text-sm">Aucune idée pour le moment.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {kaizens.map(k => (
              <StickyKaizen
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
            <DialogTitle className="text-lg">{editingPdca ? "Modifier le post-it" : "Nouveau problème"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {pdcaForm.origin_label && (
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg px-3 py-2 text-xs text-blue-300">
                ↩ Origine : {pdcaForm.origin_label}
              </div>
            )}
            <div className="space-y-1.5">
              <Label className="text-slate-300 font-semibold">Problème <span className="text-red-400">*</span></Label>
              <Textarea
                className="bg-slate-800 border-slate-700 text-white resize-none text-sm"
                rows={3}
                placeholder="Quel est le problème observé ?"
                value={pdcaForm.problem}
                onChange={e => setPdcaForm(f => ({ ...f, problem: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-300 font-semibold">Solution proposée / Action mise en place</Label>
              <Textarea
                className="bg-slate-800 border-slate-700 text-white resize-none text-sm"
                rows={2}
                placeholder="Quelle solution a été testée ?"
                value={pdcaForm.action}
                onChange={e => setPdcaForm(f => ({ ...f, action: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-300 font-semibold">Résultat du test</Label>
              <Textarea
                className="bg-slate-800 border-slate-700 text-white resize-none text-sm"
                rows={2}
                placeholder="Qu'est-ce qu'on a observé ?"
                value={pdcaForm.result}
                onChange={e => setPdcaForm(f => ({ ...f, result: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-300 font-semibold">Standardisation</Label>
              <Textarea
                className="bg-slate-800 border-slate-700 text-white resize-none text-sm"
                rows={2}
                placeholder="On standardise ? Comment ? (ou pourquoi pas)"
                value={pdcaForm.standardization}
                onChange={e => setPdcaForm(f => ({ ...f, standardization: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-slate-300 font-semibold">Importance</Label>
                <Select value={pdcaForm.priority} onValueChange={v => setPdcaForm(f => ({ ...f, priority: v as PDCAPriority }))}>
                  <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700 text-white">
                    {PDCA_PRIORITIES.map(p => (
                      <SelectItem key={p} value={p}>
                        <span className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full inline-block ${priorityColor[p].dot}`} />
                          {priorityColor[p].label}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-slate-300 font-semibold">Budget estimé (€)</Label>
                <input
                  type="number"
                  className="w-full rounded-md bg-slate-800 border border-slate-700 text-white px-3 py-2 text-sm"
                  placeholder="0"
                  value={pdcaForm.budget}
                  onChange={e => setPdcaForm(f => ({ ...f, budget: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-300 font-semibold">Avancement</Label>
              <Select value={pdcaForm.status} onValueChange={v => setPdcaForm(f => ({ ...f, status: v as PDCAStatus }))}>
                <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700 text-white">
                  {PDCA_STATUSES.map(s => (
                    <SelectItem key={s} value={s}>
                      <span className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full inline-block ${statusConfig[s].dot}`} />
                        {statusConfig[s].label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPdcaOpen(false)} className="border-slate-700 text-slate-300">Annuler</Button>
            <Button onClick={savePdca} disabled={savingPdca || !pdcaForm.problem.trim()} className="bg-blue-600 hover:bg-blue-700 text-white">
              {savingPdca ? "Enregistrement…" : editingPdca ? "Mettre à jour" : "Créer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Kaizen Modal ── */}
      <Dialog open={kaizenOpen} onOpenChange={setKaizenOpen}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-md">
          <DialogHeader>
            <DialogTitle>{editingKaizen ? "Modifier l'idée" : "Nouvelle idée d'amélioration"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-slate-300 font-semibold">Description <span className="text-red-400">*</span></Label>
              <Textarea className="bg-slate-800 border-slate-700 text-white resize-none" rows={3} placeholder="Décrivez l'idée…" value={kaizenForm.description} onChange={e => setKaizenForm(f => ({ ...f, description: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-300 font-semibold">Auteur</Label>
              <input className="w-full rounded-md bg-slate-800 border border-slate-700 text-white px-3 py-2 text-sm" placeholder="Nom" value={kaizenForm.author} onChange={e => setKaizenForm(f => ({ ...f, author: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-300 font-semibold">Gain estimé (€)</Label>
              <input type="number" className="w-full rounded-md bg-slate-800 border border-slate-700 text-white px-3 py-2 text-sm" placeholder="0" value={kaizenForm.estimated_gain} onChange={e => setKaizenForm(f => ({ ...f, estimated_gain: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-300 font-semibold">Statut</Label>
              <Select value={kaizenForm.status} onValueChange={v => setKaizenForm(f => ({ ...f, status: v as KaizenStatus }))}>
                <SelectTrigger className="bg-slate-800 border-slate-700 text-white"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700 text-white">
                  {(Object.keys(kaizenStickyColor) as KaizenStatus[]).map(s => (
                    <SelectItem key={s} value={s}>
                      <span className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full inline-block ${kaizenStickyColor[s].dot}`} />
                        {kaizenStickyColor[s].label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setKaizenOpen(false)} className="border-slate-700 text-slate-300">Annuler</Button>
            <Button onClick={saveKaizen} disabled={savingKaizen || !kaizenForm.description.trim()} className="bg-yellow-500 hover:bg-yellow-400 text-slate-900 font-semibold">
              {savingKaizen ? "Enregistrement…" : editingKaizen ? "Mettre à jour" : "Créer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ── Post-it PDCA ──────────────────────────────────────────────────────────────

function StickyPDCA({ pdca, onEdit, onDelete, onAdvance, deleting }: {
  pdca: PDCA; onEdit: () => void; onDelete: () => void; onAdvance: () => void; deleting: boolean
}) {
  const prio = priorityColor[pdca.priority ?? "medium"]
  const status = statusConfig[pdca.status]
  const next = nextPdcaStatus(pdca.status)

  return (
    <div className={`${prio.bg} ${prio.border} border-2 rounded-sm shadow-md p-4 flex flex-col gap-3 relative min-h-[200px]`}
         style={{ transform: `rotate(${(Math.abs(pdca.id.charCodeAt(0) % 3) - 1) * 0.8}deg)` }}>

      {/* Priority + actions */}
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-xs font-bold text-slate-700 uppercase tracking-wide">
          <span className={`w-2.5 h-2.5 rounded-full ${prio.dot}`} />
          {prio.label}
        </span>
        <div className="flex items-center gap-0.5">
          <button onClick={onEdit} className="p-1 text-slate-500 hover:text-slate-800 transition-colors rounded">
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button onClick={onDelete} disabled={deleting} className="p-1 text-slate-400 hover:text-red-600 transition-colors rounded">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Problème */}
      <p className="text-sm font-bold text-slate-800 leading-snug flex-1">{pdca.problem}</p>

      {/* Solution */}
      {pdca.action && (
        <div className="border-t border-slate-400/30 pt-2">
          <p className="text-xs text-slate-600 font-semibold uppercase tracking-wide mb-1">Solution</p>
          <p className="text-xs text-slate-700 leading-relaxed line-clamp-3">{pdca.action}</p>
        </div>
      )}

      {/* Budget */}
      {pdca.budget && pdca.budget > 0 && (
        <p className="text-xs font-semibold text-slate-700">
          💰 {pdca.budget.toLocaleString("fr-FR")} € estimé
        </p>
      )}

      {/* Origin */}
      {pdca.origin_label && (
        <p className="text-xs text-slate-500 italic truncate">↩ {pdca.origin_label}</p>
      )}

      {/* Footer: status + advance */}
      <div className="flex items-center justify-between pt-1 border-t border-slate-400/20">
        <span className="flex items-center gap-1 text-xs text-slate-600">
          <span className={`w-2 h-2 rounded-full ${status.dot}`} />
          {status.label}
        </span>
        {next ? (
          <button
            onClick={onAdvance}
            className="text-xs font-semibold text-slate-600 hover:text-slate-900 flex items-center gap-0.5 transition-colors"
          >
            {statusConfig[next].label.replace("En ", "")} <ChevronRight className="w-3 h-3" />
          </button>
        ) : (
          <span className="flex items-center gap-1 text-xs font-bold text-green-700">
            <CheckCircle2 className="w-3.5 h-3.5" /> Terminé
          </span>
        )}
      </div>
    </div>
  )
}

// ── Post-it Kaizen ────────────────────────────────────────────────────────────

function StickyKaizen({ kaizen, onEdit, onDelete, onToPdca, deleting }: {
  kaizen: Kaizen; onEdit: () => void; onDelete: () => void; onToPdca: () => void; deleting: boolean
}) {
  const cfg = kaizenStickyColor[kaizen.status]

  return (
    <div className={`${cfg.bg} ${cfg.border} border-2 rounded-sm shadow-md p-4 flex flex-col gap-3 min-h-[160px]`}
         style={{ transform: `rotate(${(Math.abs(kaizen.id.charCodeAt(0) % 3) - 1) * 0.6}deg)` }}>

      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-xs font-bold text-slate-700 uppercase tracking-wide">
          <span className={`w-2.5 h-2.5 rounded-full ${cfg.dot}`} />
          {cfg.label}
        </span>
        <div className="flex items-center gap-0.5">
          <button onClick={onEdit} className="p-1 text-slate-500 hover:text-slate-800 transition-colors rounded">
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button onClick={onDelete} disabled={deleting} className="p-1 text-slate-400 hover:text-red-600 transition-colors rounded">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <p className="text-sm font-bold text-slate-800 leading-snug flex-1">{kaizen.description}</p>

      <div className="flex items-center justify-between pt-1 border-t border-slate-400/20">
        <span className="text-xs text-slate-500">{kaizen.author || "—"}</span>
        {kaizen.estimated_gain > 0 && (
          <span className="text-xs font-semibold text-green-700">~{kaizen.estimated_gain.toLocaleString("fr-FR")} €</span>
        )}
      </div>

      <button
        onClick={onToPdca}
        className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1 transition-colors"
      >
        <RefreshCw className="w-3 h-3" /> Traiter en PDCA
      </button>
    </div>
  )
}
