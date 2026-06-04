// ROLLER -> FranconLean revenue sync.
//
// Auth (confirmed from docs):
//   POST https://api.roller.app/token  | Content-Type: application/json
//   body {"client_id","client_secret"} -> { access_token, token_type:"Bearer", expires_in }
//
// Revenue (confirmed from docs):
//   GET https://api.roller.app/reporting/revenue-entries?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD&pageNumber=N
//   Header: Authorization: Bearer <token>, Accept: application/json
//   endDate is exclusive (docs: "should be +1 day from the startDate").
//   Each entry has: recordDate, entryType (Transaction|Recognition|Adjustment), fundsReceived, netRevenue, ...
//
// CA (chiffre d'affaires) = sum of `fundsReceived` for entryType === "Transaction", grouped by recordDate (day).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const ROLLER_BASE = "https://api.roller.app"
const SITE_ID = "00000000-0000-0000-0000-000000000001"
const DAYS_BACK = 30
const DAILY_TARGET = 10000
const MAX_PAGES = 20
const RATE_LIMIT_MS = 1100 // ROLLER allows ~1 request/second per credentials

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

// Normalise whatever shape ROLLER returns into a flat array of entries.
function extractEntries(parsed: unknown): any[] {
  if (Array.isArray(parsed)) return parsed
  if (parsed && typeof parsed === "object") {
    const o = parsed as Record<string, unknown>
    for (const key of ["data", "items", "results", "revenueEntries", "entries"]) {
      if (Array.isArray(o[key])) return o[key] as any[]
    }
  }
  return []
}

async function fetchRevenueEntries(token: string, startDate: string, endDate: string) {
  const all: any[] = []
  for (let page = 1; page <= MAX_PAGES; page++) {
    const url = `${ROLLER_BASE}/reporting/revenue-entries?startDate=${startDate}&endDate=${endDate}&pageNumber=${page}`
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    })
    const text = await res.text()
    if (!res.ok) {
      if (page === 1) throw new Error(`Revenue fetch failed: ${res.status} - ${text.slice(0, 300)}`)
      break // a later page failed; keep what we have
    }
    const entries = extractEntries(JSON.parse(text))
    all.push(...entries)
    if (entries.length === 0) break // no more pages
    await sleep(RATE_LIMIT_MS)
  }
  return all
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors })

  try {
    const clientId = Deno.env.get("ROLLER_CLIENT_ID_FRAN")
    const clientSecret = Deno.env.get("ROLLER_CLIENT_SECRET_FRAN")
    if (!clientId || !clientSecret) throw new Error("Missing Roller credentials in secrets")

    const today = new Date()
    const start = new Date(today.getTime() - DAYS_BACK * 86400_000)
    const startDate = ymd(start)
    const endDate = ymd(new Date(today.getTime() + 86400_000)) // exclusive end = tomorrow

    // 1. Auth
    const token = await getToken(clientId, clientSecret)

    // 2. Fetch + paginate revenue entries
    const entries = await fetchRevenueEntries(token, startDate, endDate)

    // 3. Aggregate CA per day: funds received on Transaction entries
    const byDay = new Map<string, number>()
    for (const e of entries) {
      if (e?.entryType !== "Transaction") continue
      const day = String(e.recordDate ?? e.transactionDate ?? "").split("T")[0]
      const funds = Number(e.fundsReceived ?? 0)
      if (!day || Number.isNaN(funds)) continue
      byDay.set(day, (byDay.get(day) ?? 0) + funds)
    }

    const rows = [...byDay.entries()]
      .map(([date, amount]) => ({
        site_id: SITE_ID,
        date,
        amount: Math.round(amount * 100) / 100,
        target: DAILY_TARGET,
        period: "day",
      }))
      .sort((a, b) => a.date.localeCompare(b.date))

    // 4. Replace the synced window in `sales` (delete + insert, no unique constraint needed)
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    )

    let synced = 0
    if (rows.length) {
      const { error: delErr } = await supabase
        .from("sales")
        .delete()
        .eq("site_id", SITE_ID)
        .eq("period", "day")
        .gte("date", startDate)
        .lte("date", ymd(today))
      if (delErr) throw delErr

      const { error: insErr } = await supabase.from("sales").insert(rows)
      if (insErr) throw insErr
      synced = rows.length
    }

    return new Response(
      JSON.stringify(
        {
          success: true,
          dateRange: { startDate, endDate },
          entriesReceived: entries.length,
          daysSynced: synced,
          totalCA: Math.round(rows.reduce((s, r) => s + r.amount, 0) * 100) / 100,
          days: rows,
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
