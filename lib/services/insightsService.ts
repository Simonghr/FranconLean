import type { Incident, Sale, CustomerFeedback, Kaizen, Insight } from '@/lib/types'

export function generateInsights(
  incidents: Incident[],
  sales: Sale[],
  feedback: CustomerFeedback[],
  kaizen: Kaizen[],
  site_id: string
): Insight[] {
  const insights: Insight[] = []
  const now = new Date()

  // --- Incident category increase >20% vs previous period ---
  const periodDays = 14
  const mid = new Date(now.getTime() - periodDays * 24 * 3600 * 1000)
  const start = new Date(now.getTime() - 2 * periodDays * 24 * 3600 * 1000)

  const currentPeriod = incidents.filter(i => new Date(i.created_at) >= mid)
  const previousPeriod = incidents.filter(i => {
    const d = new Date(i.created_at)
    return d >= start && d < mid
  })

  const categories = [...new Set(incidents.map(i => i.category))]
  for (const cat of categories) {
    const curr = currentPeriod.filter(i => i.category === cat).length
    const prev = previousPeriod.filter(i => i.category === cat).length
    if (prev > 0 && (curr - prev) / prev > 0.2) {
      insights.push({
        id: `ins-cat-${cat}`,
        site_id,
        message: `Les incidents de type "${cat}" ont augmenté de ${Math.round(((curr - prev) / prev) * 100)}% sur les 2 dernières semaines.`,
        type: 'warning',
        category: cat,
        created_at: now.toISOString(),
      })
    }
  }

  // --- CA below target 3+ consecutive days ---
  const sortedSales = [...sales].sort((a, b) => a.date.localeCompare(b.date))
  let belowStreak = 0
  let streakTriggered = false
  for (const sale of sortedSales) {
    if (sale.amount < sale.target) {
      belowStreak++
      if (belowStreak >= 3 && !streakTriggered) {
        streakTriggered = true
        insights.push({
          id: 'ins-ca-below',
          site_id,
          message: `Le CA est en dessous de l'objectif depuis ${belowStreak} jours consécutifs. Une analyse est recommandée.`,
          type: 'warning',
          category: 'performance',
          created_at: now.toISOString(),
        })
      }
    } else {
      belowStreak = 0
      streakTriggered = false
    }
  }

  // --- Customer complaints > 30% of total feedback ---
  const complaints = feedback.filter(f => f.sentiment === 'negative').length
  if (feedback.length > 0 && complaints / feedback.length > 0.3) {
    insights.push({
      id: 'ins-complaints',
      site_id,
      message: `${Math.round((complaints / feedback.length) * 100)}% des retours clients sont négatifs. Tendance à surveiller.`,
      type: 'warning',
      category: 'quality',
      created_at: now.toISOString(),
    })
  }

  // --- Kaizen ideas implemented this month ---
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const implementedThisMonth = kaizen.filter(
    k => k.status === 'implemented' && new Date(k.created_at) >= startOfMonth
  )
  if (implementedThisMonth.length > 0) {
    const totalGain = implementedThisMonth.reduce((s, k) => s + (k.real_gain ?? k.estimated_gain), 0)
    insights.push({
      id: 'ins-kaizen',
      site_id,
      message: `${implementedThisMonth.length} idée(s) Kaizen implémentée(s) ce mois — gain estimé : ${totalGain.toLocaleString('fr-FR')} €.`,
      type: 'improvement',
      category: 'kaizen',
      created_at: now.toISOString(),
    })
  }

  return insights
}
