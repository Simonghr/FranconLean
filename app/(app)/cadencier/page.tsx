"use client"
import { useState, useEffect, useMemo } from "react"
import { ClipboardList, Search, Plus, Trash2, Save, GripVertical, Check, PackageCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import * as productsRepo from "@/lib/repositories/products"
import { useSite } from "@/lib/context/SiteContext"
import type { Product } from "@/lib/types"

const NO_ZONE = "Sans zone"

// ── Reorder math ──────────────────────────────────────────────────────────
function toOrderColis(p: Product): number | null {
  if (p.target_stock == null || p.current_stock == null) return null
  const missing = p.target_stock - p.current_stock
  if (missing <= 0) return 0
  if (p.pack_size && p.pack_size > 0) return Math.ceil(missing / p.pack_size)
  return Math.ceil(missing) // no pack size → order in counting units
}
function orderAmount(p: Product): number | null {
  const q = toOrderColis(p)
  if (q == null || p.price == null) return null
  const units = p.pack_size && p.pack_size > 0 ? q * p.pack_size : q
  // when a pack size exists the price is per unit inside the pack; amount = colis * price (price already per pack in source? -> per unit) — use colis*price when pack set, else units*price
  return p.pack_size && p.pack_size > 0 ? q * p.price : units * p.price
}
function stockValue(p: Product): number | null {
  if (p.current_stock == null || p.price == null) return null
  return p.current_stock * p.price
}
function eur(n: number | null | undefined) {
  if (n == null) return "—"
  return n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €"
}
function parseNum(v: string): number | null {
  const t = v.trim().replace(",", ".")
  if (t === "") return null
  const n = Number(t)
  return isNaN(n) ? null : n
}

type GroupBy = "zone" | "supplier"

export default function CadencierPage() {
  const { siteId: SITE_ID } = useSite()
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [groupBy, setGroupBy] = useState<GroupBy>("zone")
  const [supplierFilter, setSupplierFilter] = useState<string>("all")
  const [savingInv, setSavingInv] = useState(false)
  const [savedInv, setSavedInv] = useState(false)
  const [dragId, setDragId] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    productsRepo.getAll(SITE_ID).then(setProducts).catch(console.error).finally(() => setLoading(false))
  }, [SITE_ID])

  const suppliers = useMemo(
    () => [...new Set(products.map(p => p.supplier))].sort((a, b) => a.localeCompare(b)),
    [products]
  )
  const zones = useMemo(
    () => [...new Set(products.map(p => p.zone).filter(Boolean) as string[])].sort((a, b) => a.localeCompare(b)),
    [products]
  )

  // ── Local edits ───────────────────────────────────────────────────────────
  const patchLocal = (id: string, patch: Partial<Product>) =>
    setProducts(prev => prev.map(p => (p.id === id ? { ...p, ...patch } : p)))

  const persist = async (id: string, patch: Partial<Product>) => {
    try { await productsRepo.update(id, patch) } catch (e) { console.error(e) }
  }
  const patch = (id: string, p: Partial<Product>) => { patchLocal(id, p); persist(id, p) }

  const addProduct = async () => {
    const name = window.prompt("Nom du produit ?")?.trim()
    if (!name) return
    const supplier = window.prompt("Fournisseur ?")?.trim() || "Divers"
    const maxPos = products.reduce((m, p) => Math.max(m, p.position), 0)
    try {
      const created = await productsRepo.create({ site_id: SITE_ID, supplier, name, position: maxPos + 10 })
      setProducts(prev => [...prev, created])
    } catch (e) { console.error(e) }
  }

  const deleteProduct = async (p: Product) => {
    if (!window.confirm(`Supprimer « ${p.name} » ?`)) return
    try {
      await productsRepo.remove(p.id)
      setProducts(prev => prev.filter(x => x.id !== p.id))
    } catch (e) { console.error(e) }
  }

  const saveInventory = async () => {
    setSavingInv(true)
    try {
      const today = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Paris" })
      await productsRepo.saveInventory(SITE_ID, products, today)
      setSavedInv(true)
      setTimeout(() => setSavedInv(false), 2500)
    } catch (e) { console.error(e) } finally { setSavingInv(false) }
  }

  // ── Drag & drop reorder (persists global position order) ───────────────────
  const handleDrop = async (targetId: string) => {
    if (!dragId || dragId === targetId) { setDragId(null); return }
    const ordered = [...products].sort((a, b) => a.position - b.position)
    const from = ordered.findIndex(p => p.id === dragId)
    const to = ordered.findIndex(p => p.id === targetId)
    if (from === -1 || to === -1) { setDragId(null); return }
    const dragged = ordered[from]
    // When grouped by zone, dropping into another zone re-tags the dragged item.
    const targetZone = ordered[to].zone ?? null
    ordered.splice(from, 1)
    ordered.splice(to, 0, dragged)
    const reZoned = ordered.map(p => (p.id === dragId && groupBy === "zone" ? { ...p, zone: targetZone } : p))
    const withPos = reZoned.map((p, i) => ({ ...p, position: (i + 1) * 10 }))
    setProducts(withPos)
    setDragId(null)
    try {
      await productsRepo.saveOrder(withPos.map(p => p.id))
      if (groupBy === "zone" && (dragged.zone ?? null) !== targetZone) {
        await productsRepo.update(dragId, { zone: targetZone })
      }
    } catch (e) { console.error(e) }
  }

  // ── Filtering + grouping ───────────────────────────────────────────────────
  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    return products
      .filter(p => supplierFilter === "all" || p.supplier === supplierFilter)
      .filter(p => !q || p.name.toLowerCase().includes(q) || p.supplier.toLowerCase().includes(q))
      .sort((a, b) => a.position - b.position)
  }, [products, search, supplierFilter])

  const groups = useMemo(() => {
    const map = new Map<string, Product[]>()
    for (const p of visible) {
      const key = groupBy === "zone" ? (p.zone || NO_ZONE) : p.supplier
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(p)
    }
    return [...map.entries()]
  }, [visible, groupBy])

  const grandStock = products.reduce((s, p) => s + (stockValue(p) ?? 0), 0)
  const grandOrder = products.reduce((s, p) => s + (orderAmount(p) ?? 0), 0)
  const filledCount = products.filter(p => p.current_stock != null).length

  if (loading) return <div className="text-center py-20 text-slate-500">Chargement…</div>

  return (
    <div className="space-y-6 max-w-[1400px]">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <ClipboardList className="w-6 h-6 text-cyan-400" />
            Cadencier de commande
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Comptez le stock et saisissez la quantité par référence · {filledCount}/{products.length} saisis
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={addProduct}>
            <Plus className="w-4 h-4 mr-1.5" /> Produit
          </Button>
          <Button size="sm" onClick={saveInventory} disabled={savingInv}
            className={savedInv ? "bg-green-600 hover:bg-green-600" : ""}>
            {savedInv ? <Check className="w-4 h-4 mr-1.5" /> : <Save className="w-4 h-4 mr-1.5" />}
            {savedInv ? "Inventaire enregistré" : savingInv ? "Enregistrement…" : "Enregistrer l'inventaire"}
          </Button>
        </div>
      </div>

      {/* Totals */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
          <div className="text-xs text-slate-400 uppercase tracking-widest">Valeur du stock</div>
          <div className="text-2xl font-bold text-white mt-1">{eur(grandStock)}</div>
        </div>
        <div className="bg-slate-800 border border-cyan-500/20 rounded-xl p-4">
          <div className="text-xs text-slate-400 uppercase tracking-widest">Montant à commander</div>
          <div className="text-2xl font-bold text-cyan-400 mt-1">{eur(grandOrder)}</div>
        </div>
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
          <div className="text-xs text-slate-400 uppercase tracking-widest">Références</div>
          <div className="text-2xl font-bold text-white mt-1">{products.length}</div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input placeholder="Rechercher un produit…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <div className="flex items-center gap-1 bg-slate-800 border border-slate-700 rounded-lg p-0.5">
          {(["zone", "supplier"] as GroupBy[]).map(g => (
            <button key={g} onClick={() => setGroupBy(g)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                groupBy === g ? "bg-cyan-600 text-white" : "text-slate-400 hover:text-white"
              }`}>
              {g === "zone" ? "Par zone (comptage)" : "Par fournisseur (commande)"}
            </button>
          ))}
        </div>
        <select
          value={supplierFilter}
          onChange={e => setSupplierFilter(e.target.value)}
          className="text-sm px-3 py-2 rounded-lg border bg-slate-800 text-slate-300 border-slate-700 focus:outline-none focus:border-cyan-500"
        >
          <option value="all">Tous les fournisseurs</option>
          {suppliers.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {groupBy === "zone" && (
        <p className="text-xs text-slate-500 -mt-2">
          Glissez <GripVertical className="w-3 h-3 inline" /> pour réordonner le comptage · déposez une ligne dans une autre zone pour l'y déplacer.
        </p>
      )}

      {/* Groups */}
      {groups.map(([groupName, items]) => {
        const gStock = items.reduce((s, p) => s + (stockValue(p) ?? 0), 0)
        const gOrder = items.reduce((s, p) => s + (orderAmount(p) ?? 0), 0)
        return (
          <div key={groupName} className="bg-slate-800/40 border border-slate-700 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5 bg-slate-800 border-b border-slate-700">
              <div className="flex items-center gap-2 text-sm font-semibold text-white">
                {groupBy === "zone" ? <PackageCheck className="w-4 h-4 text-cyan-400" /> : null}
                {groupName}
                <span className="text-xs font-normal text-slate-500">({items.length})</span>
              </div>
              <div className="text-xs text-slate-400">
                Stock {eur(gStock)} · <span className="text-cyan-400">Commande {eur(gOrder)}</span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-700/60 text-[11px] text-slate-500 uppercase tracking-wider">
                    {groupBy === "zone" && <th className="w-6"></th>}
                    <th className="text-left px-3 py-2 font-semibold">Produit</th>
                    <th className="text-right px-2 py-2 font-semibold">Prix/U</th>
                    <th className="text-right px-2 py-2 font-semibold">Colisage</th>
                    <th className="text-right px-2 py-2 font-semibold">Cible</th>
                    <th className="text-center px-2 py-2 font-semibold text-cyan-400">Stock compté</th>
                    <th className="text-right px-2 py-2 font-semibold">À commander</th>
                    <th className="text-left px-2 py-2 font-semibold">Zone</th>
                    <th className="w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map(p => {
                    const colis = toOrderColis(p)
                    const needOrder = colis != null && colis > 0
                    return (
                      <tr
                        key={p.id}
                        draggable={groupBy === "zone"}
                        onDragStart={() => setDragId(p.id)}
                        onDragOver={e => e.preventDefault()}
                        onDrop={() => handleDrop(p.id)}
                        className={`border-b border-slate-700/40 hover:bg-slate-700/20 transition-colors ${dragId === p.id ? "opacity-40" : ""}`}
                      >
                        {groupBy === "zone" && (
                          <td className="pl-2 text-slate-600 cursor-grab active:cursor-grabbing">
                            <GripVertical className="w-4 h-4" />
                          </td>
                        )}
                        <td className="px-3 py-2">
                          <div className="text-slate-100">{p.name}</div>
                          <div className="text-[11px] text-slate-500">
                            {p.supplier}{p.note ? ` · ${p.note}` : ""}
                          </div>
                        </td>
                        <td className="px-2 py-2 text-right">
                          <input
                            defaultValue={p.price ?? ""}
                            onBlur={e => { const v = parseNum(e.target.value); if (v !== p.price) patch(p.id, { price: v }) }}
                            className="w-16 bg-transparent text-right text-slate-300 border-b border-transparent hover:border-slate-600 focus:border-cyan-500 focus:outline-none"
                            placeholder="—"
                          />
                        </td>
                        <td className="px-2 py-2 text-right">
                          <input
                            defaultValue={p.pack_size ?? ""}
                            onBlur={e => { const v = parseNum(e.target.value); if (v !== p.pack_size) patch(p.id, { pack_size: v }) }}
                            className="w-14 bg-transparent text-right text-slate-300 border-b border-transparent hover:border-slate-600 focus:border-cyan-500 focus:outline-none"
                            placeholder="—"
                          />
                        </td>
                        <td className="px-2 py-2 text-right">
                          <input
                            defaultValue={p.target_stock ?? ""}
                            onBlur={e => { const v = parseNum(e.target.value); if (v !== p.target_stock) patch(p.id, { target_stock: v }) }}
                            className="w-14 bg-transparent text-right text-slate-300 border-b border-transparent hover:border-slate-600 focus:border-cyan-500 focus:outline-none"
                            placeholder="—"
                          />
                        </td>
                        <td className="px-2 py-2 text-center">
                          <input
                            key={p.current_stock ?? "empty"}
                            defaultValue={p.current_stock ?? ""}
                            onBlur={e => { const v = parseNum(e.target.value); if (v !== p.current_stock) patch(p.id, { current_stock: v }) }}
                            inputMode="decimal"
                            className={`w-20 text-center rounded-md px-2 py-1.5 font-semibold border focus:outline-none ${
                              p.current_stock == null
                                ? "bg-slate-900 border-slate-600 text-white focus:border-cyan-500"
                                : "bg-cyan-500/10 border-cyan-500/40 text-cyan-300 focus:border-cyan-400"
                            }`}
                            placeholder="—"
                          />
                        </td>
                        <td className={`px-2 py-2 text-right font-medium ${needOrder ? "text-orange-400" : "text-slate-500"}`}>
                          {colis == null ? "—" : colis === 0 ? "0" : `${colis}${p.pack_size ? " col." : " u."}`}
                        </td>
                        <td className="px-2 py-2">
                          <input
                            list="zone-list"
                            defaultValue={p.zone ?? ""}
                            onBlur={e => { const v = e.target.value.trim() || null; if (v !== p.zone) patch(p.id, { zone: v }) }}
                            className="w-28 bg-transparent text-xs text-slate-300 border-b border-transparent hover:border-slate-600 focus:border-cyan-500 focus:outline-none"
                            placeholder="+ zone"
                          />
                        </td>
                        <td className="px-2 py-2 text-right">
                          <button onClick={() => deleteProduct(p)} className="text-slate-600 hover:text-red-400 transition-colors">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )
      })}

      <datalist id="zone-list">
        {zones.map(z => <option key={z} value={z} />)}
      </datalist>

      {products.length === 0 && (
        <div className="text-center text-slate-500 py-12">Aucun produit. Cliquez sur « Produit » pour en ajouter.</div>
      )}
    </div>
  )
}
