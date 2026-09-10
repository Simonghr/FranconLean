import { supabase } from '@/lib/supabase'
import type { Product, CountSession, CountLine } from '@/lib/types'

export async function getAll(site_id: string): Promise<Product[]> {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('site_id', site_id)
    .order('position', { ascending: true })
  if (error) throw error
  return data as Product[]
}

export async function create(
  data: Pick<Product, 'site_id' | 'supplier' | 'name'> &
    Partial<Pick<Product, 'price' | 'pack_size' | 'target_stock' | 'zone' | 'note' | 'position' | 'current_stock'>>
): Promise<Product> {
  const { data: result, error } = await supabase.from('products').insert(data).select().single()
  if (error) throw error
  return result as Product
}

export async function update(
  id: string,
  data: Partial<Pick<Product, 'supplier' | 'name' | 'price' | 'pack_size' | 'target_stock' | 'zone' | 'note' | 'position' | 'current_stock'>>
): Promise<Product> {
  const { data: result, error } = await supabase.from('products').update(data).eq('id', id).select().single()
  if (error) throw error
  return result as Product
}

export async function remove(id: string): Promise<void> {
  const { error } = await supabase.from('products').delete().eq('id', id)
  if (error) throw error
}

// Persist an ordered list of ids by writing their new position.
export async function saveOrder(ids: string[]): Promise<void> {
  await Promise.all(
    ids.map((id, i) => supabase.from('products').update({ position: (i + 1) * 10 }).eq('id', id))
  )
}

// ── Counting sessions ──────────────────────────────────────────────────────

// Most recent draft (in-progress) session for a site, or null.
export async function getActiveSession(site_id: string): Promise<CountSession | null> {
  const { data, error } = await supabase
    .from('count_sessions')
    .select('*')
    .eq('site_id', site_id)
    .eq('status', 'draft')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return (data as CountSession) ?? null
}

export async function createSession(
  data: Pick<CountSession, 'site_id' | 'session_date'> &
    Partial<Pick<CountSession, 'session_time' | 'author_first' | 'author_last'>>
): Promise<CountSession> {
  const { data: result, error } = await supabase.from('count_sessions').insert(data).select().single()
  if (error) throw error
  return result as CountSession
}

export async function updateSession(
  id: string,
  patch: Partial<Pick<CountSession, 'status' | 'session_date' | 'session_time' | 'author_first' | 'author_last'>>
): Promise<CountSession> {
  const { data, error } = await supabase
    .from('count_sessions')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data as CountSession
}

export async function getLines(session_id: string): Promise<CountLine[]> {
  const { data, error } = await supabase.from('count_lines').select('*').eq('session_id', session_id)
  if (error) throw error
  return data as CountLine[]
}

export async function setLine(session_id: string, product_id: string, quantity: number | null): Promise<void> {
  const { error } = await supabase
    .from('count_lines')
    .upsert({ session_id, product_id, quantity }, { onConflict: 'session_id,product_id' })
  if (error) throw error
}
