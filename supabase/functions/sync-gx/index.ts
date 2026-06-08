// ROLLER -> FranconLean Guest Experience (GX) score sync.
//
// Auth:  POST https://api.roller.app/token  (JSON body {client_id, client_secret})
// Data:  GET  https://api.roller.app/reporting/gx-score-responses?...&pageNumber
//        (Roller's "GX Score" is an NPS-like guest-survey metric, scaled -100..+100,
//        built from individual survey responses — we aggregate the daily average here.)
//
// NOTE: Roller's exact response field names for this endpoint aren't in our codebase yet
// (the API docs page requires a logged-in Roller account). This function therefore starts
// in DEBUG mode: it dumps the raw first page so we can see real field names, then we wire
// up the aggregation against the confirmed shape — same iterative process used to build
// sync-roller (whose CA figures now match Roller's dashboard to within a few cents).
//
// POST body options:
//   { "debug": true }                                   -> dumps raw API response, no DB write
//   { "days": 30 }                                      -> last 30 days, sync to DB
//   { "startDate":"2026-05-01","endDate":"2026-05-31" } -> explicit range, sync to DB

import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const ROLLER_BASE = "https://api.roller.app"
const SITE_ID = "00000000-0000-0000-0000-000000000001"
const DEFAULT_DAYS = 30
const MAX_PAGES = 20
const RATE_LIMIT_MS = 1050
const DAY_MS = 86400_000

// Best-guess endpoint path, following the same naming convention as the confirmed
// `/reporting/revenue-entries` Data API endpoint. /reporting/gx-score-responses
// returned 404 — try several plausible alternatives in debug mode and report which
// one (if any) responds with data, since Roller's docs page is behind a login wall.
const GX_ENDPOINT_CANDIDATES = [
  "/reporting/gx-score-responses",
  "/reporting/gx-score",
  "/reporting/guest-experience-score-responses",
  "/data/gx-score-responses",
  "/gx-score-responses",
  "/gx/responses",
  "/guest-experience/responses",
  "/guest-experience/gx-score-responses",
  "/surveys/gx-score-responses",
  "/surveys/responses",
  "/feedback/gx-score-responses",
]
const GX_ENDPOINT_PATH = GX_ENDPOINT_CANDIDATES[0]

// Candidate field names for the survey's numeric score and its date — Roller's exact
// schema isn't confirmed yet, so we try the most likely candidates defensively.
const SCORE_FIELDS = ["score", "gxScore", "npsScore", "rating", "responseScore"]
const DATE_FIELDS = ["responseDate", "modifiedDate", "surveyDate", "date", "createdDate", "submittedDate"]

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

function extractItems(parsed: unknown): any[] {
  if (Array.isArray(parsed)) return parsed
  if (parsed && typeof parsed === "object") {
    const o = parsed as Record<string, unknown>
    for (const key of ["data", "items", "results", "responses", "gxScoreResponses"]) {
      if (Array.isArray(o[key])) return o[key] as any[]
    }
  }
  return []
}

function firstDefined(obj: any, fields: string[]): { field: string; value: unknown } | null {
  for (const f of fields) {
    if (obj?.[f] !== undefined && obj[f] !== null) return { field: f, value: obj[f] }
  }
  return null
}

async function fetchPage(token: string, startDate: string, endDate: string, page: number) {
  const url = `${ROLLER_BASE}${GX_ENDPOINT_PATH}?startDate=${startDate}&endDate=${endDate}&pageNumber=${page}`
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`${url}: ${res.status} - ${text.slice(0, 300)}`)
  return { url, items: extractItems(JSON.parse(text)), raw: text }
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

    if (debug) {
      // DEBUG: try each candidate endpoint path until one returns data (or all fail),
      // so we can confirm the real route + field names before wiring up aggregation.
      const attempts: any[] = []
      let found: { path: string; url: string; items: any[]; raw: string } | null = null
      for (const path of GX_ENDPOINT_CANDIDATES) {
        await sleep(RATE_LIMIT_MS)
        const url = `${ROLLER_BASE}${path}?startDate=${startDate}&endDate=${lastDateStr}&pageNumber=1`
        try {
          const res = await fetch(url, { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } })
          const text = await res.text()
          if (!res.ok) {
            attempts.push({ path, status: res.status, body: text.slice(0, 200) })
            continue
          }
          const items = extractItems(JSON.parse(text))
          attempts.push({ path, status: res.status, itemCount: items.length })
          if (!found) found = { path, url, items, raw: text }
        } catch (e) {
          attempts.push({ path, error: String(e).slice(0, 200) })
        }
      }

      if (!found) {
        return new Response(
          JSON.stringify({
            success: false,
            mode: "debug",
            error: "None of the candidate GX endpoint paths returned a successful response.",
            attempts,
            hint: "Check Roller's Data API docs (logged in) for the exact 'Get GX score responses' route, then update GX_ENDPOINT_CANDIDATES in sync-gx/index.ts.",
          }, null, 2),
          { headers: { ...cors, "Content-Type": "application/json" } }
        )
      }

      const sample = found.items[0] ?? null
      return new Response(
        JSON.stringify(
          {
            success: true,
            mode: "debug",
            endpointFound: found.path,
            endpointTried: found.url,
            attempts,
            itemCount: found.items.length,
            firstItemFields: sample ? Object.keys(sample) : [],
            firstItem: sample,
            detectedScoreField: sample ? firstDefined(sample, SCORE_FIELDS) : null,
            detectedDateField: sample ? firstDefined(sample, DATE_FIELDS) : null,
            rawSnippet: found.raw.slice(0, 4000),
          },
          null,
          2
        ),
        { headers: { ...cors, "Content-Type": "application/json" } }
      )
    }

    // Normal mode: paginate through the range, aggregate score per day, upsert to DB.
    const byDay = new Map<string, { sum: number; count: number }>()
    const errors: string[] = []
    let itemsReceived = 0

    for (let page = 1; page <= MAX_PAGES; page++) {
      await sleep(RATE_LIMIT_MS)
      let items: any[]
      try {
        ;({ items } = await fetchPage(token, startDate, lastDateStr, page))
      } catch (e) {
        errors.push(String(e).slice(0, 200))
        break
      }
      if (items.length === 0) break
      itemsReceived += items.length

      for (const item of items) {
        const scoreHit = firstDefined(item, SCORE_FIELDS)
        const dateHit = firstDefined(item, DATE_FIELDS)
        if (!scoreHit || !dateHit) continue
        const score = Number(scoreHit.value)
        if (Number.isNaN(score)) continue
        const day = String(dateHit.value).split("T")[0]
        if (day < startDate || day > lastDateStr) continue
        const slot = byDay.get(day) ?? { sum: 0, count: 0 }
        slot.sum += score
        slot.count += 1
        byDay.set(day, slot)
      }
    }

    const rows = [...byDay.entries()]
      .map(([date, { sum, count }]) => ({
        site_id: SITE_ID,
        date,
        score: r2(sum / count),
        responses_count: count,
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
        .from("gx_scores")
        .delete()
        .eq("site_id", SITE_ID)
        .eq("period", "day")
        .gte("date", startDate)
        .lte("date", lastDateStr)
      if (delErr) throw new Error(`delete gx_scores: ${delErr.message}`)

      const { error: insErr } = await supabase.from("gx_scores").insert(rows)
      if (insErr) throw new Error(`insert gx_scores: ${insErr.message}`)
      synced = rows.length
    }

    return new Response(
      JSON.stringify(
        {
          success: true,
          dateRange: { startDate, endDate: lastDateStr },
          itemsReceived,
          daysSynced: synced,
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
