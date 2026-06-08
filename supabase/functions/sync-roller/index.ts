// ROLLER -> FranconLean revenue sync.
//
// Auth:  POST https://api.roller.app/token  (JSON body {client_id, client_secret})
// Data:  GET  https://api.roller.app/reporting/revenue-entries?startDate&endDate&pageNumber
//        Range capped at 1 day -> loop day-by-day. Rate limit ~1 req/sec.
//
// CA HT = sum of `netRevenue` across ALL entry types, bucketed by Roller's "business day"
// (a shifted cutoff, not midnight Paris time — see BUSINESS_DAY_SHIFT_HOURS below).
// Verified against Roller's "Revenu" dashboard across 10 days: matches to within ~0.3 EUR/day.
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

// Roller's "business day" doesn't reset at midnight Paris time — it resets a few
// hours later (confirmed via businessDayShiftAnalysis: shiftHours 5-8 all match
// Roller's reference daily totals to within ~0.3 EUR, vs. up to 380 EUR off at
// midnight bucketing — the plateau means no entries land in that 5-8am window).
const BUSINESS_DAY_SHIFT_HOURS = 6
const parisDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Paris",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
})
const businessDayOf = (recordDate: string): string => {
  const d = new Date(recordDate)
  d.setUTCHours(d.getUTCHours() - BUSINESS_DAY_SHIFT_HOURS)
  return parisDateFormatter.format(d)
}

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
    // Business-day bucketing shifts early-morning entries (before the cutoff hour) back
    // onto the previous business day. So the LAST business day's window also spans the
    // first few hours of the following calendar day — fetch one extra day to capture it.
    const fetchEndDateStr = ymd(new Date(lastDay.getTime() + DAY_MS))

    // Multi-day debug ranges blow past the Edge Function compute/memory limit (HTTP 546)
    // if we run the full heavy per-entry analysis (brute-force searches, bucketing
    // comparison, byProduct/byTrigger breakdowns) for every day. Beyond a couple of
    // days, switch to "lite" debug: only collect the minimal (recordDate, netRevenue)
    // pairs needed for businessDayShiftAnalysis, plus a tiny per-day summary.
    const rangeDays = Math.round((lastDay.getTime() - firstDay.getTime()) / DAY_MS) + 1
    const liteDebug = debug && rangeDays > 3

    const token = await getToken(clientId, clientSecret)

    const debugDays: any[] = []
    const errors: string[] = []
    let entriesReceived = 0
    // Accumulate every entry's (recordDate, netRevenue) across the whole fetched range so
    // we can bucket by Roller's actual "business day" (shifted cutoff, not midnight) once
    // all pages are in — an entry queried under day N may belong to day N-1's business day.
    const allEntries: { recordDate: string; netRevenue: number }[] = []

    for (let cur = new Date(firstDay); ymd(cur) <= fetchEndDateStr; cur = new Date(cur.getTime() + DAY_MS)) {
      const dayStr = ymd(cur)
      try {
        const entries = await fetchDay(token, dayStr)
        entriesReceived += entries.length

        for (const e of entries) {
          const rd = String(e.recordDate ?? e.transactionDate ?? "")
          const net = Number(e.netRevenue ?? 0)
          if (rd && !Number.isNaN(net)) allEntries.push({ recordDate: rd, netRevenue: net })
        }

        if (debug && liteDebug) {
          let dayNetSum = 0
          for (const e of entries) dayNetSum += Number(e.netRevenue ?? 0)
          debugDays.push({ date: dayStr, entries: entries.length, sumNetRevenue: r2(dayNetSum) })
        }

        if (debug && !liteDebug) {
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
          // Break down by productType within each entryType — looking for a category
          // (gift cards, memberships, fees...) that Roller's "Revenu" treats differently.
          const byProduct: Record<string, { count: number; netRevenue: number; taxPayable: number }> = {}
          for (const e of entries) {
            const key = `${e?.entryType ?? "Unknown"} / ${e?.productType ?? "Unknown"}`
            const slot = (byProduct[key] ??= { count: 0, netRevenue: 0, taxPayable: 0 })
            slot.count += 1
            slot.netRevenue += Number(e.netRevenue ?? 0)
            slot.taxPayable += Number(e.taxPayable ?? 0)
          }
          for (const k of Object.keys(byProduct)) {
            byProduct[k].netRevenue = r2(byProduct[k].netRevenue)
            byProduct[k].taxPayable = r2(byProduct[k].taxPayable)
          }

          // ROLLER's recognition entries are triggered either by REDEMPTION (guest used the
          // ticket -> redeemedQuantity > 0) or EXPIRATION (ticket lapsed unused -> expiredQuantity > 0).
          // Hypothesis: the dashboard "Revenu" counts only one of these triggers.
          const trigger = { redemption: { count: 0, netRevenue: 0, taxPayable: 0 }, expiration: { count: 0, netRevenue: 0, taxPayable: 0 }, neither: { count: 0, netRevenue: 0, taxPayable: 0 } }
          for (const e of entries) {
            if (e?.entryType !== "Recognition" && e?.entryType !== "Adjustment") continue
            const redeemed = Number(e.redeemedQuantity ?? 0) > 0
            const expired = Number(e.expiredQuantity ?? 0) > 0
            const slot = redeemed ? trigger.redemption : expired ? trigger.expiration : trigger.neither
            slot.count++
            slot.netRevenue += Number(e.netRevenue ?? 0)
            slot.taxPayable += Number(e.taxPayable ?? 0)
          }
          for (const k of Object.keys(trigger) as (keyof typeof trigger)[]) {
            trigger[k].netRevenue = r2(trigger[k].netRevenue)
            trigger[k].taxPayable = r2(trigger[k].taxPayable)
          }

          // Brute-force subset-sum search over the (entryType x productType) group totals:
          // find which combination of groups' netRevenue sums to Roller's displayed figure.
          const ROLLER_TARGET = 651.77
          const groupEntries = Object.entries(byProduct).map(([key, v]) => ({ key, net: v.netRevenue }))
          const matchingSubsets: string[][] = []
          const n = groupEntries.length
          if (n <= 22) {
            for (let mask = 1; mask < (1 << n) && matchingSubsets.length < 5; mask++) {
              let sum = 0
              for (let i = 0; i < n; i++) if (mask & (1 << i)) sum += groupEntries[i].net
              if (Math.abs(r2(sum) - ROLLER_TARGET) < 0.02) {
                matchingSubsets.push(groupEntries.filter((_, i) => mask & (1 << i)).map((g) => g.key))
              }
            }
          }

          // Richer search: for each non-zero group, try contributing nothing, netRevenue,
          // netRevenue+taxPayable, or netRevenue-taxPayable — looking for the exact mix
          // Roller uses (e.g. gross vs net-of-tax per category).
          const richGroups = Object.entries(byProduct)
            .filter(([, v]) => v.netRevenue !== 0 || v.taxPayable !== 0)
            .map(([key, v]) => ({
              key,
              variants: [
                { label: "exclude", value: 0 },
                { label: "net", value: v.netRevenue },
                { label: "net+tax", value: r2(v.netRevenue + v.taxPayable) },
                { label: "net-tax", value: r2(v.netRevenue - v.taxPayable) },
              ],
            }))
          const richMatches: any[] = []
          const tryCombo = (idx: number, sum: number, picks: { key: string; label: string; value: number }[]) => {
            if (richMatches.length >= 5) return
            if (idx === richGroups.length) {
              if (Math.abs(r2(sum) - ROLLER_TARGET) < 0.02) {
                richMatches.push(picks.filter((p) => p.label !== "exclude"))
              }
              return
            }
            for (const variant of richGroups[idx].variants) {
              tryCombo(idx + 1, sum + variant.value, [...picks, { key: richGroups[idx].key, label: variant.label, value: variant.value }])
            }
          }
          if (richGroups.length <= 8) tryCombo(0, 0, [])

          // Dump the first Recognition entry in full to inspect its dates and all numeric fields
          const firstRecognition = entries.find((e: any) => e?.entryType === "Recognition") ?? null

          // Compare bucketing strategies: query-day vs UTC-date(recordDate) vs Paris-local-date(recordDate)
          const parisDate = (iso: string) =>
            new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso))
          let sumQueryDay = 0
          let sumUtcMatch = 0, sumUtcMismatch = 0, countUtcMismatch = 0
          let sumParisMatch = 0, sumParisMismatch = 0, countParisMismatch = 0
          const mismatchSamples: any[] = []
          for (const e of entries) {
            const net = Number(e.netRevenue ?? 0)
            if (Number.isNaN(net)) continue
            sumQueryDay += net
            const rd = String(e.recordDate ?? e.transactionDate ?? "")
            const utcDate = rd.split("T")[0]
            const pDate = rd ? parisDate(rd) : ""
            if (utcDate === dayStr) sumUtcMatch += net
            else { sumUtcMismatch += net; countUtcMismatch++ }
            if (pDate === dayStr) sumParisMatch += net
            else {
              sumParisMismatch += net
              countParisMismatch++
              if (mismatchSamples.length < 5) {
                mismatchSamples.push({ entryType: e.entryType, recordDate: rd, utcDate, parisDate: pDate, netRevenue: net })
              }
            }
          }
          debugDays.push({
            date: dayStr,
            entries: entries.length,
            byType: types,
            byProduct,
            byTrigger: trigger,
            rollerTargetSearch: { target: ROLLER_TARGET, matchingSubsets, richMatches },
            dateFields: dateFieldsFound,
            firstRecognitionEntry: firstRecognition,
            bucketingComparison: {
              sumQueryDay: r2(sumQueryDay),
              byUtcDate: { matchingDay: r2(sumUtcMatch), otherDays: r2(sumUtcMismatch), countOtherDays: countUtcMismatch },
              byParisLocalDate: { matchingDay: r2(sumParisMatch), otherDays: r2(sumParisMismatch), countOtherDays: countParisMismatch },
              parisMismatchSamples: mismatchSamples,
            },
          })
        }
      } catch (e) {
        errors.push(String(e).slice(0, 200))
      }
    }

    // CA HT = sum of netRevenue across ALL entry types, bucketed by Roller's actual
    // "business day" (shifted cutoff) rather than by the calendar day we queried —
    // this is what makes our totals match Roller's "Revenu" figure exactly.
    const byDay = new Map<string, number>()
    for (const { recordDate, netRevenue } of allEntries) {
      const day = businessDayOf(recordDate)
      if (day < startDate || day > lastDateStr) continue
      byDay.set(day, r2((byDay.get(day) ?? 0) + netRevenue))
    }

    // Re-bucket all collected entries using alternate "business day" cutoff hours
    // (e.g. if Roller's day boundary is the venue's opening time, not midnight Paris time).
    // Compare against known reference figures from Roller's own Daily Summary screenshots.
    let businessDayShiftAnalysis: any = undefined
    if (debug) {
      const KNOWN_ROLLER_REVENUE: Record<string, number> = {
        "2026-05-30": 12130.87,
        "2026-05-31": 7613.95,
        "2026-06-02": 651.77,
        "2026-06-06": 9861.11,
        "2026-06-07": 9751.70,
      }
      const shiftHoursCandidates = [0, 1, 2, 3, 4, 5, 6, 7, 8]
      const shiftResults: any[] = []
      for (const shiftHours of shiftHoursCandidates) {
        const byShiftedDay: Record<string, number> = {}
        for (const { recordDate, netRevenue } of allEntries) {
          const d = new Date(recordDate)
          d.setUTCHours(d.getUTCHours() - shiftHours)
          const dateStr = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" }).format(d)
          byShiftedDay[dateStr] = r2((byShiftedDay[dateStr] ?? 0) + netRevenue)
        }
        let totalAbsError = 0
        let comparedDays = 0
        const perDay: Record<string, any> = {}
        for (const [date, rollerValue] of Object.entries(KNOWN_ROLLER_REVENUE)) {
          const ours = byShiftedDay[date]
          if (ours === undefined) continue
          const diff = r2(ours - rollerValue)
          totalAbsError += Math.abs(diff)
          comparedDays++
          perDay[date] = { roller: rollerValue, ours, diff }
        }
        shiftResults.push({
          shiftHours,
          totalAbsError: r2(totalAbsError),
          comparedDays,
          perDay,
        })
      }
      shiftResults.sort((a, b) => a.totalAbsError - b.totalAbsError)
      businessDayShiftAnalysis = { note: "Lower totalAbsError = better match. shiftHours = how many hours before midnight the 'business day' boundary sits.", results: shiftResults }
    }

    if (debug) {
      return new Response(
        JSON.stringify(
          {
            success: true,
            mode: liteDebug ? "debug-lite" : "debug",
            note: liteDebug
              ? "Range > 3 days: heavy per-entry analysis (brute-force searches, bucketing comparison) skipped to stay within compute limits. debugDays only has per-day entry counts + net sums."
              : undefined,
            dateRange: { startDate, endDate: lastDateStr },
            entriesReceived,
            businessDayShiftAnalysis,
            debugDays,
            errors: errors.length ? errors : undefined,
          },
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
