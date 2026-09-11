"use client"
import { useState, useEffect, useMemo, useRef } from "react"
import Link from "next/link"
import { ShoppingCart, ArrowLeft, Trash2, Check, FileUp, TrendingDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import * as salesRepo from "@/lib/repositories/salesImports"
import * as productsRepo from "@/lib/repositories/products"
import { useSite } from "@/lib/context/SiteContext"
import type { Product, SalesImport, SalesLine, RollerAlias } from "@/lib/types"

function frDate(d: string | null) {
  return d ? d.split("-").reverse().join("/") : "—"
}

// Minimal CSV parser handling quoted fields and commas inside quotes.
function parseCSV(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ""
  let inQuotes = false
  const t = text.replace(/^﻿/, "")
  for (let i = 0; i < t.length; i++) {
    const c = t[i]
    if (inQuotes) {
      if (c === '"') {
        if (t[i + 1] === '"') { field += '"'; i++ } else inQuotes = false
      } else field += c
    } else if (c === '"') inQuotes = true
    else if (c === ",") { row.push(field); field = "" }
    else if (c === "\n") { row.push(field); rows.push(row); row = []; field = "" }
    else if (c === "\r") { /* skip */ }
    else field += c
  }
  if (field !== "" || row.length) { row.push(field); rows.push(row) }
  return rows.filter(r => r.some(c => c.trim() !== ""))
}

interface ParsedRow { roller_name: string; category: string | null; qty_sold: number }

// The report may split one product across variant rows; sum by product name.
function extractRows(text: string): ParsedRow[] {
  const rows = parseCSV(text)
  if (!rows.length) return []
  const header = rows[0].map(h => h.trim().toLowerCase())
  const iName = header.indexOf("product name")
  const iQty = header.indexOf("qty sold")
  const iCat = header.indexOf("reporting category")
  if (iName < 0 || iQty < 0) return []
  const acc = new Map<string, ParsedRow>()
  for (let r = 1; r < rows.length; r++) {
    const cells = rows[r]
    const name = (cells[iName] ?? "").trim()
    if (!name) continue
    const qty = Number((cells[iQty] ?? "").trim().replace(",", ".")) || 0
    const cat = iCat >= 0 ? (cells[iCat] ?? "").trim() || null : null
    const prev = acc.get(name)
    if (prev) prev.qty_sold += qty
    else acc.set(name, { roller_name: name, category: cat, qty_sold: qty })
  }
  return [...acc.values()].sort((a, b) => a.roller_name.localeCompare(b.roller_name))
}

export default function VentesPage() {
  const { siteId: SITE_ID } = useSite()
  const [products, setProducts] = useState<Product[]>([])
  const [imports, setImports] = useState<SalesImport[]>([])
  const [aliases, setAliases] = useState<Record<string, RollerAlias>>({})
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<SalesImport | null>(null)
  const [lines, setLines] = useState<SalesLine[]>([])
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [applying, setApplying] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

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
        const [prods, imps, als] = await Promise.all([
          productsRepo.getAll(SITE_ID), salesRepo.list(SITE_ID), salesRepo.getAliases(SITE_ID),
        ])
        if (!alive) return
        setProducts(prods); setImports(imps); setAliases(als)
        if (imps.length) void openImport(imps[0])
      } catch (e) { console.error(e) } finally { if (alive) setLoading(false) }
    })()
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [SITE_ID])

  const openImport = async (imp: SalesImport) => {
    setSelected(imp)
    setLoadingDetail(true)
    try { setLines(await salesRepo.getLines(imp.id)) }
    catch (e) { console.error(e) } finally { setLoadingDetail(false) }
  }

  const onFile = async (file: File) => {
    try {
      const text = await file.text()
      const parsed = extractRows(text)
      if (!parsed.length) { window.alert("Fichier illisible : colonnes « Product Name » et « Qty Sold » introuvables."); return }
      const today = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Paris" })
      const imp = await salesRepo.create({
        site_id: SITE_ID, source_file: file.name,
        label: file.name.replace(/\.csv$/i, ""), period_date: today,
      })
      // Pre-fill product mapping + deductible from remembered aliases.
      const rows = parsed.map(p => {
        const a = aliases[p.roller_name]
        return {
          roller_name: p.roller_name, category: p.category, qty_sold: p.qty_sold,
          product_id: a?.product_id ?? null, deductible: a ? a.deductible : true,
        }
      })
      const created = await salesRepo.addLines(imp.id, rows)
      setImports(prev => [imp, ...prev])
      setSelected(imp)
      setLines(created.sort((a, b) => a.roller_name.localeCompare(b.roller_name)))
    } catch (e: any) { console.error(e); window.alert(`Erreur : ${e?.message ?? e}`) }
    finally { if (fileRef.current) fileRef.current.value = "" }
  }

  const patchLine = (id: string, patch: Partial<SalesLine>) => {
    setLines(prev => prev.map(l => l.id === id ? { ...l, ...patch } : l))
    salesRepo.updateLine(id, patch).catch(console.error)
  }

  const chooseProduct = (line: SalesLine, product_id: string | null) => {
    patchLine(line.id, { product_id })
    salesRepo.rememberAlias(SITE_ID, line.roller_name, product_id, line.deductible).catch(console.error)
    setAliases(prev => ({ ...prev, [line.roller_name]: { ...(prev[line.roller_name] ?? {} as RollerAlias), site_id: SITE_ID, roller_name: line.roller_name, product_id, deductible: line.deductible } }))
  }

  const toggleDeductible = (line: SalesLine, deductible: boolean) => {
    patchLine(line.id, { deductible })
    salesRepo.rememberAlias(SITE_ID, line.roller_name, line.product_id, deductible).catch(console.error)
    setAliases(prev => ({ ...prev, [line.roller_name]: { ...(prev[line.roller_name] ?? {} as RollerAlias), site_id: SITE_ID, roller_name: line.roller_name, product_id: line.product_id, deductible } }))
  }

  const deleteImport = async (imp: SalesImport) => {
    if (imp.status === "applied") { window.alert("Import déjà appliqué : impossible de le supprimer (le stock a été déduit)."); return }
    if (!window.confirm(`Supprimer l'import « ${imp.label ?? frDate(imp.period_date)} » ?`)) return
    try {
      await salesRepo.remove(imp.id)
      setImports(prev => {
        const next = prev.filter(x => x.id !== imp.id)
        if (selected?.id === imp.id) { if (next.length) void openImport(next[0]); else { setSelected(null); setLines([]) } }
        return next
      })
    } catch (e) { console.error(e) }
  }

  const deductLines = lines.filter(l => l.deductible && l.product_id && (l.qty_sold ?? 0) > 0)

  const apply = async () => {
    if (!selected) return
    if (!window.confirm(`Appliquer les ventes ? Le stock de ${deductLines.length} produit(s) sera déduit.`)) return
    setApplying(true)
    try {
      // Sum deductions per product, then subtract from theoretical stock.
      const deltas = new Map<string, number>()
      for (const l of deductLines) deltas.set(l.product_id!, (deltas.get(l.product_id!) ?? 0) + (l.qty_sold as number))
      const updates = new Map<string, number>()
      for (const [pid, sold] of deltas) {
        const p = productById.get(pid); if (!p) continue
        updates.set(pid, (p.stock ?? 0) - sold)
      }
      await Promise.all([...updates.entries()].map(([pid, stock]) => productsRepo.update(pid, { stock })))
      await salesRepo.update(selected.id, { status: "applied" })
      setProducts(prev => prev.map(p => updates.has(p.id) ? { ...p, stock: updates.get(p.id)! } : p))
      const updated = { ...selected, status: "applied" as const }
      setSelected(updated)
      setImports(prev => prev.map(i => i.id === updated.id ? updated : i))
    } catch (e: any) { console.error(e); window.alert(`Erreur : ${e?.message ?? e}`) } finally { setApplying(false) }
  }

  if (loading) return <div className="text-center py-20 text-slate-500">Chargement…</div>

  const isApplied = selected?.status === "applied"
  const matchedCount = lines.filter(l => l.product_id).length
  const nonDeductibleCount = lines.filter(l => !l.deductible).length

  return (
    <div className="space-y-6 max-w-[1200px]">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          <Link href="/cadencier" className="text-slate-400 hover:text-white flex items-center gap-1.5 text-sm">
            <ArrowLeft className="w-4 h-4" /> Cadencier
          </Link>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <ShoppingCart className="w-6 h-6 text-rose-400" /> Ventes Roller
          </h1>
        </div>
        <div>
          <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) void onFile(f) }} />
          <Button size="sm" onClick={() => fileRef.current?.click()}>
            <FileUp className="w-4 h-4 mr-1.5" /> Importer un CSV
          </Button>
        </div>
      </div>

      <p className="text-xs text-slate-500">
        Exportez le rapport <span className="text-slate-300">« Product Revenue »</span> depuis Roller (CSV), puis importez-le ici.
        Chaque produit vendu est associé une fois à un produit du cadencier — l&apos;association est mémorisée pour les prochains imports.
      </p>

      {imports.length === 0 ? (
        <div className="bg-slate-800/50 border border-dashed border-slate-600 rounded-xl px-4 py-8 text-center text-slate-400">
          Aucun import. Cliquez sur <span className="text-slate-200">Importer un CSV</span>.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] gap-5">
          {/* List */}
          <div className="space-y-2">
            {imports.map(imp => {
              const isSel = selected?.id === imp.id
              return (
                <div key={imp.id} className={`flex items-center rounded-xl border transition-colors ${isSel ? "bg-rose-500/10 border-rose-500/40" : "bg-slate-800 border-slate-700 hover:bg-slate-700/50"}`}>
                  <button onClick={() => openImport(imp)} className="flex-1 text-left px-3 py-2.5 min-w-0">
                    <div className="text-sm font-semibold text-white truncate">{imp.label || "Import"}</div>
                    <div className="text-xs text-slate-400 mt-0.5 flex items-center gap-2 flex-wrap">
                      <span>{frDate(imp.period_date)}</span>
                      <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${imp.status === "applied" ? "bg-green-500/15 text-green-400" : "bg-amber-500/15 text-amber-400"}`}>
                        {imp.status === "applied" ? "Appliqué" : "Brouillon"}
                      </span>
                    </div>
                  </button>
                  <button onClick={() => deleteImport(imp)} className="px-2.5 self-stretch text-slate-600 hover:text-red-400 transition-colors"><Trash2 className="w-4 h-4" /></button>
                </div>
              )
            })}
          </div>

          {/* Detail */}
          <div>
            {!selected ? (
              <div className="text-slate-500 text-sm py-8 text-center">Sélectionnez un import.</div>
            ) : (
              <>
                <div className="flex items-center gap-2 mb-3 text-xs flex-wrap">
                  <span className="px-2 py-1 rounded-full bg-slate-800 border border-slate-700 text-slate-300">{lines.length} produits vendus</span>
                  <span className="px-2 py-1 rounded-full bg-slate-800 border border-slate-700 text-slate-300">{matchedCount} associés</span>
                  <span className="px-2 py-1 rounded-full bg-slate-800 border border-slate-700 text-slate-400">{nonDeductibleCount} non déductibles</span>
                </div>

                {isApplied && (
                  <div className="mb-3 text-sm text-green-400 bg-green-500/10 border border-green-500/30 rounded-lg px-3 py-2">
                    Import appliqué — le stock a été déduit.
                  </div>
                )}

                <div className="bg-slate-800/40 border border-slate-700 rounded-xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-700 text-[11px] text-slate-500 uppercase tracking-wider">
                          <th className="text-left px-3 py-2 font-semibold">Produit Roller</th>
                          <th className="text-right px-2 py-2 font-semibold text-rose-400">Vendu</th>
                          <th className="text-left px-2 py-2 font-semibold">→ Produit cadencier</th>
                          <th className="text-center px-2 py-2 font-semibold">Déduire</th>
                          <th className="text-right px-3 py-2 font-semibold">Stock</th>
                        </tr>
                      </thead>
                      <tbody>
                        {loadingDetail ? (
                          <tr><td colSpan={5} className="text-center text-slate-500 py-8">Chargement…</td></tr>
                        ) : lines.length === 0 ? (
                          <tr><td colSpan={5} className="text-center text-slate-500 py-8">Aucune ligne.</td></tr>
                        ) : lines.map(l => {
                          const p = l.product_id ? productById.get(l.product_id) : null
                          return (
                            <tr key={l.id} className={`border-b border-slate-700/40 ${!l.deductible ? "opacity-50" : ""}`}>
                              <td className="px-3 py-2">
                                <div className="text-slate-200">{l.roller_name}</div>
                                {l.category && <div className="text-[10px] text-slate-500">{l.category}</div>}
                              </td>
                              <td className="px-2 py-2 text-right text-rose-300 font-semibold whitespace-nowrap">{l.qty_sold ?? 0}</td>
                              <td className="px-2 py-2">
                                <select value={l.product_id ?? ""} disabled={isApplied}
                                  onChange={e => chooseProduct(l, e.target.value || null)}
                                  className="max-w-[240px] text-xs px-2 py-1 rounded border bg-slate-800 text-slate-200 border-slate-700 focus:outline-none focus:border-rose-500">
                                  <option value="">— non associé —</option>
                                  {productOptions.map(op => <option key={op.id} value={op.id}>{op.supplier} — {op.name}</option>)}
                                </select>
                              </td>
                              <td className="px-2 py-2 text-center">
                                <input type="checkbox" checked={l.deductible} disabled={isApplied}
                                  onChange={e => toggleDeductible(l, e.target.checked)} className="w-4 h-4 accent-rose-500" />
                              </td>
                              <td className="px-3 py-2 text-right whitespace-nowrap">
                                {p ? (
                                  <span className={`font-semibold ${(p.stock ?? 0) < 0 ? "text-red-400" : "text-slate-200"}`}>
                                    {p.stock ?? 0}<span className="text-[10px] text-slate-500 ml-1">{p.unit ?? ""}</span>
                                  </span>
                                ) : <span className="text-slate-600">—</span>}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {!isApplied && (
                  <div className="flex items-center justify-end gap-3 mt-3">
                    <Button size="sm" onClick={apply} disabled={applying || deductLines.length === 0} className="bg-rose-600 hover:bg-rose-500">
                      <Check className="w-4 h-4 mr-1.5" /> Appliquer — −{deductLines.length} produit(s) du stock
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      <p className="text-xs text-slate-500 flex items-center gap-1.5">
        <TrendingDown className="w-3.5 h-3.5" /> L&apos;application déduit les quantités vendues du stock théorique de chaque produit associé et déductible. Décochez « Déduire » pour les produits non quantifiables (fontaine, BIB, sirops…).
      </p>
    </div>
  )
}
