import { supabase } from '@/lib/supabase'
import type { Kaizen } from '@/lib/types'

export async function getAll(site_id: string): Promise<Kaizen[]> {
  const { data, error } = await supabase
    .from('kaizen')
    .select('*')
    .eq('site_id', site_id)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data as Kaizen[]
}

export async function getById(id: string): Promise<Kaizen> {
  const { data, error } = await supabase.from('kaizen').select('*').eq('id', id).single()
  if (error) throw error
  return data as Kaizen
}

export async function create(data: Omit<Kaizen, 'id' | 'created_at'>): Promise<Kaizen> {
  const { data: result, error } = await supabase.from('kaizen').insert(data).select().single()
  if (error) throw error
  return result as Kaizen
}

export async function update(id: string, data: Partial<Kaizen>): Promise<Kaizen> {
  const { data: result, error } = await supabase.from('kaizen').update(data).eq('id', id).select().single()
  if (error) throw error
  return result as Kaizen
}

export async function remove(id: string): Promise<void> {
  const { error } = await supabase.from('kaizen').delete().eq('id', id)
  if (error) throw error
}
