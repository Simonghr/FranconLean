"use client"
import { createContext, useContext, useEffect, useState } from "react"
import type { User, SupabaseClient } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/client"
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
  role: UserRole | null
  loading: boolean
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  role: null,
  loading: true,
  signOut: async () => {},
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [role, setRole] = useState<UserRole | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    const loadRole = async (u: User) => {
      const { data } = await supabase.from("profiles").select("role").eq("id", u.id).maybeSingle()
      setRole((data?.role as UserRole) ?? null)
    }
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user)
      setLoading(false)
      if (user) { ensureProfile(supabase, user); loadRole(user) }
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ?? null)
      if (session?.user) { ensureProfile(supabase, session.user); loadRole(session.user) }
      else setRole(null)
    })
    return () => subscription.unsubscribe()
  }, [])

  const signOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{ user, role, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
