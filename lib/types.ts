export type UserRole = 'admin' | 'director' | 'manager' | 'collaborator'

export interface User {
  id: string
  name: string
  email: string
  role: UserRole
  site_id: string
}

export interface Site {
  id: string
  name: string
  address: string
  manager_name: string
}

export type SalePeriod = 'day' | 'week' | 'month'

export interface Sale {
  id: string
  site_id: string
  date: string
  amount: number
  target: number
  period: SalePeriod
}

export type IncidentCategory = 'process' | 'quality' | 'security' | 'client' | 'it' | 'logistics' | 'other'
export type IncidentImpact = 'low' | 'medium' | 'high'
export type IncidentStatus = 'open' | 'in_progress' | 'resolved' | 'standardized'

export interface Incident {
  id: string
  site_id: string
  description: string
  category: IncidentCategory
  impact: IncidentImpact
  owner: string
  status: IncidentStatus
  created_at: string
  resolved_at?: string
}

export type FeedbackType = 'satisfaction' | 'complaint'
export type FeedbackCategory = 'compliment' | 'positive_experience' | 'complaint' | 'remark' | 'quality_issue' | 'service_issue'
export type FeedbackSentiment = 'positive' | 'neutral' | 'negative'

export interface CustomerFeedback {
  id: string
  site_id: string
  type: FeedbackType
  category: FeedbackCategory
  description: string
  sentiment: FeedbackSentiment
  created_at: string
}

export type KaizenStatus = 'idea' | 'in_progress' | 'implemented' | 'rejected'

export interface Kaizen {
  id: string
  site_id: string
  author: string
  description: string
  estimated_gain: number
  real_gain?: number
  status: KaizenStatus
  created_at: string
}

export type PDCAStatus = 'plan' | 'do' | 'check' | 'act'

export interface PDCA {
  id: string
  site_id: string
  problem: string
  objective: string
  action: string
  result: string
  standardization: string
  status: PDCAStatus
  created_at: string
}

export interface A3Report {
  id: string
  site_id: string
  title: string
  context: string
  current_state: string
  target_state: string
  root_causes: string[]
  five_whys: string[]
  action_plan: string[]
  results: string
  created_at: string
}

export type InsightType = 'warning' | 'improvement' | 'info'

export interface Insight {
  id: string
  site_id: string
  message: string
  type: InsightType
  category: string
  created_at: string
}

export interface TeamMember {
  name: string
  role: string
  present: boolean
}

export interface DailyBriefing {
  site_id: string
  date: string
  responsible: string
  adjoint: string
  objectives: string[]
  team: TeamMember[]
}
