import { supabase } from '@/lib/supabase'

export interface BudgetEntry {
  site_id: string
  date: string
  target: number
}

export async function getAll(site_id: string): Promise<BudgetEntry[]> {
  const { data, error } = await supabase
    .from('budgets')
    .select('*')
    .eq('site_id', site_id)
    .order('date', { ascending: true })
  if (error) throw error
  return data as BudgetEntry[]
}

export async function upsertMany(entries: BudgetEntry[]): Promise<void> {
  const { error } = await supabase
    .from('budgets')
    .upsert(entries, { onConflict: 'site_id,date' })
  if (error) throw error
}

export async function syncSalesTargets(site_id: string, entries: BudgetEntry[]): Promise<void> {
  for (const entry of entries) {
    const { error } = await supabase
      .from('sales')
      .update({ target: entry.target })
      .eq('site_id', site_id)
      .eq('date', entry.date)
      .eq('period', 'day')
    if (error) throw error
  }
}
