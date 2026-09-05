"use client"
import { useState, useEffect, useMemo } from "react"
import { Plus, Trash2, RefreshCw, Cake, MessageSquare, Calendar, ThumbsUp, ThumbsDown, Wrench, Star, QrCode, ArrowLeftRight, Sparkles } from "lucide-react"
import { format } from "date-fns"
import { fr } from "date-fns/locale"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { supabase } from "@/lib/supabase"
import * as improvementsRepo from "@/lib/repositories/improvements"
import * as gxReviewsRepo from "@/lib/repositories/gxReviews"
import * as bookingsRepo from "@/lib/repositories/bookings"
import * as brainstormRepo from "@/lib/repositories/brainstorm"
import type { GxReview } from "@/lib/repositories/gxReviews"
import type { Improvement, ImprovementKind, BrainstormEntry, BrainstormCategory } from "@/lib/types"
import { useSite } from "@/lib/context/SiteContext"

const ZONE = 'anniv' as const

const kindConfig: Record<ImprovementKind, { label: string; icon: typeof ThumbsUp; activeBtn: string; bar: string; header: string; ring: string }> = {
  positive:    { label: "Point positif",    icon: ThumbsUp, activeBtn: "bg-green-600 text-white hover:bg-green-500",  bar: "border-l-green-500", header: "from-green-500/20 to-emerald-500/5 border-green-500/40", ring: "text-green-400" },
  improvement: { label: "Point à améliorer", icon: Wrench,   activeBtn: "bg-amber-600 text-white hover:bg-amber-500", bar: "border-l-amber-500", header: "from-amber-500/20 to-orange-500/5 border-amber-500/40", ring: "text-amber-400" },
}

const CATEGORY_LABEL: Record<BrainstormCategory, string> = {
  accueil: "Accueil", salles: "Salles", extensions: "Extensions",
  ambiance: "Ambiance", communication: "Communication", comprehension: "Compréhension", entraide: "Entraide",
  satisfaction: "Satisfaction", accompagnement: "Accompagnement", feedback: "Feed-back",
}

const ALL_CATEGORIES: { id: BrainstormCategory; label: string }[] = [
  { id: "accueil", label: "Accueil" }, { id: "salles", label: "Salles" }, { id: "extensions", label: "Extensions" },
  { id: "ambiance", label: "Ambiance" }, { id: "communication", label: "Communication" },
  { id: "comprehension", label: "Compréhension" }, { id: "entraide", label: "Entraide" },
  { id: "satisfaction", label: "Satisfaction" }, { id: "accompagnement", label: "Accompagnement" }, { id: "feedback", label: "Feed-back" },
]

export default function AmeliorationsPage() {
  const { siteId: SITE_ID } = useSite()
  const [items, setItems] = useState<Improvement[]>([])
  const [anniversaryReviews, setAnniversaryReviews] = useState<GxReview[]>([])
  const [brainstormEntries, setBrainstormEntries] = useState<BrainstormEntry[]>([])
  const [brainstormUrl, setBrainstormUrl] = useState("")
  const [loading, setLoading] = useState(true)
  const [newItems, setNewItems] = useState<Record<ImprovementKind, string>>({ positive: "", improvement: "" })
  const [qrExpanded, setQrExpanded] = useState(false)
  const [brainstormOpen, setBrainstormOpen] = useState(true)
  const [brainstormSessionId, setBrainstormSessionId] = useState("")
  const [editingEntry, setEditingEntry] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState("")
  const [newKeyword, setNewKeyword] = useState<Record<string, string>>({})
  const [categoryFilter, setCategoryFilter] = useState<BrainstormCategory | "all">("all")
  const [showSynthesis, setShowSynthesis] = useState(false)
  const [openComment, setOpenComment] = useState<string | null>(null)
  const [commentDraft, setCommentDraft] = useState("")

  const load = async () => {
    setLoading(true)
    try {
      const [data, reviews, bookings, brainstorm, settings] = await Promise.all([
        improvementsRepo.getAll(SITE_ID),
        gxReviewsRepo.getRecent(SITE_ID, 500),
        bookingsRepo.getAnniversaryBookings(SITE_ID),
        brainstormRepo.getAll(SITE_ID),
        brainstormRepo.getSettings(SITE_ID),
      ])
      setItems(data.map(i => ({ ...i, kind: i.kind ?? 'improvement' })))
      const refs = new Set(bookings.map(b => b.roller_booking_id))
      setAnniversaryReviews(reviews.filter(r => r.booking_reference && refs.has(r.booking_reference)))
      setBrainstormEntries(brainstorm)
      setBrainstormOpen(settings.is_open)
      setBrainstormSessionId(settings.session_id)
    } finally {
      setLoading(false)
    }
  }

  const toggleBrainstormOpen = async () => {
    const updated = await brainstormRepo.setOpen(SITE_ID, !brainstormOpen)
    setBrainstormOpen(updated.is_open)
  }

  const startEditEntry = (entry: BrainstormEntry) => {
    setEditingEntry(entry.id)
    setEditDraft(entry.keyword)
  }

  const saveEditEntry = async (entry: BrainstormEntry) => {
    const kw = editDraft.trim()
    if (!kw) return
    const updated = await brainstormRepo.update(entry.id, { keyword: kw })
    setBrainstormEntries(prev => prev.map(e => e.id === entry.id ? updated : e))
    setEditingEntry(null)
  }

  const deleteEntry = async (id: string) => {
    await brainstormRepo.remove(id)
    setBrainstormEntries(prev => prev.filter(e => e.id !== id))
  }

  const moveEntry = async (entry: BrainstormEntry) => {
    const sentiment = entry.sentiment === 'positive' ? 'negative' : 'positive'
    const updated = await brainstormRepo.update(entry.id, { sentiment })
    setBrainstormEntries(prev => prev.map(e => e.id === entry.id ? updated : e))
  }

  const reorderEntry = (draggedId: string, targetId: string) => {
    if (draggedId === targetId) return
    setBrainstormEntries(prev => {
      const fromIndex = prev.findIndex(e => e.id === draggedId)
      const toIndex = prev.findIndex(e => e.id === targetId)
      if (fromIndex === -1 || toIndex === -1) return prev
      const next = [...prev]
      const [moved] = next.splice(fromIndex, 1)
      next.splice(toIndex, 0, moved)
      return next
    })
  }

  const addEntry = async (category: BrainstormCategory, sentiment: "positive" | "negative", keyword: string) => {
    const kw = keyword.trim()
    if (!kw) return
    const created = await brainstormRepo.create({ site_id: SITE_ID, category, sentiment, keyword: kw })
    setBrainstormEntries(prev => [created, ...prev])
  }

  const resetBrainstorm = async () => {
    if (!window.confirm("Réinitialiser toutes les réponses et générer un nouveau QR code ?")) return
    await brainstormRepo.removeAll(SITE_ID)
    setBrainstormEntries([])
    const updated = await brainstormRepo.newSession(SITE_ID)
    setBrainstormOpen(updated.is_open)
    setBrainstormSessionId(updated.session_id)
  }

  const generateQrCode = async () => {
    try {
      const updated = await brainstormRepo.newSession(SITE_ID)
      setBrainstormOpen(updated.is_open)
      setBrainstormSessionId(updated.session_id)
    } catch (err: any) {
      window.alert(`Erreur : ${err?.message ?? err}\n\nVérifie que la table brainstorm_settings (avec la colonne session_id) existe dans Supabase.`)
    }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load() }, [SITE_ID])

  useEffect(() => {
    if (!brainstormSessionId) return
    setBrainstormUrl(`${window.location.origin}/brainstorm?s=${brainstormSessionId}&site=${SITE_ID}`)
  }, [brainstormSessionId, SITE_ID])

  useEffect(() => {
    const channel = supabase
      .channel(`brainstorm_entries_live_${SITE_ID}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'brainstorm_entries', filter: `site_id=eq.${SITE_ID}` },
        (payload) => {
          setBrainstormEntries(prev => [payload.new as BrainstormEntry, ...prev])
        })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [SITE_ID])

  const zoneItems = items.filter(i => i.zone === ZONE)

  const synthesis = useMemo(() => {
    const topKeywords = (category: BrainstormCategory, sentiment: "positive" | "negative") => {
      const counts = new Map<string, number>()
      brainstormEntries
        .filter(e => e.category === category && e.sentiment === sentiment)
        .forEach(e => {
          const kw = e.keyword.trim().toLowerCase()
          counts.set(kw, (counts.get(kw) ?? 0) + 1)
        })
      return [...counts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([kw]) => kw)
    }
    return ALL_CATEGORIES
      .map(cat => ({
        category: cat,
        positive: topKeywords(cat.id, "positive"),
        negative: topKeywords(cat.id, "negative"),
      }))
      .filter(s => s.positive.length > 0 || s.negative.length > 0)
  }, [brainstormEntries])

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
      <div className="flex items-center justify-between bg-gradient-to-r from-pink-600 via-fuchsia-600 to-purple-600 rounded-2xl p-5 shadow-lg shadow-fuchsia-900/30">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Cake className="w-7 h-7" />
            Anniversaire
          </h1>
          <p className="text-pink-100 text-sm mt-1">
            Points à améliorer pour le week-end prochain
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading} className="bg-white/10 border-white/30 text-white hover:bg-white/20 hover:text-white">
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Actualiser
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {(Object.entries(kindConfig) as [ImprovementKind, typeof kindConfig[ImprovementKind]][]).map(([k, cfg]) => {
          const Icon = cfg.icon
          const kindItems = zoneItems.filter(i => i.kind === k)
          return (
            <div key={k} className={`bg-gradient-to-b ${cfg.header} border-2 rounded-2xl p-4 shadow-lg`}>
              <div className={`flex items-center gap-2 text-sm font-bold ${cfg.ring} uppercase tracking-widest mb-3`}>
                <Icon className="w-5 h-5" />
                {cfg.label}{kindItems.length > 1 ? "s" : ""}
                <span className="ml-auto bg-slate-900/40 text-white text-xs rounded-full px-2 py-0.5">{kindItems.length}</span>
              </div>

              {showSynthesis && (() => {
                const sentiment = k === 'positive' ? 'positive' : 'negative'
                const rows = synthesis.filter(s => s[sentiment].length > 0)
                if (rows.length === 0) return null
                return (
                  <div className="mb-3 p-2.5 rounded-lg bg-slate-900/40 border border-slate-700/60 space-y-1.5">
                    <div className="flex items-center gap-1.5 text-[11px] font-semibold text-indigo-300 uppercase tracking-widest">
                      <Sparkles className="w-3 h-3" /> Synthèse
                    </div>
                    {rows.map(s => (
                      <div key={s.category.id} className="flex items-center gap-1.5 flex-wrap text-xs">
                        <span className="text-slate-400 font-medium">{s.category.label}:</span>
                        {s[sentiment].map(kw => (
                          <span key={kw} className={`px-2 py-0.5 rounded-full border ${
                            sentiment === "positive" ? "bg-green-500/10 text-green-400 border-green-500/30" : "bg-amber-500/10 text-amber-400 border-amber-500/30"
                          }`}>{kw}</span>
                        ))}
                      </div>
                    ))}
                  </div>
                )
              })()}

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

              {(() => {
                const sentiment = k === 'positive' ? 'positive' : 'negative'
                const entries = brainstormEntries.filter(e => e.sentiment === sentiment && (categoryFilter === "all" || e.category === categoryFilter))
                return (
                  <div className="flex flex-wrap items-center gap-1.5 mb-3">
                    {entries.map(e => (
                      editingEntry === e.id ? (
                        <span key={e.id} className="inline-flex items-center gap-1">
                          <input
                            value={editDraft}
                            onChange={ev => setEditDraft(ev.target.value)}
                            onKeyDown={ev => { if (ev.key === "Enter") saveEditEntry(e); if (ev.key === "Escape") setEditingEntry(null) }}
                            autoFocus
                            className="text-xs px-2 py-0.5 rounded-full border bg-slate-900 text-white border-slate-600 w-28"
                          />
                          <button onClick={() => saveEditEntry(e)} className="text-[11px] text-green-400 hover:text-green-300">✓</button>
                          <button onClick={() => setEditingEntry(null)} className="text-[11px] text-slate-500 hover:text-slate-400">✕</button>
                        </span>
                      ) : (
                        <span
                          key={e.id}
                          draggable
                          onDragStart={ev => ev.dataTransfer.setData("text/plain", e.id)}
                          onDragOver={ev => ev.preventDefault()}
                          onDrop={ev => { ev.preventDefault(); reorderEntry(ev.dataTransfer.getData("text/plain"), e.id) }}
                          className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border cursor-move ${
                          sentiment === "positive" ? "bg-green-500/10 text-green-400 border-green-500/30" : "bg-amber-500/10 text-amber-400 border-amber-500/30"
                        }`}>
                          <span className="text-slate-500">{CATEGORY_LABEL[e.category]}:</span>
                          <button onClick={() => startEditEntry(e)} className="hover:underline">{e.keyword}</button>
                          <button onClick={() => moveEntry(e)} className="opacity-40 hover:opacity-100" title={sentiment === "positive" ? "Déplacer vers À améliorer" : "Déplacer vers Positif"}>
                            <ArrowLeftRight className="w-3 h-3" />
                          </button>
                          <button onClick={() => deleteEntry(e.id)} className="opacity-40 hover:opacity-100">×</button>
                        </span>
                      )
                    ))}
                    <select
                      value={newKeyword[`${k}_cat`] ?? ALL_CATEGORIES[0].id}
                      onChange={ev => setNewKeyword(prev => ({ ...prev, [`${k}_cat`]: ev.target.value }))}
                      className="text-xs px-1.5 py-0.5 rounded-full border bg-transparent text-slate-400 border-slate-700 focus:outline-none"
                    >
                      {ALL_CATEGORIES.map(c => <option key={c.id} value={c.id} className="bg-slate-800">{c.label}</option>)}
                    </select>
                    <input
                      value={newKeyword[`${k}_kw`] ?? ""}
                      onChange={ev => setNewKeyword(prev => ({ ...prev, [`${k}_kw`]: ev.target.value }))}
                      onKeyDown={ev => {
                        if (ev.key === "Enter") {
                          const cat = (newKeyword[`${k}_cat`] ?? ALL_CATEGORIES[0].id) as BrainstormCategory
                          addEntry(cat, sentiment, newKeyword[`${k}_kw`] ?? "")
                          setNewKeyword(prev => ({ ...prev, [`${k}_kw`]: "" }))
                        }
                      }}
                      placeholder="+ mot-clé"
                      className="text-xs px-2 py-0.5 rounded-full border bg-transparent text-slate-400 border-slate-700 placeholder-slate-600 w-20 focus:outline-none focus:border-slate-500"
                    />
                  </div>
                )
              })()}

              {kindItems.length === 0 ? (
                <div className="text-center text-slate-500 text-sm py-6">
                  Aucune idée pour le moment.
                </div>
              ) : (
                <ul className="space-y-2">
                  {kindItems.map(item => (
                    <li key={item.id} className={`bg-slate-900/60 border border-slate-700/60 border-l-4 ${cfg.bar} rounded-lg p-3 shadow-sm`}>
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

      <div className="bg-gradient-to-br from-indigo-500/15 via-slate-800 to-purple-500/15 border-2 border-indigo-500/40 rounded-2xl p-4 space-y-4 shadow-lg">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm font-bold text-indigo-300 uppercase tracking-widest">
            <QrCode className="w-5 h-5" />
            Brainstorming réunion d'équipe
          </div>
          <div className="flex items-center gap-2">
            <select
              value={categoryFilter}
              onChange={ev => setCategoryFilter(ev.target.value as BrainstormCategory | "all")}
              className="text-xs px-2 py-1.5 rounded-lg border bg-slate-900 text-slate-300 border-slate-700 focus:outline-none focus:border-indigo-500"
            >
              <option value="all">Tous les thèmes</option>
              {ALL_CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
            <Button
              size="sm"
              className={showSynthesis ? "bg-indigo-600 hover:bg-indigo-500 text-white" : "bg-indigo-600/80 hover:bg-indigo-500 text-white"}
              onClick={() => setShowSynthesis(s => !s)}
            >
              <Sparkles className="w-4 h-4 mr-1.5" />
              {showSynthesis ? "Masquer la synthèse" : "Synthèse"}
            </Button>
            <Button size="sm" variant="outline" onClick={resetBrainstorm}>
              Réinitialiser
            </Button>
            <Button
              size="sm"
              variant={brainstormOpen ? "outline" : "default"}
              className={brainstormOpen ? "" : "bg-red-600 hover:bg-red-500 text-white"}
              onClick={toggleBrainstormOpen}
            >
              {brainstormOpen ? "Fermer les réponses" : "Réponses fermées — Réouvrir"}
            </Button>
          </div>
        </div>
        {brainstormUrl ? (
          <button
            type="button"
            onClick={() => setQrExpanded(true)}
            className="bg-white p-2 rounded-lg inline-block hover:opacity-90 transition-opacity"
            title="Agrandir le QR code"
          >
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(brainstormUrl)}`}
              alt="QR code brainstorming"
              width={180}
              height={180}
            />
          </button>
        ) : (
          <Button size="sm" onClick={generateQrCode}>
            Générer le QR code
          </Button>
        )}
      </div>

      {anniversaryReviews.length > 0 && (
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2 mb-4">
            <Star className="w-5 h-5 text-amber-400 fill-amber-400" />
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

      {qrExpanded && brainstormUrl && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-6"
          onClick={() => setQrExpanded(false)}
        >
          <div className="bg-white p-6 rounded-2xl">
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=${encodeURIComponent(brainstormUrl)}`}
              alt="QR code brainstorming"
              width={500}
              height={500}
              className="max-w-full max-h-[80vh]"
            />
          </div>
        </div>
      )}
    </div>
  )
}
