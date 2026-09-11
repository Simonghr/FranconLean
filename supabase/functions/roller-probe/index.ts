// Probe: discover which ROLLER reporting endpoint returns product-level sales
// (quantity sold per product). Auth reuses the revenue sync credentials.
const ROLLER_BASE = "https://api.roller.app"

async function getToken(clientId: string, clientSecret: string): Promise<string> {
  const res = await fetch(`${ROLLER_BASE}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ client_id: clientId, client_secret: clientSecret }),
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`Token failed: ${res.status} - ${text.slice(0, 200)}`)
  const token = JSON.parse(text)?.access_token
  if (!token) throw new Error(`No access_token: ${text.slice(0, 200)}`)
  return token
}

function shapeOf(text: string): string {
  try {
    const p = JSON.parse(text)
    if (Array.isArray(p)) return `array(${p.length}) itemKeys=[${Object.keys(p[0] ?? {}).join(",")}]`
    let s = `obj keys=[${Object.keys(p).join(",")}]`
    for (const k of ["data", "items", "results", "products", "entries"]) {
      if (Array.isArray((p as any)[k])) s += ` ${k}[${(p as any)[k].length}] itemKeys=[${Object.keys((p as any)[k][0] ?? {}).join(",")}]`
    }
    return s
  } catch { return "non-json: " + text.slice(0, 160) }
}

Deno.serve(async () => {
  try {
    const clientId = Deno.env.get("ROLLER_CLIENT_ID_FRAN")
    const clientSecret = Deno.env.get("ROLLER_CLIENT_SECRET_FRAN")
    if (!clientId || !clientSecret) return new Response(JSON.stringify({ error: "missing ROLLER creds" }), { status: 500 })
    const token = await getToken(clientId, clientSecret)

    const start = new Date(Date.now() - 2 * 86400000).toISOString().split("T")[0]
    const end = new Date().toISOString().split("T")[0]

    const candidates = [
      "/reporting/product-sales",
      "/reporting/detailed-product-sales",
      "/reporting/product-revenue",
      "/reporting/product-revenue-entries",
      "/reporting/products",
      "/reporting/sales",
      "/reporting/sales-by-product",
      "/reporting/items",
      "/reporting/revenue-entries?groupBy=product",
    ]

    const results: any[] = []
    for (const path of candidates) {
      const sep = path.includes("?") ? "&" : "?"
      const url = `${ROLLER_BASE}${path}${sep}startDate=${start}&endDate=${end}&pageNumber=1`
      try {
        const res = await fetch(url, { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } })
        const text = await res.text()
        results.push({ path, status: res.status, ok: res.ok, shape: res.ok ? shapeOf(text).slice(0, 500) : text.slice(0, 160) })
      } catch (e) { results.push({ path, error: String(e).slice(0, 200) }) }
      await new Promise((r) => setTimeout(r, 1200))
    }
    return new Response(JSON.stringify({ start, end, results }, null, 2), { headers: { "Content-Type": "application/json" } })
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 })
  }
})
