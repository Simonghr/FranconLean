"use client"
import { useState, useEffect, useMemo } from "react"
import Link from "next/link"
import { Truck, ArrowLeft, Plus, Trash2, Check, FileText, PackagePlus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import * as deliveriesRepo from "@/lib/repositories/deliveries"
import * as productsRepo from "@/lib/repositories/products"
import { useSite } from "@/lib/context/SiteContext"
import type { Product, Delivery, DeliveryLine } from "@/lib/types"

function frDate(d: string | null) {
  return d ? d.split("-").reverse().join("/") : "—"
}
function parseNum(v: string): number | null {
  const t = v.trim().replace(",", ".")
  if (t === "") return null
  const n = Number(t)
  return isNaN(n) ? null : n
}

export default function ReceptionPage() {
  const { siteId: SITE_ID } = useSite()
  const [products, setProducts] = useState<Product[]>([])
  const [deliveries, setDeliveries] = useState<Delivery[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Delivery | null>(null)
  const [lines, setLines] = useState<DeliveryLine[]>([])
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [validating, setValidating] = useState(false)

  const productById = useMemo(() => {
    const m = new Map<string, Product>()
    for (const p of products) m.set(p.id, p)
    return m
  }, [products])

  const productOptions = useMemo(
    () => [...products].sort((a, b) => (a.supplier + a.name).localeCompare(b.supplier + b.name)),
    [products]
  )

  useEffect(() => {
    let alive = true
    setLoading(true)
    ;(async () => {
      try {
        const [prods, dels] = await Promise.all([productsRepo.getAll(SITE_ID), deliveriesRepo.list(SITE_ID)])
        if (!alive) return
        setProducts(prods)
        setDeliveries(dels)
        if (dels.length) void openDelivery(dels[0])
      } catch (e) { console.error(e) } finally { if (alive) setLoading(false) }
    })()
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [SITE_ID])

  const openDelivery = async (d: Delivery) => {
    setSelected(d)
    setLoadingDetail(true)
    try { setLines(await deliveriesRepo.getLines(d.id)) }
    catch (e) { console.error(e) } finally { setLoadingDetail(false) }
  }

  const newDelivery = async () => {
    try {
      const today = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Paris" })
      const d = await deliveriesRepo.create({ site_id: SITE_ID, delivery_date: today, supplier: "" })
      setDeliveries(prev => [d, ...prev])
      setSelected(d); setLines([])
    } catch (e: any) { console.error(e); window.alert(`Erreur : ${e?.message ?? e}`) }
  }

  const patchHeader = (patch: Partial<Delivery>) => {
    if (!selected) return
    const updated = { ...selected, ...patch }
    setSelected(updated)
    setDeliveries(prev => prev.map(d => d.id === updated.id ? updated : d))
    deliveriesRepo.update(selected.id, patch as any).catch(console.error)
  }

  const addLine = async () => {
    if (!selected) return
    try {
      const l = await deliveriesRepo.addLine(selected.id, { raw_label: "" })
      setLines(prev => [...prev, l])
    } catch (e) { console.error(e) }
  }

  const patchLine = (id: string, patch: Partial<DeliveryLine>) => {
    setLines(prev => prev.map(l => l.id === id ? { ...l, ...patch } : l))
    deliveriesRepo.updateLine(id, patch).catch(console.error)
  }

  // When a product is chosen, default the received qty from colis × colisage if available.
  const chooseProduct = (line: DeliveryLine, product_id: string | null) => {
    const patch: Partial<DeliveryLine> = { product_id }
    if (product_id && line.qty == null && line.raw_qty != null) {
      const p = productById.get(product_id)
      const pack = line.raw_pack ?? p?.pack_size ?? null
      patch.qty = pack ? line.raw_qty * pack : line.raw_qty
    }
    patchLine(line.id, patch)
  }

  const removeLine = async (id: string) => {
    try { await deliveriesRepo.deleteLine(id); setLines(prev => prev.filter(l => l.id !== id)) }
    catch (e) { console.error(e) }
  }

  const deleteDelivery = async (d: Delivery) => {
    if (!window.confirm(`Supprimer la réception du ${frDate(d.delivery_date)} ?`)) return
    try {
      await deliveriesRepo.remove(d.id)
      setDeliveries(prev => {
        const next = prev.filter(x => x.id !== d.id)
        if (selected?.id === d.id) { if (next.length) void openDelivery(next[0]); else { setSelected(null); setLines([]) } }
        return next
      })
    } catch (e) { console.error(e) }
  }

  const matchedLines = lines.filter(l => !l.ignored && l.product_id && l.qty != null && l.qty !== 0)

  const validate = async () => {
    if (!selected) return
    if (!window.confirm(`Valider la réception ? Le stock de ${matchedLines.length} produit(s) sera augmenté.`)) return
    setValidating(true)
    try {
      // Increment each matched product's theoretical stock, in its counting unit.
      const updatedProducts = new Map<string, number>()
      for (const l of matchedLines) {
        const p = productById.get(l.product_id!)
        if (!p) continue
        const base = updatedProducts.get(p.id) ?? p.stock ?? 0
        updatedProducts.set(p.id, base + (l.qty as number))
      }
      await Promise.all([...updatedProducts.entries()].map(([pid, stock]) => productsRepo.update(pid, { stock })))
      // Remember supplier references for future auto-matching.
      if (selected.supplier) {
        await Promise.all(
          matchedLines.filter(l => l.raw_ref).map(l =>
            deliveriesRepo.rememberRef(SITE_ID, selected.supplier as string, l.raw_ref as string, l.product_id as string)
          )
        )
      }
      await deliveriesRepo.update(selected.id, { status: "validated" })
      setProducts(prev => prev.map(p => updatedProducts.has(p.id) ? { ...p, stock: updatedProducts.get(p.id)! } : p))
      const updated = { ...selected, status: "validated" as const }
      setSelected(updated)
      setDeliveries(prev => prev.map(d => d.id === updated.id ? updated : d))
    } catch (e: any) { console.error(e); window.alert(`Erreur : ${e?.message ?? e}`) } finally { setValidating(false) }
  }

  if (loading) return <div className="text-center py-20 text-slate-500">Chargement…</div>

  const isValidated = selected?.status === "validated"

  return (
    <div className="space-y-6 max-w-[1200px]">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          <Link href="/cadencier" className="text-slate-400 hover:text-white flex items-center gap-1.5 text-sm">
            <ArrowLeft className="w-4 h-4" /> Cadencier
          </Link>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Truck className="w-6 h-6 text-emerald-400" /> Réceptions
          </h1>
        </div>
        <Button size="sm" onClick={newDelivery}><Plus className="w-4 h-4 mr-1.5" /> Nouvelle réception</Button>
      </div>

      {deliveries.length === 0 ? (
        <div className="bg-slate-800/50 border border-dashed border-slate-600 rounded-xl px-4 py-8 text-center text-slate-400">
          Aucune réception. Cliquez sur <span className="text-slate-200">Nouvelle réception</span> pour enregistrer une livraison.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] gap-5">
          {/* List */}
          <div className="space-y-2">
            {deliveries.map(d => {
              const isSel = selected?.id === d.id
              return (
                <div key={d.id} className={`flex items-center rounded-xl border transition-colors ${isSel ? "bg-emerald-500/10 border-emerald-500/40" : "bg-slate-800 border-slate-700 hover:bg-slate-700/50"}`}>
                  <button onClick={() => openDelivery(d)} className="flex-1 text-left px-3 py-2.5 min-w-0">
                    <div className="text-sm font-semibold text-white flex items-center gap-1.5 truncate">
                      <FileText className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" /> {d.supplier || "Sans fournisseur"}
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5 flex items-center gap-2 flex-wrap">
                      <span>{frDate(d.delivery_date)}</span>
                      {d.invoice_number && <span className="truncate">n°{d.invoice_number}</span>}
                      <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${d.status === "validated" ? "bg-green-500/15 text-green-400" : "bg-amber-500/15 text-amber-400"}`}>
                        {d.status === "validated" ? "Validée" : "Brouillon"}
                      </span>
                    </div>
                  </button>
                  <button onClick={() => deleteDelivery(d)} className="px-2.5 self-stretch text-slate-600 hover:text-red-400 transition-colors"><Trash2 className="w-4 h-4" /></button>
                </div>
              )
            })}
          </div>

          {/* Detail */}
          <div>
            {!selected ? (
              <div className="text-slate-500 text-sm py-8 text-center">Sélectionnez une réception.</div>
            ) : (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
                  <div className="space-y-1.5">
                    <Label>Fournisseur</Label>
                    <Input value={selected.supplier ?? ""} disabled={isValidated} onChange={e => patchHeader({ supplier: e.target.value })} placeholder="Fournisseur" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Date</Label>
                    <Input type="date" value={selected.delivery_date ?? ""} disabled={isValidated} onChange={e => patchHeader({ delivery_date: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>N° facture / BL</Label>
                    <Input value={selected.invoice_number ?? ""} disabled={isValidated} onChange={e => patchHeader({ invoice_number: e.target.value })} placeholder="n°…" />
                  </div>
                </div>

                {isValidated && (
                  <div className="mb-3 text-sm text-green-400 bg-green-500/10 border border-green-500/30 rounded-lg px-3 py-2">
                    Réception validée — le stock a été mis à jour.
                  </div>
                )}

                <div className="bg-slate-800/40 border border-slate-700 rounded-xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-700 text-[11px] text-slate-500 uppercase tracking-wider">
                          <th className="text-left px-3 py-2 font-semibold">Ligne facture</th>
                          <th className="text-left px-2 py-2 font-semibold">→ Produit</th>
                          <th className="text-right px-2 py-2 font-semibold">Colis</th>
                          <th className="text-right px-2 py-2 font-semibold">Colisage</th>
                          <th className="text-right px-2 py-2 font-semibold text-emerald-400">Reçu (unité)</th>
                          <th className="text-center px-2 py-2 font-semibold">Ignorer</th>
                          <th className="w-8"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {loadingDetail ? (
                          <tr><td colSpan={7} className="text-center text-slate-500 py-8">Chargement…</td></tr>
                        ) : lines.length === 0 ? (
                          <tr><td colSpan={7} className="text-center text-slate-500 py-8">Aucune ligne. Ajoutez-en une ci-dessous.</td></tr>
                        ) : lines.map(l => {
                          const p = l.product_id ? productById.get(l.product_id) : null
                          return (
                            <tr key={l.id} className={`border-b border-slate-700/40 ${l.ignored ? "opacity-40" : ""}`}>
                              <td className="px-3 py-2">
                                <input defaultValue={l.raw_label ?? ""} disabled={isValidated}
                                  onBlur={e => { const v = e.target.value; if (v !== (l.raw_label ?? "")) patchLine(l.id, { raw_label: v }) }}
                                  className="w-full bg-transparent text-slate-200 border-b border-transparent hover:border-slate-600 focus:border-emerald-500 focus:outline-none"
                                  placeholder="Libellé…" />
                                {l.raw_ref && <div className="text-[10px] text-slate-500">réf {l.raw_ref}</div>}
                              </td>
                              <td className="px-2 py-2">
                                <select value={l.product_id ?? ""} disabled={isValidated}
                                  onChange={e => chooseProduct(l, e.target.value || null)}
                                  className="max-w-[220px] text-xs px-2 py-1 rounded border bg-slate-800 text-slate-200 border-slate-700 focus:outline-none focus:border-emerald-500">
                                  <option value="">— non associé —</option>
                                  {productOptions.map(op => <option key={op.id} value={op.id}>{op.supplier} — {op.name}</option>)}
                                </select>
                              </td>
                              <td className="px-2 py-2 text-right">
                                <input defaultValue={l.raw_qty ?? ""} disabled={isValidated}
                                  onBlur={e => patchLine(l.id, { raw_qty: parseNum(e.target.value) })}
                                  className="w-12 bg-transparent text-right text-slate-300 border-b border-transparent hover:border-slate-600 focus:border-emerald-500 focus:outline-none" placeholder="—" />
                              </td>
                              <td className="px-2 py-2 text-right">
                                <input defaultValue={l.raw_pack ?? ""} disabled={isValidated}
                                  onBlur={e => patchLine(l.id, { raw_pack: parseNum(e.target.value) })}
                                  className="w-12 bg-transparent text-right text-slate-300 border-b border-transparent hover:border-slate-600 focus:border-emerald-500 focus:outline-none" placeholder="—" />
                              </td>
                              <td className="px-2 py-2 text-right whitespace-nowrap">
                                <input key={`${l.id}-${l.qty ?? "e"}`} defaultValue={l.qty ?? ""} disabled={isValidated}
                                  onBlur={e => patchLine(l.id, { qty: parseNum(e.target.value) })}
                                  className="w-16 bg-slate-900 text-center text-emerald-300 font-semibold rounded px-1 py-1 border border-emerald-500/30 focus:border-emerald-400 focus:outline-none disabled:opacity-60" placeholder="—" />
                                <span className="text-[10px] text-slate-500 ml-1">{p?.unit ?? ""}</span>
                              </td>
                              <td className="px-2 py-2 text-center">
                                <input type="checkbox" checked={l.ignored} disabled={isValidated}
                                  onChange={e => patchLine(l.id, { ignored: e.target.checked })} className="w-4 h-4 accent-slate-500" />
                              </td>
                              <td className="px-2 py-2 text-right">
                                {!isValidated && <button onClick={() => removeLine(l.id)} className="text-slate-600 hover:text-red-400"><Trash2 className="w-3.5 h-3.5" /></button>}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {!isValidated && (
                  <div className="flex items-center justify-between gap-3 mt-3 flex-wrap">
                    <Button size="sm" variant="outline" onClick={addLine}><Plus className="w-4 h-4 mr-1.5" /> Ajouter une ligne</Button>
                    <Button size="sm" onClick={validate} disabled={validating || matchedLines.length === 0} className="bg-emerald-600 hover:bg-emerald-500">
                      <Check className="w-4 h-4 mr-1.5" /> Valider — +{matchedLines.length} produit(s) en stock
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      <p className="text-xs text-slate-500 flex items-center gap-1.5">
        <PackagePlus className="w-3.5 h-3.5" /> La validation augmente le stock théorique de chaque produit associé (dans son unité de comptage).
      </p>
    </div>
  )
}
