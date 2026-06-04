import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const ROLLER_BASE_URL = "https://api.rollerpos.com"
const SITE_ID = "00000000-0000-0000-0000-000000000001"

async function getRollerToken(clientId: string, clientSecret: string): Promise<string> {
  const res = await fetch(`${ROLLER_BASE_URL}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret,
      scope: "reporting",
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Roller auth failed: ${res.status} - ${err}`)
  }

  const data = await res.json()
  return data.access_token
}

async function fetchRollerRevenue(token: string, dateFrom: string, dateTo: string) {
  const res = await fetch(
    `${ROLLER_BASE_URL}/v2/reports/revenue?date_from=${dateFrom}&date_to=${dateTo}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    }
  )

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Roller revenue fetch failed: ${res.status} - ${err}`)
  }

  return res.json()
}

async function fetchRollerBookings(token: string, dateFrom: string, dateTo: string) {
  const res = await fetch(
    `${ROLLER_BASE_URL}/v2/bookings?date_from=${dateFrom}&date_to=${dateTo}&status=completed`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    }
  )

  if (!res.ok) return null
  return res.json()
}

Deno.serve(async (req) => {
  // CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      },
    })
  }

  try {
    const clientId = Deno.env.get("ROLLER_CLIENT_ID_FRAN")
    const clientSecret = Deno.env.get("ROLLER_CLIENT_SECRET_FRAN")

    if (!clientId || !clientSecret) {
      throw new Error("Missing Roller credentials in secrets")
    }

    // Date range: last 30 days
    const dateTo = new Date().toISOString().split("T")[0]
    const dateFrom = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0]

    // 1. Authenticate with Roller
    const token = await getRollerToken(clientId, clientSecret)

    // 2. Fetch revenue data
    const revenueData = await fetchRollerRevenue(token, dateFrom, dateTo)

    // 3. Fetch bookings (optional)
    const bookingsData = await fetchRollerBookings(token, dateFrom, dateTo)

    // 4. Sync to Supabase sales table
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    )

    const salesRows = []

    // Map Roller revenue data to our sales table format
    if (revenueData?.data || revenueData?.revenue || Array.isArray(revenueData)) {
      const items = revenueData?.data || revenueData?.revenue || revenueData

      for (const item of items) {
        const date = item.date || item.business_date || item.created_at?.split("T")[0]
        const amount = item.total || item.net_revenue || item.gross_revenue || item.amount || 0

        if (date && amount) {
          salesRows.push({
            site_id: SITE_ID,
            date,
            amount: parseFloat(amount),
            target: 10000, // default daily target €10,000
            period: "day",
          })
        }
      }
    }

    let syncResult = { upserted: 0, revenue_raw: revenueData }

    if (salesRows.length > 0) {
      const { error, count } = await supabase
        .from("sales")
        .upsert(salesRows, { onConflict: "site_id,date,period", ignoreDuplicates: false })
        .select()

      if (error) throw error
      syncResult.upserted = salesRows.length
    }

    return new Response(
      JSON.stringify({
        success: true,
        date_range: { from: dateFrom, to: dateTo },
        sync: syncResult,
        bookings_available: !!bookingsData,
        raw_sample: revenueData,
      }),
      {
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    )
  }
})
