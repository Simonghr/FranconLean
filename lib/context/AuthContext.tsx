"use client"
import { createContext, useContext, useEffect, useState } from "react"
import type { User, SupabaseClient } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/client"

async function ensureProfile(supabase: SupabaseClient, user: User) {
  const name = user.user_metadata?.name ?? user.email?.split("@")[0] ?? "Utilisateur"
  await supabase.from("profiles").upsert(
    { id: user.id, name },
    { onConflict: "id", ignoreDuplicates: true }
  )
}

interface AuthContextValue {
  user: User | null
  loading: boolean
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  signOut: async () => {},
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user)
      setLoading(false)
      if (user) ensureProfile(supabase, user)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ?? null)
      if (session?.user) ensureProfile(supabase, session.user)
    })
    return () => subscription.unsubscribe()
  }, [])

  const signOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{ user, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
