"use client"
import { useState, useEffect, useMemo } from "react"
import { ClipboardList, Search, Plus, Trash2, GripVertical, PackageCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import * as productsRepo from "@/lib/repositories/products"
import { useSite } from "@/lib/context/SiteContext"
import type { Product } from "@/lib/types"

const NO_ZONE = "Sans zone"

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

  const patchLocal = (id: string, patch: Partial<Product>) =>
    setProducts(prev => prev.map(p => (p.id === id ? { ...p, ...patch } : p)))
  const patch = (id: string, p: Partial<Product>) => {
    patchLocal(id, p)
    productsRepo.update(id, p).catch(console.error)
  }

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

  // Drag & drop reorder — persists the global counting order; dropping into
  // another zone re-tags the moved product to that zone.
  const handleDrop = async (targetId: string) => {
    if (!dragId || dragId === targetId) { setDragId(null); return }
    const ordered = [...products].sort((a, b) => a.position - b.position)
    const from = ordered.findIndex(p => p.id === dragId)
    const to = ordered.findIndex(p => p.id === targetId)
    if (from === -1 || to === -1) { setDragId(null); return }
    const dragged = ordered[from]
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

  const filledCount = products.filter(p => p.current_stock != null).length

  if (loading) return <div className="text-center py-20 text-slate-500">Chargement…</div>

  return (
    <div className="space-y-6 max-w-[1100px]">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <ClipboardList className="w-6 h-6 text-cyan-400" />
            Cadencier de commande
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Saisissez la quantité en stock de chaque produit · {filledCount}/{products.length} renseignés
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={addProduct}>
          <Plus className="w-4 h-4 mr-1.5" /> Ajouter un produit
        </Button>
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
              {g === "zone" ? "Par zone" : "Par fournisseur"}
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
          Glissez <GripVertical className="w-3 h-3 inline" /> pour réordonner · déposez une ligne dans une autre zone pour l'y déplacer.
        </p>
      )}

      {/* Groups */}
      {groups.map(([groupName, items]) => (
        <div key={groupName} className="bg-slate-800/40 border border-slate-700 rounded-xl overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 border-b border-slate-700 text-sm font-semibold text-white">
            {groupBy === "zone" ? <PackageCheck className="w-4 h-4 text-cyan-400" /> : null}
            {groupName}
            <span className="text-xs font-normal text-slate-500">({items.length})</span>
          </div>

          <ul>
            {items.map(p => (
              <li
                key={p.id}
                draggable={groupBy === "zone"}
                onDragStart={() => setDragId(p.id)}
                onDragOver={e => e.preventDefault()}
                onDrop={() => handleDrop(p.id)}
                className={`flex items-center gap-3 px-3 py-2.5 border-b border-slate-700/40 hover:bg-slate-700/20 transition-colors ${dragId === p.id ? "opacity-40" : ""}`}
              >
                {groupBy === "zone" && (
                  <span className="text-slate-600 cursor-grab active:cursor-grabbing flex-shrink-0">
                    <GripVertical className="w-4 h-4" />
                  </span>
                )}

                <div className="flex-1 min-w-0">
                  <div className="text-slate-100 truncate">{p.name}</div>
                  <div className="text-[11px] text-slate-500 truncate">
                    {p.supplier}{p.note ? ` · ${p.note}` : ""}
                  </div>
                </div>

                {/* Zone tag */}
                <input
                  list="zone-list"
                  defaultValue={p.zone ?? ""}
                  onBlur={e => { const v = e.target.value.trim() || null; if (v !== p.zone) patch(p.id, { zone: v }) }}
                  className="w-24 bg-transparent text-xs text-slate-400 border-b border-transparent hover:border-slate-600 focus:border-cyan-500 focus:outline-none text-right hidden sm:block"
                  placeholder="+ zone"
                />

                {/* Quantity — the only thing to fill */}
                <input
                  key={p.current_stock ?? "empty"}
                  defaultValue={p.current_stock ?? ""}
                  onBlur={e => { const v = parseNum(e.target.value); if (v !== p.current_stock) patch(p.id, { current_stock: v }) }}
                  inputMode="decimal"
                  className={`w-20 flex-shrink-0 text-center rounded-md px-2 py-1.5 font-semibold border focus:outline-none ${
                    p.current_stock == null
                      ? "bg-slate-900 border-slate-600 text-white focus:border-cyan-500"
                      : "bg-cyan-500/10 border-cyan-500/40 text-cyan-300 focus:border-cyan-400"
                  }`}
                  placeholder="Qté"
                />

                <button onClick={() => deleteProduct(p)} className="text-slate-600 hover:text-red-400 transition-colors flex-shrink-0">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}

      <datalist id="zone-list">
        {zones.map(z => <option key={z} value={z} />)}
      </datalist>

      {products.length === 0 && (
        <div className="text-center text-slate-500 py-12">Aucun produit. Cliquez sur « Ajouter un produit ».</div>
      )}
    </div>
  )
}
