import { supabase } from '@/lib/supabase'
import type { Incident } from '@/lib/types'

export async function getAll(site_id: string): Promise<Incident[]> {
  const { data, error } = await supabase
    .from('incidents')
    .select('*')
    .eq('site_id', site_id)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data as Incident[]
}

export async function getById(id: string): Promise<Incident> {
  const { data, error } = await supabase.from('incidents').select('*').eq('id', id).single()
  if (error) throw error
  return data as Incident
}

export async function create(data: Omit<Incident, 'id' | 'created_at'>): Promise<Incident> {
  const { data: result, error } = await supabase.from('incidents').insert(data).select().single()
  if (error) throw error
  return result as Incident
}

export async function update(id: string, data: Partial<Incident>): Promise<Incident> {
  const { data: result, error } = await supabase.from('incidents').update(data).eq('id', id).select().single()
  if (error) throw error
  return result as Incident
}

export async function remove(id: string): Promise<void> {
  const { error } = await supabase.from('incidents').delete().eq('id', id)
  if (error) throw error
}
