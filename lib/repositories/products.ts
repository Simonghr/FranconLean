import { supabase } from '@/lib/supabase'
import type { Product, InventoryCount } from '@/lib/types'

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

// Snapshot every product's current_stock into the history table under one session date.
export async function saveInventory(site_id: string, products: Product[], session_date: string): Promise<void> {
  const rows = products
    .filter(p => p.current_stock != null)
    .map(p => ({ site_id, product_id: p.id, counted: p.current_stock as number, session_date }))
  if (rows.length === 0) return
  const { error } = await supabase.from('inventory_counts').insert(rows)
  if (error) throw error
}

export async function getHistory(site_id: string): Promise<InventoryCount[]> {
  const { data, error } = await supabase
    .from('inventory_counts')
    .select('*')
    .eq('site_id', site_id)
    .order('session_date', { ascending: false })
  if (error) throw error
  return data as InventoryCount[]
}
