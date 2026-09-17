import type { UserRole } from '@/lib/types'

// Routes each restricted role is allowed to visit. Roles not listed here have
// full access.
const ROLE_ALLOWED_PREFIXES: Partial<Record<UserRole, string[]>> = {
  // Staff (comptage uniquement) : la page cadencier seulement.
  staff: ['/cadencier'],
}

export function isPathAllowed(role: UserRole | null | undefined, pathname: string): boolean {
  if (!role) return true
  const allowed = ROLE_ALLOWED_PREFIXES[role]
  if (!allowed) return true
  if (role === 'staff') {
    // Staff: only the cadencier page itself, not its management sub-pages.
    return pathname === '/cadencier'
  }
  return allowed.some(prefix => pathname === prefix || pathname.startsWith(prefix + '/'))
}

// Where to send a restricted user who lands on a page they can't access.
export function landingPath(role: UserRole | null | undefined): string {
  if (role === 'staff') return '/cadencier'
  return '/dashboard'
}
