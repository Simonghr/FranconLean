// ROLLER -> FranconLean revenue sync.
//
// Auth (confirmed from docs):
//   POST https://api.roller.app/token  | Content-Type: application/json
//   body {"client_id","client_secret"} -> { access_token, token_type:"Bearer", expires_in }
//
// Revenue (confirmed from docs):
//   GET https://api.roller.app/reporting/revenue-entries?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD&pageNumber=N
//   Header: Authorization: Bearer <token>, Accept: application/json
//   IMPORTANT: the range is capped at 1 day -> endDate must be startDate + 1 (exclusive).
//   So we loop day-by-day. ROLLER rate limit is ~1 request/second per credentials.
//
// CA HT (chiffre d'affaires hors taxes) = sum of `netRevenue` for entryType === "Transaction",
// grouped per day. netRevenue is the after-tax (ex-VAT) revenue per entry.
//
// Optional POST body to control the window:
//   { "days": 30 }                              -> last 30 days
//   { "startDate": "2026-05-01", "endDate": "2026-05-31" }  -> explicit range (inclusive)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const ROLLER_BASE = "https://api.roller.app"
const SITE_ID = "00000000-0000-0000-0000-000000000001"
const DEFAULT_DAYS = 7
const DAILY_TARGET = 10000
const MAX_PAGES_PER_DAY = 10
const RATE_LIMIT_MS = 1050 // ROLLER allows ~1 request/second per credentials
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

// GET one page, retrying once on 429 (rate limited).
async function getPage(token: string, dayStart: string, dayEnd: string, page: number) {
  const url = `${ROLLER_BASE}/reporting/revenue-entries?startDate=${dayStart}&endDate=${dayEnd}&pageNumber=${page}`
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    })
    if (res.status === 429) {
      await sleep(2000)
      continue
    }
    const text = await res.text()
    if (!res.ok) throw new Error(`${dayStart}: ${res.status} - ${text.slice(0, 200)}`)
    return extractEntries(JSON.parse(text))
  }
  throw new Error(`${dayStart}: rate limited (429) after retry`)
}

// Fetch one day's entries (handles pagination within the day).
async function fetchDay(token: string, dayStart: string) {
  const dayEnd = ymd(new Date(new Date(dayStart).getTime() + DAY_MS))
  const all: any[] = []
  for (let page = 1; page <= MAX_PAGES_PER_DAY; page++) {
    await sleep(RATE_LIMIT_MS)
    const entries = await getPage(token, dayStart, dayEnd, page)
    all.push(...entries)
    if (entries.length === 0) break
  }
  return all
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors })

  try {
    const clientId = Deno.env.get("ROLLER_CLIENT_ID_FRAN")
    const clientSecret = Deno.env.get("ROLLER_CLIENT_SECRET_FRAN")
    if (!clientId || !clientSecret) throw new Error("Missing Roller credentials in secrets")

    // Parse optional body (ignore the dashboard's default {"name":"Functions"}).
    let body: any = {}
    try {
      body = await req.json()
    } catch (_) {
      // no/invalid body -> defaults
    }

    const today = new Date()
    let firstDay: Date
    let lastDay: Date // inclusive
    if (body?.startDate && body?.endDate) {
      firstDay = new Date(body.startDate)
      lastDay = new Date(body.endDate)
    } else {
      const days = Number(body?.days) > 0 ? Math.min(Number(body.days), 92) : DEFAULT_DAYS
      lastDay = today
      firstDay = new Date(today.getTime() - (days - 1) * DAY_MS)
    }

    const startDate = ymd(firstDay)
    const lastDateStr = ymd(lastDay)

    // 1. Auth
    const token = await getToken(clientId, clientSecret)

    // 2. Loop day-by-day (API max range = 1 day)
    const byDay = new Map<string, number>()
    const errors: string[] = []
    let entriesReceived = 0

    for (let cur = new Date(firstDay); ymd(cur) <= lastDateStr; cur = new Date(cur.getTime() + DAY_MS)) {
      const dayStr = ymd(cur)
      try {
        const entries = await fetchDay(token, dayStr)
        entriesReceived += entries.length
        for (const e of entries) {
          if (e?.entryType !== "Transaction") continue
          const d = String(e.recordDate ?? e.transactionDate ?? dayStr).split("T")[0]
          const net = Number(e.netRevenue ?? 0)
          if (Number.isNaN(net)) continue
          byDay.set(d, (byDay.get(d) ?? 0) + net)
        }
        if (!byDay.has(dayStr)) byDay.set(dayStr, byDay.get(dayStr) ?? 0) // keep 0-CA days
      } catch (e) {
        errors.push(String(e).slice(0, 200))
      }
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

    // 3. Replace the synced window in `sales` (delete + insert)
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    )

    let synced = 0
    if (rows.length) {
      // Ensure the Franconville site row exists (sales.site_id has a FK to sites.id)
      const { error: siteErr } = await supabase
        .from("sites")
        .upsert({ id: SITE_ID, name: "Franconville" }, { onConflict: "id" })
      if (siteErr) throw new Error(`upsert site: ${siteErr.message}`)

      const { error: delErr } = await supabase
        .from("sales")
        .delete()
        .eq("site_id", SITE_ID)
        .eq("period", "day")
        .gte("date", startDate)
        .lte("date", lastDateStr)
      if (delErr) throw new Error(`delete sales: ${delErr.message}`)

      const { error: insErr } = await supabase.from("sales").insert(rows)
      if (insErr) throw new Error(`insert sales: ${insErr.message}`)
      synced = rows.length
    }

    return new Response(
      JSON.stringify(
        {
          success: true,
          dateRange: { startDate, endDate: lastDateStr },
          entriesReceived,
          daysSynced: synced,
          totalCA: Math.round(rows.reduce((s, r) => s + r.amount, 0) * 100) / 100,
          days: rows,
          errors: errors.length ? errors : undefined,
        },
        null,
        2
      ),
      { headers: { ...cors, "Content-Type": "application/json" } }
    )
  } catch (error) {
    const message =
      error instanceof Error ? error.message : (error as any)?.message ?? JSON.stringify(error)
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    })
  }
})
