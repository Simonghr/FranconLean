import { supabase } from '@/lib/supabase'
import type { RecipeLine } from '@/lib/types'

// Normalise a product name so a recipe keyed on one spelling still matches the
// slightly different spelling that appears in a Roller sales export.
export function normName(s: string): string {
  return s
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // strip accents
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim()
}

export async function getAll(site_id: string): Promise<RecipeLine[]> {
  const { data, error } = await supabase
    .from('recipe_lines').select('*').eq('site_id', site_id)
    .order('roller_name', { ascending: true })
  if (error) throw error
  return data as RecipeLine[]
}

export async function addLine(
  site_id: string, roller_name: string, product_id: string, qty: number
): Promise<RecipeLine> {
  const { data, error } = await supabase
    .from('recipe_lines')
    .upsert({ site_id, roller_name, product_id, qty }, { onConflict: 'site_id,roller_name,product_id' })
    .select().single()
  if (error) throw error
  return data as RecipeLine
}

export async function updateLine(id: string, patch: Partial<Pick<RecipeLine, 'product_id' | 'qty'>>): Promise<RecipeLine> {
  const { data, error } = await supabase.from('recipe_lines').update(patch).eq('id', id).select().single()
  if (error) throw error
  return data as RecipeLine
}

export async function deleteLine(id: string): Promise<void> {
  const { error } = await supabase.from('recipe_lines').delete().eq('id', id)
  if (error) throw error
}

// Delete every component of one sold product (a whole recipe).
export async function deleteRecipe(site_id: string, roller_name: string): Promise<void> {
  const { error } = await supabase
    .from('recipe_lines').delete().eq('site_id', site_id).eq('roller_name', roller_name)
  if (error) throw error
}

// Map: normalised sold-product name -> its components. Used at sales apply time.
export function buildMap(lines: RecipeLine[]): Map<string, RecipeLine[]> {
  const m = new Map<string, RecipeLine[]>()
  for (const l of lines) {
    const k = normName(l.roller_name)
    const arr = m.get(k) ?? []
    arr.push(l)
    m.set(k, arr)
  }
  return m
}
