/**
 * canonicalJson — serialização JSON determinística.
 *
 * `JSON.stringify` padrão NÃO é determinístico: a ordem das chaves
 * depende da ordem de inserção no objeto, e Dates viram strings
 * em ISO mas via `toJSON()` implícito. Para hash de cadeia, qualquer
 * variação de ordem produz hash diferente e quebra a verificação.
 *
 * Regras:
 *   - Chaves de objeto ordenadas alfabeticamente
 *   - Date → string ISO 8601 explícita
 *   - undefined → omitido (consistente com JSON.stringify default)
 *   - Arrays preservam ordem (como devem)
 *   - readonly arrays viram arrays normais (compat com JSON)
 */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(value, canonicalReplacer)
}

function canonicalReplacer(_key: string, value: unknown): unknown {
  if (value === undefined)        return undefined
  if (value === null)             return null
  if (value instanceof Date)      return value.toISOString()
  if (Array.isArray(value))       return value
  if (typeof value !== 'object')  return value

  // Objeto plano — reordena as chaves alfabeticamente
  const obj = value as Record<string, unknown>
  const sorted: Record<string, unknown> = {}
  for (const k of Object.keys(obj).sort()) {
    sorted[k] = obj[k]
  }
  return sorted
}
