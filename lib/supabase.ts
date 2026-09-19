import { createBrowserClient } from '@supabase/ssr'
import { canWrite } from '@/lib/permissions'

const raw = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const MUTATORS = ['insert', 'update', 'upsert', 'delete'] as const

// Wrap `.from(table)` so that write operations are blocked for read-only roles.
// Reads (select) are untouched. This is the single app-wide enforcement point.
function guardedFrom(table: string) {
  const qb: any = raw.from(table)
  for (const m of MUTATORS) {
    const orig = qb[m].bind(qb)
    qb[m] = (...args: any[]) => {
      if (!canWrite(m, table, args[0])) {
        throw new Error("Action non autorisée pour votre rôle.")
      }
      return orig(...args)
    }
  }
  return qb
}

export const supabase: typeof raw = new Proxy(raw, {
  get(target, prop, receiver) {
    if (prop === 'from') return guardedFrom
    const v = Reflect.get(target, prop, receiver)
    return typeof v === 'function' ? v.bind(target) : v
  },
})
