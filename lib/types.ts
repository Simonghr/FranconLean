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

export interface GxScore {
  id: string
  site_id: string
  date: string
  score: number
  responses_count: number
  fans_count: number
  critics_count: number
  period: SalePeriod
}

export type IncidentCategory = 'process' | 'quality' | 'security' | 'client' | 'it' | 'logistics' | 'other'
export type IncidentImpact = 'low' | 'medium' | 'high'
export type IncidentUrgency = 'low' | 'medium' | 'client_impact'
export type IncidentStatus = 'declared' | 'analysed' | 'action_ongoing' | 'verified' | 'standardised' | 'closed'
export type IncidentZone = 'bar' | 'caisse' | 'arcades' | 'parc' | 'laser_game' | 'annivs'

export type BrainstormCategory =
  | 'accueil' | 'salles' | 'extensions'
  | 'ambiance' | 'communication' | 'comprehension' | 'entraide'
  | 'satisfaction' | 'accompagnement' | 'feedback'
export type BrainstormSentiment = 'positive' | 'negative'

export interface BrainstormEntry {
  id: string
  site_id: string
  category: BrainstormCategory
  sentiment: BrainstormSentiment
  keyword: string
  created_at: string
}

export interface BrainstormSettings {
  site_id: string
  is_open: boolean
  session_id: string
}

export type ImprovementZone = 'parc' | 'anniv' | 'bar' | 'caisse'
export type ImprovementKind = 'positive' | 'improvement'

export interface Improvement {
  id: string
  site_id: string
  zone: ImprovementZone
  kind: ImprovementKind
  description: string
  comment: string
  done: boolean
  created_at: string
}
export type IncidentType = 'technique' | 'operationnel' | 'blessure' | 'service_client'

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
  zone?: IncidentZone
  incident_type?: IncidentType
  occurred_at?: string
  urgency?: IncidentUrgency
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
  benefits?: string
  estimated_cost?: number
  real_gain?: number
  status: KaizenStatus
  created_at: string
}

export type PDCAStatus = 'plan' | 'do' | 'check' | 'act'
export type PDCAPriority = 'low' | 'medium' | 'urgent' | 'investment'

export interface PDCA {
  id: string
  site_id: string
  problem: string
  objective: string
  action: string
  result: string
  standardization: string
  status: PDCAStatus
  priority?: PDCAPriority
  budget?: number
  created_at: string
  origin_label?: string
  origin_id?: string
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

export interface Product {
  id: string
  site_id: string
  supplier: string
  name: string
  price: number | null
  pack_size: number | null
  target_stock: number | null
  zone: string | null
  note: string | null
  position: number
  current_stock: number | null
  temporary: boolean
  unit: string | null
  stock: number | null
  created_at: string
}

export type DeliveryStatus = 'draft' | 'validated'

export interface Delivery {
  id: string
  site_id: string
  supplier: string | null
  delivery_date: string | null
  invoice_number: string | null
  status: DeliveryStatus
  source_file: string | null
  created_at: string
  updated_at: string
}

export interface DeliveryLine {
  id: string
  delivery_id: string
  product_id: string | null
  raw_label: string | null
  raw_ref: string | null
  raw_qty: number | null
  raw_pack: number | null
  qty: number | null
  unit_price: number | null
  ignored: boolean
  created_at: string
}

export type CountSessionStatus = 'draft' | 'validated'

export interface CountSession {
  id: string
  site_id: string
  session_date: string
  session_time: string | null
  author_first: string | null
  author_last: string | null
  status: CountSessionStatus
  created_at: string
  updated_at: string
}

export interface CountLine {
  id: string
  session_id: string
  product_id: string
  quantity: number | null
}

export interface RollerAlias {
  id: string
  site_id: string
  roller_name: string
  product_id: string | null
  deductible: boolean
  created_at: string
}

export type SalesImportStatus = 'draft' | 'applied'

export interface SalesImport {
  id: string
  site_id: string
  label: string | null
  period_date: string | null
  status: SalesImportStatus
  source_file: string | null
  created_at: string
  updated_at: string
}

export interface RecipeLine {
  id: string
  site_id: string
  roller_name: string
  product_id: string
  qty: number | null
  created_at: string
}

export interface SalesLine {
  id: string
  import_id: string
  roller_name: string
  category: string | null
  qty_sold: number | null
  product_id: string | null
  deductible: boolean
  created_at: string
}
