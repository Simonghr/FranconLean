import { supabase } from '@/lib/supabase'

export interface Booking {
  id: string
  site_id: string
  roller_booking_id: string
  booking_date: string | null
  customer_name: string | null
  product_name: string
  product_id: string
  quantity: number
  status: string | null
  is_anniversary: boolean
}

export async function getAnniversaryBookings(site_id: string): Promise<Booking[]> {
  const { data, error } = await supabase
    .from('bookings')
    .select('*')
    .eq('site_id', site_id)
    .or('is_anniversary.eq.true,product_name.ilike.%anniversaire%')
  if (error) throw error
  return data as Booking[]
}
