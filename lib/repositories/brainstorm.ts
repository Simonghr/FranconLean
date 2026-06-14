import { supabase } from '@/lib/supabase'
import type { BrainstormEntry, BrainstormCategory, BrainstormSentiment } from '@/lib/types'

export async function getAll(site_id: string): Promise<BrainstormEntry[]> {
  const { data, error } = await supabase
    .from('brainstorm_entries')
    .select('*')
    .eq('site_id', site_id)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data as BrainstormEntry[]
}

export async function create(data: { site_id: string; category: BrainstormCategory; sentiment: BrainstormSentiment; keyword: string }): Promise<BrainstormEntry> {
  const { data: result, error } = await supabase.from('brainstorm_entries').insert(data).select().single()
  if (error) throw error
  return result as BrainstormEntry
}

export async function remove(id: string): Promise<void> {
  const { error } = await supabase.from('brainstorm_entries').delete().eq('id', id)
  if (error) throw error
}

export async function removeAll(site_id: string): Promise<void> {
  const { error } = await supabase.from('brainstorm_entries').delete().eq('site_id', site_id)
  if (error) throw error
}
