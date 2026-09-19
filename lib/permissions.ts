// Centralised write-permission gate.
//
//  - Editors (admin / direction)  : everything.
//  - Manager                      : create & modify anything EXCEPT deleting
//                                   data and EXCEPT changing stock targets.
//  - Staff                        : only the stock-counting tables.
//  - anyone else                  : read-only.

const EDITOR_ROLES = ["admin", "direction"]
const STAFF_WRITE_TABLES = ["count_sessions", "count_lines"]
// Product columns that represent the "stock cible" (targets) — managers can't touch these.
const TARGET_FIELDS = ["target_stock", "target_high"]

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
// General management (create/modify products, reorder, sub-pages…). Editors + manager.
export function canManageRole(role: string | null | undefined): boolean {
  return canEditRole(role) || role === "manager"
}
// Deleting data — editors only.
export function canDeleteRole(role: string | null | undefined): boolean {
  return canEditRole(role)
}
// Editing stock targets — editors only.
export function canEditTargetsRole(role: string | null | undefined): boolean {
  return canEditRole(role)
}

function touchesTargets(payload: unknown): boolean {
  const rows = Array.isArray(payload) ? payload : [payload]
  return rows.some(r => r && typeof r === "object" && TARGET_FIELDS.some(f => f in (r as Record<string, unknown>)))
}

type Op = "insert" | "update" | "upsert" | "delete"

// Whether the current user may perform this write.
export function canWrite(op: Op, table: string, payload?: unknown): boolean {
  const r = getCurrentRole()
  if (r == null) return true // role not loaded yet — fail open (avoids blocking editors on first paint)
  if (EDITOR_ROLES.includes(r)) return true
  if (r === "staff") return STAFF_WRITE_TABLES.includes(table)
  if (r === "manager") {
    if (op === "delete") return false
    if (table === "products" && touchesTargets(payload)) return false
    return true
  }
  return false
}
