"use client"
import { useMemo } from "react"
import { mockInsights } from "@/lib/mockData"
import type { Insight } from "@/lib/types"

export function useInsights(siteId?: string): Insight[] {
  return useMemo(() => {
    if (siteId) {
      return mockInsights.filter(i => i.site_id === siteId)
    }
    return mockInsights
  }, [siteId])
}
