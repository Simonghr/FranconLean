"use client"
import { useEffect, useState } from "react"
import { Users, UserPlus, KeyRound, Trash2, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/lib/context/AuthContext"

interface Row { id: string; name: string | null; email: string | null; role: string }

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin", director: "Directeur", site_director: "Directeur de site", manager: "Manager",
  collaborator: "Collaborateur", staff: "Staff (comptage)",
}
const ROLES = ["admin", "director", "site_director", "manager", "collaborator", "staff"]
const RESTRICTED = ["collaborator", "staff"]

async function callApi(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke("manage-users", { body })
  if (error) {
    let msg = error.message
    try { const j = await (error as any).context.json(); if (j?.error) msg = j.error } catch { /* ignore */ }
    throw new Error(msg)
  }
  if (data?.error) throw new Error(data.error)
  return data
}

export function UsersAdmin() {
  const { role } = useAuth()
  // Manager = any role that isn't one of the restricted ones.
  const canManage = !!role && !RESTRICTED.includes(role)
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState({ email: "", password: "", name: "", role: "staff" })

  const load = async () => {
    setLoading(true); setError(null)
    try { const d = await callApi({ action: "list" }); setRows(d.users ?? []) }
    catch (e: any) { setError(e.message) } finally { setLoading(false) }
  }

  useEffect(() => { if (canManage) load(); else setLoading(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canManage])

  if (!canManage) return null

  const create = async () => {
    if (!form.email.trim() || !form.password) { setError("Email et mot de passe requis"); return }
    setBusy(true); setError(null)
    try {
      await callApi({ action: "create", ...form })
      setForm({ email: "", password: "", name: "", role: "staff" })
      await load()
    } catch (e: any) { setError(e.message) } finally { setBusy(false) }
  }

  const changeRole = async (id: string, newRole: string) => {
    setRows(prev => prev.map(r => r.id === id ? { ...r, role: newRole } : r))
    try { await callApi({ action: "set_role", id, role: newRole }) }
    catch (e: any) { setError(e.message); load() }
  }

  const resetPassword = async (r: Row) => {
    const pw = window.prompt(`Nouveau mot de passe pour ${r.email ?? r.name} (6 caractères min.) :`)
    if (!pw) return
    try { await callApi({ action: "set_password", id: r.id, password: pw }); window.alert("Mot de passe mis à jour.") }
    catch (e: any) { setError(e.message) }
  }

  const remove = async (r: Row) => {
    if (!window.confirm(`Supprimer le compte ${r.email ?? r.name} ? Cette action est définitive.`)) return
    try { await callApi({ action: "delete", id: r.id }); setRows(prev => prev.filter(x => x.id !== r.id)) }
    catch (e: any) { setError(e.message) }
  }

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl">
      <div className="flex items-center gap-2.5 px-5 py-4 border-b border-slate-700">
        <Users className="w-4 h-4 text-cyan-400" />
        <h3 className="font-semibold text-white">Utilisateurs & accès</h3>
      </div>
      <div className="p-5 space-y-5">
        {error && <div className="text-sm text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">{error}</div>}

        {/* Create */}
        <div className="bg-slate-900/50 border border-slate-700 rounded-lg p-4 space-y-3">
          <div className="text-sm font-semibold text-white flex items-center gap-2"><UserPlus className="w-4 h-4 text-cyan-400" /> Nouveau compte</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Email</Label>
              <Input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="prenom@nikito.com" /></div>
            <div className="space-y-1.5"><Label>Nom affiché</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Prénom Nom" /></div>
            <div className="space-y-1.5"><Label>Mot de passe</Label>
              <Input value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder="6 caractères min." /></div>
            <div className="space-y-1.5"><Label>Rôle</Label>
              <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                className="w-full text-sm px-3 py-2 rounded-lg border bg-slate-800 text-slate-200 border-slate-700 focus:outline-none focus:border-cyan-500">
                {ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
              </select></div>
          </div>
          <Button size="sm" onClick={create} disabled={busy}>
            {busy ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <UserPlus className="w-4 h-4 mr-1.5" />} Créer le compte
          </Button>
        </div>

        {/* List */}
        {loading ? (
          <div className="text-slate-500 text-sm py-4 text-center">Chargement…</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700 text-[11px] text-slate-500 uppercase tracking-wider">
                  <th className="text-left px-2 py-2 font-semibold">Nom / Email</th>
                  <th className="text-left px-2 py-2 font-semibold">Rôle</th>
                  <th className="text-right px-2 py-2 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.id} className="border-b border-slate-700/40">
                    <td className="px-2 py-2">
                      <div className="text-slate-200">{r.name ?? "—"}</div>
                      <div className="text-[11px] text-slate-500">{r.email ?? ""}</div>
                    </td>
                    <td className="px-2 py-2">
                      <select value={r.role} onChange={e => changeRole(r.id, e.target.value)}
                        className="text-xs px-2 py-1 rounded border bg-slate-800 text-slate-200 border-slate-700 focus:outline-none focus:border-cyan-500">
                        {ROLES.map(role => <option key={role} value={role}>{ROLE_LABELS[role]}</option>)}
                      </select>
                    </td>
                    <td className="px-2 py-2">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => resetPassword(r)} title="Réinitialiser le mot de passe" className="text-slate-500 hover:text-cyan-400"><KeyRound className="w-4 h-4" /></button>
                        <button onClick={() => remove(r)} title="Supprimer" className="text-slate-500 hover:text-red-400"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && <tr><td colSpan={3} className="text-center text-slate-500 py-4">Aucun utilisateur.</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
