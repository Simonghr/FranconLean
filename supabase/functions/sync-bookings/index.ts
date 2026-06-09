// ROLLER -> FranconLean Bookings sync.
//
// Fetches upcoming bookings from Roller and stores them in the `bookings` table.
// Primary use: show Anniversaire bookings for next weekend on the dashboard.
//
// POST body options:
//   { "debug": true }                                   -> dumps raw API response, no DB write
//   { "days": 14 }                                      -> next 14 days (default)
//   { "startDate":"2026-06-14","endDate":"2026-06-15" } -> explicit range

import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const ROLLER_BASE = "https://api.roller.app"
const SITE_ID = "00000000-0000-0000-0000-000000000001"
const DEFAULT_DAYS = 14
const ANNIVERSARY_PRODUCT_IDS = new Set(["1219385", "1219387", "1224203"])
const RATE_LIMIT_MS = 1050
const DAY_MS = 86400_000

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const ymd = (d: Date) => d.toISOString().split("T")[0]

async function getToken(clientId: string, clientSecret: string): Promise<string> {
  const res = await fetch(`${ROLLER_BASE}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ client_id: clientId, client_secret: clientSecret }),
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`Token failed: ${res.status} - ${text.slice(0, 300)}`)
  const token = JSON.parse(text)?.access_token
  if (!token) throw new Error(`No access_token: ${text.slice(0, 300)}`)
  return token
}

async function probe(token: string, path: string) {
  const res = await fetch(`${ROLLER_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
  })
  const text = await res.text()
  let body: any
  try { body = JSON.parse(text) } catch { body = text.slice(0, 500) }
  return { status: res.status, body }
}

async function fetchBookingsPage(token: string, startDate: string, endDate: string, page: number) {
  // Try different possible endpoints
  const url = `${ROLLER_BASE}/bookings?startDate=${startDate}&endDate=${endDate}&pageNumber=${page}&pageSize=100`
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    })
    if (res.status === 429) { await sleep(2000); continue }
    const text = await res.text()
    if (!res.ok) return { items: [], raw: { status: res.status, text: text.slice(0, 300) } }
    const parsed = JSON.parse(text)
    // Extract items from various response shapes
    let items: any[] = []
    if (Array.isArray(parsed)) items = parsed
    else if (parsed?.items) items = parsed.items
    else if (parsed?.data) items = parsed.data
    else if (parsed?.bookings) items = parsed.bookings
    else if (parsed?.results) items = parsed.results
    return { items, raw: parsed, totalPages: parsed?.totalPages ?? 1 }
  }
  return { items: [], raw: null, totalPages: 1 }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors })

  try {
    const clientId = Deno.env.get("ROLLER_CLIENT_ID_FRAN")
    const clientSecret = Deno.env.get("ROLLER_CLIENT_SECRET_FRAN")
    if (!clientId || !clientSecret) throw new Error("Missing Roller credentials in secrets")

    let body: any = {}
    try { body = await req.json() } catch (_) {}

    const debug = !!body?.debug
    const today = new Date()

    let startDate: string
    let endDate: string
    if (body?.startDate && body?.endDate) {
      startDate = body.startDate
      endDate = body.endDate
    } else {
      const days = Number(body?.days) > 0 ? Math.min(Number(body.days), 90) : DEFAULT_DAYS
      startDate = ymd(today)
      endDate = ymd(new Date(today.getTime() + (days - 1) * DAY_MS))
    }

    const token = await getToken(clientId, clientSecret)

    if (debug) {
      const [
        r1, r2, r3, r4, r5, r6, r7
      ] = await Promise.all([
        probe(token, `/bookings?bookingDate=${startDate}&pageNumber=1&pageSize=3`),
        probe(token, `/bookings?sessionDate=${startDate}&pageNumber=1&pageSize=3`),
        probe(token, `/bookings?date=${startDate}&pageNumber=1&pageSize=3`),
        probe(token, `/bookings?from=${startDate}&to=${endDate}&pageNumber=1&pageSize=3`),
        probe(token, `/bookings?createdFrom=${startDate}&createdTo=${endDate}&pageNumber=1&pageSize=3`),
        probe(token, `/bookings?bookingDateFrom=${startDate}&bookingDateTo=${endDate}&pageNumber=1&pageSize=3`),
        probe(token, `/products?pageNumber=1&pageSize=50`),
      ])

      return new Response(JSON.stringify({
        success: true,
        mode: "debug",
        dateRange: { startDate, endDate },
        endpoints: {
          "bookingDate=":       r1,
          "sessionDate=":       r2,
          "date=":              r3,
          "from/to=":           r4,
          "createdFrom/To=":    r5,
          "bookingDateFrom/To=":r6,
          "products (all)":     r7,
        },
      }, null, 2), { headers: { ...cors, "Content-Type": "application/json" } })
    }

    // Normal sync: fetch bookings in range
    const allBookings: any[] = []
    const errors: string[] = []

    for (let page = 1; page <= 20; page++) {
      await sleep(RATE_LIMIT_MS)
      const result = await fetchBookingsPage(token, startDate, endDate, page)
      allBookings.push(...result.items)
      if (result.items.length === 0 || page >= (result.totalPages ?? 1)) break
    }

    // Extract booking rows — look for Anniversaire products
    const rows: any[] = []
    for (const b of allBookings) {
      const items = b?.items ?? []
      for (const item of items) {
        const bookingDate = item?.bookingDate ?? item?.date ?? null
        const productName: string = item?.productName ?? item?.name ?? item?.product?.name ?? ""
        rows.push({
          site_id: SITE_ID,
          roller_booking_id: String(b?.bookingReference ?? b?.id ?? ""),
          booking_date: bookingDate,
          customer_name: b?.name ?? null,
          product_name: productName,
          product_id: String(item?.productId ?? ""),
          quantity: item?.quantity ?? 1,
          status: b?.status ?? null,
          is_anniversary: ANNIVERSARY_PRODUCT_IDS.has(String(item?.productId ?? "")),
        })
      }
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
    if (!supabaseUrl || !supabaseKey) throw new Error("Missing Supabase env vars")
    const supabase = createClient(supabaseUrl, supabaseKey)

    let synced = 0
    if (rows.length) {
      try {
        const r = await supabase.from("bookings").upsert(rows, { onConflict: "roller_booking_id,product_id" })
        if (r?.error) errors.push(`bookings upsert: ${r.error.message}`)
        else synced = rows.length
      } catch (e) {
        errors.push(`bookings skipped: ${String(e).slice(0, 200)}`)
      }
    }

    return new Response(JSON.stringify({
      success: true,
      dateRange: { startDate, endDate },
      bookingsReceived: allBookings.length,
      rowsSynced: synced,
      anniversaireCount: rows.filter(r => r.is_anniversary).length,
      errors: errors.length ? errors : undefined,
    }, null, 2), { headers: { ...cors, "Content-Type": "application/json" } })

  } catch (error) {
    const message = error instanceof Error ? error.message : JSON.stringify(error)
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    })
  }
})
