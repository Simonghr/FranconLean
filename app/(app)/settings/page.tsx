"use client"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Save, User, Bell, Database } from "lucide-react"

export default function SettingsPage() {
  const [saved, setSaved] = useState(false)
  const [profile, setProfile] = useState({
    name: "Simon Gohier",
    email: "simon.gohier@franconville.fr",
    role: "Directeur",
    site: "Franconville",
  })

  const handleSave = () => {
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-white">Paramètres</h1>
        <p className="text-slate-400 text-sm mt-1">Gérez votre profil et vos préférences</p>
      </div>

      {/* Profile */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl">
        <div className="flex items-center gap-2.5 px-5 py-4 border-b border-slate-700">
          <User className="w-4 h-4 text-blue-400" />
          <h3 className="font-semibold text-white">Profil utilisateur</h3>
        </div>
        <div className="p-5 space-y-4">
          <div className="flex items-center gap-4 mb-5">
            <div className="w-16 h-16 rounded-full bg-blue-600 flex items-center justify-center text-white text-2xl font-bold">
              {profile.name.charAt(0)}
            </div>
            <div>
              <div className="font-semibold text-white">{profile.name}</div>
              <div className="text-sm text-slate-400">{profile.role} — {profile.site}</div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Nom complet</Label>
              <Input value={profile.name} onChange={e => setProfile(p => ({ ...p, name: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input value={profile.email} onChange={e => setProfile(p => ({ ...p, email: e.target.value }))} />
            </div>
          </div>
          <Button onClick={handleSave} variant={saved ? "success" : "default"}>
            <Save className="w-4 h-4" />
            {saved ? "Enregistré !" : "Enregistrer"}
          </Button>
        </div>
      </div>

      {/* Notifications */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl">
        <div className="flex items-center gap-2.5 px-5 py-4 border-b border-slate-700">
          <Bell className="w-4 h-4 text-orange-400" />
          <h3 className="font-semibold text-white">Notifications</h3>
        </div>
        <div className="p-5 space-y-3">
          {[
            "Alertes incidents critiques",
            "Résumé quotidien par email",
            "Nouvelles idées Kaizen",
            "Rappels PDCA en retard",
          ].map(item => (
            <label key={item} className="flex items-center gap-3 cursor-pointer group">
              <div className="relative">
                <input type="checkbox" defaultChecked className="sr-only" />
                <div className="w-9 h-5 bg-blue-600 rounded-full" />
                <div className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform translate-x-4" />
              </div>
              <span className="text-sm text-slate-300">{item}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Supabase config */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl">
        <div className="flex items-center gap-2.5 px-5 py-4 border-b border-slate-700">
          <Database className="w-4 h-4 text-purple-400" />
          <h3 className="font-semibold text-white">Connexion Supabase</h3>
        </div>
        <div className="p-5 space-y-4">
          <div className="space-y-2">
            <Label>NEXT_PUBLIC_SUPABASE_URL</Label>
            <Input placeholder="https://xxxx.supabase.co" className="font-mono text-xs" />
          </div>
          <div className="space-y-2">
            <Label>NEXT_PUBLIC_SUPABASE_ANON_KEY</Label>
            <Input placeholder="eyJ..." type="password" className="font-mono text-xs" />
          </div>
          <p className="text-xs text-slate-500">
            Ces variables doivent être définies dans votre fichier .env.local pour activer la synchronisation avec Supabase.
          </p>
        </div>
      </div>
    </div>
  )
}
