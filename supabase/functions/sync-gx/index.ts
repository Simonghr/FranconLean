// ROLLER -> FranconLean Guest Experience (GX) score sync.
//
// Auth:  POST https://api.roller.app/token  (JSON body {client_id, client_secret})
// Data:  GET  https://api.roller.app/reporting/gxs?startDate&endDate&pageNumber&pageSize
//        Range: endDate must be startDate +1 day -> loop day-by-day, like revenue-entries.
//
// Roller's GX Score is an NPS-style metric (-100..+100). Each survey response carries
// `isFan` (overallRating 4-5) or `isCritic` (overallRating 1-3) — there's no neutral
// bucket. The aggregate score for a period is:
//   GX score = (fanCount - criticCount) / totalResponses * 100
// We bucket responses by `createdDate` (when the survey was sent to the guest, i.e.
// closest to their visit date) — Roller filters the date-range query by `modifiedDate`,
// so we may pull in a few extra/missing edge responses near range boundaries; acceptable
// for a daily aggregate metric (unlike CA, this isn't a cents-precision figure).
//
// POST body options:
//   { "debug": true }                                   -> dumps raw API response, no DB write
//   { "days": 30 }                                      -> last 30 days, sync to DB
//   { "startDate":"2026-05-01","endDate":"2026-05-31" } -> explicit range, sync to DB

import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const ROLLER_BASE = "https://api.roller.app"
const SITE_ID = "00000000-0000-0000-0000-000000000001"
const DEFAULT_DAYS = 30
const MAX_PAGES_PER_DAY = 10
const RATE_LIMIT_MS = 1050
const DAY_MS = 86400_000

const GX_ENDPOINT_PATH = "/reporting/gxs"

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
    for (const key of ["data", "items", "results", "responses", "gxsResponses"]) {
      if (Array.isArray(o[key])) return o[key] as any[]
    }
  }
  return []
}

async function getPage(token: string, dayStart: string, dayEnd: string, page: number) {
  const url = `${ROLLER_BASE}${GX_ENDPOINT_PATH}?startDate=${dayStart}&endDate=${dayEnd}&pageNumber=${page}&pageSize=100`
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
    return extractItems(JSON.parse(text))
  }
  throw new Error(`${dayStart}: rate limited (429) after retry`)
}

async function fetchDay(token: string, dayStart: string) {
  const dayEnd = ymd(new Date(new Date(dayStart).getTime() + DAY_MS))
  const all: any[] = []
  for (let page = 1; page <= MAX_PAGES_PER_DAY; page++) {
    await sleep(RATE_LIMIT_MS)
    const items = await getPage(token, dayStart, dayEnd, page)
    all.push(...items)
    if (items.length === 0) break
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

    if (debug) {
      const items = await fetchDay(token, startDate)
      const sample = items[0] ?? null
      const fans = items.filter((r: any) => r?.isFan === true).length
      const critics = items.filter((r: any) => r?.isCritic === true).length

      const probe = async (path: string) => {
        const res = await fetch(`${ROLLER_BASE}${path}`, {
          headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
        })
        const text = await res.text()
        let body: any
        try { body = JSON.parse(text) } catch { body = text.slice(0, 500) }
        return { status: res.status, body }
      }

      // Probe known endpoints and try to find all rating categories / comments
      const [
        detailResult,
        customerResult,
        bookingResult,
        reviewsResult,
        feedbackResult,
        surveysResult,
        gxListFull,
      ] = await Promise.all([
        sample?.gxsResponseId ? probe(`/reporting/gxs/${sample.gxsResponseId}`) : Promise.resolve(null),
        sample?.customerId    ? probe(`/customers/${sample.customerId}`) : Promise.resolve(null),
        sample?.bookingReference ? probe(`/bookings/${sample.bookingReference}`) : Promise.resolve(null),
        sample?.customerId    ? probe(`/customers/${sample.customerId}/reviews`) : Promise.resolve(null),
        sample?.customerId    ? probe(`/customers/${sample.customerId}/feedback`) : Promise.resolve(null),
        probe(`/reporting/surveys?startDate=${startDate}&endDate=${ymd(new Date(new Date(startDate).getTime() + DAY_MS))}&pageNumber=1&pageSize=5`),
        probe(`/reporting/gxs?startDate=${startDate}&endDate=${ymd(new Date(new Date(startDate).getTime() + DAY_MS))}&pageNumber=1&pageSize=1`),
      ])

      // Collect all unique field names across all items to reveal hidden fields
      const allFields = new Set<string>()
      for (const item of items) Object.keys(item).forEach(k => allFields.add(k))

      // Check if any item has text/comment fields
      const textFields = [...allFields].filter(k => {
        const lower = k.toLowerCase()
        return lower.includes("comment") || lower.includes("text") || lower.includes("note")
          || lower.includes("feedback") || lower.includes("review") || lower.includes("message")
          || lower.includes("rating") || lower.includes("reason") || lower.includes("score")
      })

      // Sample non-null values for all fields
      const fieldSamples: Record<string, any> = {}
      for (const field of allFields) {
        const val = items.find((it: any) => it[field] != null && it[field] !== "")?.[field]
        if (val !== undefined) fieldSamples[field] = val
      }

      return new Response(
        JSON.stringify(
          {
            success: true,
            mode: "debug",
            dayQueried: startDate,
            itemCount: items.length,
            fans,
            critics,
            computedScoreForDay: items.length ? r2(((fans - critics) / items.length) * 100) : null,
            allFields: [...allFields],
            textAndRatingFields: textFields,
            fieldSamples,
            firstItem: sample,
            endpoints: {
              detail:    detailResult,
              customer:  customerResult,
              booking:   bookingResult,
              reviews:   reviewsResult,
              feedback:  feedbackResult,
              surveys:   surveysResult,
              gxListRaw: gxListFull,
            },
          },
          null,
          2
        ),
        { headers: { ...cors, "Content-Type": "application/json" } }
      )
    }

    // Normal mode: paginate through the range day-by-day, aggregate fan/critic counts
    // per day (bucketed by createdDate), compute the NPS-style GX score, upsert to DB.
    const byDay = new Map<string, { fans: number; critics: number; total: number }>()
    const reviewRows: any[] = []
    const errors: string[] = []
    let itemsReceived = 0

    for (let cur = new Date(firstDay); ymd(cur) <= lastDateStr; cur = new Date(cur.getTime() + DAY_MS)) {
      const dayStr = ymd(cur)
      try {
        const items = await fetchDay(token, dayStr)
        itemsReceived += items.length
        for (const item of items) {
          const created = String(item?.createdDate ?? item?.modifiedDate ?? "")
          const day = created.split("T")[0]
          if (!day || day < startDate || day > lastDateStr) continue

          // Aggregate by day
          const slot = byDay.get(day) ?? { fans: 0, critics: 0, total: 0 }
          slot.total += 1
          if (item?.isFan === true) slot.fans += 1
          else if (item?.isCritic === true) slot.critics += 1
          byDay.set(day, slot)

          // Capture individual review
          const rollerId = String(item?.gxsResponseId ?? "")
          if (rollerId) {
            reviewRows.push({
              site_id: SITE_ID,
              date: day,
              roller_id: rollerId,
              guest_name: null,
              overall_rating: item?.overallRating ?? null,
              service_rating: item?.serviceRating ?? null,
              service_rating_reasons: item?.serviceRatingReasons ?? null,
              safety_rating: item?.safetyRating ?? null,
              safety_rating_reasons: item?.safetyRatingReasons ?? null,
              facilities_rating: item?.facilitiesRating ?? null,
              facilities_rating_reasons: item?.facilitiesRatingReasons ?? null,
              value_rating: item?.valueRating ?? null,
              value_rating_reasons: item?.valueRatingReasons ?? null,
              is_fan: item?.isFan === true,
              is_critic: item?.isCritic === true,
              comment: item?.comments ?? null,
            })
          }
        }
      } catch (e) {
        errors.push(String(e).slice(0, 200))
      }
    }

    const rows = [...byDay.entries()]
      .map(([date, { fans, critics, total }]) => ({
        site_id: SITE_ID,
        date,
        score: total ? Math.round(fans / total * 100) - Math.round(critics / total * 100) : 0,
        responses_count: total,
        fans_count: fans,
        critics_count: critics,
        period: "day",
      }))
      .sort((a, b) => a.date.localeCompare(b.date))

    const supabaseUrl = Deno.env.get("SUPABASE_URL")
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
    if (!supabaseUrl || !supabaseKey) throw new Error("Missing Supabase env vars")

    const supabase = createClient(supabaseUrl, supabaseKey)

    const dbErr = (op: string, r: any) => {
      const msg = r?.error?.message ?? r?.error ?? String(r)
      throw new Error(`${op}: ${msg}`)
    }

    let synced = 0
    if (rows.length) {
      try {
        const r1 = await supabase.from("sites").upsert({ id: SITE_ID, name: "Franconville" }, { onConflict: "id" })
        if (r1 && r1.error) dbErr("upsert site", r1)
      } catch (e) { throw new Error(`upsert site: ${String(e)}`) }

      try {
        const r2 = await supabase.from("gx_scores").delete()
          .eq("site_id", SITE_ID).eq("period", "day")
          .gte("date", startDate).lte("date", lastDateStr)
        if (r2 && r2.error) dbErr("delete gx_scores", r2)
      } catch (e) { throw new Error(`delete gx_scores: ${String(e)}`) }

      try {
        const r3 = await supabase.from("gx_scores").insert(rows)
        if (r3 && r3.error) dbErr("insert gx_scores", r3)
        synced = rows.length
      } catch (e) { throw new Error(`insert gx_scores: ${String(e)}`) }
    }

    // Upsert individual reviews (only those with a roller_id)
    let reviewsSynced = 0
    if (reviewRows.length) {
      try {
        const r4 = await supabase.from("gx_reviews").upsert(reviewRows, { onConflict: "roller_id" })
        if (r4 && r4.error) errors.push(`gx_reviews upsert: ${r4.error.message ?? JSON.stringify(r4.error)}`)
        else reviewsSynced = reviewRows.length
      } catch (e) {
        errors.push(`gx_reviews skipped: ${String(e).slice(0, 200)}`)
      }
    }

    return new Response(
      JSON.stringify(
        {
          success: true,
          dateRange: { startDate, endDate: lastDateStr },
          itemsReceived,
          daysSynced: synced,
          reviewsSynced,
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
