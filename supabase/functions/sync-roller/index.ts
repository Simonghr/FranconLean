// ROLLER -> FranconLean revenue sync.
//
// Auth:  POST https://api.roller.app/token  (JSON body {client_id, client_secret})
// Data:  GET  https://api.roller.app/reporting/revenue-entries?startDate&endDate&pageNumber
//        Range capped at 1 day -> loop day-by-day. Rate limit ~1 req/sec.
//
// CA HT = sum of `netRevenue` across ALL entry types, per day.
// Verified: 2026-05-30 sums to 12,130.87 EUR, matching Roller's "Revenu" dashboard exactly.
//
// POST body options:
//   { "days": 30 }                                      -> last 30 days, sync to DB
//   { "startDate":"2026-05-01","endDate":"2026-05-31" } -> explicit range, sync to DB
//   { ...range, "debug": true } -> NO DB write; sums key fields broken down by entryType

import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const ROLLER_BASE = "https://api.roller.app"
const SITE_ID = "00000000-0000-0000-0000-000000000001"
const DEFAULT_DAYS = 7
const DAILY_TARGET = 10000
const MAX_PAGES_PER_DAY = 20
const RATE_LIMIT_MS = 1050
const DAY_MS = 86400_000

const DEBUG_FIELDS = [
  "netRevenue",
  "taxPayable",
  "recognisedDiscount",
  "transactionValue",
  "fundsReceived",
  "taxOnFundsReceived",
  "feeRevenue",
  "deferredRevenue",
  "deferredRevenueGiftCards",
  "manualGiftCardAdjustment",
  "deferredRevenueOther",
  "accountsReceivable",
  "voucherFundsReceived",
  "discount",
  "deferredFeeRevenue",
  "taxOnFees",
  "multiVenueGiftCardReceivable",
  "multiVenueGiftCardPayable",
]

// Date fields to inspect — helps diagnose which date Roller uses to assign an entry to a day
const DATE_FIELDS = [
  "date",
  "transactionDate",
  "recognitionDate",
  "recognisedDate",
  "createdAt",
  "updatedAt",
  "sessionDate",
  "visitDate",
]

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const ymd = (d: Date) => d.toISOString().split("T")[0]
const r2 = (n: number) => Math.round(n * 100) / 100

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

    let body: any = {}
    try {
      body = await req.json()
    } catch (_) {}

    const debug = !!body?.debug

    const today = new Date()
    let firstDay: Date
    let lastDay: Date
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

    const token = await getToken(clientId, clientSecret)

    const byDay = new Map<string, number>()
    const debugDays: any[] = []
    const errors: string[] = []
    let entriesReceived = 0

    for (let cur = new Date(firstDay); ymd(cur) <= lastDateStr; cur = new Date(cur.getTime() + DAY_MS)) {
      const dayStr = ymd(cur)
      try {
        const entries = await fetchDay(token, dayStr)
        entriesReceived += entries.length

        if (debug) {
          const types: Record<string, any> = {}
          for (const e of entries) {
            const t = String(e?.entryType ?? "Unknown")
            const slot = (types[t] ??= { count: 0 })
            slot.count += 1
            for (const f of DEBUG_FIELDS) slot[f] = (slot[f] ?? 0) + Number(e[f] ?? 0)
          }
          for (const t of Object.keys(types)) {
            for (const f of DEBUG_FIELDS) types[t][f] = r2(types[t][f])
          }
          // Expose all date fields found on the first entry to understand Roller's date model
          const dateFieldsFound: Record<string, string> = {}
          if (entries.length > 0) {
            for (const f of DATE_FIELDS) {
              if (entries[0][f] !== undefined) dateFieldsFound[f] = String(entries[0][f])
            }
            for (const k of Object.keys(entries[0])) {
              if (k.toLowerCase().includes("date") || k.toLowerCase().includes("time") || k.toLowerCase().includes("at")) {
                if (!(k in dateFieldsFound)) dateFieldsFound[k] = String(entries[0][k])
              }
            }
          }
          // Dump the first Recognition entry in full to inspect its dates and all numeric fields
          const firstRecognition = entries.find((e: any) => e?.entryType === "Recognition") ?? null
          debugDays.push({
            date: dayStr,
            entries: entries.length,
            byType: types,
            dateFields: dateFieldsFound,
            firstRecognitionEntry: firstRecognition,
          })
        }

        // CA HT = sum of netRevenue across ALL entry types
        let dayTotal = 0
        for (const e of entries) {
          const net = Number(e.netRevenue ?? 0)
          if (!Number.isNaN(net)) dayTotal += net
        }
        byDay.set(dayStr, dayTotal)
      } catch (e) {
        errors.push(String(e).slice(0, 200))
      }
    }

    if (debug) {
      return new Response(
        JSON.stringify(
          { success: true, mode: "debug", dateRange: { startDate, endDate: lastDateStr }, entriesReceived, debugDays, errors: errors.length ? errors : undefined },
          null,
          2
        ),
        { headers: { ...cors, "Content-Type": "application/json" } }
      )
    }

    const rows = [...byDay.entries()]
      .map(([date, amount]) => ({
        site_id: SITE_ID,
        date,
        amount: r2(amount),
        target: DAILY_TARGET,
        period: "day",
      }))
      .sort((a, b) => a.date.localeCompare(b.date))

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    )

    let synced = 0
    if (rows.length) {
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
          totalCA: r2(rows.reduce((s, r) => s + r.amount, 0)),
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
