import { supabase } from '@/lib/supabase'
import type { A3Report } from '@/lib/types'

export async function getAll(site_id: string): Promise<A3Report[]> {
  const { data, error } = await supabase
    .from('a3_reports')
    .select('*')
    .eq('site_id', site_id)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data as A3Report[]
}

export async function getById(id: string): Promise<A3Report> {
  const { data, error } = await supabase.from('a3_reports').select('*').eq('id', id).single()
  if (error) throw error
  return data as A3Report
}

export async function create(data: Omit<A3Report, 'id' | 'created_at'>): Promise<A3Report> {
  const { data: result, error } = await supabase.from('a3_reports').insert(data).select().single()
  if (error) throw error
  return result as A3Report
}

export async function update(id: string, data: Partial<A3Report>): Promise<A3Report> {
  const { data: result, error } = await supabase.from('a3_reports').update(data).eq('id', id).select().single()
  if (error) throw error
  return result as A3Report
}

export async function remove(id: string): Promise<void> {
  const { error } = await supabase.from('a3_reports').delete().eq('id', id)
  if (error) throw error
}
