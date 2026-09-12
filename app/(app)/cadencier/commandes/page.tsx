"use client"
import { useState, useEffect, useMemo } from "react"
import Link from "next/link"
import { ClipboardCheck, ArrowLeft, Copy, Check, Truck } from "lucide-react"
import { Button } from "@/components/ui/button"
import * as productsRepo from "@/lib/repositories/products"
import { useSite } from "@/lib/context/SiteContext"
import type { Product } from "@/lib/types"

function parseNum(v: string): number | null {
  const t = v.trim().replace(",", ".")
  if (t === "") return null
  const n = Number(t)
  return isNaN(n) ? null : n
}

interface Row {
  product: Product
  onHand: number
  target: number
  toOrder: number       // in counting unit
  colis: number | null  // rounded up to full cartons
}

export default function CommandesPage() {
  const { siteId: SITE_ID } = useSite()
  const [products, setProducts] = useState<Product[]>([])
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [hasCount, setHasCount] = useState(true)
  const [loading, setLoading] = useState(true)
  // Manual overrides of the suggested order quantity (counting unit), by product id.
  const [override, setOverride] = useState<Record<string, number>>({})
  const [copied, setCopied] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    setLoading(true)
    ;(async () => {
      try {
        const [prods, latest] = await Promise.all([
          productsRepo.getAll(SITE_ID), productsRepo.getLatestCounts(SITE_ID),
        ])
        if (!alive) return
        setProducts(prods); setCounts(latest); setHasCount(Object.keys(latest).length > 0)
      } catch (e) { console.error(e) } finally { if (alive) setLoading(false) }
    })()
    return () => { alive = false }
  }, [SITE_ID])

  const patchTarget = (id: string, v: number | null) => {
    setProducts(prev => prev.map(p => p.id === id ? { ...p, target_stock: v } : p))
    productsRepo.update(id, { target_stock: v }).catch(console.error)
  }

  // Build order rows grouped by supplier (only products with a target and a shortfall).
  const groups = useMemo(() => {
    const bySupplier = new Map<string, Row[]>()
    for (const p of products) {
      if (p.target_stock == null) continue
      const onHand = counts[p.id] ?? 0
      const target = p.target_stock
      const suggested = Math.max(0, target - onHand)
      const toOrder = override[p.id] ?? suggested
      if (toOrder <= 0) continue
      const colis = p.pack_size && p.pack_size > 0 ? Math.ceil(toOrder / p.pack_size) : null
      const row: Row = { product: p, onHand, target, toOrder, colis }
      const arr = bySupplier.get(p.supplier) ?? []
      arr.push(row); bySupplier.set(p.supplier, arr)
    }
    return [...bySupplier.entries()]
      .map(([supplier, rows]) => [supplier, rows.sort((a, b) => a.product.name.localeCompare(b.product.name))] as const)
      .sort((a, b) => a[0].localeCompare(b[0]))
  }, [products, counts, override])

  const copySupplier = (supplier: string, rows: Row[]) => {
    const today = new Date().toLocaleDateString("fr-FR", { timeZone: "Europe/Paris" })
    const lines = rows.map(r => {
      const colis = r.colis != null ? ` (${r.colis} colis)` : ""
      return `- ${r.product.name} : ${r.toOrder}${r.product.unit ? " " + r.product.unit : ""}${colis}`
    })
    const text = `Commande ${supplier} — ${today}\n${lines.join("\n")}`
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(supplier); setTimeout(() => setCopied(null), 1500)
    }).catch(() => {})
  }

  if (loading) return <div className="text-center py-20 text-slate-500">Chargement…</div>

  return (
    <div className="space-y-6 max-w-[1100px]">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          <Link href="/cadencier" className="text-slate-400 hover:text-white flex items-center gap-1.5 text-sm">
            <ArrowLeft className="w-4 h-4" /> Cadencier
          </Link>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <ClipboardCheck className="w-6 h-6 text-amber-400" /> Commandes
          </h1>
        </div>
      </div>

      <p className="text-xs text-slate-500">
        Pour chaque produit ayant un <span className="text-slate-300">stock cible</span>, la quantité à commander =
        <span className="text-slate-300"> cible − dernier comptage</span>, regroupée par fournisseur. Ajustez une quantité si besoin, puis copiez la commande.
      </p>

      {!hasCount && (
        <div className="text-sm text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2">
          Aucune saisie validée trouvée : le stock actuel est considéré à 0. Validez une saisie dans le cadencier pour un calcul fiable.
        </div>
      )}

      {groups.length === 0 ? (
        <div className="bg-slate-800/50 border border-dashed border-slate-600 rounded-xl px-4 py-8 text-center text-slate-400">
          Rien à commander. Définissez un <span className="text-slate-200">stock cible</span> sur vos produits (bouton ✏️ dans le cadencier) pour générer les commandes.
        </div>
      ) : (
        groups.map(([supplier, rows]) => (
          <div key={supplier} className="bg-slate-800/40 border border-slate-700 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between gap-2 px-4 py-2.5 bg-slate-800 border-b border-slate-700">
              <span className="text-sm font-semibold text-white flex items-center gap-2">
                <Truck className="w-4 h-4 text-amber-400" /> {supplier}
                <span className="text-xs font-normal text-slate-500">({rows.length} produit{rows.length > 1 ? "s" : ""})</span>
              </span>
              <Button size="sm" variant="outline" onClick={() => copySupplier(supplier, rows)}>
                {copied === supplier ? <><Check className="w-4 h-4 mr-1.5 text-green-400" /> Copié</> : <><Copy className="w-4 h-4 mr-1.5" /> Copier</>}
              </Button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-700 text-[11px] text-slate-500 uppercase tracking-wider">
                    <th className="text-left px-3 py-2 font-semibold">Produit</th>
                    <th className="text-right px-2 py-2 font-semibold">Compté</th>
                    <th className="text-right px-2 py-2 font-semibold">Cible</th>
                    <th className="text-right px-2 py-2 font-semibold text-amber-400">À commander</th>
                    <th className="text-right px-3 py-2 font-semibold">Colis</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(r => (
                    <tr key={r.product.id} className="border-b border-slate-700/40">
                      <td className="px-3 py-2 text-slate-200">{r.product.name}</td>
                      <td className="px-2 py-2 text-right text-slate-400 whitespace-nowrap">{r.onHand}<span className="text-[10px] text-slate-600 ml-1">{r.product.unit ?? ""}</span></td>
                      <td className="px-2 py-2 text-right">
                        <input defaultValue={r.target} inputMode="decimal"
                          onBlur={e => patchTarget(r.product.id, parseNum(e.target.value))}
                          className="w-14 bg-transparent text-right text-slate-300 border-b border-slate-700/60 hover:border-slate-500 focus:border-cyan-500 focus:outline-none" />
                      </td>
                      <td className="px-2 py-2 text-right whitespace-nowrap">
                        <input key={`${r.product.id}-${r.toOrder}`} defaultValue={r.toOrder} inputMode="decimal"
                          onBlur={e => {
                            const v = parseNum(e.target.value)
                            setOverride(prev => ({ ...prev, [r.product.id]: v ?? 0 }))
                          }}
                          className="w-16 bg-slate-900 text-center text-amber-300 font-semibold rounded px-1 py-1 border border-amber-500/30 focus:border-amber-400 focus:outline-none" />
                        <span className="text-[10px] text-slate-500 ml-1">{r.product.unit ?? ""}</span>
                      </td>
                      <td className="px-3 py-2 text-right text-slate-300 whitespace-nowrap">
                        {r.colis != null ? <span className="font-semibold">{r.colis}</span> : <span className="text-slate-600">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))
      )}
    </div>
  )
}
