"use client"
import { useState, useEffect } from "react"
import { Plus, Trash2, RefreshCw, ListChecks, MessageSquare } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import * as improvementsRepo from "@/lib/repositories/improvements"
import type { Improvement, ImprovementZone } from "@/lib/types"

const SITE_ID = '00000000-0000-0000-0000-000000000001'

const ZONES: ImprovementZone[] = ['parc', 'anniv', 'bar', 'caisse']

const zoneLabels: Record<ImprovementZone, string> = {
  parc: "Parc",
  anniv: "Anniv",
  bar: "Bar",
  caisse: "Caisse",
}

export default function AmeliorationsPage() {
  const [items, setItems] = useState<Improvement[]>([])
  const [loading, setLoading] = useState(true)
  const [zone, setZone] = useState<ImprovementZone>('parc')
  const [newItem, setNewItem] = useState("")
  const [openComment, setOpenComment] = useState<string | null>(null)
  const [commentDraft, setCommentDraft] = useState("")

  const load = async () => {
    setLoading(true)
    try {
      const data = await improvementsRepo.getAll(SITE_ID)
      setItems(data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const zoneItems = items.filter(i => i.zone === zone)

  const handleAdd = async () => {
    const description = newItem.trim()
    if (!description) return
    const created = await improvementsRepo.create({ site_id: SITE_ID, zone, description })
    setItems(prev => [created, ...prev])
    setNewItem("")
  }

  const toggleDone = async (item: Improvement) => {
    const updated = await improvementsRepo.update(item.id, { done: !item.done })
    setItems(prev => prev.map(i => i.id === item.id ? updated : i))
  }

  const handleDelete = async (id: string) => {
    await improvementsRepo.remove(id)
    setItems(prev => prev.filter(i => i.id !== id))
  }

  const openCommentEditor = (item: Improvement) => {
    setOpenComment(item.id)
    setCommentDraft(item.comment ?? "")
  }

  const saveComment = async (item: Improvement) => {
    const updated = await improvementsRepo.update(item.id, { comment: commentDraft })
    setItems(prev => prev.map(i => i.id === item.id ? updated : i))
    setOpenComment(null)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <ListChecks className="w-6 h-6 text-blue-400" />
            Amélioration
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Points à améliorer pour le week-end prochain, par zone
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Actualiser
        </Button>
      </div>

      <Tabs value={zone} onValueChange={v => setZone(v as ImprovementZone)}>
        <TabsList>
          {ZONES.map(z => (
            <TabsTrigger key={z} value={z}>{zoneLabels[z]}</TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Input
            value={newItem}
            onChange={e => setNewItem(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") handleAdd() }}
            placeholder={`Nouveau point à améliorer — ${zoneLabels[zone]}`}
            className="flex-1"
          />
          <Button onClick={handleAdd} disabled={!newItem.trim()}>
            <Plus className="w-4 h-4 mr-2" />
            Ajouter
          </Button>
        </div>

        {zoneItems.length === 0 ? (
          <div className="text-center text-slate-500 text-sm py-8">
            Aucun point pour {zoneLabels[zone]} pour le moment.
          </div>
        ) : (
          <ul className="space-y-2">
            {zoneItems.map(item => (
              <li key={item.id} className="bg-slate-900/50 border border-slate-700 rounded-lg p-3">
                <div className="flex items-start gap-3">
                  <button
                    onClick={() => toggleDone(item)}
                    className={`mt-0.5 w-5 h-5 flex-shrink-0 rounded border-2 flex items-center justify-center transition-colors ${
                      item.done ? "bg-green-500 border-green-500" : "border-slate-500 hover:border-slate-400"
                    }`}
                  >
                    {item.done && <span className="text-white text-xs">✓</span>}
                  </button>

                  <div className="flex-1 min-w-0">
                    <div className={`text-sm ${item.done ? "text-slate-500 line-through" : "text-white"}`}>
                      {item.description}
                    </div>

                    {openComment === item.id ? (
                      <div className="mt-2 space-y-2">
                        <Textarea
                          value={commentDraft}
                          onChange={e => setCommentDraft(e.target.value)}
                          placeholder="Plan d'action..."
                          className="text-sm"
                          rows={3}
                        />
                        <div className="flex gap-2">
                          <Button size="sm" onClick={() => saveComment(item)}>Enregistrer</Button>
                          <Button size="sm" variant="outline" onClick={() => setOpenComment(null)}>Annuler</Button>
                        </div>
                      </div>
                    ) : item.comment ? (
                      <button
                        onClick={() => openCommentEditor(item)}
                        className="mt-1.5 flex items-start gap-1.5 text-xs text-slate-400 hover:text-slate-300 text-left"
                      >
                        <MessageSquare className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                        <span>{item.comment}</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => openCommentEditor(item)}
                        className="mt-1.5 flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-400"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        Ajouter un plan d'action
                      </button>
                    )}
                  </div>

                  <button
                    onClick={() => handleDelete(item.id)}
                    className="text-slate-500 hover:text-red-400 transition-colors flex-shrink-0"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
