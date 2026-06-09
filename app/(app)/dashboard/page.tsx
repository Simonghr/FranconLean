"use client"
import { useState, useEffect } from "react"
import { Plus, AlertTriangle, MessageSquare } from "lucide-react"
import { BriefingHeader } from "@/components/dashboard/BriefingHeader"
import { KPICard } from "@/components/dashboard/KPICard"
import { InsightsPanel } from "@/components/dashboard/InsightsPanel"
import { CAChart } from "@/components/charts/CAChart"
import { IncidentsChart } from "@/components/charts/IncidentsChart"
import { FeedbackChart } from "@/components/charts/FeedbackChart"
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
import { generateInsights } from "@/lib/services/insightsService"
import { seedDatabase } from "@/lib/seed"
import type { Incident, Sale, GxScore, CustomerFeedback, Insight, IncidentCategory, IncidentImpact, IncidentZone, IncidentType } from "@/lib/types"

const SITE_ID = '00000000-0000-0000-0000-000000000001'

const mockSite = { id: SITE_ID, name: 'Franconville', address: '12 Rue du Commerce, 95130 Franconville', manager_name: 'Simon Gohier' }

export default function DashboardPage() {
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [sales, setSales] = useState<Sale[]>([])
  const [gxScores, setGxScores] = useState<GxScore[]>([])
  const [gxError, setGxError] = useState<string | null>(null)
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
        const gx = await gxRepo.getAll(SITE_ID)
        setGxScores(gx)
      } catch (err) {
        console.error('Failed to load GX scores', err)
        setGxError(err instanceof Error ? err.message : String(err))
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
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
        <KPICard
          title="GX 30 dernières"
          value={loading ? "…" : last30Score !== null ? `${last30Score} pts` : "–"}
          subtitle="30 dernières réponses"
          trend={0}
          trendLabel=""
          status={last30Score === null ? "warning" : last30Score >= 50 ? "good" : last30Score >= 0 ? "warning" : "critical"}
        />
        <KPICard
          title="Incidents Ouverts"
          value={loading ? "…" : openIncidents.length}
          subtitle={`${incidents.length} total ce mois`}
          trend={-15}
          trendLabel="vs mois dernier"
          status={openIncidents.length <= 2 ? "good" : openIncidents.length <= 4 ? "warning" : "critical"}
          footer={`${openIncidents.filter(i => i.impact === "high").length} à fort impact`}
        />
        <KPICard
          title="Retours Clients"
          value={loading ? "…" : weekFeedback.length}
          subtitle="Cette semaine"
          trend={12}
          trendLabel="vs semaine passée"
          status={
            weekFeedback.filter(f => f.sentiment === "positive").length > weekFeedback.length / 2
              ? "good" : "warning"
          }
          footer={`${weekFeedback.filter(f => f.sentiment === "positive").length} positifs`}
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-1">
          <CAChart sales={sales} title="CA 14 derniers jours" />
        </div>
        <div>
          <IncidentsChart incidents={incidents} title="Incidents par catégorie" />
        </div>
        <div>
          <FeedbackChart feedback={feedback} title="Sentiment clients" />
        </div>
      </div>

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
