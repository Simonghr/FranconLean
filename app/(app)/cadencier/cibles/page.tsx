"use client"
import { useState, useEffect, useMemo } from "react"
import Link from "next/link"
import { Target, ArrowLeft, Search, Truck } from "lucide-react"
import { Input } from "@/components/ui/input"
import * as productsRepo from "@/lib/repositories/products"
import { useSite } from "@/lib/context/SiteContext"
import { useAuth } from "@/lib/context/AuthContext"
import { canEditTargetsRole } from "@/lib/permissions"
import type { Product } from "@/lib/types"

function parseNum(v: string): number | null {
  const t = v.trim().replace(",", ".")
  if (t === "") return null
  const n = Number(t)
  return isNaN(n) ? null : n
}

export default function CiblesPage() {
  const { siteId: SITE_ID } = useSite()
  const { role } = useAuth()
  const canEdit = canEditTargetsRole(role)
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")

  useEffect(() => {
    let alive = true
    setLoading(true)
    ;(async () => {
      try {
        const prods = await productsRepo.getAll(SITE_ID)
        if (alive) setProducts(prods)
      } catch (e) { console.error(e) } finally { if (alive) setLoading(false) }
    })()
    return () => { alive = false }
  }, [SITE_ID])

  const patch = (id: string, field: "target_stock" | "target_high", v: number | null) => {
    setProducts(prev => prev.map(p => p.id === id ? { ...p, [field]: v } : p))
    productsRepo.update(id, { [field]: v }).catch(console.error)
  }

  const groups = useMemo(() => {
    const q = search.trim().toLowerCase()
    const filtered = products.filter(p => !q || p.name.toLowerCase().includes(q) || (p.supplier ?? "").toLowerCase().includes(q))
    const map = new Map<string, Product[]>()
    for (const p of filtered) {
      const key = p.department === "consommable" ? "Consommables" : (p.supplier || "Divers")
      const arr = map.get(key) ?? []
      arr.push(p); map.set(key, arr)
    }
    return [...map.entries()]
      .map(([k, rows]) => [k, rows.sort((a, b) => a.name.localeCompare(b.name))] as const)
      .sort((a, b) => a[0].localeCompare(b[0]))
  }, [products, search])

  if (loading) return <div className="text-center py-20 text-slate-500">Chargement…</div>

  return (
    <div className="space-y-5 max-w-[900px]">
      <div className="flex items-center gap-3 flex-wrap">
        <Link href="/cadencier" className="text-slate-400 hover:text-white flex items-center gap-1.5 text-sm">
          <ArrowLeft className="w-4 h-4" /> Gestion de stock
        </Link>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Target className="w-6 h-6 text-cyan-400" /> Stock cible
        </h1>
      </div>

      <p className="text-xs text-slate-500">
        Remplissez le stock souhaité par produit pour deux scénarios : <span className="text-cyan-300">Semaine standard</span> et
        <span className="text-amber-300"> Forte période</span>. Dans les Commandes, vous choisirez le scénario à utiliser.
      </p>
      {!canEdit && (
        <div className="text-sm text-slate-400 bg-slate-800/60 border border-slate-700 rounded-lg px-3 py-2">
          Lecture seule — la modification des stocks cibles est réservée à la Direction.
        </div>
      )}

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <Input placeholder="Rechercher un produit…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
      </div>

      {groups.map(([supplier, rows]) => (
        <div key={supplier} className="bg-slate-800/40 border border-slate-700 rounded-xl overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 border-b border-slate-700 text-sm font-semibold text-white">
            <Truck className="w-4 h-4 text-cyan-400" /> {supplier}
            <span className="text-xs font-normal text-slate-500">({rows.length})</span>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700 text-[11px] text-slate-500 uppercase tracking-wider">
                <th className="text-left px-3 py-2 font-semibold">Produit</th>
                <th className="text-right px-2 py-2 font-semibold text-cyan-300 w-28">Semaine<br />standard</th>
                <th className="text-right px-3 py-2 font-semibold text-amber-300 w-28">Forte<br />période</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(p => (
                <tr key={p.id} className="border-b border-slate-700/40">
                  <td className="px-3 py-2">
                    <div className="text-slate-200">{p.name}</div>
                    <div className="text-[10px] text-slate-500">{p.unit ?? ""}</div>
                  </td>
                  <td className="px-2 py-2 text-right">
                    <input defaultValue={p.target_stock ?? ""} inputMode="decimal"
                      disabled={!canEdit} onBlur={e => patch(p.id, "target_stock", parseNum(e.target.value))}
                      className="w-20 bg-slate-900 text-center text-cyan-200 rounded px-2 py-1 border border-cyan-500/30 focus:border-cyan-400 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed" placeholder="—" />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <input defaultValue={p.target_high ?? ""} inputMode="decimal"
                      disabled={!canEdit} onBlur={e => patch(p.id, "target_high", parseNum(e.target.value))}
                      className="w-20 bg-slate-900 text-center text-amber-200 rounded px-2 py-1 border border-amber-500/30 focus:border-amber-400 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed" placeholder="—" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  )
}
