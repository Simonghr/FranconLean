// ROLLER API discovery + sync function.
// First run: discovers the correct token + data endpoints by probing candidates.
// Once the working URLs are known, the sync path maps revenue into the `sales` table.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const SITE_ID = "00000000-0000-0000-0000-000000000001"

// Candidate hostnames for the ROLLER API (DNS-resolved at runtime).
const HOSTS = [
  "https://api.roller.app",
  "https://api.roller.software",
  "https://api.rollerdigital.com",
]

// Candidate OAuth2 token paths.
const TOKEN_PATHS = ["/token", "/oauth/token", "/connect/token"]

// Candidate revenue/data endpoint paths (filled in with date params later).
const REVENUE_PATHS = [
  "/data/revenues",
  "/data/revenue-entries",
  "/revenues",
  "/v1/data/revenues",
]

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

async function tryToken(host: string, path: string, clientId: string, clientSecret: string) {
  const url = `${host}${path}`
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: clientId,
        client_secret: clientSecret,
      }),
    })
    const text = await res.text()
    let token: string | null = null
    try {
      token = JSON.parse(text)?.access_token ?? null
    } catch (_) {
      // non-JSON response
    }
    return { url, status: res.status, ok: res.ok, token, body: text.slice(0, 300) }
  } catch (e) {
    return { url, status: 0, ok: false, token: null, error: String(e).slice(0, 200) }
  }
}

async function tryRevenue(host: string, path: string, token: string, from: string, to: string) {
  // Try a couple of common date param namings.
  const queries = [
    `startDate=${from}&endDate=${to}`,
    `dateFrom=${from}&dateTo=${to}`,
    `date_from=${from}&date_to=${to}`,
  ]
  for (const q of queries) {
    const url = `${host}${path}?${q}`
    try {
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      })
      const text = await res.text()
      if (res.ok) {
        return { url, status: res.status, ok: true, sample: text.slice(0, 800) }
      }
      // 4xx other than 404 still tells us the host/path resolved
      if (res.status !== 404) {
        return { url, status: res.status, ok: false, body: text.slice(0, 300) }
      }
    } catch (e) {
      return { url, status: 0, ok: false, error: String(e).slice(0, 200) }
    }
  }
  return { url: `${host}${path}`, status: 404, ok: false }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors })

  try {
    const clientId = Deno.env.get("ROLLER_CLIENT_ID_FRAN")
    const clientSecret = Deno.env.get("ROLLER_CLIENT_SECRET_FRAN")
    if (!clientId || !clientSecret) throw new Error("Missing Roller credentials in secrets")

    const to = new Date().toISOString().split("T")[0]
    const from = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]

    // --- Phase 1: discover a working token endpoint ---
    const tokenAttempts = []
    let workingToken: string | null = null
    let workingHost: string | null = null

    outer:
    for (const host of HOSTS) {
      for (const path of TOKEN_PATHS) {
        const attempt = await tryToken(host, path, clientId, clientSecret)
        tokenAttempts.push(attempt)
        if (attempt.ok && attempt.token) {
          workingToken = attempt.token
          workingHost = host
          break outer
        }
      }
    }

    if (!workingToken || !workingHost) {
      return new Response(
        JSON.stringify(
          {
            phase: "auth_discovery",
            success: false,
            message: "No token endpoint succeeded. See attempts for clues (DNS errors = wrong host).",
            tokenAttempts,
          },
          null,
          2
        ),
        { status: 200, headers: { ...cors, "Content-Type": "application/json" } }
      )
    }

    // --- Phase 2: discover a working revenue endpoint ---
    const revenueAttempts = []
    let workingRevenue: any = null
    for (const path of REVENUE_PATHS) {
      const attempt = await tryRevenue(workingHost, path, workingToken, from, to)
      revenueAttempts.push(attempt)
      if (attempt.ok) {
        workingRevenue = attempt
        break
      }
    }

    // --- Phase 3: if we found revenue data, sync it into `sales` ---
    let syncResult: any = { upserted: 0 }
    if (workingRevenue?.sample) {
      try {
        const parsed = JSON.parse(workingRevenue.sample)
        const items = parsed?.data || parsed?.items || parsed?.revenues || (Array.isArray(parsed) ? parsed : [])
        const rows = []
        for (const it of items) {
          const date = it.date || it.entryDate || it.businessDate || it.startDate
          const amount = it.fundsReceived ?? it.total ?? it.amount ?? it.revenue ?? it.netRevenue
          if (date && amount != null) {
            rows.push({
              site_id: SITE_ID,
              date: String(date).split("T")[0],
              amount: Number(amount),
              target: 10000,
              period: "day",
            })
          }
        }
        if (rows.length) {
          const supabase = createClient(
            Deno.env.get("SUPABASE_URL")!,
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
          )
          const { error } = await supabase
            .from("sales")
            .upsert(rows, { onConflict: "site_id,date,period" })
          if (error) throw error
          syncResult = { upserted: rows.length }
        }
      } catch (e) {
        syncResult = { upserted: 0, parseNote: String(e).slice(0, 200) }
      }
    }

    return new Response(
      JSON.stringify(
        {
          success: true,
          discovered: {
            host: workingHost,
            tokenEndpoint: tokenAttempts.find((a) => a.ok)?.url,
            revenueEndpoint: workingRevenue?.url ?? null,
          },
          dateRange: { from, to },
          sync: syncResult,
          revenueSample: workingRevenue?.sample ?? null,
          revenueAttempts,
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
