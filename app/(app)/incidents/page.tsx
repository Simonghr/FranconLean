"use client"
import { useState, useEffect } from "react"
import { Plus, Search, AlertTriangle } from "lucide-react"
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
import type { Incident, IncidentStatus, IncidentCategory, IncidentImpact } from "@/lib/types"

const SITE_ID = '00000000-0000-0000-0000-000000000001'

const statusLabels: Record<IncidentStatus, string> = {
  open: "Ouvert",
  in_progress: "En cours",
  resolved: "Résolu",
  standardized: "Standardisé",
}

const statusVariants: Record<IncidentStatus, "destructive" | "warning" | "success" | "info"> = {
  open: "destructive",
  in_progress: "warning",
  resolved: "success",
  standardized: "info",
}

const categoryLabels: Record<IncidentCategory, string> = {
  process: "Process",
  quality: "Qualité",
  security: "Sécurité",
  client: "Client",
  it: "IT",
  logistics: "Logistique",
  other: "Autre",
}

const impactColors: Record<IncidentImpact, string> = {
  low: "bg-yellow-400",
  medium: "bg-orange-400",
  high: "bg-red-400",
}

const impactLabels: Record<IncidentImpact, string> = {
  low: "Faible",
  medium: "Moyen",
  high: "Élevé",
}

const nextStatus: Record<IncidentStatus, IncidentStatus | null> = {
  open: "in_progress",
  in_progress: "resolved",
  resolved: "standardized",
  standardized: null,
}

const nextStatusLabel: Record<IncidentStatus, string | null> = {
  open: "Prendre en charge",
  in_progress: "Marquer résolu",
  resolved: "Standardiser",
  standardized: null,
}

export default function IncidentsPage() {
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [filterStatus, setFilterStatus] = useState<string>("all")
  const [filterCategory, setFilterCategory] = useState<string>("all")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState({
    description: "", category: "process", impact: "medium", owner: ""
  })

  useEffect(() => {
    incidentsRepo.getAll(SITE_ID)
      .then(setIncidents)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const filtered = incidents.filter(inc => {
    const matchSearch = inc.description.toLowerCase().includes(search.toLowerCase()) ||
      inc.owner.toLowerCase().includes(search.toLowerCase())
    const matchStatus = filterStatus === "all" || inc.status === filterStatus
    const matchCat = filterCategory === "all" || inc.category === filterCategory
    return matchSearch && matchStatus && matchCat
  })

  const handleAdd = async () => {
    if (!form.description || !form.owner) return
    try {
      const newInc = await incidentsRepo.create({
        site_id: SITE_ID,
        description: form.description,
        category: form.category as IncidentCategory,
        impact: form.impact as IncidentImpact,
        owner: form.owner,
        status: "open",
      })
      setIncidents(prev => [newInc, ...prev])
      setForm({ description: "", category: "process", impact: "medium", owner: "" })
      setDialogOpen(false)
    } catch (err) {
      console.error('Failed to create incident', err)
    }
  }

  const handleStatusUpdate = async (inc: Incident) => {
    const next = nextStatus[inc.status]
    if (!next) return
    try {
      const updated = await incidentsRepo.update(inc.id, {
        status: next,
        ...(next === "resolved" || next === "standardized" ? { resolved_at: new Date().toISOString() } : {}),
      })
      setIncidents(prev => prev.map(i => i.id === updated.id ? updated : i))
    } catch (err) {
      console.error('Failed to update incident', err)
    }
  }

  const counts = {
    open: incidents.filter(i => i.status === "open").length,
    in_progress: incidents.filter(i => i.status === "in_progress").length,
    resolved: incidents.filter(i => i.status === "resolved").length,
    standardized: incidents.filter(i => i.status === "standardized").length,
  }

  return (
    <div className="space-y-6 max-w-[1400px]">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Incidents</h1>
          <p className="text-slate-400 text-sm mt-1">Gestion et suivi des incidents opérationnels</p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="w-4 h-4" />
          Déclarer un incident
        </Button>
      </div>

      {/* Status summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {([
          { key: "open", label: "Ouverts", color: "text-red-400", bg: "border-red-500/20" },
          { key: "in_progress", label: "En cours", color: "text-orange-400", bg: "border-orange-500/20" },
          { key: "resolved", label: "Résolus", color: "text-green-400", bg: "border-green-500/20" },
          { key: "standardized", label: "Standardisés", color: "text-blue-400", bg: "border-blue-500/20" },
        ] as const).map(({ key, label, color, bg }) => (
          <button
            key={key}
            onClick={() => setFilterStatus(filterStatus === key ? "all" : key)}
            className={`bg-slate-800 border ${bg} rounded-xl p-4 text-left transition-colors hover:bg-slate-700 ${filterStatus === key ? "ring-1 ring-blue-500" : ""}`}
          >
            <div className={`text-2xl font-bold ${color}`}>{counts[key]}</div>
            <div className="text-xs text-slate-400 mt-1">{label}</div>
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Rechercher..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Catégorie" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes catégories</SelectItem>
            {Object.entries(categoryLabels).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Statut" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous statuts</SelectItem>
            {Object.entries(statusLabels).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="text-left px-5 py-3 text-xs text-slate-400 font-semibold uppercase tracking-widest">Impact</th>
                <th className="text-left px-5 py-3 text-xs text-slate-400 font-semibold uppercase tracking-widest">Description</th>
                <th className="text-left px-5 py-3 text-xs text-slate-400 font-semibold uppercase tracking-widest">Catégorie</th>
                <th className="text-left px-5 py-3 text-xs text-slate-400 font-semibold uppercase tracking-widest">Responsable</th>
                <th className="text-left px-5 py-3 text-xs text-slate-400 font-semibold uppercase tracking-widest">Statut</th>
                <th className="text-left px-5 py-3 text-xs text-slate-400 font-semibold uppercase tracking-widest">Date</th>
                <th className="text-left px-5 py-3 text-xs text-slate-400 font-semibold uppercase tracking-widest">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-slate-500">
                    Chargement…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-slate-500">
                    <AlertTriangle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    Aucun incident trouvé
                  </td>
                </tr>
              ) : (
                filtered.map(inc => (
                  <tr key={inc.id} className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <div className={`w-2.5 h-2.5 rounded-full ${impactColors[inc.impact]}`} />
                        <span className="text-xs text-slate-400">{impactLabels[inc.impact]}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3 max-w-xs">
                      <span className="text-slate-200 line-clamp-2">{inc.description}</span>
                    </td>
                    <td className="px-5 py-3">
                      <Badge variant="default">{categoryLabels[inc.category]}</Badge>
                    </td>
                    <td className="px-5 py-3 text-slate-300">{inc.owner}</td>
                    <td className="px-5 py-3">
                      <Badge variant={statusVariants[inc.status]}>{statusLabels[inc.status]}</Badge>
                    </td>
                    <td className="px-5 py-3 text-slate-400 text-xs">
                      {format(new Date(inc.created_at), "dd/MM/yyyy", { locale: fr })}
                    </td>
                    <td className="px-5 py-3">
                      {nextStatus[inc.status] && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-xs h-7 px-2"
                          onClick={() => handleStatusUpdate(inc)}
                        >
                          {nextStatusLabel[inc.status]}
                        </Button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Déclarer un incident</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Description *</Label>
              <Textarea
                placeholder="Décrivez l'incident en détail..."
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
                <Label>Impact</Label>
                <Select value={form.impact} onValueChange={v => setForm(f => ({ ...f, impact: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Faible</SelectItem>
                    <SelectItem value="medium">Moyen</SelectItem>
                    <SelectItem value="high">Élevé</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Responsable *</Label>
              <Input
                placeholder="Nom du responsable"
                value={form.owner}
                onChange={e => setForm(f => ({ ...f, owner: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Annuler</Button>
            <Button onClick={handleAdd} disabled={!form.description || !form.owner}>
              Déclarer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
