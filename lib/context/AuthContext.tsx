"use client"
import { createContext, useContext, useEffect, useState } from "react"
import type { User, SupabaseClient } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/client"
import { setCurrentRole } from "@/lib/permissions"
import type { UserRole } from "@/lib/types"

async function ensureProfile(supabase: SupabaseClient, user: User) {
  const name = user.user_metadata?.name ?? user.email?.split("@")[0] ?? "Utilisateur"
  await supabase.from("profiles").upsert(
    { id: user.id, name },
    { onConflict: "id", ignoreDuplicates: true }
  )
}

interface AuthContextValue {
  user: User | null
  role: UserRole | null        // effective role (respects "view as" for admins)
  realRole: UserRole | null    // the account's actual role
  isAdmin: boolean
  viewRole: UserRole | null    // admin preview override, or null
  setViewRole: (r: UserRole | null) => void
  loading: boolean
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  role: null,
  realRole: null,
  isAdmin: false,
  viewRole: null,
  setViewRole: () => {},
  loading: true,
  signOut: async () => {},
})

const VIEW_KEY = "viewRole"

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [realRole, setRealRole] = useState<UserRole | null>(null)
  const [viewRole, setViewRoleState] = useState<UserRole | null>(null)
  const [loading, setLoading] = useState(true)

  const isAdmin = realRole === "admin"
  const effective = (isAdmin && viewRole) ? viewRole : realRole

  // Keep the write-permission gate in sync with the effective role.
  useEffect(() => { setCurrentRole(effective) }, [effective])

  const setViewRole = (r: UserRole | null) => {
    setViewRoleState(r)
    try { if (r) localStorage.setItem(VIEW_KEY, r); else localStorage.removeItem(VIEW_KEY) } catch { /* ignore */ }
  }

  useEffect(() => {
    const supabase = createClient()
    const loadRole = async (u: User) => {
      const { data } = await supabase.from("profiles").select("role").eq("id", u.id).maybeSingle()
      const r = (data?.role as UserRole) ?? null
      setRealRole(r)
      // Restore an admin's "view as" preview (only admins may impersonate).
      if (r === "admin") {
        try { const v = localStorage.getItem(VIEW_KEY) as UserRole | null; if (v) setViewRoleState(v) } catch { /* ignore */ }
      } else {
        setViewRoleState(null)
        try { localStorage.removeItem(VIEW_KEY) } catch { /* ignore */ }
      }
    }
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user)
      setLoading(false)
      if (user) { ensureProfile(supabase, user); loadRole(user) }
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ?? null)
      if (session?.user) { ensureProfile(supabase, session.user); loadRole(session.user) }
      else { setRealRole(null); setViewRoleState(null); setCurrentRole(null) }
    })
    return () => subscription.unsubscribe()
  }, [])

  const signOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{ user, role: effective, realRole, isAdmin, viewRole, setViewRole, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
