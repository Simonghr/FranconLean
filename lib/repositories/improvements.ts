import { supabase } from '@/lib/supabase'
import type { Improvement, ImprovementZone } from '@/lib/types'

export async function getAll(site_id: string): Promise<Improvement[]> {
  const { data, error } = await supabase
    .from('improvements')
    .select('*')
    .eq('site_id', site_id)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data as Improvement[]
}

export async function create(data: { site_id: string; zone: ImprovementZone; description: string; comment?: string }): Promise<Improvement> {
  const { data: result, error } = await supabase.from('improvements').insert(data).select().single()
  if (error) throw error
  return result as Improvement
}

export async function update(id: string, data: Partial<Improvement>): Promise<Improvement> {
  const { data: result, error } = await supabase.from('improvements').update(data).eq('id', id).select().single()
  if (error) throw error
  return result as Improvement
}

export async function remove(id: string): Promise<void> {
  const { error } = await supabase.from('improvements').delete().eq('id', id)
  if (error) throw error
}
