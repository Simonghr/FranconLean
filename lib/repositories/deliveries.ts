import { supabase } from '@/lib/supabase'
import type { Delivery, DeliveryLine } from '@/lib/types'

export async function list(site_id: string): Promise<Delivery[]> {
  const { data, error } = await supabase
    .from('deliveries')
    .select('*')
    .eq('site_id', site_id)
    .order('delivery_date', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
  if (error) throw error
  return data as Delivery[]
}

export async function create(
  data: Pick<Delivery, 'site_id'> & Partial<Pick<Delivery, 'supplier' | 'delivery_date' | 'invoice_number' | 'source_file'>>
): Promise<Delivery> {
  const { data: result, error } = await supabase.from('deliveries').insert(data).select().single()
  if (error) throw error
  return result as Delivery
}

export async function update(
  id: string,
  patch: Partial<Pick<Delivery, 'supplier' | 'delivery_date' | 'invoice_number' | 'status'>>
): Promise<Delivery> {
  const { data, error } = await supabase
    .from('deliveries')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id).select().single()
  if (error) throw error
  return data as Delivery
}

export async function remove(id: string): Promise<void> {
  const { error } = await supabase.from('deliveries').delete().eq('id', id)
  if (error) throw error
}

export async function getLines(delivery_id: string): Promise<DeliveryLine[]> {
  const { data, error } = await supabase
    .from('delivery_lines').select('*').eq('delivery_id', delivery_id)
    .order('created_at', { ascending: true })
  if (error) throw error
  return data as DeliveryLine[]
}

export async function addLine(
  delivery_id: string,
  data: Partial<Pick<DeliveryLine, 'product_id' | 'raw_label' | 'raw_ref' | 'raw_qty' | 'raw_pack' | 'qty' | 'unit_price' | 'ignored'>>
): Promise<DeliveryLine> {
  const { data: result, error } = await supabase
    .from('delivery_lines').insert({ delivery_id, ...data }).select().single()
  if (error) throw error
  return result as DeliveryLine
}

export async function updateLine(
  id: string,
  patch: Partial<Pick<DeliveryLine, 'product_id' | 'raw_label' | 'raw_ref' | 'raw_qty' | 'raw_pack' | 'qty' | 'unit_price' | 'ignored'>>
): Promise<DeliveryLine> {
  const { data, error } = await supabase.from('delivery_lines').update(patch).eq('id', id).select().single()
  if (error) throw error
  return data as DeliveryLine
}

export async function deleteLine(id: string): Promise<void> {
  const { error } = await supabase.from('delivery_lines').delete().eq('id', id)
  if (error) throw error
}

// Remember "this supplier reference maps to this product" for future invoices.
export async function rememberRef(site_id: string, supplier: string, supplier_ref: string, product_id: string): Promise<void> {
  const { error } = await supabase
    .from('product_supplier_refs')
    .upsert({ site_id, supplier, supplier_ref, product_id }, { onConflict: 'site_id,supplier,supplier_ref' })
  if (error) throw error
}

export async function getRefs(site_id: string, supplier: string): Promise<Record<string, string>> {
  const { data, error } = await supabase
    .from('product_supplier_refs').select('supplier_ref, product_id')
    .eq('site_id', site_id).eq('supplier', supplier)
  if (error) throw error
  const map: Record<string, string> = {}
  for (const r of (data ?? []) as { supplier_ref: string; product_id: string }[]) map[r.supplier_ref] = r.product_id
  return map
}
