"use client"
import { useState, useEffect } from "react"
import { Plus, Trash2, RefreshCw, Cake, MessageSquare, Calendar, ThumbsUp, Wrench, Star } from "lucide-react"
import { format } from "date-fns"
import { fr } from "date-fns/locale"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import * as improvementsRepo from "@/lib/repositories/improvements"
import * as gxReviewsRepo from "@/lib/repositories/gxReviews"
import * as bookingsRepo from "@/lib/repositories/bookings"
import type { GxReview } from "@/lib/repositories/gxReviews"
import type { Improvement, ImprovementKind } from "@/lib/types"

const SITE_ID = '00000000-0000-0000-0000-000000000001'
const ZONE = 'anniv' as const

const kindConfig: Record<ImprovementKind, { label: string; icon: typeof ThumbsUp; activeBtn: string; bar: string }> = {
  positive:    { label: "Point positif",    icon: ThumbsUp, activeBtn: "bg-green-600 text-white hover:bg-green-500",  bar: "border-l-green-500" },
  improvement: { label: "Point à améliorer", icon: Wrench,   activeBtn: "bg-amber-600 text-white hover:bg-amber-500", bar: "border-l-amber-500" },
}

export default function AmeliorationsPage() {
  const [items, setItems] = useState<Improvement[]>([])
  const [anniversaryReviews, setAnniversaryReviews] = useState<GxReview[]>([])
  const [loading, setLoading] = useState(true)
  const [newItems, setNewItems] = useState<Record<ImprovementKind, string>>({ positive: "", improvement: "" })
  const [openComment, setOpenComment] = useState<string | null>(null)
  const [commentDraft, setCommentDraft] = useState("")

  const load = async () => {
    setLoading(true)
    try {
      const [data, reviews, bookings] = await Promise.all([
        improvementsRepo.getAll(SITE_ID),
        gxReviewsRepo.getRecent(SITE_ID, 500),
        bookingsRepo.getAnniversaryBookings(SITE_ID),
      ])
      setItems(data.map(i => ({ ...i, kind: i.kind ?? 'improvement' })))
      const refs = new Set(bookings.map(b => b.roller_booking_id))
      setAnniversaryReviews(reviews.filter(r => r.booking_reference && refs.has(r.booking_reference)))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const zoneItems = items.filter(i => i.zone === ZONE)

  const handleAdd = async (kind: ImprovementKind) => {
    const description = newItems[kind].trim()
    if (!description) return
    const created = await improvementsRepo.create({ site_id: SITE_ID, zone: ZONE, kind, description })
    setItems(prev => [{ ...created, kind: created.kind ?? kind }, ...prev])
    setNewItems(prev => ({ ...prev, [kind]: "" }))
  }

  const toggleDone = async (item: Improvement) => {
    const updated = await improvementsRepo.update(item.id, { done: !item.done })
    setItems(prev => prev.map(i => i.id === item.id ? { ...updated, kind: updated.kind ?? item.kind } : i))
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
    setItems(prev => prev.map(i => i.id === item.id ? { ...updated, kind: updated.kind ?? item.kind } : i))
    setOpenComment(null)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Cake className="w-6 h-6 text-pink-400" />
            Anniversaire
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Points à améliorer pour le week-end prochain
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Actualiser
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {(Object.entries(kindConfig) as [ImprovementKind, typeof kindConfig[ImprovementKind]][]).map(([k, cfg]) => {
          const Icon = cfg.icon
          const kindItems = zoneItems.filter(i => i.kind === k)
          return (
            <div key={k} className={`bg-slate-800 border border-slate-700 border-t-4 ${cfg.bar.replace("border-l-", "border-t-")} rounded-xl p-4`}>
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-300 uppercase tracking-widest mb-3">
                <Icon className="w-3.5 h-3.5" />
                {cfg.label}{kindItems.length > 1 ? "s" : ""}
              </div>

              <div className="flex items-center gap-1.5 mb-3">
                <Input
                  value={newItems[k]}
                  onChange={e => setNewItems(prev => ({ ...prev, [k]: e.target.value }))}
                  onKeyDown={e => { if (e.key === "Enter") handleAdd(k) }}
                  placeholder="Nouvelle idée..."
                  className="h-8 text-sm flex-1"
                />
                <Button size="icon" className="h-8 w-8" onClick={() => handleAdd(k)} disabled={!newItems[k].trim()}>
                  <Plus className="w-4 h-4" />
                </Button>
              </div>

              {kindItems.length === 0 ? (
                <div className="text-center text-slate-500 text-sm py-6">
                  Aucune idée pour le moment.
                </div>
              ) : (
                <ul className="space-y-2">
                  {kindItems.map(item => (
                    <li key={item.id} className={`bg-slate-900/50 border border-slate-700 border-l-4 ${cfg.bar} rounded-lg p-3`}>
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
                          <div className="text-sm text-white">
                            {item.description}
                          </div>
                          <div className="flex items-center gap-1 text-[11px] text-slate-500 mt-1">
                            <Calendar className="w-3 h-3" />
                            {format(new Date(item.created_at), "dd MMM yyyy", { locale: fr })}
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
          )
        })}
      </div>

      {anniversaryReviews.length > 0 && (
        <div>
          <h2 className="text-base font-semibold text-white flex items-center gap-2 mb-4">
            <Star className="w-4 h-4 text-pink-400 fill-pink-400" />
            Avis clients — réservations Anniversaire ({anniversaryReviews.length})
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {anniversaryReviews.map(r => {
              const overallStars = r.overall_rating ?? (r.is_fan ? 5 : r.is_critic ? 2 : 3)
              const borderColor = r.is_fan ? "border-green-500/30 bg-green-500/5" : r.is_critic ? "border-red-500/30 bg-red-500/5" : "border-pink-500/30 bg-pink-500/5"
              return (
                <div key={r.id} className={`bg-slate-800 border ${borderColor} rounded-xl p-4 space-y-3`}>
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-xs font-semibold text-pink-400 flex items-center gap-1">
                      🎂 Anniversaire
                    </span>
                    <span className="text-xs text-slate-500 shrink-0">
                      {format(new Date(r.date), "dd/MM/yyyy", { locale: fr })}
                    </span>
                  </div>
                  <div className="flex items-center gap-0.5">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} className={`w-3.5 h-3.5 ${i < overallStars ? "text-amber-400 fill-amber-400" : "text-slate-600"}`} />
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
    </div>
  )
}
