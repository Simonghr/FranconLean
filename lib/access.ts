import type { UserRole } from '@/lib/types'

// Routes a 'collaborator' account is allowed to visit. Other roles have full access.
export const COLLABORATOR_ALLOWED_PREFIXES = ['/ameliorations']

export function isPathAllowed(role: UserRole | null | undefined, pathname: string): boolean {
  if (role !== 'collaborator') return true
  return COLLABORATOR_ALLOWED_PREFIXES.some(prefix => pathname === prefix || pathname.startsWith(prefix + '/'))
}
