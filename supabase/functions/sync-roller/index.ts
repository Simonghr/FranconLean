// ROLLER Data API sync.
// Auth confirmed from ROLLER docs:
//   POST https://api.roller.app/token
//   Content-Type: application/json
//   Body: {"client_id": "...", "client_secret": "..."}
//   -> { access_token, token_type: "Bearer", expires_in }
// Requests: Authorization: Bearer <token>, Accept: application/json

import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const ROLLER_BASE = "https://api.roller.app"
const SITE_ID = "00000000-0000-0000-0000-000000000001"

// Revenue endpoint candidates — /data/revenues is deprecated, so probe v2 variants.
const REVENUE_PATHS = [
  "/data/v2/revenues",
  "/data/v2/revenue-entries",
  "/data/revenue-entries",
  "/v2/data/revenues",
  "/data/v1/revenues",
  "/reporting/revenues",
]

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

async function getToken(clientId: string, clientSecret: string): Promise<string> {
  const res = await fetch(`${ROLLER_BASE}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ client_id: clientId, client_secret: clientSecret }),
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`Token request failed: ${res.status} - ${text.slice(0, 300)}`)
  const token = JSON.parse(text)?.access_token
  if (!token) throw new Error(`No access_token in response: ${text.slice(0, 300)}`)
  return token
}

async function probeRevenue(token: string, from: string, to: string) {
  const queries = [
    `startDate=${from}&endDate=${to}`,
    `dateFrom=${from}&dateTo=${to}`,
  ]
  for (const path of REVENUE_PATHS) {
    for (const q of queries) {
      const url = `${ROLLER_BASE}${path}?${q}`
      try {
        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
        })
        const text = await res.text()
        if (res.ok) return { url, ok: true, body: text }
        // 404 = wrong path, 409 = deprecated -> keep probing other candidates
        if (res.status !== 404 && res.status !== 409) {
          return { url, ok: false, status: res.status, body: text.slice(0, 300) }
        }
      } catch (e) {
        return { url, ok: false, error: String(e).slice(0, 200) }
      }
    }
  }
  return { ok: false, status: 404, note: "No revenue path matched" }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors })

  try {
    const clientId = Deno.env.get("ROLLER_CLIENT_ID_FRAN")
    const clientSecret = Deno.env.get("ROLLER_CLIENT_SECRET_FRAN")
    if (!clientId || !clientSecret) throw new Error("Missing Roller credentials in secrets")

    const to = new Date().toISOString().split("T")[0]
    const from = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]

    // 1. Authenticate (JSON body, per ROLLER docs)
    const token = await getToken(clientId, clientSecret)

    // 2. Find + fetch revenue data
    const revenue = await probeRevenue(token, from, to)
    if (!revenue.ok) {
      return new Response(
        JSON.stringify(
          { success: true, auth: "ok", revenue, note: "Token works. Paste this so we can map the revenue endpoint." },
          null,
          2
        ),
        { headers: { ...cors, "Content-Type": "application/json" } }
      )
    }

    // 3. Map revenue into the sales table
    const parsed = JSON.parse(revenue.body!)
    const items =
      parsed?.data || parsed?.items || parsed?.revenues || parsed?.results || (Array.isArray(parsed) ? parsed : [])

    // Aggregate revenue per day (Roller returns granular entries)
    const byDay = new Map<string, number>()
    for (const it of items) {
      const rawDate = it.date || it.entryDate || it.businessDate || it.startDate || it.transactionDate
      const amount = it.fundsReceived ?? it.recognisedRevenue ?? it.total ?? it.amount ?? it.revenue ?? it.netRevenue
      if (rawDate && amount != null) {
        const day = String(rawDate).split("T")[0]
        byDay.set(day, (byDay.get(day) ?? 0) + Number(amount))
      }
    }

    const rows = [...byDay.entries()].map(([date, amount]) => ({
      site_id: SITE_ID,
      date,
      amount: Math.round(amount * 100) / 100,
      target: 10000,
      period: "day",
    }))

    let upserted = 0
    if (rows.length) {
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      )
      const { error } = await supabase.from("sales").upsert(rows, { onConflict: "site_id,date,period" })
      if (error) throw error
      upserted = rows.length
    }

    return new Response(
      JSON.stringify(
        {
          success: true,
          auth: "ok",
          revenueEndpoint: revenue.url,
          dateRange: { from, to },
          daysSynced: upserted,
          entriesReceived: items.length,
          sample: JSON.stringify(items[0] ?? null).slice(0, 500),
        },
        null,
        2
      ),
      { headers: { ...cors, "Content-Type": "application/json" } }
    )
  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: String(error) }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    })
  }
})
