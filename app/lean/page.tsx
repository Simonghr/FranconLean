import Link from "next/link"
import { RefreshCw, FileText, Lightbulb, ArrowRight, CheckCircle2, Clock } from "lucide-react"
import { mockPDCA, mockA3Reports, mockKaizen } from "@/lib/mockData"

export default function LeanPage() {
  const pdcaInProgress = mockPDCA.filter(p => p.status !== "act").length
  const kaizenIdeas = mockKaizen.filter(k => k.status === "idea").length
  const kaizenImplemented = mockKaizen.filter(k => k.status === "implemented").length
  const totalGain = mockKaizen
    .filter(k => k.real_gain)
    .reduce((s, k) => s + (k.real_gain ?? 0), 0)

  const tools = [
    {
      href: "/lean/pdca",
      icon: RefreshCw,
      title: "PDCA",
      subtitle: "Plan — Do — Check — Act",
      description: "Cycles d'amélioration continue. Identifiez un problème, planifiez, agissez, vérifiez et standardisez.",
      color: "text-blue-400",
      bg: "bg-blue-500/10 border-blue-500/20",
      stats: [
        { label: "En cours", value: pdcaInProgress, color: "text-orange-400" },
        { label: "Total", value: mockPDCA.length, color: "text-slate-300" },
      ],
    },
    {
      href: "/lean/a3",
      icon: FileText,
      title: "A3 Reports",
      subtitle: "Problem Solving Structuré",
      description: "Résolution de problèmes complexes sur une seule feuille A3 : contexte, état actuel, cibles, causes racines et plan d'action.",
      color: "text-purple-400",
      bg: "bg-purple-500/10 border-purple-500/20",
      stats: [
        { label: "Rapports", value: mockA3Reports.length, color: "text-slate-300" },
        { label: "En cours", value: mockA3Reports.length, color: "text-orange-400" },
      ],
    },
    {
      href: "/lean/kaizen",
      icon: Lightbulb,
      title: "Kaizen",
      subtitle: "Amélioration Continue",
      description: "Collectez et implémentez des idées d'amélioration. Petits changements, grands résultats.",
      color: "text-yellow-400",
      bg: "bg-yellow-500/10 border-yellow-500/20",
      stats: [
        { label: "Idées", value: kaizenIdeas, color: "text-yellow-400" },
        { label: "Implémentées", value: kaizenImplemented, color: "text-green-400" },
        { label: "Gains", value: `${totalGain.toLocaleString("fr-FR")} €`, color: "text-green-400" },
      ],
    },
  ]

  return (
    <div className="space-y-6 max-w-[1400px]">
      <div>
        <h1 className="text-2xl font-bold text-white">Outils Lean</h1>
        <p className="text-slate-400 text-sm mt-1">Méthodes d'amélioration continue — Approche Michael Ballé</p>
      </div>

      {/* Philosophy banner */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
        <blockquote className="text-slate-300 italic text-sm leading-relaxed border-l-2 border-blue-500 pl-4">
          "Le Lean n'est pas un ensemble d'outils mais un système de pensée. Chaque problème est une opportunité d'apprendre."
          <br />
          <cite className="text-slate-500 not-italic mt-1 block">— Michael Ballé</cite>
        </blockquote>
      </div>

      {/* Tools grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {tools.map(({ href, icon: Icon, title, subtitle, description, color, bg, stats }) => (
          <Link key={href} href={href} className="group">
            <div className={`bg-slate-800 border ${bg} rounded-xl p-5 h-full hover:bg-slate-700 transition-colors`}>
              <div className="flex items-start justify-between mb-4">
                <div className={`p-2.5 rounded-xl ${bg}`}>
                  <Icon className={`w-6 h-6 ${color}`} />
                </div>
                <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-slate-300 transition-colors" />
              </div>
              <h3 className="text-lg font-bold text-white mb-0.5">{title}</h3>
              <div className={`text-xs font-medium ${color} mb-3`}>{subtitle}</div>
              <p className="text-sm text-slate-400 leading-relaxed mb-4">{description}</p>
              <div className="flex items-center gap-4 pt-3 border-t border-slate-700/50">
                {stats.map(s => (
                  <div key={s.label}>
                    <div className={`text-lg font-bold ${s.color}`}>{s.value}</div>
                    <div className="text-xs text-slate-500">{s.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* PDCA cycle visual */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
        <h3 className="font-semibold text-white mb-4">Cycle PDCA — Vue d'ensemble</h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: "PLAN", desc: "Identifier le problème et planifier", color: "bg-blue-600", count: mockPDCA.filter(p => p.status === "plan").length },
            { label: "DO", desc: "Mettre en œuvre l'action", color: "bg-yellow-500", count: mockPDCA.filter(p => p.status === "do").length },
            { label: "CHECK", desc: "Vérifier les résultats", color: "bg-orange-500", count: mockPDCA.filter(p => p.status === "check").length },
            { label: "ACT", desc: "Standardiser et pérenniser", color: "bg-green-600", count: mockPDCA.filter(p => p.status === "act").length },
          ].map(({ label, desc, color, count }) => (
            <div key={label} className="bg-slate-900/50 rounded-xl p-4">
              <div className={`inline-block px-2 py-0.5 rounded text-xs font-bold text-white ${color} mb-2`}>{label}</div>
              <div className="text-2xl font-bold text-white mb-1">{count}</div>
              <div className="text-xs text-slate-400">{desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
