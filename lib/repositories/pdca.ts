import { supabase } from '@/lib/supabase'
import type { PDCA } from '@/lib/types'

export async function getAll(site_id: string): Promise<PDCA[]> {
  const { data, error } = await supabase
    .from('pdca')
    .select('*')
    .eq('site_id', site_id)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data as PDCA[]
}

export async function getById(id: string): Promise<PDCA> {
  const { data, error } = await supabase.from('pdca').select('*').eq('id', id).single()
  if (error) throw error
  return data as PDCA
}

export async function create(data: Omit<PDCA, 'id' | 'created_at'>): Promise<PDCA> {
  const { data: result, error } = await supabase.from('pdca').insert(data).select().single()
  if (error) throw error
  return result as PDCA
}

export async function update(id: string, data: Partial<PDCA>): Promise<PDCA> {
  const { data: result, error } = await supabase.from('pdca').update(data).eq('id', id).select().single()
  if (error) throw error
  return result as PDCA
}

export async function remove(id: string): Promise<void> {
  const { error } = await supabase.from('pdca').delete().eq('id', id)
  if (error) throw error
}
