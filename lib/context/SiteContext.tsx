"use client"
import { createContext, useContext, useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"

export interface Site {
  id: string
  name: string
}

// Franconville — the original park, used as the default selection.
export const DEFAULT_SITE_ID = "00000000-0000-0000-0000-000000000001"
const STORAGE_KEY = "franconlean.currentSiteId"

interface SiteContextValue {
  siteId: string
  sites: Site[]
  currentSite: Site | null
  setSiteId: (id: string) => void
  loading: boolean
}

const SiteContext = createContext<SiteContextValue>({
  siteId: DEFAULT_SITE_ID,
  sites: [],
  currentSite: null,
  setSiteId: () => {},
  loading: true,
})

export function SiteProvider({ children }: { children: React.ReactNode }) {
  const [siteId, setSiteIdState] = useState<string>(DEFAULT_SITE_ID)
  const [sites, setSites] = useState<Site[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) setSiteIdState(stored)
    } catch {}

    supabase
      .from("sites")
      .select("id, name")
      .order("name", { ascending: true })
      .then(({ data }) => {
        if (data) setSites(data as Site[])
        setLoading(false)
      })
  }, [])

  const setSiteId = (id: string) => {
    setSiteIdState(id)
    try {
      localStorage.setItem(STORAGE_KEY, id)
    } catch {}
  }

  const currentSite = sites.find(s => s.id === siteId) ?? null

  return (
    <SiteContext.Provider value={{ siteId, sites, currentSite, setSiteId, loading }}>
      {children}
    </SiteContext.Provider>
  )
}

export const useSite = () => useContext(SiteContext)
