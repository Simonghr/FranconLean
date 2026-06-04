import { supabase } from '@/lib/supabase'
import type { CustomerFeedback } from '@/lib/types'

export async function getAll(site_id: string): Promise<CustomerFeedback[]> {
  const { data, error } = await supabase
    .from('customer_feedback')
    .select('*')
    .eq('site_id', site_id)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data as CustomerFeedback[]
}

export async function getById(id: string): Promise<CustomerFeedback> {
  const { data, error } = await supabase.from('customer_feedback').select('*').eq('id', id).single()
  if (error) throw error
  return data as CustomerFeedback
}

export async function create(data: Omit<CustomerFeedback, 'id' | 'created_at'>): Promise<CustomerFeedback> {
  const { data: result, error } = await supabase.from('customer_feedback').insert(data).select().single()
  if (error) throw error
  return result as CustomerFeedback
}

export async function update(id: string, data: Partial<CustomerFeedback>): Promise<CustomerFeedback> {
  const { data: result, error } = await supabase.from('customer_feedback').update(data).eq('id', id).select().single()
  if (error) throw error
  return result as CustomerFeedback
}

export async function remove(id: string): Promise<void> {
  const { error } = await supabase.from('customer_feedback').delete().eq('id', id)
  if (error) throw error
}
