import { supabase } from '@/lib/supabase'
import type { Site } from '@/lib/types'

export async function getAllSites(): Promise<Site[]> {
  const { data, error } = await supabase.from('sites').select('*').order('name')
  if (error) throw error
  return data as Site[]
}

export async function getSiteById(id: string): Promise<Site> {
  const { data, error } = await supabase.from('sites').select('*').eq('id', id).single()
  if (error) throw error
  return data as Site
}

export async function createSite(data: Omit<Site, 'id'>): Promise<Site> {
  const { data: result, error } = await supabase.from('sites').insert(data).select().single()
  if (error) throw error
  return result as Site
}

export async function updateSite(id: string, data: Partial<Site>): Promise<Site> {
  const { data: result, error } = await supabase.from('sites').update(data).eq('id', id).select().single()
  if (error) throw error
  return result as Site
}

export async function removeSite(id: string): Promise<void> {
  const { error } = await supabase.from('sites').delete().eq('id', id)
  if (error) throw error
}
