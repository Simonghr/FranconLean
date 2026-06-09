"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { Activity, TrendingUp, Shield, Users, Eye, EyeOff, Star } from "lucide-react"
import { createClient } from "@/lib/supabase/client"

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError("Identifiants incorrects. Vérifiez votre email et mot de passe.")
      setLoading(false)
    } else {
      router.push("/dashboard")
      router.refresh()
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 flex">
      {/* Left panel — branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-slate-900 border-r border-slate-800 flex-col justify-between p-12">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
            <Activity className="w-6 h-6 text-white" />
          </div>
          <div>
            <div className="text-xl font-bold text-white">FranconLean</div>
            <div className="text-xs text-slate-500 uppercase tracking-widest">Management Visuel</div>
          </div>
        </div>

        <div className="space-y-8">
          <div>
            <h1 className="text-4xl font-bold text-white leading-tight mb-4">
              Le cockpit<br />
              <span className="text-blue-400">opérationnel</span><br />
              de votre équipe.
            </h1>
            <p className="text-slate-400 leading-relaxed max-w-sm">
              Pilotez la performance, gérez les incidents et améliorez continuellement selon la méthode Lean de Michael Ballé.
            </p>
          </div>

          <div className="space-y-4">
            {[
              { icon: TrendingUp, label: "CA en temps réel", desc: "Synchronisé depuis Roller, toutes les heures" },
              { icon: Star, label: "GX Score Roller", desc: "Satisfaction client · Fans & Critics" },
              { icon: Shield, label: "Incidents & PDCA", desc: "Workflow complet jusqu'à la standardisation" },
              { icon: Users, label: "Management visuel", desc: "Kaizen, A3, Intelligence Lean" },
            ].map(({ icon: Icon, label, desc }) => (
              <div key={label} className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-blue-600/10 border border-blue-500/20 flex items-center justify-center flex-shrink-0">
                  <Icon className="w-4 h-4 text-blue-400" />
                </div>
                <div>
                  <div className="text-sm font-medium text-white">{label}</div>
                  <div className="text-xs text-slate-500">{desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <blockquote className="border-l-2 border-blue-500 pl-4">
          <p className="text-slate-400 italic text-sm leading-relaxed">
            "Le Lean n'est pas un ensemble d'outils mais un système de pensée."
          </p>
          <cite className="text-slate-600 text-xs not-italic mt-1 block">— Michael Ballé</cite>
        </blockquote>
      </div>

      {/* Right panel — login form */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
              <Activity className="w-6 h-6 text-white" />
            </div>
            <div className="text-xl font-bold text-white">FranconLean</div>
          </div>

          <div className="mb-8">
            <h2 className="text-2xl font-bold text-white">Connexion</h2>
            <p className="text-slate-400 text-sm mt-1">Accédez à votre tableau de bord</p>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-xl px-4 py-3 mb-6">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Adresse email
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                placeholder="vous@exemple.fr"
                required
                autoComplete="email"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Mot de passe
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 pr-12 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-300 p-1"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2 mt-2"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Connexion…
                </>
              ) : (
                "Se connecter"
              )}
            </button>
          </form>

          <p className="text-center text-xs text-slate-600 mt-8">
            Accès réservé aux membres de l'équipe.<br />
            Contactez votre administrateur pour un accès.
          </p>
        </div>
      </div>
    </div>
  )
}
