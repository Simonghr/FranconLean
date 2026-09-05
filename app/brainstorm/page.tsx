"use client"
import { useState, useEffect } from "react"
import { ThumbsUp, ThumbsDown, CheckCircle2, Sparkles, Lock } from "lucide-react"
import * as brainstormRepo from "@/lib/repositories/brainstorm"
import type { BrainstormCategory, BrainstormSentiment } from "@/lib/types"

const DEFAULT_SITE_ID = '00000000-0000-0000-0000-000000000001'

const GROUPS: { title: string; categories: { id: BrainstormCategory; label: string }[] }[] = [
  {
    title: "Prestations",
    categories: [
      { id: "accueil", label: "Accueil" },
      { id: "salles", label: "Salles" },
      { id: "extensions", label: "Extensions" },
    ],
  },
  {
    title: "Équipe",
    categories: [
      { id: "ambiance", label: "Ambiance" },
      { id: "communication", label: "Communication" },
      { id: "comprehension", label: "Compréhension" },
      { id: "entraide", label: "Entraide" },
    ],
  },
  {
    title: "Client",
    categories: [
      { id: "satisfaction", label: "Satisfaction" },
      { id: "accompagnement", label: "Accompagnement" },
      { id: "feedback", label: "Feed-back" },
    ],
  },
]

function KeywordField({
  category, sentiment, onSubmit,
}: { category: BrainstormCategory; sentiment: BrainstormSentiment; onSubmit: (kw: string) => Promise<void> }) {
  const [value, setValue] = useState("")
  const [sent, setSent] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)

  const handleAdd = async () => {
    const kw = value.trim()
    if (!kw || submitting) return
    setSubmitting(true)
    try {
      await onSubmit(kw)
      setSent(prev => [...prev, kw])
      setValue("")
    } finally {
      setSubmitting(false)
    }
  }

  const isPositive = sentiment === "positive"

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5">
        <input
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handleAdd() } }}
          placeholder={isPositive ? "Mot-clé positif..." : "Mot-clé à améliorer..."}
          className={`flex-1 bg-slate-800 border rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 ${
            isPositive ? "border-green-700/50 focus:ring-green-500 focus:border-green-500" : "border-amber-700/50 focus:ring-amber-500 focus:border-amber-500"
          }`}
        />
        <button
          onClick={handleAdd}
          disabled={!value.trim() || submitting}
          className={`px-3 py-2 rounded-lg text-sm font-medium disabled:opacity-40 ${
            isPositive ? "bg-green-600 hover:bg-green-500 text-white" : "bg-amber-600 hover:bg-amber-500 text-white"
          }`}
        >
          +
        </button>
      </div>
      {sent.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {sent.map((kw, i) => (
            <span key={i} className={`text-xs px-2 py-0.5 rounded-full border ${
              isPositive ? "bg-green-500/10 text-green-400 border-green-500/30" : "bg-amber-500/10 text-amber-400 border-amber-500/30"
            }`}>
              {kw}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

export default function BrainstormPage() {
  const [isOpen, setIsOpen] = useState<boolean | null>(null)
  const [siteId, setSiteId] = useState(DEFAULT_SITE_ID)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const site = params.get('site') || DEFAULT_SITE_ID
    setSiteId(site)
    brainstormRepo.getSettings(site).then(s => {
      const sessionParam = params.get('s')
      setIsOpen(s.is_open && (!s.session_id || sessionParam === s.session_id))
    })
  }, [])

  const handleSubmit = async (category: BrainstormCategory, sentiment: BrainstormSentiment, keyword: string) => {
    await brainstormRepo.create({ site_id: siteId, category, sentiment, keyword })
  }

  if (isOpen === false) {
    return (
      <div className="min-h-screen bg-slate-950 px-4 py-8 flex items-center justify-center">
        <div className="text-center space-y-3">
          <Lock className="w-8 h-8 text-slate-500 mx-auto" />
          <h1 className="text-xl font-bold text-white">Les réponses sont closes</h1>
          <p className="text-slate-400 text-sm">Merci pour ta participation, le brainstorming est terminé.</p>
        </div>
      </div>
    )
  }

  if (isOpen === null) return null

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-8">
      <div className="max-w-2xl mx-auto space-y-8">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 text-pink-400">
            <Sparkles className="w-5 h-5" />
            <span className="text-xs font-semibold uppercase tracking-widest">Réunion d'équipe</span>
          </div>
          <h1 className="text-2xl font-bold text-white">Brainstorming</h1>
          <p className="text-slate-400 text-sm">
            Pour chaque thème, ajoute des <span className="text-white font-medium">mots-clés</span> (pas de phrases) :
            un point <span className="text-green-400">positif</span> et/ou un point <span className="text-amber-400">à améliorer</span>.
          </p>
        </div>

        {GROUPS.map(group => (
          <div key={group.title} className="space-y-4">
            <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-widest border-b border-slate-800 pb-2">
              {group.title}
            </h2>
            {group.categories.map(cat => (
              <div key={cat.id} className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
                <div className="text-sm font-medium text-white">{cat.label}</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <div className="flex items-center gap-1.5 text-xs text-green-400 font-medium mb-1.5">
                      <ThumbsUp className="w-3.5 h-3.5" /> Positif
                    </div>
                    <KeywordField category={cat.id} sentiment="positive" onSubmit={kw => handleSubmit(cat.id, "positive", kw)} />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5 text-xs text-amber-400 font-medium mb-1.5">
                      <ThumbsDown className="w-3.5 h-3.5" /> À améliorer
                    </div>
                    <KeywordField category={cat.id} sentiment="negative" onSubmit={kw => handleSubmit(cat.id, "negative", kw)} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ))}

        <div className="flex items-center justify-center gap-2 text-slate-500 text-sm pt-2">
          <CheckCircle2 className="w-4 h-4" />
          Merci pour ta participation !
        </div>
      </div>
    </div>
  )
}
