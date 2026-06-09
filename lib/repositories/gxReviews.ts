import { supabase } from '@/lib/supabase'

export interface GxReview {
  id: string
  site_id: string
  date: string
  roller_id: string
  guest_name?: string
  overall_rating?: number
  is_fan: boolean
  is_critic: boolean
  comment?: string
  created_at: string
}

export async function getAll(site_id: string, limit = 100): Promise<GxReview[]> {
  const { data, error } = await supabase
    .from('gx_reviews')
    .select('*')
    .eq('site_id', site_id)
    .order('date', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data as GxReview[]
}

export async function getWithComments(site_id: string, limit = 50): Promise<GxReview[]> {
  const { data, error } = await supabase
    .from('gx_reviews')
    .select('*')
    .eq('site_id', site_id)
    .not('comment', 'is', null)
    .order('date', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data as GxReview[]
}
