"use client"
import { useState } from "react"
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
import {
  mockSite, mockBriefing, mockSales, mockIncidents, mockFeedback, mockInsights
} from "@/lib/mockData"

const todaySale = mockSales[mockSales.length - 1]
const caToday = Math.round(todaySale?.amount ?? 0)
const caTarget = Math.round(todaySale?.target ?? 0)
const caTrend = caTarget > 0 ? Math.round(((caToday - caTarget) / caTarget) * 100) : 0

const openIncidents = mockIncidents.filter(i => i.status === "open" || i.status === "in_progress")
const weekFeedback = mockFeedback.filter(f => {
  const d = new Date(f.created_at)
  const now = new Date()
  return (now.getTime() - d.getTime()) < 7 * 24 * 3600 * 1000
})

export default function DashboardPage() {
  const [incidentOpen, setIncidentOpen] = useState(false)
  const [feedbackOpen, setFeedbackOpen] = useState(false)
  const [incidentForm, setIncidentForm] = useState({
    description: "", category: "process", impact: "medium", owner: ""
  })
  const [feedbackForm, setFeedbackForm] = useState({
    description: "", category: "compliment", sentiment: "positive"
  })

  return (
    <div className="space-y-6 max-w-[1400px]">
      {/* Briefing Header */}
      <BriefingHeader briefing={mockBriefing} siteName={mockSite.name} />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KPICard
          title="CA Aujourd'hui"
          value={`${caToday.toLocaleString("fr-FR")} €`}
          subtitle={`Objectif : ${caTarget.toLocaleString("fr-FR")} €`}
          trend={caTrend}
          trendLabel="vs objectif"
          status={caTrend >= 0 ? "good" : caTrend > -10 ? "warning" : "critical"}
        />
        <KPICard
          title="Incidents Ouverts"
          value={openIncidents.length}
          subtitle={`${mockIncidents.length} total ce mois`}
          trend={-15}
          trendLabel="vs mois dernier"
          status={openIncidents.length <= 2 ? "good" : openIncidents.length <= 4 ? "warning" : "critical"}
          footer={`${openIncidents.filter(i => i.impact === "high").length} à fort impact`}
        />
        <KPICard
          title="Retours Clients"
          value={weekFeedback.length}
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
          <CAChart sales={mockSales} title="CA 14 derniers jours" />
        </div>
        <div>
          <IncidentsChart incidents={mockIncidents} title="Incidents par catégorie" />
        </div>
        <div>
          <FeedbackChart feedback={mockFeedback} title="Sentiment clients" />
        </div>
      </div>

      {/* Bottom row: insights + quick actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <InsightsPanel insights={mockInsights} />
        </div>

        {/* Quick actions */}
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
          <h3 className="font-semibold text-white mb-4">Actions rapides</h3>
          <div className="space-y-3">
            <Button
              className="w-full justify-start gap-3"
              variant="outline"
              onClick={() => setIncidentOpen(true)}
            >
              <AlertTriangle className="w-4 h-4 text-orange-400" />
              Déclarer un incident
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
                      <Badge variant={inc.status === "open" ? "destructive" : "warning"} className="text-xs py-0">
                        {inc.status === "open" ? "Ouvert" : "En cours"}
                      </Badge>
                      <span className="text-xs text-slate-500">{inc.owner}</span>
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
            <DialogTitle>Déclarer un incident</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                placeholder="Décrivez l'incident..."
                value={incidentForm.description}
                onChange={e => setIncidentForm(f => ({ ...f, description: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Catégorie</Label>
                <Select value={incidentForm.category} onValueChange={v => setIncidentForm(f => ({ ...f, category: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="process">Process</SelectItem>
                    <SelectItem value="quality">Qualité</SelectItem>
                    <SelectItem value="security">Sécurité</SelectItem>
                    <SelectItem value="client">Client</SelectItem>
                    <SelectItem value="it">IT</SelectItem>
                    <SelectItem value="logistics">Logistique</SelectItem>
                    <SelectItem value="other">Autre</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Impact</Label>
                <Select value={incidentForm.impact} onValueChange={v => setIncidentForm(f => ({ ...f, impact: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Faible</SelectItem>
                    <SelectItem value="medium">Moyen</SelectItem>
                    <SelectItem value="high">Élevé</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Responsable</Label>
              <Input
                placeholder="Nom du responsable"
                value={incidentForm.owner}
                onChange={e => setIncidentForm(f => ({ ...f, owner: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIncidentOpen(false)}>Annuler</Button>
            <Button onClick={() => setIncidentOpen(false)}>Déclarer</Button>
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
            <Button onClick={() => setFeedbackOpen(false)}>Enregistrer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
