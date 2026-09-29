"use client"
import { useState, useEffect, useMemo } from "react"
import Link from "next/link"
import { TrendingDown, ArrowLeft, Plus, Trash2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import * as lossesRepo from "@/lib/repositories/losses"
import * as productsRepo from "@/lib/repositories/products"
import { useSite } from "@/lib/context/SiteContext"
import { useAuth } from "@/lib/context/AuthContext"
import { canDeleteRole } from "@/lib/permissions"
import type { Product, StockLoss } from "@/lib/types"

function frDateTime(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString("fr-FR", { timeZone: "Europe/Paris" }) + " " +
    d.toLocaleTimeString("fr-FR", { timeZone: "Europe/Paris", hour: "2-digit", minute: "2-digit" })
}
function parseNum(v: string): number | null {
  const t = v.trim().replace(",", ".")
  if (t === "") return null
  const n = Number(t)
  return isNaN(n) ? null : n
}

export default function PertesPage() {
  const { siteId: SITE_ID } = useSite()
  const canDelete = canDeleteRole(useAuth().role)
  const [products, setProducts] = useState<Product[]>([])
  const [losses, setLosses] = useState<StockLoss[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ productId: "", qty: "", unit: "", reason: "" })
  const [saving, setSaving] = useState(false)

  const productOptions = useMemo(
    () => [...products].sort((a, b) => (a.name).localeCompare(b.name)),
    [products]
  )
  const productById = useMemo(() => {
    const m = new Map<string, Product>()
    for (const p of products) m.set(p.id, p)
    return m
  }, [products])

  useEffect(() => {
    let alive = true
    setLoading(true)
    ;(async () => {
      try {
        const [prods, ls] = await Promise.all([productsRepo.getAll(SITE_ID), lossesRepo.list(SITE_ID)])
        if (!alive) return
        setProducts(prods); setLosses(ls)
      } catch (e) { console.error(e) } finally { if (alive) setLoading(false) }
    })()
    return () => { alive = false }
  }, [SITE_ID])

  const openNew = () => { setForm({ productId: "", qty: "", unit: "", reason: "" }); setOpen(true) }

  // Fill the unit from the chosen product (still editable).
  const chooseProduct = (id: string) => {
    const p = productById.get(id)
    setForm(f => ({ ...f, productId: id, unit: f.unit || (p?.unit ?? "") }))
  }

  const submit = async () => {
    const p = productById.get(form.productId)
    if (!p) { window.alert("Sélectionnez un produit."); return }
    const q = parseNum(form.qty)
    if (q == null || q <= 0) { window.alert("Indiquez une quantité valide."); return }
    setSaving(true)
    try {
      const created = await lossesRepo.create({
        site_id: SITE_ID, product_id: p.id, product_name: p.name,
        quantity: q, unit: form.unit.trim() || p.unit || null, reason: form.reason.trim() || null,
      })
      // Deduct from the theoretical stock so the "État des stocks" stays accurate.
      const newStock = (p.stock ?? 0) - q
      await productsRepo.update(p.id, { stock: newStock })
      setProducts(prev => prev.map(x => x.id === p.id ? { ...x, stock: newStock } : x))
      setLosses(prev => [created, ...prev])
      setOpen(false)
    } catch (e: any) { console.error(e); window.alert(`Erreur : ${e?.message ?? e}`) }
    finally { setSaving(false) }
  }

  const removeLoss = async (l: StockLoss) => {
    if (!window.confirm(`Supprimer cette perte (${l.product_name}) ?`)) return
    try {
      await lossesRepo.remove(l.id)
      // Give the deducted quantity back to the theoretical stock.
      if (l.product_id) {
        const p = productById.get(l.product_id)
        if (p) {
          const newStock = (p.stock ?? 0) + l.quantity
          await productsRepo.update(p.id, { stock: newStock })
          setProducts(prev => prev.map(x => x.id === p.id ? { ...x, stock: newStock } : x))
        }
      }
      setLosses(prev => prev.filter(x => x.id !== l.id))
    } catch (e) { console.error(e) }
  }

  if (loading) return <div className="text-center py-20 text-slate-500">Chargement…</div>

  return (
    <div className="space-y-6 max-w-[1000px]">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          <Link href="/cadencier" className="text-slate-400 hover:text-white flex items-center gap-1.5 text-sm">
            <ArrowLeft className="w-4 h-4" /> Gestion de stock
          </Link>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <TrendingDown className="w-6 h-6 text-red-400" /> Pertes
          </h1>
        </div>
        <Button size="sm" onClick={openNew}><Plus className="w-4 h-4 mr-1.5" /> Nouvelle perte</Button>
      </div>

      <p className="text-xs text-slate-500">
        Recensez les pertes (casse, périmé, erreur…). Chaque perte est <span className="text-slate-300">déduite du stock théorique</span> du produit.
      </p>

      {losses.length === 0 ? (
        <div className="bg-slate-800/50 border border-dashed border-slate-600 rounded-xl px-4 py-8 text-center text-slate-400">
          Aucune perte enregistrée. Cliquez sur <span className="text-slate-200">Nouvelle perte</span>.
        </div>
      ) : (
        <div className="bg-slate-800/40 border border-slate-700 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700 text-[11px] text-slate-500 uppercase tracking-wider">
                  <th className="text-left px-3 py-2 font-semibold">Date</th>
                  <th className="text-left px-2 py-2 font-semibold">Produit</th>
                  <th className="text-right px-2 py-2 font-semibold text-red-400">Quantité</th>
                  <th className="text-left px-2 py-2 font-semibold">Motif</th>
                  <th className="w-8"></th>
                </tr>
              </thead>
              <tbody>
                {losses.map(l => (
                  <tr key={l.id} className="border-b border-slate-700/40">
                    <td className="px-3 py-2 text-slate-400 whitespace-nowrap">{frDateTime(l.created_at)}</td>
                    <td className="px-2 py-2 text-slate-200">{l.product_name ?? "—"}</td>
                    <td className="px-2 py-2 text-right text-red-300 font-semibold whitespace-nowrap">
                      {l.quantity}<span className="text-[10px] text-slate-500 ml-1">{l.unit ?? ""}</span>
                    </td>
                    <td className="px-2 py-2 text-slate-300">{l.reason ?? "—"}</td>
                    <td className="px-2 py-2 text-right">
                      {canDelete && <button onClick={() => removeLoss(l)} className="text-slate-600 hover:text-red-400"><Trash2 className="w-3.5 h-3.5" /></button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {open && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={() => setOpen(false)}>
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white flex items-center gap-2"><TrendingDown className="w-5 h-5 text-red-400" /> Nouvelle perte</h3>
              <button onClick={() => setOpen(false)} className="text-slate-500 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Produit</Label>
                <select value={form.productId} onChange={e => chooseProduct(e.target.value)}
                  className="w-full text-sm px-3 py-2 rounded-lg border bg-slate-800 text-slate-200 border-slate-700 focus:outline-none focus:border-red-500">
                  <option value="">— sélectionner —</option>
                  {productOptions.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Quantité</Label>
                  <Input value={form.qty} inputMode="decimal" autoFocus
                    onChange={e => setForm(f => ({ ...f, qty: e.target.value }))} placeholder="ex. 3" />
                </div>
                <div className="space-y-1.5">
                  <Label>Unité</Label>
                  <Input value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))} placeholder="ex. pièce" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Motif de la perte</Label>
                <Input value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
                  onKeyDown={e => { if (e.key === "Enter") submit() }} placeholder="ex. casse, périmé, erreur…" />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
              <Button onClick={submit} disabled={saving} className="bg-red-600 hover:bg-red-500">Enregistrer la perte</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
