import { supabase } from '@/lib/supabase'
import type { Sale } from '@/lib/types'

export async function getAll(site_id: string): Promise<Sale[]> {
  const { data, error } = await supabase
    .from('sales')
    .select('*')
    .eq('site_id', site_id)
    .order('date', { ascending: true })
  if (error) throw error
  return data as Sale[]
}

export async function getById(id: string): Promise<Sale> {
  const { data, error } = await supabase.from('sales').select('*').eq('id', id).single()
  if (error) throw error
  return data as Sale
}

export async function create(data: Omit<Sale, 'id' | 'created_at'>): Promise<Sale> {
  const { data: result, error } = await supabase.from('sales').insert(data).select().single()
  if (error) throw error
  return result as Sale
}

export async function update(id: string, data: Partial<Sale>): Promise<Sale> {
  const { data: result, error } = await supabase.from('sales').update(data).eq('id', id).select().single()
  if (error) throw error
  return result as Sale
}

export async function remove(id: string): Promise<void> {
  const { error } = await supabase.from('sales').delete().eq('id', id)
  if (error) throw error
}
