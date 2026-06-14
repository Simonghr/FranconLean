import { supabase } from '@/lib/supabase'
import type { BrainstormEntry, BrainstormCategory, BrainstormSentiment, BrainstormSettings } from '@/lib/types'

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

export async function update(id: string, data: Partial<Pick<BrainstormEntry, 'keyword' | 'sentiment' | 'category'>>): Promise<BrainstormEntry> {
  const { data: result, error } = await supabase.from('brainstorm_entries').update(data).eq('id', id).select().single()
  if (error) throw error
  return result as BrainstormEntry
}

export async function getSettings(site_id: string): Promise<BrainstormSettings> {
  const { data, error } = await supabase
    .from('brainstorm_settings')
    .select('*')
    .eq('site_id', site_id)
    .maybeSingle()
  if (error) throw error
  return (data as BrainstormSettings) ?? { site_id, is_open: true, session_id: '' }
}

export async function setOpen(site_id: string, is_open: boolean): Promise<BrainstormSettings> {
  const { data, error } = await supabase
    .from('brainstorm_settings')
    .upsert({ site_id, is_open })
    .select()
    .single()
  if (error) throw error
  return data as BrainstormSettings
}

export async function newSession(site_id: string): Promise<BrainstormSettings> {
  const { data, error } = await supabase
    .from('brainstorm_settings')
    .upsert({ site_id, is_open: true, session_id: crypto.randomUUID() })
    .select()
    .single()
  if (error) throw error
  return data as BrainstormSettings
}
