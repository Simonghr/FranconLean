import { supabase } from '@/lib/supabase'
import type { GxScore } from '@/lib/types'

export async function getAll(site_id: string): Promise<GxScore[]> {
  const { data, error } = await supabase
    .from('gx_scores')
    .select('*')
    .eq('site_id', site_id)
    .order('date', { ascending: true })
  if (error) throw error
  return data as GxScore[]
}

export async function getById(id: string): Promise<GxScore> {
  const { data, error } = await supabase.from('gx_scores').select('*').eq('id', id).single()
  if (error) throw error
  return data as GxScore
}

export async function create(data: Omit<GxScore, 'id' | 'created_at'>): Promise<GxScore> {
  const { data: result, error } = await supabase.from('gx_scores').insert(data).select().single()
  if (error) throw error
  return result as GxScore
}

export async function update(id: string, data: Partial<GxScore>): Promise<GxScore> {
  const { data: result, error } = await supabase.from('gx_scores').update(data).eq('id', id).select().single()
  if (error) throw error
  return result as GxScore
}

export async function remove(id: string): Promise<void> {
  const { error } = await supabase.from('gx_scores').delete().eq('id', id)
  if (error) throw error
}
