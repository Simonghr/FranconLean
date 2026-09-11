"use client"
import { useState, useEffect, useMemo } from "react"
import Link from "next/link"
import { ChefHat, ArrowLeft, Plus, Trash2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import * as recipesRepo from "@/lib/repositories/recipes"
import * as productsRepo from "@/lib/repositories/products"
import * as salesRepo from "@/lib/repositories/salesImports"
import { useSite } from "@/lib/context/SiteContext"
import type { Product, RecipeLine } from "@/lib/types"

function parseNum(v: string): number {
  const t = v.trim().replace(",", ".")
  const n = Number(t)
  return isNaN(n) ? 0 : n
}

export default function RecettesPage() {
  const { siteId: SITE_ID } = useSite()
  const [products, setProducts] = useState<Product[]>([])
  const [lines, setLines] = useState<RecipeLine[]>([])
  const [rollerNames, setRollerNames] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<string | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [newName, setNewName] = useState("")

  const productById = useMemo(() => {
    const m = new Map<string, Product>()
    for (const p of products) m.set(p.id, p)
    return m
  }, [products])

  const productOptions = useMemo(
    () => [...products].sort((a, b) => (a.supplier + a.name).localeCompare(b.supplier + b.name)),
    [products]
  )

  // Recipes grouped by sold-product name.
  const recipes = useMemo(() => {
    const m = new Map<string, RecipeLine[]>()
    for (const l of lines) {
      const arr = m.get(l.roller_name) ?? []
      arr.push(l)
      m.set(l.roller_name, arr)
    }
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  }, [lines])

  useEffect(() => {
    let alive = true
    setLoading(true)
    ;(async () => {
      try {
        const [prods, rl, names] = await Promise.all([
          productsRepo.getAll(SITE_ID), recipesRepo.getAll(SITE_ID), salesRepo.knownRollerNames(SITE_ID),
        ])
        if (!alive) return
        setProducts(prods); setLines(rl); setRollerNames(names)
        const first = [...new Set(rl.map(l => l.roller_name))].sort()[0] ?? null
        setSelected(first)
      } catch (e) { console.error(e) } finally { if (alive) setLoading(false) }
    })()
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [SITE_ID])

  const selLines = lines.filter(l => l.roller_name === selected)

  const addIngredient = async () => {
    if (!selected) return
    const firstProd = productOptions.find(p => !selLines.some(l => l.product_id === p.id))
    if (!firstProd) { window.alert("Tous les produits sont déjà dans cette recette."); return }
    try {
      const created = await recipesRepo.addLine(SITE_ID, selected, firstProd.id, 1)
      setLines(prev => [...prev, created])
    } catch (e: any) { console.error(e); window.alert(`Erreur : ${e?.message ?? e}`) }
  }

  const patchLine = (id: string, patch: Partial<RecipeLine>) => {
    setLines(prev => prev.map(l => l.id === id ? { ...l, ...patch } : l))
    recipesRepo.updateLine(id, patch as any).catch(console.error)
  }

  const removeLine = async (id: string) => {
    try { await recipesRepo.deleteLine(id); setLines(prev => prev.filter(l => l.id !== id)) }
    catch (e) { console.error(e) }
  }

  const deleteRecipe = async (roller_name: string) => {
    if (!window.confirm(`Supprimer la recette de « ${roller_name} » ?`)) return
    try {
      await recipesRepo.deleteRecipe(SITE_ID, roller_name)
      setLines(prev => {
        const next = prev.filter(l => l.roller_name !== roller_name)
        if (selected === roller_name) setSelected([...new Set(next.map(l => l.roller_name))].sort()[0] ?? null)
        return next
      })
    } catch (e) { console.error(e) }
  }

  const createRecipe = async () => {
    const name = newName.trim()
    if (!name) return
    const firstProd = productOptions[0]
    if (!firstProd) { window.alert("Aucun produit disponible."); return }
    try {
      const created = await recipesRepo.addLine(SITE_ID, name, firstProd.id, 1)
      setLines(prev => [...prev, created])
      setSelected(name); setAddOpen(false); setNewName("")
    } catch (e: any) { console.error(e); window.alert(`Erreur : ${e?.message ?? e}`) }
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
            <ChefHat className="w-6 h-6 text-violet-400" /> Recettes
          </h1>
        </div>
        <Button size="sm" onClick={() => { setNewName(""); setAddOpen(true) }}>
          <Plus className="w-4 h-4 mr-1.5" /> Nouvelle recette
        </Button>
      </div>

      <p className="text-xs text-slate-500">
        Une recette relie un <span className="text-slate-300">produit vendu sur Roller</span> à un ou plusieurs
        <span className="text-slate-300"> ingrédients du cadencier</span> (ex. 1 hot-dog = 1 saucisse + 1 pain).
        À l&apos;import des ventes, chaque vente déduit automatiquement les ingrédients (× quantité vendue).
      </p>

      {recipes.length === 0 ? (
        <div className="bg-slate-800/50 border border-dashed border-slate-600 rounded-xl px-4 py-8 text-center text-slate-400">
          Aucune recette. Cliquez sur <span className="text-slate-200">Nouvelle recette</span>.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-5">
          {/* List of sold products with a recipe */}
          <div className="space-y-2">
            {recipes.map(([rn, ls]) => {
              const isSel = selected === rn
              return (
                <div key={rn} className={`flex items-center rounded-xl border transition-colors ${isSel ? "bg-violet-500/10 border-violet-500/40" : "bg-slate-800 border-slate-700 hover:bg-slate-700/50"}`}>
                  <button onClick={() => setSelected(rn)} className="flex-1 text-left px-3 py-2.5 min-w-0">
                    <div className="text-sm font-semibold text-white truncate">{rn}</div>
                    <div className="text-xs text-slate-400 mt-0.5">{ls.length} ingrédient{ls.length > 1 ? "s" : ""}</div>
                  </button>
                  <button onClick={() => deleteRecipe(rn)} className="px-2.5 self-stretch text-slate-600 hover:text-red-400 transition-colors"><Trash2 className="w-4 h-4" /></button>
                </div>
              )
            })}
          </div>

          {/* Detail: ingredients of selected recipe */}
          <div>
            {!selected ? (
              <div className="text-slate-500 text-sm py-8 text-center">Sélectionnez une recette.</div>
            ) : (
              <>
                <div className="text-sm text-slate-300 mb-3">
                  <span className="text-slate-500">Produit vendu :</span> <span className="font-semibold text-white">{selected}</span>
                </div>
                <div className="bg-slate-800/40 border border-slate-700 rounded-xl overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-700 text-[11px] text-slate-500 uppercase tracking-wider">
                        <th className="text-left px-3 py-2 font-semibold">Ingrédient (cadencier)</th>
                        <th className="text-right px-2 py-2 font-semibold text-violet-400">Qté / vente</th>
                        <th className="text-left px-2 py-2 font-semibold">Unité</th>
                        <th className="w-8"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {selLines.length === 0 ? (
                        <tr><td colSpan={4} className="text-center text-slate-500 py-6">Aucun ingrédient.</td></tr>
                      ) : selLines.map(l => {
                        const p = productById.get(l.product_id)
                        return (
                          <tr key={l.id} className="border-b border-slate-700/40">
                            <td className="px-3 py-2">
                              <select value={l.product_id}
                                onChange={e => patchLine(l.id, { product_id: e.target.value })}
                                className="max-w-[280px] text-xs px-2 py-1 rounded border bg-slate-800 text-slate-200 border-slate-700 focus:outline-none focus:border-violet-500">
                                {productOptions.map(op => <option key={op.id} value={op.id}>{op.supplier} — {op.name}</option>)}
                              </select>
                            </td>
                            <td className="px-2 py-2 text-right">
                              <input defaultValue={l.qty ?? 1} inputMode="decimal"
                                onBlur={e => patchLine(l.id, { qty: parseNum(e.target.value) })}
                                className="w-16 bg-slate-900 text-center text-violet-300 font-semibold rounded px-1 py-1 border border-violet-500/30 focus:border-violet-400 focus:outline-none" />
                            </td>
                            <td className="px-2 py-2 text-slate-500 text-xs">{p?.unit ?? ""}</td>
                            <td className="px-2 py-2 text-right">
                              <button onClick={() => removeLine(l.id)} className="text-slate-600 hover:text-red-400"><Trash2 className="w-3.5 h-3.5" /></button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="mt-3">
                  <Button size="sm" variant="outline" onClick={addIngredient}><Plus className="w-4 h-4 mr-1.5" /> Ajouter un ingrédient</Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* New recipe modal */}
      {addOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setAddOpen(false)}>
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-5 w-full max-w-md space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white">Nouvelle recette</h3>
              <button onClick={() => setAddOpen(false)} className="text-slate-500 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-1.5">
              <Label>Produit vendu (Roller)</Label>
              <Input list="roller-name-list" autoFocus value={newName}
                onChange={e => setNewName(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") createRecipe() }}
                placeholder="Choisir un produit vendu ou saisir son nom…" />
              <datalist id="roller-name-list">
                {rollerNames.filter(n => !lines.some(l => l.roller_name === n)).map(n => <option key={n} value={n} />)}
              </datalist>
              <p className="text-[11px] text-slate-500">Choisissez le nom exact tel qu&apos;il apparaît dans l&apos;export Roller (proposé dans la liste).</p>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setAddOpen(false)}>Annuler</Button>
              <Button onClick={createRecipe} disabled={!newName.trim()} className="bg-violet-600 hover:bg-violet-500">Créer</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
