"use client"
import { useState, useEffect } from "react"
import { Plus, Search, AlertTriangle, Pencil, ArrowRight, MapPin, Clock, User, Trash2 } from "lucide-react"
import { format } from "date-fns"
import { fr } from "date-fns/locale"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import * as incidentsRepo from "@/lib/repositories/incidents"
import type { Incident, IncidentStatus, IncidentCategory, IncidentImpact, IncidentZone, IncidentType } from "@/lib/types"

const SITE_ID = '00000000-0000-0000-0000-000000000001'

// ── Workflow ────────────────────────────────────────────────────────────────

const WORKFLOW: IncidentStatus[] = [
  'declared', 'analysed', 'action_ongoing', 'verified', 'standardised', 'closed'
]

const statusConfig: Record<IncidentStatus, {
  label: string
  variant: "destructive" | "warning" | "info" | "success" | "default"
  color: string
  bg: string
  border: string
}> = {
  declared:       { label: "Déclaré",        variant: "destructive", color: "text-red-400",    bg: "bg-red-500/10",    border: "border-red-500/20" },
  analysed:       { label: "Analysé",         variant: "warning",     color: "text-orange-400", bg: "bg-orange-500/10", border: "border-orange-500/20" },
  action_ongoing: { label: "Action en cours", variant: "info",        color: "text-blue-400",   bg: "bg-blue-500/10",   border: "border-blue-500/20" },
  verified:       { label: "Vérifié",         variant: "info",        color: "text-purple-400", bg: "bg-purple-500/10", border: "border-purple-500/20" },
  standardised:   { label: "Standardisé",     variant: "success",     color: "text-green-400",  bg: "bg-green-500/10",  border: "border-green-500/20" },
  closed:         { label: "Clôturé",         variant: "default",     color: "text-slate-400",  bg: "bg-slate-500/10",  border: "border-slate-700" },
}

const nextStatus = (s: IncidentStatus): IncidentStatus | null => {
  const idx = WORKFLOW.indexOf(s)
  return idx < WORKFLOW.length - 1 ? WORKFLOW[idx + 1] : null
}

const nextActionLabel: Record<IncidentStatus, string | null> = {
  declared:       "Marquer analysé",
  analysed:       "Action en cours",
  action_ongoing: "Marquer vérifié",
  verified:       "Standardiser",
  standardised:   "Clôturer",
  closed:         null,
}

// ── Reference data ──────────────────────────────────────────────────────────

const zoneLabels: Record<IncidentZone, string> = {
  bar: "Bar", caisse: "Caisse", arcades: "Arcades",
  parc: "Parc", laser_game: "Laser Game", annivs: "Annivs",
}

const typeLabels: Record<IncidentType, string> = {
  technique: "Technique", operationnel: "Opérationnel",
  blessure: "Blessure", service_client: "Service client",
}

const typeColors: Record<IncidentType, string> = {
  technique: "text-blue-400", operationnel: "text-orange-400",
  blessure: "text-red-400", service_client: "text-purple-400",
}

// ── Blank form ───────────────────────────────────────────────────────────────

const nowParis = () => {
  const now = new Date()
  return {
    date: now.toLocaleDateString("en-CA", { timeZone: "Europe/Paris" }),
    time: now.toLocaleTimeString("fr-FR", { timeZone: "Europe/Paris", hour: "2-digit", minute: "2-digit" }),
  }
}

type FormState = {
  description: string
  incident_type: string
  zone: string
  date: string
  time: string
  owner: string
}

const blankForm = (): FormState => {
  const { date, time } = nowParis()
  return { description: "", incident_type: "technique", zone: "parc", date, time, owner: "" }
}

// ── Incident form (shared by Create + Edit) ──────────────────────────────────

function IncidentForm({ form, onChange }: { form: FormState; onChange: (f: FormState) => void }) {
  const set = (k: keyof FormState) => (v: string) => onChange({ ...form, [k]: v })
  return (
    <div className="space-y-4 py-2">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Date</Label>
          <Input type="date" value={form.date} onChange={e => set("date")(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Heure</Label>
          <Input type="time" value={form.time} onChange={e => set("time")(e.target.value)} />
        </div>
      </div>
      <div className="space-y-2">
        <Label>Zone</Label>
        <Select value={form.zone} onValueChange={set("zone")}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {Object.entries(zoneLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Type d'incident</Label>
        <Select value={form.incident_type} onValueChange={set("incident_type")}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {Object.entries(typeLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Responsable</Label>
        <Input
          placeholder="Nom du responsable assigné"
          value={form.owner}
          onChange={e => set("owner")(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label>Description *</Label>
        <Textarea
          placeholder="Décrivez l'incident..."
          value={form.description}
          onChange={e => set("description")(e.target.value)}
          rows={3}
        />
      </div>
    </div>
  )
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function IncidentsPage() {
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [filterStatus, setFilterStatus] = useState<string>("all")
  const [filterType, setFilterType] = useState<string>("all")

  const [createOpen, setCreateOpen] = useState(false)
  const [createForm, setCreateForm] = useState<FormState>(blankForm)

  const [editOpen, setEditOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<Incident | null>(null)
  const [editForm, setEditForm] = useState<FormState>(blankForm)

  useEffect(() => {
    incidentsRepo.getAll(SITE_ID)
      .then(setIncidents)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  // ── Helpers ────────────────────────────────────────────────────────────────

  const formToPayload = (f: FormState) => ({
    occurred_at: new Date(`${f.date}T${f.time}:00`).toISOString(),
    zone: f.zone as IncidentZone,
    incident_type: f.incident_type as IncidentType,
    owner: f.owner,
  })

  const handleCreate = async () => {
    if (!createForm.description) return
    try {
      const newInc = await incidentsRepo.create({
        site_id: SITE_ID,
        description: createForm.description,
        category: 'other' as IncidentCategory,
        impact: 'medium' as IncidentImpact,
        status: 'declared',
        ...formToPayload(createForm),
      })
      setIncidents(prev => [newInc, ...prev])
      setCreateForm(blankForm())
      setCreateOpen(false)
    } catch (err) { console.error(err) }
  }

  const openEdit = (inc: Incident) => {
    const occurred = inc.occurred_at ? new Date(inc.occurred_at) : new Date(inc.created_at)
    setEditTarget(inc)
    setEditForm({
      description: inc.description,
      incident_type: inc.incident_type ?? "technique",
      zone: inc.zone ?? "parc",
      date: occurred.toLocaleDateString("en-CA", { timeZone: "Europe/Paris" }),
      time: occurred.toLocaleTimeString("fr-FR", { timeZone: "Europe/Paris", hour: "2-digit", minute: "2-digit" }),
      owner: inc.owner ?? "",
    })
    setEditOpen(true)
  }

  const handleEdit = async () => {
    if (!editTarget || !editForm.description) return
    try {
      const updated = await incidentsRepo.update(editTarget.id, {
        description: editForm.description,
        ...formToPayload(editForm),
      })
      setIncidents(prev => prev.map(i => i.id === updated.id ? updated : i))
      setEditOpen(false)
    } catch (err) { console.error(err) }
  }

  const handleAdvance = async (inc: Incident) => {
    const next = nextStatus(inc.status)
    if (!next) return
    try {
      const updated = await incidentsRepo.update(inc.id, {
        status: next,
        ...(next === 'closed' ? { resolved_at: new Date().toISOString() } : {}),
      })
      setIncidents(prev => prev.map(i => i.id === updated.id ? updated : i))
    } catch (err) { console.error(err) }
  }

  const handleDelete = async (inc: Incident) => {
    if (!confirm(`Supprimer cet incident ?\n"${inc.description.slice(0, 80)}"`)) return
    try {
      await incidentsRepo.remove(inc.id)
      setIncidents(prev => prev.filter(i => i.id !== inc.id))
    } catch (err) { console.error(err) }
  }

  const handleStatusChange = async (inc: Incident, status: IncidentStatus) => {
    try {
      const updated = await incidentsRepo.update(inc.id, { status })
      setIncidents(prev => prev.map(i => i.id === updated.id ? updated : i))
    } catch (err) { console.error(err) }
  }

  // ── Counts ─────────────────────────────────────────────────────────────────

  const counts = WORKFLOW.reduce((acc, s) => {
    acc[s] = incidents.filter(i => i.status === s).length
    return acc
  }, {} as Record<IncidentStatus, number>)

  const activeCount = incidents.filter(i => i.status !== 'closed').length

  // ── Filtering ──────────────────────────────────────────────────────────────

  const filtered = incidents.filter(inc => {
    const matchSearch = inc.description.toLowerCase().includes(search.toLowerCase()) ||
      (inc.owner ?? "").toLowerCase().includes(search.toLowerCase())
    const matchStatus = filterStatus === "all" || inc.status === filterStatus
    const matchType = filterType === "all" || inc.incident_type === filterType
    return matchSearch && matchStatus && matchType
  })

  return (
    <div className="space-y-6 max-w-[1400px]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Incidents</h1>
          <p className="text-slate-400 text-sm mt-1">
            {activeCount} actif{activeCount !== 1 ? "s" : ""} · {incidents.length} total
          </p>
        </div>
        <Button
          className="bg-orange-500/10 border border-orange-500/40 text-orange-300 hover:bg-orange-500/20 hover:text-orange-200"
          variant="outline"
          onClick={() => { setCreateForm(blankForm()); setCreateOpen(true) }}
        >
          <AlertTriangle className="w-4 h-4" />
          Signaler un incident
        </Button>
      </div>

      {/* Workflow summary */}
      <div className="grid grid-cols-3 lg:grid-cols-6 gap-2">
        {WORKFLOW.map(s => {
          const cfg = statusConfig[s]
          const isActive = filterStatus === s
          return (
            <button
              key={s}
              onClick={() => setFilterStatus(filterStatus === s ? "all" : s)}
              className={`bg-slate-800 border ${cfg.border} rounded-xl p-3 text-left transition-all hover:bg-slate-700/60 ${isActive ? "ring-1 ring-blue-500" : ""}`}
            >
              <div className={`text-xl font-bold ${cfg.color}`}>{counts[s]}</div>
              <div className="text-xs text-slate-400 mt-0.5">{cfg.label}</div>
            </button>
          )
        })}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input placeholder="Rechercher…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les types</SelectItem>
            {Object.entries(typeLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Statut" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les statuts</SelectItem>
            {WORKFLOW.map(s => <SelectItem key={s} value={s}>{statusConfig[s].label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700">
                {["Date/Heure", "Zone", "Type", "Description", "Responsable", "Statut", "Actions"].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs text-slate-400 font-semibold uppercase tracking-widest whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="px-4 py-12 text-center text-slate-500">Chargement…</td></tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-slate-500">
                    <AlertTriangle className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    Aucun incident trouvé
                  </td>
                </tr>
              ) : filtered.map(inc => {
                const cfg = statusConfig[inc.status]
                const next = nextStatus(inc.status)
                const occurred = inc.occurred_at ?? inc.created_at
                return (
                  <tr key={inc.id} className="border-b border-slate-700/40 hover:bg-slate-700/20 transition-colors">
                    {/* Date */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-1.5 text-slate-300 text-xs">
                        <Clock className="w-3.5 h-3.5 text-slate-500" />
                        {format(new Date(occurred), "dd/MM HH:mm", { locale: fr })}
                      </div>
                    </td>
                    {/* Zone */}
                    <td className="px-4 py-3">
                      {inc.zone ? (
                        <div className="flex items-center gap-1.5 text-xs text-slate-300">
                          <MapPin className="w-3.5 h-3.5 text-slate-500" />
                          {zoneLabels[inc.zone as IncidentZone] ?? inc.zone}
                        </div>
                      ) : <span className="text-slate-600">—</span>}
                    </td>
                    {/* Type */}
                    <td className="px-4 py-3">
                      {inc.incident_type ? (
                        <span className={`text-xs font-medium ${typeColors[inc.incident_type as IncidentType] ?? "text-slate-400"}`}>
                          {typeLabels[inc.incident_type as IncidentType] ?? inc.incident_type}
                        </span>
                      ) : <span className="text-slate-600">—</span>}
                    </td>
                    {/* Description */}
                    <td className="px-4 py-3 max-w-xs">
                      <span className="text-slate-200 line-clamp-2 text-sm">{inc.description}</span>
                    </td>
                    {/* Responsable */}
                    <td className="px-4 py-3">
                      {inc.owner ? (
                        <div className="flex items-center gap-1.5 text-xs text-slate-300">
                          <div className="w-5 h-5 rounded-full bg-blue-600/30 border border-blue-500/30 flex items-center justify-center text-blue-300 text-xs font-semibold flex-shrink-0">
                            {inc.owner.charAt(0).toUpperCase()}
                          </div>
                          {inc.owner}
                        </div>
                      ) : (
                        <button
                          onClick={() => openEdit(inc)}
                          className="text-xs text-slate-500 hover:text-slate-300 flex items-center gap-1 transition-colors"
                        >
                          <User className="w-3.5 h-3.5" />
                          Assigner
                        </button>
                      )}
                    </td>
                    {/* Statut */}
                    <td className="px-4 py-3">
                      <Select value={inc.status} onValueChange={v => handleStatusChange(inc, v as IncidentStatus)}>
                        <SelectTrigger className="h-7 text-xs border-0 bg-transparent p-0 w-auto gap-1 focus:ring-0">
                          <Badge variant={cfg.variant} className="text-xs cursor-pointer">{cfg.label}</Badge>
                        </SelectTrigger>
                        <SelectContent>
                          {WORKFLOW.map(s => (
                            <SelectItem key={s} value={s}>
                              <span className={statusConfig[s].color}>{statusConfig[s].label}</span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                    {/* Actions */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <Button
                          size="sm" variant="ghost"
                          className="h-7 w-7 p-0 text-slate-400 hover:text-white"
                          onClick={() => openEdit(inc)}
                          title="Modifier"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          size="sm" variant="ghost"
                          className="h-7 w-7 p-0 text-slate-600 hover:text-red-400 transition-colors"
                          onClick={() => handleDelete(inc)}
                          title="Supprimer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                        {next && (
                          <Button
                            size="sm" variant="ghost"
                            className="h-7 px-2 text-xs text-slate-400 hover:text-white flex items-center gap-1"
                            onClick={() => handleAdvance(inc)}
                            title={nextActionLabel[inc.status] ?? ""}
                          >
                            <ArrowRight className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Signaler un incident</DialogTitle></DialogHeader>
          <IncidentForm form={createForm} onChange={setCreateForm} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Annuler</Button>
            <Button onClick={handleCreate} disabled={!createForm.description}>Signaler</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifier l'incident</DialogTitle>
          </DialogHeader>
          <IncidentForm form={editForm} onChange={setEditForm} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Annuler</Button>
            <Button onClick={handleEdit} disabled={!editForm.description}>Enregistrer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
