"use client"
import { useState, useEffect } from "react"
import { Plus, AlertTriangle, MessageSquare, PartyPopper } from "lucide-react"
import { BriefingHeader } from "@/components/dashboard/BriefingHeader"
import { KPICard } from "@/components/dashboard/KPICard"
import { InsightsPanel } from "@/components/dashboard/InsightsPanel"
import { CAChart } from "@/components/charts/CAChart"
import { IncidentsChart } from "@/components/charts/IncidentsChart"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { mockBriefing } from "@/lib/mockData"
import * as incidentsRepo from "@/lib/repositories/incidents"
import * as salesRepo from "@/lib/repositories/sales"
import * as gxRepo from "@/lib/repositories/gx"
import * as feedbackRepo from "@/lib/repositories/feedback"
import * as kaizenRepo from "@/lib/repositories/kaizen"
import * as gxReviewsRepo from "@/lib/repositories/gxReviews"
import type { GxReview } from "@/lib/repositories/gxReviews"
import { translateTag } from "@/lib/gxTagTranslations"
import { generateInsights } from "@/lib/services/insightsService"
import { seedDatabase } from "@/lib/seed"
import type { Incident, Sale, GxScore, CustomerFeedback, Insight, IncidentCategory, IncidentImpact, IncidentZone, IncidentType } from "@/lib/types"

const SITE_ID = '00000000-0000-0000-0000-000000000001'

const mockSite = { id: SITE_ID, name: 'Franconville', address: '12 Rue du Commerce, 95130 Franconville', manager_name: 'Simon Gohier' }

export default function DashboardPage() {
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [sales, setSales] = useState<Sale[]>([])
  const [gxScores, setGxScores] = useState<GxScore[]>([])
  const [gxReviews, setGxReviews] = useState<GxReview[]>([])
  const [gxError, setGxError] = useState<string | null>(null)
  const [anniversaires, setAnniversaires] = useState<{ sat: number; sun: number; satStr: string; sunStr: string } | null>(null)
  const [feedback, setFeedback] = useState<CustomerFeedback[]>([])
  const [insights, setInsights] = useState<Insight[]>([])
  const [loading, setLoading] = useState(true)

  const [incidentOpen, setIncidentOpen] = useState(false)
  const [feedbackOpen, setFeedbackOpen] = useState(false)

  const nowParis = () => {
    const now = new Date()
    const date = now.toLocaleDateString("en-CA", { timeZone: "Europe/Paris" })
    const time = now.toLocaleTimeString("fr-FR", { timeZone: "Europe/Paris", hour: "2-digit", minute: "2-digit" })
    return { date, time }
  }
  const [incidentForm, setIncidentForm] = useState(() => {
    const { date, time } = nowParis()
    return { description: "", incident_type: "technique", zone: "parc", date, time }
  })
  const [feedbackForm, setFeedbackForm] = useState({
    description: "", category: "compliment", sentiment: "positive"
  })

  useEffect(() => {
    async function load() {
      try {
        await seedDatabase()
        const [inc, sal, fb, kz] = await Promise.all([
          incidentsRepo.getAll(SITE_ID),
          salesRepo.getAll(SITE_ID),
          feedbackRepo.getAll(SITE_ID),
          kaizenRepo.getAll(SITE_ID),
        ])
        setIncidents(inc)
        setSales(sal)
        setFeedback(fb)
        setInsights(generateInsights(inc, sal, fb, kz, SITE_ID))
      } catch (err) {
        console.error('Failed to load dashboard data', err)
      } finally {
        setLoading(false)
      }
      // GX scores loaded separately so a failure here doesn't blank the whole dashboard
      try {
        const [gx, rev] = await Promise.all([
          gxRepo.getAll(SITE_ID),
          gxReviewsRepo.getRecent(SITE_ID, 200),
        ])
        setGxScores(gx)
        setGxReviews(rev)
      } catch (err) {
        console.error('Failed to load GX scores', err)
        setGxError(err instanceof Error ? err.message : String(err))
      }

      // Anniversaires next weekend
      try {
        const todayParis = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Paris" })
        const today = new Date(todayParis + "T12:00:00")
        const dow = today.getDay() // 0=Sun, 6=Sat
        const daysToSat = dow === 6 ? 7 : (6 - dow + 7) % 7 || 7
        const sat = new Date(today); sat.setDate(today.getDate() + daysToSat)
        const sun = new Date(sat); sun.setDate(sat.getDate() + 1)
        const satStr = sat.toLocaleDateString("en-CA")
        const sunStr = sun.toLocaleDateString("en-CA")

        const { data } = await import('@/lib/supabase').then(m =>
          m.supabase.from('bookings')
            .select('booking_date, roller_booking_id')
            .eq('site_id', SITE_ID)
            .eq('is_anniversary', true)
            .in('booking_date', [satStr, sunStr])
        )
        const rows = data ?? []
        const uniq = (date: string) => new Set(rows.filter((r: any) => r.booking_date === date).map((r: any) => r.roller_booking_id)).size
        setAnniversaires({
          sat: uniq(satStr),
          sun: uniq(sunStr),
          satStr,
          sunStr,
        })
      } catch (e) {
        console.error('Failed to load anniversaires', e)
      }
    }
    load()
  }, [])

  const todayStr = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Paris" })
  const todaySale = sales.find(s => s.date === todayStr)
  const caToday = Math.round(todaySale?.amount ?? 0)
  const caTarget = Math.round(todaySale?.target ?? 10000)
  const caTrend = caTarget > 0 ? Math.round(((caToday - caTarget) / caTarget) * 100) : 0

// Roller's GX Score formula: round each percentage separately before subtracting.
// Math.round((fans-critics)/total*100) gives 73 while Roller shows 74 for 26/4/30.
const gxCalc = (fans: number, critics: number, total: number) =>
  total ? Math.round(fans / total * 100) - Math.round(critics / total * 100) : 0

  // GX Score — last weekend (most recent Saturday + Sunday)
  const lastWeekendScore = (() => {
    if (!gxScores.length) return null
    const today = new Date()
    const dow = today.getDay() // 0=Sun,1=Mon,...,6=Sat
    const lastSun = new Date(today); lastSun.setDate(today.getDate() - (dow === 0 ? 7 : dow))
    const lastSat = new Date(lastSun); lastSat.setDate(lastSun.getDate() - 1)
    const satStr = lastSat.toISOString().split("T")[0]
    const sunStr = lastSun.toISOString().split("T")[0]
    const days = gxScores.filter(g => g.date === satStr || g.date === sunStr)
    if (!days.length) return null
    const fans = days.reduce((s, g) => s + (g.fans_count ?? 0), 0)
    const critics = days.reduce((s, g) => s + (g.critics_count ?? 0), 0)
    const total = days.reduce((s, g) => s + g.responses_count, 0)
    return { score: gxCalc(fans, critics, total), total, satStr, sunStr }
  })()

  // GX Score — last 30 responses
  const last30Score = (() => {
    if (!gxScores.length) return null
    const sorted = [...gxScores].sort((a, b) => b.date.localeCompare(a.date))
    let fans = 0, critics = 0, total = 0
    for (const g of sorted) {
      const remaining = 30 - total
      if (remaining <= 0) break
      const take = Math.min(remaining, g.responses_count)
      const ratio = take / g.responses_count
      fans += Math.round((g.fans_count ?? 0) * ratio)
      critics += Math.round((g.critics_count ?? 0) * ratio)
      total += take
    }
    return total ? gxCalc(fans, critics, total) : null
  })()

  // ── GX tag synthesis ──────────────────────────────────────────────────────
  const tagSynthesis = (() => {
    const fanTags: Record<string, number> = {}
    const criticTags: Record<string, number> = {}
    for (const r of gxReviews) {
      const allReasons = [
        ...(r.service_rating_reasons ?? []),
        ...(r.safety_rating_reasons ?? []),
        ...(r.facilities_rating_reasons ?? []),
        ...(r.value_rating_reasons ?? []),
      ]
      const target = r.is_fan ? fanTags : r.is_critic ? criticTags : null
      if (!target) continue
      for (const tag of allReasons) target[tag] = (target[tag] ?? 0) + 1
    }
    const toTop = (obj: Record<string, number>, n = 5) =>
      Object.entries(obj).sort((a, b) => b[1] - a[1]).slice(0, n)
    return { fans: toTop(fanTags), critics: toTop(criticTags) }
  })()

  const openIncidents = incidents.filter(i => i.status !== 'closed' && i.status !== 'standardised')
  const weekFeedback = feedback.filter(f => {
    const d = new Date(f.created_at)
    const now = new Date()
    return (now.getTime() - d.getTime()) < 7 * 24 * 3600 * 1000
  })

  const handleAddIncident = async () => {
    if (!incidentForm.description) return
    try {
      const occurred_at = new Date(`${incidentForm.date}T${incidentForm.time}:00`).toISOString()
      const newInc = await incidentsRepo.create({
        site_id: SITE_ID,
        description: incidentForm.description,
        category: 'other' as IncidentCategory,
        impact: 'medium' as IncidentImpact,
        owner: '',
        status: 'declared',
        zone: incidentForm.zone as IncidentZone,
        incident_type: incidentForm.incident_type as IncidentType,
        occurred_at,
      })
      setIncidents(prev => [newInc, ...prev])
      const { date, time } = nowParis()
      setIncidentForm({ description: "", incident_type: "technique", zone: "parc", date, time })
      setIncidentOpen(false)
    } catch (err) {
      console.error('Failed to create incident', err)
    }
  }

  const handleAddFeedback = async () => {
    if (!feedbackForm.description) return
    try {
      const newFb = await feedbackRepo.create({
        site_id: SITE_ID,
        type: ["compliment", "positive_experience"].includes(feedbackForm.category) ? "satisfaction" : "complaint",
        category: feedbackForm.category as CustomerFeedback["category"],
        description: feedbackForm.description,
        sentiment: feedbackForm.sentiment as CustomerFeedback["sentiment"],
      })
      setFeedback(prev => [newFb, ...prev])
      setFeedbackForm({ description: "", category: "compliment", sentiment: "positive" })
      setFeedbackOpen(false)
    } catch (err) {
      console.error('Failed to create feedback', err)
    }
  }

  return (
    <div className="space-y-6 max-w-[1400px]">
      {/* Briefing Header */}
      <BriefingHeader briefing={mockBriefing} siteName={mockSite.name} />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KPICard
          title="CA Aujourd'hui"
          value={loading ? "…" : `${caToday.toLocaleString("fr-FR")} €`}
          subtitle={`Objectif : ${caTarget.toLocaleString("fr-FR")} €`}
          trend={caTrend}
          trendLabel="vs objectif"
          status={caTrend >= 0 ? "good" : caTrend > -10 ? "warning" : "critical"}
        />
        <KPICard
          title="GX Week-end"
          value={loading ? "…" : lastWeekendScore !== null ? `${lastWeekendScore.score} pts` : "–"}
          subtitle={lastWeekendScore ? `${lastWeekendScore.total} avis · sam+dim` : gxError ? `Erreur: ${gxError.slice(0, 40)}` : "Aucune donnée"}
          trend={0}
          trendLabel=""
          status={lastWeekendScore === null ? "warning" : lastWeekendScore.score >= 50 ? "good" : lastWeekendScore.score >= 0 ? "warning" : "critical"}
        />

        {/* Anniversaires prochain week-end */}
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-400 uppercase tracking-widest font-semibold">Anniv. Week-end</span>
            <PartyPopper className="w-4 h-4 text-pink-400" />
          </div>
          {anniversaires === null ? (
            <div className="text-2xl font-bold text-slate-500">–</div>
          ) : (
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">Sam {anniversaires.satStr.slice(8)}/{anniversaires.satStr.slice(5,7)}</span>
                <span className="text-xl font-bold text-pink-400">{anniversaires.sat}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">Dim {anniversaires.sunStr.slice(8)}/{anniversaires.sunStr.slice(5,7)}</span>
                <span className="text-xl font-bold text-pink-400">{anniversaires.sun}</span>
              </div>
            </div>
          )}
          <div className="text-xs text-slate-500 mt-1">Réservations Roller</div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div>
          <CAChart sales={sales} title="CA 14 derniers jours" />
        </div>
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-white">Incidents par type</h3>
            <div className="flex items-center gap-3">
              <span className={`text-2xl font-bold ${openIncidents.length === 0 ? "text-green-400" : openIncidents.length <= 2 ? "text-orange-400" : "text-red-400"}`}>
                {openIncidents.length}
              </span>
              <div className="text-right">
                <div className="text-xs text-slate-400">ouverts</div>
                <div className="text-xs text-slate-500">{openIncidents.filter(i => i.impact === "high").length} fort impact</div>
              </div>
            </div>
          </div>
          <IncidentsChart incidents={incidents} title="" />
        </div>
      </div>

      {/* GX Tag Synthesis */}
      {(tagSynthesis.fans.length > 0 || tagSynthesis.critics.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-slate-800 border border-green-500/20 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-green-400 flex items-center gap-2 mb-3">
              👍 Ce qui plaît (Fans)
            </h3>
            <div className="space-y-2">
              {tagSynthesis.fans.map(([tag, count]) => {
                const pct = Math.round(count / tagSynthesis.fans[0][1] * 100)
                return (
                  <div key={tag}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-200">{translateTag(tag, true)}</span>
                      <span className="text-slate-400">{count}</span>
                    </div>
                    <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                      <div className="h-full bg-green-500 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
          <div className="bg-slate-800 border border-red-500/20 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-red-400 flex items-center gap-2 mb-3">
              👎 Ce qui déplaît (Critiques)
            </h3>
            <div className="space-y-2">
              {tagSynthesis.critics.length === 0
                ? <p className="text-xs text-slate-500">Pas encore de données</p>
                : tagSynthesis.critics.map(([tag, count]) => {
                  const pct = Math.round(count / tagSynthesis.critics[0][1] * 100)
                  return (
                    <div key={tag}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-slate-200">{translateTag(tag, false)}</span>
                        <span className="text-slate-400">{count}</span>
                      </div>
                      <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                        <div className="h-full bg-red-500 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  )
                })
              }
            </div>
          </div>
        </div>
      )}

      {/* Bottom row: insights + quick actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <InsightsPanel insights={insights} />
        </div>

        {/* Quick actions */}
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
          <h3 className="font-semibold text-white mb-4">Actions rapides</h3>
          <div className="space-y-3">
            <Button
              className="w-full justify-start gap-3 bg-orange-500/10 border-orange-500/40 text-orange-300 hover:bg-orange-500/20 hover:text-orange-200"
              variant="outline"
              onClick={() => setIncidentOpen(true)}
            >
              <AlertTriangle className="w-4 h-4 text-orange-400" />
              Signaler un incident
            </Button>
            <Button
              className="w-full justify-start gap-3"
              variant="outline"
              onClick={() => setFeedbackOpen(true)}
            >
              <MessageSquare className="w-4 h-4 text-blue-400" />
              Ajouter retour client
            </Button>
            <Button className="w-full justify-start gap-3" variant="outline">
              <Plus className="w-4 h-4 text-green-400" />
              Nouvelle idée Kaizen
            </Button>
          </div>

          {/* Recent incidents mini list */}
          <div className="mt-5">
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">
              Incidents récents
            </div>
            <div className="space-y-2">
              {openIncidents.slice(0, 3).map(inc => (
                <div key={inc.id} className="flex items-start gap-2 py-2 border-b border-slate-700/50 last:border-0">
                  <div className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${
                    inc.impact === "high" ? "bg-red-400" : inc.impact === "medium" ? "bg-orange-400" : "bg-yellow-400"
                  }`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-slate-300 truncate">{inc.description}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <Badge variant={inc.status === 'declared' ? 'destructive' : 'warning'} className="text-xs py-0">
                        {inc.status === 'declared' ? 'Déclaré' : inc.status === 'analysed' ? 'Analysé' : 'En cours'}
                      </Badge>
                      {inc.zone && <span className="text-xs text-slate-500 capitalize">{inc.zone.replace("_", " ")}</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Add Incident Dialog */}
      <Dialog open={incidentOpen} onOpenChange={setIncidentOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Signaler un incident</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Date</Label>
                <Input
                  type="date"
                  value={incidentForm.date}
                  onChange={e => setIncidentForm(f => ({ ...f, date: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Heure</Label>
                <Input
                  type="time"
                  value={incidentForm.time}
                  onChange={e => setIncidentForm(f => ({ ...f, time: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Zone</Label>
              <Select value={incidentForm.zone} onValueChange={v => setIncidentForm(f => ({ ...f, zone: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="bar">Bar</SelectItem>
                  <SelectItem value="caisse">Caisse</SelectItem>
                  <SelectItem value="arcades">Arcades</SelectItem>
                  <SelectItem value="parc">Parc</SelectItem>
                  <SelectItem value="laser_game">Laser Game</SelectItem>
                  <SelectItem value="annivs">Annivs</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Type d'incident</Label>
              <Select value={incidentForm.incident_type} onValueChange={v => setIncidentForm(f => ({ ...f, incident_type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="technique">Technique</SelectItem>
                  <SelectItem value="operationnel">Opérationnel</SelectItem>
                  <SelectItem value="blessure">Blessure</SelectItem>
                  <SelectItem value="service_client">Service client</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                placeholder="Décrivez l'incident..."
                value={incidentForm.description}
                onChange={e => setIncidentForm(f => ({ ...f, description: e.target.value }))}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIncidentOpen(false)}>Annuler</Button>
            <Button onClick={handleAddIncident} disabled={!incidentForm.description}>
              Signaler
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Feedback Dialog */}
      <Dialog open={feedbackOpen} onOpenChange={setFeedbackOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ajouter un retour client</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                placeholder="Décrivez le retour client..."
                value={feedbackForm.description}
                onChange={e => setFeedbackForm(f => ({ ...f, description: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Catégorie</Label>
                <Select value={feedbackForm.category} onValueChange={v => setFeedbackForm(f => ({ ...f, category: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="compliment">Compliment</SelectItem>
                    <SelectItem value="positive_experience">Expérience positive</SelectItem>
                    <SelectItem value="complaint">Plainte</SelectItem>
                    <SelectItem value="remark">Remarque</SelectItem>
                    <SelectItem value="quality_issue">Problème qualité</SelectItem>
                    <SelectItem value="service_issue">Problème service</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Sentiment</Label>
                <Select value={feedbackForm.sentiment} onValueChange={v => setFeedbackForm(f => ({ ...f, sentiment: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="positive">Positif</SelectItem>
                    <SelectItem value="neutral">Neutre</SelectItem>
                    <SelectItem value="negative">Négatif</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFeedbackOpen(false)}>Annuler</Button>
            <Button onClick={handleAddFeedback} disabled={!feedbackForm.description}>Enregistrer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
