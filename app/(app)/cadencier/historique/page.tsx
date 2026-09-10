"use client"
import { useState, useEffect, useMemo } from "react"
import Link from "next/link"
import { History, ArrowLeft, User, Clock, PackageCheck, ClipboardList, Pencil, Trash2, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import * as productsRepo from "@/lib/repositories/products"
import { useSite } from "@/lib/context/SiteContext"
import type { Product, CountSession } from "@/lib/types"

const NO_ZONE = "Sans zone"

function frDate(d: string) {
  return d.split("-").reverse().join("/")
}
function parseNum(v: string): number | null {
  const t = v.trim().replace(",", ".")
  if (t === "") return null
  const n = Number(t)
  return isNaN(n) ? null : n
}

export default function CadencierHistoriquePage() {
  const { siteId: SITE_ID } = useSite()
  const [products, setProducts] = useState<Product[]>([])
  const [sessions, setSessions] = useState<CountSession[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<CountSession | null>(null)
  const [qty, setQty] = useState<Record<string, number | null>>({})
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [editing, setEditing] = useState(false)

  useEffect(() => {
    let alive = true
    setLoading(true)
    ;(async () => {
      try {
        const [prods, sess] = await Promise.all([
          productsRepo.getAll(SITE_ID),
          productsRepo.listSessions(SITE_ID, "validated"),
        ])
        if (!alive) return
        setProducts(prods)
        setSessions(sess)
        if (sess.length) void openSession(sess[0])
      } catch (e) { console.error(e) } finally { if (alive) setLoading(false) }
    })()
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [SITE_ID])

  const openSession = async (s: CountSession) => {
    setSelected(s)
    setEditing(false)
    setLoadingDetail(true)
    try {
      const lines = await productsRepo.getLines(s.id)
      const map: Record<string, number | null> = {}
      for (const l of lines) map[l.product_id] = l.quantity
      setQty(map)
    } catch (e) { console.error(e) } finally { setLoadingDetail(false) }
  }

  const setQuantity = (product_id: string, v: number | null) => {
    if (!selected) return
    setQty(prev => ({ ...prev, [product_id]: v }))
    productsRepo.setLine(selected.id, product_id, v).catch(console.error)
  }

  const patchHeader = (patch: Partial<CountSession>) => {
    if (!selected) return
    const updated = { ...selected, ...patch }
    setSelected(updated)
    setSessions(prev => prev.map(s => (s.id === updated.id ? updated : s)))
    productsRepo.updateSession(selected.id, patch as any).catch(console.error)
  }

  const deleteSession = async (s: CountSession) => {
    if (!window.confirm(`Supprimer définitivement la saisie du ${frDate(s.session_date)} ?`)) return
    try {
      await productsRepo.deleteSession(s.id)
      setSessions(prev => {
        const next = prev.filter(x => x.id !== s.id)
        if (selected?.id === s.id) {
          if (next.length) void openSession(next[0])
          else { setSelected(null); setQty({}) }
        }
        return next
      })
    } catch (e) { console.error(e) }
  }

  const groups = useMemo(() => {
    const map = new Map<string, Product[]>()
    for (const p of [...products].sort((a, b) => a.position - b.position)) {
      const key = p.zone || NO_ZONE
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(p)
    }
    return [...map.entries()]
  }, [products])

  const filledCount = Object.values(qty).filter(v => v != null).length

  if (loading) return <div className="text-center py-20 text-slate-500">Chargement…</div>

  return (
    <div className="space-y-6 max-w-[1100px]">
      <div className="flex items-center gap-3 flex-wrap">
        <Link href="/cadencier" className="text-slate-400 hover:text-white flex items-center gap-1.5 text-sm">
          <ArrowLeft className="w-4 h-4" /> Cadencier
        </Link>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <History className="w-6 h-6 text-cyan-400" /> Historique des saisies
        </h1>
      </div>

      {sessions.length === 0 ? (
        <div className="bg-slate-800/50 border border-dashed border-slate-600 rounded-xl px-4 py-8 text-center text-slate-400">
          Aucune saisie validée pour le moment. Les saisies apparaîtront ici une fois <span className="text-slate-200">validées</span> depuis le Cadencier.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] gap-5">
          {/* Sessions list */}
          <div className="space-y-2">
            {sessions.map(s => {
              const isSel = selected?.id === s.id
              return (
                <div
                  key={s.id}
                  className={`group flex items-center rounded-xl border transition-colors ${
                    isSel ? "bg-cyan-500/10 border-cyan-500/40" : "bg-slate-800 border-slate-700 hover:bg-slate-700/50"
                  }`}
                >
                  <button onClick={() => openSession(s)} className="flex-1 text-left px-3 py-2.5 min-w-0">
                    <div className="text-sm font-semibold text-white flex items-center gap-1.5">
                      <ClipboardList className="w-3.5 h-3.5 text-cyan-400" /> {frDate(s.session_date)}
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5 flex items-center gap-2 flex-wrap">
                      {(s.author_first || s.author_last) && (
                        <span className="flex items-center gap-1"><User className="w-3 h-3" />{[s.author_first, s.author_last].filter(Boolean).join(" ")}</span>
                      )}
                      {s.session_time && <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{s.session_time}</span>}
                    </div>
                  </button>
                  <button onClick={() => deleteSession(s)} title="Supprimer cette saisie"
                    className="px-2.5 self-stretch text-slate-600 hover:text-red-400 transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )
            })}
          </div>

          {/* Detail */}
          <div>
            {!selected ? (
              <div className="text-slate-500 text-sm py-8 text-center">Sélectionnez une saisie à gauche.</div>
            ) : (
              <>
                <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
                  {editing ? (
                    <div className="flex items-center gap-2 flex-wrap">
                      <Input type="date" value={selected.session_date} onChange={e => patchHeader({ session_date: e.target.value })} className="h-8 w-auto" />
                      <Input type="time" value={selected.session_time ?? ""} onChange={e => patchHeader({ session_time: e.target.value })} className="h-8 w-auto" />
                      <Input value={selected.author_first ?? ""} onChange={e => patchHeader({ author_first: e.target.value })} placeholder="Prénom" className="h-8 w-24" />
                      <Input value={selected.author_last ?? ""} onChange={e => patchHeader({ author_last: e.target.value })} placeholder="Nom" className="h-8 w-24" />
                    </div>
                  ) : (
                    <div className="text-sm text-slate-300">
                      Saisie du <span className="text-white font-semibold">{frDate(selected.session_date)}</span>
                      {(selected.author_first || selected.author_last) && <> · {[selected.author_first, selected.author_last].filter(Boolean).join(" ")}</>}
                      {selected.session_time && <> · {selected.session_time}</>}
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400">{filledCount}/{products.length}</span>
                    <Button size="sm" variant={editing ? "default" : "outline"} onClick={() => setEditing(e => !e)}
                      className={editing ? "bg-green-600 hover:bg-green-500" : ""}>
                      {editing ? <><Check className="w-4 h-4 mr-1.5" /> Terminer</> : <><Pencil className="w-4 h-4 mr-1.5" /> Modifier</>}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => deleteSession(selected)}
                      className="border-red-500/40 text-red-400 hover:bg-red-500/10 hover:text-red-300">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                {editing && (
                  <p className="text-xs text-slate-500 mb-3">Modifiez les quantités et l'en-tête ci-dessous — tout est enregistré automatiquement.</p>
                )}

                {loadingDetail ? (
                  <div className="text-center text-slate-500 py-10">Chargement…</div>
                ) : (
                  <div className="space-y-4">
                    {groups.map(([zone, items]) => (
                      <div key={zone} className="bg-slate-800/40 border border-slate-700 rounded-xl overflow-hidden">
                        <div className="flex items-center gap-2 px-4 py-2 bg-slate-800 border-b border-slate-700 text-sm font-semibold text-white">
                          <PackageCheck className="w-4 h-4 text-cyan-400" /> {zone}
                          <span className="text-xs font-normal text-slate-500">({items.length})</span>
                        </div>
                        <ul>
                          {items.map(p => (
                            <li key={p.id} className="flex items-center gap-3 px-3 py-2 border-b border-slate-700/40">
                              <div className="flex-1 min-w-0">
                                <div className="text-slate-100 truncate text-sm">{p.name}</div>
                                <div className="text-[11px] text-slate-500 truncate">{p.supplier}</div>
                              </div>
                              {editing ? (
                                <input
                                  key={`${p.id}-${qty[p.id] ?? "e"}`}
                                  defaultValue={qty[p.id] ?? ""}
                                  onBlur={e => { const v = parseNum(e.target.value); if (v !== (qty[p.id] ?? null)) setQuantity(p.id, v) }}
                                  inputMode="decimal"
                                  className={`w-20 text-center rounded-md px-2 py-1 text-sm font-semibold border focus:outline-none ${
                                    qty[p.id] == null ? "bg-slate-900 border-slate-600 text-white focus:border-cyan-500"
                                      : "bg-cyan-500/10 border-cyan-500/40 text-cyan-300 focus:border-cyan-400"
                                  }`}
                                  placeholder="Qté"
                                />
                              ) : (
                                <div className={`w-20 text-center rounded-md px-2 py-1 text-sm font-semibold ${
                                  qty[p.id] == null ? "text-slate-600" : "bg-cyan-500/10 text-cyan-300 border border-cyan-500/30"
                                }`}>
                                  {qty[p.id] ?? "—"}
                                </div>
                              )}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
