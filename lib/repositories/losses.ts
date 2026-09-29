import { supabase } from '@/lib/supabase'
import type { StockLoss } from '@/lib/types'

export async function list(site_id: string): Promise<StockLoss[]> {
  const { data, error } = await supabase
    .from('stock_losses').select('*').eq('site_id', site_id)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data as StockLoss[]
}

export async function create(
  data: Pick<StockLoss, 'site_id' | 'quantity'> &
    Partial<Pick<StockLoss, 'product_id' | 'product_name' | 'unit' | 'reason' | 'created_at'>>
): Promise<StockLoss> {
  const { data: result, error } = await supabase.from('stock_losses').insert(data).select().single()
  if (error) throw error
  return result as StockLoss
}

export async function remove(id: string): Promise<void> {
  const { error } = await supabase.from('stock_losses').delete().eq('id', id)
  if (error) throw error
}
