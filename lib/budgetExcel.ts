import * as XLSX from 'xlsx'
import type { BudgetEntry } from '@/lib/repositories/budgets'

function toISODate(value: unknown): string | null {
  if (value instanceof Date) {
    return new Date(value.getTime() - value.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
  }
  return null
}

export async function parseBudgetWorkbook(file: File, site_id: string): Promise<BudgetEntry[]> {
  const buffer = await file.arrayBuffer()
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true })

  const entries: BudgetEntry[] = []

  for (const sheetName of workbook.SheetNames) {
    if (sheetName === 'RECAP2' || sheetName.startsWith('AS_')) continue
    const sheet = workbook.Sheets[sheetName]
    const rows: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true })

    let headerIdx = -1
    let dateCol = -1
    let budgetCol = -1
    for (let i = 0; i < Math.min(rows.length, 5); i++) {
      const row = rows[i]
      const dIdx = row?.findIndex(c => c === 'Date')
      const bIdx = row?.findIndex(c => c === 'Budget Prévisionnel')
      if (dIdx != null && dIdx >= 0 && bIdx != null && bIdx >= 0) {
        headerIdx = i
        dateCol = dIdx
        budgetCol = bIdx
        break
      }
    }
    if (headerIdx === -1) continue

    for (let i = headerIdx + 1; i < rows.length; i++) {
      const row = rows[i]
      if (!row) continue
      const date = toISODate(row[dateCol])
      const budget = row[budgetCol]
      if (date && typeof budget === 'number') {
        entries.push({ site_id, date, target: budget })
      }
    }
  }

  return entries
}
