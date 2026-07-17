const DEFAULT_PAGE      = 1
const DEFAULT_PAGE_SIZE = 20
const MAX_PAGE_SIZE     = 100

export interface Pagination {
  readonly page:     number
  readonly pageSize: number
}

/**
 * parsePagination — normaliza `page`/`pageSize` de query string.
 *
 * Entradas ausentes, não-numéricas ou fora de faixa caem no default —
 * nunca lança erro (painel não deve quebrar por um param malformado).
 */
export function parsePagination(query: Record<string, string | undefined>): Pagination {
  const page     = toPositiveInt(query.page, DEFAULT_PAGE)
  const pageSize = clamp(toPositiveInt(query.pageSize, DEFAULT_PAGE_SIZE), 1, MAX_PAGE_SIZE)
  return { page, pageSize }
}

function toPositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? '', 10)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}
