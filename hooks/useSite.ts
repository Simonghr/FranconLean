"use client"
import { useState } from "react"
import { mockSite, mockBriefing } from "@/lib/mockData"
import type { Site, DailyBriefing } from "@/lib/types"

export function useSite() {
  const [site] = useState<Site>(mockSite)
  const [briefing] = useState<DailyBriefing>(mockBriefing)

  return { site, briefing }
}
