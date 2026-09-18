"use client"
import { useState, useEffect, useMemo } from "react"
import Link from "next/link"
import { Coins, ArrowLeft, Truck, AlertTriangle } from "lucide-react"
import * as productsRepo from "@/lib/repositories/products"
import { useSite } from "@/lib/context/SiteContext"
import type { Product } from "@/lib/types"

function parseNum(v: string): number | null {
  const t = v.trim().replace(",", ".")
  if (t === "") return null
  const n = Number(t)
  return isNaN(n) ? null : n
}
function eur(n: number) {
  return n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €"
}

interface Row { product: Product; qty: number; price: number | null; value: number | null }

export default function EtatStockPage() {
  const { siteId: SITE_ID } = useSite()
  const [products, setProducts] = useState<Product[]>([])
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    setLoading(true)
    ;(async () => {
      try {
        const [prods, latest] = await Promise.all([
          productsRepo.getAll(SITE_ID), productsRepo.getLatestCounts(SITE_ID),
        ])
        if (!alive) return
        setProducts(prods); setCounts(latest)
      } catch (e) { console.error(e) } finally { if (alive) setLoading(false) }
    })()
    return () => { alive = false }
  }, [SITE_ID])

  const patchPrice = (id: string, v: number | null) => {
    setProducts(prev => prev.map(p => p.id === id ? { ...p, unit_price: v } : p))
    productsRepo.update(id, { unit_price: v }).catch(console.error)
  }

  // Current qty: F&B → last validated count; consumables → theoretical stock.
  const qtyOf = (p: Product) => (p.department === "consommable" ? (p.stock ?? 0) : (counts[p.id] ?? 0))

  const groups = useMemo(() => {
    const bySupplier = new Map<string, Row[]>()
    for (const p of products) {
      const qty = qtyOf(p)
      const price = p.unit_price
      const value = price != null ? qty * price : null
      // Show products that carry stock or a price (skip empty untracked ones).
      if (qty === 0 && price == null) continue
      const key = p.department === "consommable" ? "Consommables" : (p.supplier || "Divers")
      const arr = bySupplier.get(key) ?? []
      arr.push({ product: p, qty, price, value }); bySupplier.set(key, arr)
    }
    return [...bySupplier.entries()]
      .map(([k, rows]) => [k, rows.sort((a, b) => a.product.name.localeCompare(b.product.name))] as const)
      .sort((a, b) => a[0].localeCompare(b[0]))
  }, [products, counts])

  const total = useMemo(
    () => groups.reduce((s, [, rows]) => s + rows.reduce((t, r) => t + (r.value ?? 0), 0), 0),
    [groups]
  )
  const missing = useMemo(
    () => products.filter(p => qtyOf(p) > 0 && p.unit_price == null).length,
    [products, counts]
  )

  if (loading) return <div className="text-center py-20 text-slate-500">Chargement…</div>

  return (
    <div className="space-y-6 max-w-[1100px]">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          <Link href="/cadencier" className="text-slate-400 hover:text-white flex items-center gap-1.5 text-sm">
            <ArrowLeft className="w-4 h-4" /> Gestion de stock
          </Link>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Coins className="w-6 h-6 text-emerald-400" /> État des stocks
          </h1>
        </div>
        <div className="text-right">
          <div className="text-[11px] text-slate-500 uppercase tracking-wider">Valeur totale</div>
          <div className="text-2xl font-bold text-emerald-400">{eur(total)}</div>
        </div>
      </div>

      <p className="text-xs text-slate-500">
        Valeur = <span className="text-slate-300">stock × prix unitaire</span>. Le stock F&B vient du dernier comptage validé,
        les consommables de leur stock courant. Les prix sont modifiables (clic sur la valeur).
      </p>

      {missing > 0 && (
        <div className="text-sm text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          {missing} produit{missing > 1 ? "s" : ""} en stock sans prix unitaire — renseignez-les pour une valeur complète.
        </div>
      )}

      {groups.length === 0 ? (
        <div className="bg-slate-800/50 border border-dashed border-slate-600 rounded-xl px-4 py-8 text-center text-slate-400">
          Aucun stock à valoriser pour le moment.
        </div>
      ) : (
        groups.map(([supplier, rows]) => {
          const subtotal = rows.reduce((t, r) => t + (r.value ?? 0), 0)
          return (
            <div key={supplier} className="bg-slate-800/40 border border-slate-700 rounded-xl overflow-hidden">
              <div className="flex items-center justify-between gap-2 px-4 py-2.5 bg-slate-800 border-b border-slate-700">
                <span className="text-sm font-semibold text-white flex items-center gap-2">
                  <Truck className="w-4 h-4 text-emerald-400" /> {supplier}
                  <span className="text-xs font-normal text-slate-500">({rows.length})</span>
                </span>
                <span className="text-sm font-semibold text-emerald-400">{eur(subtotal)}</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-700 text-[11px] text-slate-500 uppercase tracking-wider">
                      <th className="text-left px-3 py-2 font-semibold">Produit</th>
                      <th className="text-right px-2 py-2 font-semibold">Stock</th>
                      <th className="text-right px-2 py-2 font-semibold">Prix/U</th>
                      <th className="text-right px-3 py-2 font-semibold text-emerald-400">Valeur</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(r => (
                      <tr key={r.product.id} className="border-b border-slate-700/40">
                        <td className="px-3 py-2 text-slate-200">{r.product.name}</td>
                        <td className="px-2 py-2 text-right text-slate-400 whitespace-nowrap">
                          {r.qty}<span className="text-[10px] text-slate-600 ml-1">{r.product.unit ?? ""}</span>
                        </td>
                        <td className="px-2 py-2 text-right whitespace-nowrap">
                          <input defaultValue={r.price ?? ""} inputMode="decimal"
                            onBlur={e => patchPrice(r.product.id, parseNum(e.target.value))}
                            className={`w-20 bg-transparent text-right border-b focus:outline-none ${
                              r.price == null ? "text-amber-400 border-amber-500/40 focus:border-amber-400 placeholder-amber-500/50" : "text-slate-300 border-slate-700/60 hover:border-slate-500 focus:border-emerald-500"
                            }`} placeholder="—" />
                          <span className="text-[10px] text-slate-600 ml-1">€</span>
                        </td>
                        <td className="px-3 py-2 text-right font-semibold whitespace-nowrap">
                          {r.value != null ? <span className="text-slate-100">{eur(r.value)}</span> : <span className="text-slate-600">—</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )
        })
      )}
    </div>
  )
}
