// Centralised write-permission gate.
// Editors (admin / director / site_director) can modify & delete everything.
// Staff can only write the stock-counting tables. Everyone else is read-only.

const EDITOR_ROLES = ["admin", "director", "site_director"]
// Tables the "staff" role is allowed to write (stock counting saisies).
const STAFF_WRITE_TABLES = ["count_sessions", "count_lines"]

let currentRole: string | null = null

export function setCurrentRole(role: string | null) {
  currentRole = role
  try { if (role) localStorage.setItem("role", role); else localStorage.removeItem("role") } catch { /* ignore */ }
}

function getCurrentRole(): string | null {
  if (currentRole) return currentRole
  try { return localStorage.getItem("role") } catch { return null }
}

export function canEditRole(role: string | null | undefined): boolean {
  return !!role && EDITOR_ROLES.includes(role)
}

// Whether the current user may perform a write on the given table.
export function canWriteTable(table: string): boolean {
  const r = getCurrentRole()
  if (r == null) return true // role not loaded yet — fail open to avoid blocking editors on first paint
  if (EDITOR_ROLES.includes(r)) return true
  if (r === "staff" && STAFF_WRITE_TABLES.includes(table)) return true
  return false
}
