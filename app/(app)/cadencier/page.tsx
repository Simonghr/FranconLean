"use client"
import { useState, useEffect, useMemo, useRef } from "react"
import Link from "next/link"
import { ClipboardList, Search, Plus, Trash2, GripVertical, PackageCheck, FilePlus2, Save, Check, Clock, User, History, Truck, ShoppingCart, ChefHat, Pencil, ChevronUp, ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import * as productsRepo from "@/lib/repositories/products"
import { useSite } from "@/lib/context/SiteContext"
import type { Product, CountSession } from "@/lib/types"

const NO_ZONE = "Sans zone"

function parseNum(v: string): number | null {
  const t = v.trim().replace(",", ".")
  if (t === "") return null
  const n = Number(t)
  return isNaN(n) ? null : n
}
function nowParts() {
  const d = new Date()
  return {
    date: d.toLocaleDateString("en-CA", { timeZone: "Europe/Paris" }),
    time: d.toLocaleTimeString("fr-FR", { timeZone: "Europe/Paris", hour: "2-digit", minute: "2-digit" }),
  }
}

type GroupBy = "zone" | "supplier"

export default function CadencierPage() {
  const { siteId: SITE_ID } = useSite()
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [groupBy, setGroupBy] = useState<GroupBy>("zone")
  const [supplierFilter, setSupplierFilter] = useState<string>("all")
  const [zoneFilter, setZoneFilter] = useState<string>("all")
  // A ref (not state) so dragging triggers NO re-render mid-dragstart, which
  // would mutate the dragged DOM node and freeze the browser's drag.
  const dragIdRef = useRef<string | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const toggleSelect = (id: string) =>
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  const clearSelect = () => setSelected(new Set())

  // ── Saisie session ──────────────────────────────────────────────────────
  const [session, setSession] = useState<CountSession | null>(null)
  const [qty, setQty] = useState<Record<string, number | null>>({})
  const [newOpen, setNewOpen] = useState(false)
  const [saveOpen, setSaveOpen] = useState(false)
  const [form, setForm] = useState(() => ({ ...nowParts(), first: "", last: "" }))
  const [addOpen, setAddOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [addForm, setAddForm] = useState({ name: "", supplier: "", zone: "", unit: "", temporary: false })

  useEffect(() => {
    let alive = true
    setLoading(true)
    ;(async () => {
      try {
        const prods = await productsRepo.getAll(SITE_ID)
        if (!alive) return
        setProducts(prods)
        const s = await productsRepo.getActiveSession(SITE_ID)
        if (!alive) return
        setSession(s)
        if (s) {
          const lines = await productsRepo.getLines(s.id)
          const map: Record<string, number | null> = {}
          for (const l of lines) map[l.product_id] = l.quantity
          setQty(map)
        } else {
          setQty({})
        }
      } catch (e) { console.error(e) } finally { if (alive) setLoading(false) }
    })()
    return () => { alive = false }
  }, [SITE_ID])

  const suppliers = useMemo(
    () => [...new Set(products.map(p => p.supplier))].sort((a, b) => a.localeCompare(b)),
    [products]
  )
  const zones = useMemo(
    () => [...new Set(products.map(p => p.zone).filter(Boolean) as string[])].sort((a, b) => a.localeCompare(b)),
    [products]
  )
  // Zone options for the filter, including "Sans zone" when some products have none.
  const zoneOptions = useMemo(
    () => [...new Set(products.map(p => p.zone || NO_ZONE))].sort((a, b) => a.localeCompare(b)),
    [products]
  )
  const unitOptions = useMemo(
    () => [...new Set(products.map(p => p.unit).filter(Boolean) as string[])].sort((a, b) => a.localeCompare(b)),
    [products]
  )

  const patchProduct = (id: string, p: Partial<Product>) => {
    setProducts(prev => prev.map(x => (x.id === id ? { ...x, ...p } : x)))
    productsRepo.update(id, p).catch(console.error)
  }

  const setQuantity = (product_id: string, v: number | null) => {
    if (!session) return
    setQty(prev => ({ ...prev, [product_id]: v }))
    productsRepo.setLine(session.id, product_id, v).catch(console.error)
  }

  // ── Session actions ─────────────────────────────────────────────────────
  const startSession = async () => {
    try {
      const s = await productsRepo.createSession({
        site_id: SITE_ID,
        session_date: form.date,
        session_time: form.time || null,
        author_first: form.first.trim() || null,
        author_last: form.last.trim() || null,
      })
      setSession(s)
      setQty({})
      setNewOpen(false)
    } catch (e: any) {
      console.error(e)
      window.alert(`Impossible de démarrer la saisie : ${e?.message ?? e}`)
    }
  }

  const saveTemporary = async () => {
    if (!session) return
    try { await productsRepo.updateSession(session.id, { status: "draft" }) } catch (e) { console.error(e) }
    setSaveOpen(false)
  }
  const validateSession = async () => {
    if (!session) return
    try {
      // Complete the saisie: every product without a value is recorded as 0.
      const missing = products.filter(p => qty[p.id] == null)
      await Promise.all(missing.map(p => productsRepo.setLine(session.id, p.id, 0)))
      await productsRepo.updateSession(session.id, { status: "validated" })
    } catch (e) { console.error(e) }
    setSession(null)
    setQty({})
    setSaveOpen(false)
  }

  const openEdit = (p: Product) => {
    setEditId(p.id)
    setAddForm({
      name: p.name, supplier: p.supplier ?? "", zone: p.zone ?? "",
      unit: p.unit ?? "", temporary: p.temporary,
    })
    setAddOpen(true)
  }

  const submitAddProduct = async () => {
    const name = addForm.name.trim()
    if (!name) return
    const patch = {
      name,
      supplier: addForm.supplier.trim() || "Divers",
      zone: addForm.zone.trim() || null,
      unit: addForm.unit.trim() || null,
      temporary: addForm.temporary,
    }
    try {
      if (editId) {
        const updated = await productsRepo.update(editId, patch)
        setProducts(prev => prev.map(p => p.id === editId ? updated : p))
      } else {
        const maxPos = products.reduce((m, p) => Math.max(m, p.position), 0)
        const created = await productsRepo.create({ site_id: SITE_ID, position: maxPos + 10, ...patch })
        setProducts(prev => [...prev, created])
      }
      setAddOpen(false); setEditId(null)
    } catch (e: any) {
      console.error(e)
      window.alert(`Impossible d'enregistrer le produit : ${e?.message ?? e}`)
    }
  }
  const deleteProduct = async (p: Product) => {
    if (!window.confirm(`Supprimer « ${p.name} » ?`)) return
    try {
      await productsRepo.remove(p.id)
      setProducts(prev => prev.filter(x => x.id !== p.id))
    } catch (e) { console.error(e) }
  }

  const handleDrop = async (targetId: string) => {
    const dragId = dragIdRef.current
    dragIdRef.current = null
    if (!dragId) return
    // Move the whole selection if the dragged row is part of it; else just it.
    const moving = selected.has(dragId) && selected.size > 1 ? [...selected] : [dragId]
    if (moving.includes(targetId)) return
    const before = new Map(products.map(p => [p.id, p.position]))
    const ordered = [...products].sort((a, b) => a.position - b.position)
    if (!ordered.some(p => p.id === targetId)) return
    const targetZone = ordered.find(p => p.id === targetId)!.zone ?? null
    const movingSet = new Set(moving)
    const block = ordered.filter(p => movingSet.has(p.id)) // keeps their relative order
    const rest = ordered.filter(p => !movingSet.has(p.id))
    const insertAt = rest.findIndex(p => p.id === targetId)
    if (insertAt === -1) return
    const newOrder = [...rest.slice(0, insertAt), ...block, ...rest.slice(insertAt)]
    const reZoned = newOrder.map(p => (movingSet.has(p.id) && groupBy === "zone" ? { ...p, zone: targetZone } : p))
    const withPos = reZoned.map((p, i) => ({ ...p, position: (i + 1) * 10 }))
    setProducts(withPos)
    clearSelect()
    try {
      // Only persist the rows whose position actually changed.
      const changed = withPos.filter(p => before.get(p.id) !== p.position)
      await productsRepo.savePositions(changed.map(p => ({ id: p.id, position: p.position })))
      if (groupBy === "zone") {
        const zoneChanges = block.filter(p => (p.zone ?? null) !== targetZone)
        await Promise.all(zoneChanges.map(p => productsRepo.update(p.id, { zone: targetZone })))
      }
    } catch (e) { console.error(e) }
  }

  // Bulk-reassign the zone of every selected product.
  const moveSelectedToZone = async (zone: string) => {
    const ids = [...selected]
    if (!ids.length) return
    setProducts(prev => prev.map(p => selected.has(p.id) ? { ...p, zone } : p))
    clearSelect()
    try { await Promise.all(ids.map(id => productsRepo.update(id, { zone }))) }
    catch (e) { console.error(e) }
  }

  // Move a product up/down among the products of its own group (touch-friendly
  // alternative to drag & drop, which native HTML5 DnD can't do on tablets).
  const moveProduct = async (p: Product, dir: -1 | 1) => {
    const key = (x: Product) => (groupBy === "zone" ? (x.zone || NO_ZONE) : x.supplier)
    const group = [...products].filter(x => key(x) === key(p)).sort((a, b) => a.position - b.position)
    const idx = group.findIndex(x => x.id === p.id)
    const swap = group[idx + dir]
    if (!swap) return
    const pPos = p.position, sPos = swap.position
    setProducts(prev => prev.map(x =>
      x.id === p.id ? { ...x, position: sPos } : x.id === swap.id ? { ...x, position: pPos } : x
    ))
    try {
      await Promise.all([
        productsRepo.update(p.id, { position: sPos }),
        productsRepo.update(swap.id, { position: pPos }),
      ])
    } catch (e) { console.error(e) }
  }

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    return products
      .filter(p =>
        groupBy === "zone"
          ? zoneFilter === "all" || (p.zone || NO_ZONE) === zoneFilter
          : supplierFilter === "all" || p.supplier === supplierFilter
      )
      .filter(p => !q || p.name.toLowerCase().includes(q) || p.supplier.toLowerCase().includes(q))
      .sort((a, b) => a.position - b.position)
  }, [products, search, supplierFilter, zoneFilter, groupBy])

  const groups = useMemo(() => {
    const map = new Map<string, Product[]>()
    for (const p of visible) {
      const key = groupBy === "zone" ? (p.zone || NO_ZONE) : p.supplier
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(p)
    }
    return [...map.entries()]
  }, [visible, groupBy])

  const filledCount = Object.values(qty).filter(v => v != null).length
  const active = !!session

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
            {active
              ? `Saisie en cours · ${filledCount}/${products.length} renseignés`
              : "Démarrez une nouvelle saisie pour compter le stock"}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Link href="/cadencier/reception">
            <Button variant="outline" size="sm">
              <Truck className="w-4 h-4 mr-1.5" /> Réceptions
            </Button>
          </Link>
          <Link href="/cadencier/ventes">
            <Button variant="outline" size="sm">
              <ShoppingCart className="w-4 h-4 mr-1.5" /> Ventes
            </Button>
          </Link>
          <Link href="/cadencier/recettes">
            <Button variant="outline" size="sm">
              <ChefHat className="w-4 h-4 mr-1.5" /> Recettes
            </Button>
          </Link>
          <Link href="/cadencier/historique">
            <Button variant="outline" size="sm">
              <History className="w-4 h-4 mr-1.5" /> Historique
            </Button>
          </Link>
          <Button variant="outline" size="sm" onClick={() => {
            setEditId(null)
            setAddForm({ name: "", supplier: suppliers[0] ?? "", zone: "", unit: "", temporary: false })
            setAddOpen(true)
          }}>
            <Plus className="w-4 h-4 mr-1.5" /> Produit
          </Button>
          <Button size="sm" variant="outline" onClick={() => { setForm({ ...nowParts(), first: "", last: "" }); setNewOpen(true) }}>
            <FilePlus2 className="w-4 h-4 mr-1.5" /> Nouvelle saisie
          </Button>
          <Button size="sm" onClick={() => setSaveOpen(true)} disabled={!active}>
            <Save className="w-4 h-4 mr-1.5" /> Enregistrer
          </Button>
        </div>
      </div>

      {/* Active session banner */}
      {active && (
        <div className="flex items-center gap-4 flex-wrap bg-cyan-500/10 border border-cyan-500/30 rounded-xl px-4 py-2.5 text-sm">
          <span className="text-cyan-300 font-semibold flex items-center gap-1.5">
            <ClipboardList className="w-4 h-4" /> Saisie du {session!.session_date.split("-").reverse().join("/")}
          </span>
          {(session!.author_first || session!.author_last) && (
            <span className="text-slate-300 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-slate-400" /> {[session!.author_first, session!.author_last].filter(Boolean).join(" ")}
            </span>
          )}
          {session!.session_time && (
            <span className="text-slate-300 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-slate-400" /> {session!.session_time}
            </span>
          )}
        </div>
      )}

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
        {groupBy === "zone" ? (
          <select
            value={zoneFilter}
            onChange={e => setZoneFilter(e.target.value)}
            className="text-sm px-3 py-2 rounded-lg border bg-slate-800 text-slate-300 border-slate-700 focus:outline-none focus:border-cyan-500"
          >
            <option value="all">Toutes les zones</option>
            {zoneOptions.map(z => <option key={z} value={z}>{z}</option>)}
          </select>
        ) : (
          <select
            value={supplierFilter}
            onChange={e => setSupplierFilter(e.target.value)}
            className="text-sm px-3 py-2 rounded-lg border bg-slate-800 text-slate-300 border-slate-700 focus:outline-none focus:border-cyan-500"
          >
            <option value="all">Tous les fournisseurs</option>
            {suppliers.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        )}
      </div>

      {!active && (
        <div className="bg-slate-800/50 border border-dashed border-slate-600 rounded-xl px-4 py-3 text-sm text-slate-400">
          Aucune saisie en cours. Cliquez sur <span className="text-slate-200 font-medium">Nouvelle saisie</span> pour commencer à compter — les cases de quantité deviendront alors modifiables.
        </div>
      )}

      {groupBy === "zone" && (
        <p className="text-xs text-slate-500 -mt-2">
          Glissez <GripVertical className="w-3 h-3 inline" /> pour réordonner · déposez une ligne dans une autre zone pour l'y déplacer · cochez plusieurs produits pour les déplacer ensemble.
        </p>
      )}

      {/* Multi-selection action bar */}
      {groupBy === "zone" && selected.size > 0 && (
        <div className="flex items-center gap-3 flex-wrap bg-cyan-500/10 border border-cyan-500/40 rounded-xl px-4 py-2.5 text-sm sticky top-2 z-20 shadow-lg">
          <span className="text-cyan-200 font-semibold">{selected.size} produit{selected.size > 1 ? "s" : ""} sélectionné{selected.size > 1 ? "s" : ""}</span>
          <label className="flex items-center gap-2 text-slate-300">
            Déplacer vers
            <select defaultValue="" onChange={e => { if (e.target.value) { void moveSelectedToZone(e.target.value); e.currentTarget.value = "" } }}
              className="text-sm px-2.5 py-1.5 rounded-lg border bg-slate-800 text-slate-200 border-slate-700 focus:outline-none focus:border-cyan-500">
              <option value="" disabled>Choisir une zone…</option>
              {zoneOptions.map(z => <option key={z} value={z}>{z}</option>)}
            </select>
          </label>
          <span className="text-xs text-slate-400 hidden sm:inline">ou glissez un produit sélectionné pour déplacer tout le bloc</span>
          <button onClick={clearSelect} className="ml-auto text-slate-400 hover:text-white">Désélectionner</button>
        </div>
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
                onDragOver={e => { if (dragIdRef.current) e.preventDefault() }}
                onDrop={() => handleDrop(p.id)}
                className={`flex items-center gap-3 flex-wrap px-3 py-2.5 border-b border-slate-700/40 hover:bg-slate-700/20 transition-colors ${selected.has(p.id) ? "bg-cyan-500/10" : ""}`}
              >
                {groupBy === "zone" && (
                  <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggleSelect(p.id)}
                    title="Sélectionner" className="w-4 h-4 accent-cyan-500 flex-shrink-0" />
                )}
                {groupBy === "zone" && (
                  <span className="flex items-center flex-shrink-0">
                    <span
                      draggable
                      onDragStart={e => { dragIdRef.current = p.id; e.dataTransfer.effectAllowed = "move" }}
                      onDragEnd={() => { dragIdRef.current = null }}
                      title="Glisser pour déplacer"
                      className="text-slate-600 hover:text-slate-300 cursor-grab active:cursor-grabbing touch-none"
                    >
                      <GripVertical className="w-4 h-4" />
                    </span>
                    <span className="flex flex-col -my-1">
                      <button onClick={() => moveProduct(p, -1)} title="Monter" className="text-slate-600 hover:text-cyan-400 leading-none"><ChevronUp className="w-3.5 h-3.5" /></button>
                      <button onClick={() => moveProduct(p, 1)} title="Descendre" className="text-slate-600 hover:text-cyan-400 leading-none"><ChevronDown className="w-3.5 h-3.5" /></button>
                    </span>
                  </span>
                )}

                <div className="flex-1 min-w-0">
                  <div className="text-slate-100 truncate flex items-center gap-1.5">
                    {p.name}
                    {p.temporary && (
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30 flex-shrink-0">
                        Temporaire
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-500 truncate">
                    {p.supplier}{p.unit ? ` · ${p.unit}` : ""}{p.note ? ` · ${p.note}` : ""}
                  </div>
                </div>

                <input
                  list="unit-list"
                  defaultValue={p.unit ?? ""}
                  onBlur={e => { const v = e.target.value.trim() || null; if (v !== p.unit) patchProduct(p.id, { unit: v }) }}
                  className="w-20 bg-transparent text-xs text-slate-400 border-b border-slate-700/60 sm:border-transparent hover:border-slate-600 focus:border-cyan-500 focus:outline-none text-right"
                  placeholder="unité"
                  title="Unité de comptage"
                />

                <input
                  list="zone-list"
                  defaultValue={p.zone ?? ""}
                  onBlur={e => { const v = e.target.value.trim() || null; if (v !== p.zone) patchProduct(p.id, { zone: v }) }}
                  className="w-24 bg-transparent text-xs text-slate-400 border-b border-slate-700/60 sm:border-transparent hover:border-slate-600 focus:border-cyan-500 focus:outline-none text-right"
                  placeholder="+ zone"
                />

                {/* Quantity */}
                <input
                  key={`${p.id}-${qty[p.id] ?? "e"}`}
                  defaultValue={qty[p.id] ?? ""}
                  disabled={!active}
                  onBlur={e => { const v = parseNum(e.target.value); if (v !== (qty[p.id] ?? null)) setQuantity(p.id, v) }}
                  inputMode="decimal"
                  title={active ? "" : "Démarrez une saisie pour renseigner la quantité"}
                  className={`w-20 flex-shrink-0 text-center rounded-md px-2 py-1.5 font-semibold border focus:outline-none disabled:opacity-40 disabled:cursor-not-allowed ${
                    qty[p.id] == null
                      ? "bg-slate-900 border-slate-600 text-white focus:border-cyan-500"
                      : "bg-cyan-500/10 border-cyan-500/40 text-cyan-300 focus:border-cyan-400"
                  }`}
                  placeholder="Qté"
                />

                <button onClick={() => openEdit(p)} title="Modifier le produit" className="text-slate-600 hover:text-cyan-400 transition-colors flex-shrink-0">
                  <Pencil className="w-3.5 h-3.5" />
                </button>
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
      <datalist id="unit-list">
        {unitOptions.map(u => <option key={u} value={u} />)}
      </datalist>
      <datalist id="supplier-list">
        {suppliers.map(s => <option key={s} value={s} />)}
      </datalist>

      {products.length === 0 && (
        <div className="text-center text-slate-500 py-12">Aucun produit. Cliquez sur « Produit ».</div>
      )}

      {/* ── Add product modal ── */}
      {addOpen && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={() => { setAddOpen(false); setEditId(null) }}>
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              {editId ? <><Pencil className="w-5 h-5 text-cyan-400" /> Modifier le produit</> : <><Plus className="w-5 h-5 text-cyan-400" /> Ajouter un produit</>}
            </h3>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Nom du produit</Label>
                <Input autoFocus value={addForm.name} onChange={e => setAddForm(f => ({ ...f, name: e.target.value }))}
                  onKeyDown={e => { if (e.key === "Enter") submitAddProduct() }} placeholder="Nom du produit" />
              </div>
              <div className="space-y-1.5">
                <Label>Fournisseur</Label>
                <Input list="supplier-list" value={addForm.supplier}
                  onChange={e => setAddForm(f => ({ ...f, supplier: e.target.value }))}
                  placeholder="Choisir ou saisir un nouveau fournisseur…" />
                <p className="text-[11px] text-slate-500">Tapez un nom pour créer un nouveau fournisseur (ex. Nespresso).</p>
              </div>
              <div className="space-y-1.5">
                <Label>Zone</Label>
                <Input list="zone-list" value={addForm.zone}
                  onChange={e => setAddForm(f => ({ ...f, zone: e.target.value }))}
                  placeholder="Choisir ou saisir une nouvelle zone…" />
                <p className="text-[11px] text-slate-500">Laissez vide pour « sans zone », ou tapez un nom pour créer une nouvelle zone.</p>
              </div>
              <div className="space-y-1.5">
                <Label>Unité de comptage</Label>
                <Input list="unit-list" value={addForm.unit}
                  onChange={e => setAddForm(f => ({ ...f, unit: e.target.value }))}
                  placeholder="ex. bouteille, pièce, kg…" />
              </div>
              <label className="flex items-center gap-2.5 cursor-pointer pt-1">
                <input type="checkbox" checked={addForm.temporary}
                  onChange={e => setAddForm(f => ({ ...f, temporary: e.target.checked }))}
                  className="w-4 h-4 accent-amber-500" />
                <span className="text-sm text-slate-300">Produit temporaire</span>
              </label>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={() => { setAddOpen(false); setEditId(null) }}>Annuler</Button>
              <Button onClick={submitAddProduct} disabled={!addForm.name.trim()} className="bg-cyan-600 hover:bg-cyan-500">{editId ? "Enregistrer" : "Ajouter"}</Button>
            </div>
          </div>
        </div>
      )}

      {/* ── New saisie modal ── */}
      {newOpen && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={() => setNewOpen(false)}>
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <FilePlus2 className="w-5 h-5 text-cyan-400" /> Nouvelle saisie
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Date</Label>
                <Input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Heure</Label>
                <Input type="time" value={form.time} onChange={e => setForm(f => ({ ...f, time: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Prénom</Label>
                <Input value={form.first} onChange={e => setForm(f => ({ ...f, first: e.target.value }))} placeholder="Prénom" />
              </div>
              <div className="space-y-1.5">
                <Label>Nom</Label>
                <Input value={form.last} onChange={e => setForm(f => ({ ...f, last: e.target.value }))} placeholder="Nom" />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={() => setNewOpen(false)}>Annuler</Button>
              <Button onClick={startSession} disabled={!form.date} className="bg-cyan-600 hover:bg-cyan-500">Démarrer</Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Save modal ── */}
      {saveOpen && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={() => setSaveOpen(false)}>
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Save className="w-5 h-5 text-cyan-400" /> Enregistrer la saisie
            </h3>
            <p className="text-sm text-slate-400">
              {filledCount}/{products.length} produits renseignés.
              {filledCount < products.length && (
                <span className="text-amber-400"> À la validation, les {products.length - filledCount} produits non renseignés seront enregistrés à 0.</span>
              )}
            </p>
            <p className="text-xs text-slate-500">
              Enregistrez temporairement pour reprendre plus tard, ou validez pour clôturer la saisie (toutes les cases doivent alors avoir une valeur — 0 si rien en stock).
            </p>
            <div className="flex flex-col gap-2 pt-1">
              <Button variant="outline" onClick={saveTemporary} className="justify-start">
                <Clock className="w-4 h-4 mr-2 text-slate-400" /> Enregistrer temporairement
              </Button>
              <Button onClick={validateSession} className="justify-start bg-green-600 hover:bg-green-500">
                <Check className="w-4 h-4 mr-2" /> Valider la saisie
              </Button>
              <Button variant="ghost" onClick={() => setSaveOpen(false)} className="justify-center text-slate-400">Annuler</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
