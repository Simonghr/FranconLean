import { supabase } from '@/lib/supabase'
import type { RollerAlias, SalesImport, SalesLine } from '@/lib/types'

// ── Imports ────────────────────────────────────────────────────────────────

export async function list(site_id: string): Promise<SalesImport[]> {
  const { data, error } = await supabase
    .from('sales_imports')
    .select('*')
    .eq('site_id', site_id)
    .order('period_date', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
  if (error) throw error
  return data as SalesImport[]
}

export async function create(
  data: Pick<SalesImport, 'site_id'> & Partial<Pick<SalesImport, 'label' | 'period_date' | 'source_file'>>
): Promise<SalesImport> {
  const { data: result, error } = await supabase.from('sales_imports').insert(data).select().single()
  if (error) throw error
  return result as SalesImport
}

export async function update(
  id: string,
  patch: Partial<Pick<SalesImport, 'label' | 'period_date' | 'status'>>
): Promise<SalesImport> {
  const { data, error } = await supabase
    .from('sales_imports')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id).select().single()
  if (error) throw error
  return data as SalesImport
}

export async function remove(id: string): Promise<void> {
  const { error } = await supabase.from('sales_imports').delete().eq('id', id)
  if (error) throw error
}

// ── Lines ──────────────────────────────────────────────────────────────────

export async function getLines(import_id: string): Promise<SalesLine[]> {
  const { data, error } = await supabase
    .from('sales_lines').select('*').eq('import_id', import_id)
    .order('roller_name', { ascending: true })
  if (error) throw error
  return data as SalesLine[]
}

export async function addLines(
  import_id: string,
  rows: Array<Pick<SalesLine, 'roller_name'> & Partial<Pick<SalesLine, 'category' | 'qty_sold' | 'product_id' | 'deductible'>>>
): Promise<SalesLine[]> {
  const { data, error } = await supabase
    .from('sales_lines')
    .insert(rows.map(r => ({ import_id, ...r })))
    .select()
  if (error) throw error
  return data as SalesLine[]
}

export async function updateLine(
  id: string,
  patch: Partial<Pick<SalesLine, 'product_id' | 'deductible' | 'qty_sold'>>
): Promise<SalesLine> {
  const { data, error } = await supabase.from('sales_lines').update(patch).eq('id', id).select().single()
  if (error) throw error
  return data as SalesLine
}

// Distinct Roller product names seen across all imports for a site (for pickers).
export async function knownRollerNames(site_id: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('sales_lines')
    .select('roller_name, sales_imports!inner(site_id)')
    .eq('sales_imports.site_id', site_id)
  if (error) throw error
  const set = new Set<string>()
  for (const r of (data ?? []) as { roller_name: string }[]) set.add(r.roller_name)
  return [...set].sort((a, b) => a.localeCompare(b))
}

// ── Aliases (remember roller product → cadencier product + deductible) ───────

export async function getAliases(site_id: string): Promise<Record<string, RollerAlias>> {
  const { data, error } = await supabase.from('roller_aliases').select('*').eq('site_id', site_id)
  if (error) throw error
  const map: Record<string, RollerAlias> = {}
  for (const a of (data ?? []) as RollerAlias[]) map[a.roller_name] = a
  return map
}

export async function rememberAlias(
  site_id: string, roller_name: string, product_id: string | null, deductible: boolean
): Promise<void> {
  const { error } = await supabase
    .from('roller_aliases')
    .upsert({ site_id, roller_name, product_id, deductible }, { onConflict: 'site_id,roller_name' })
  if (error) throw error
}
