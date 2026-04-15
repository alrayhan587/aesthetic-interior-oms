const LEGACY_ALIAS_SSL_MODES = new Set(['prefer', 'require', 'verify-ca'])

function normalizeBool(value: string | null): boolean {
  if (!value) return false
  const normalized = value.trim().toLowerCase()
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on'
}

export function normalizeDatabaseUrlSslMode(rawUrl: string | undefined | null): string | undefined {
  if (!rawUrl) return undefined

  try {
    const parsed = new URL(rawUrl)
    const sslMode = parsed.searchParams.get('sslmode')?.trim().toLowerCase() ?? null
    const useLibpqCompat = normalizeBool(parsed.searchParams.get('uselibpqcompat'))

    // Keep current stronger security behavior for pg v8 and silence alias warnings.
    if (!useLibpqCompat && sslMode && LEGACY_ALIAS_SSL_MODES.has(sslMode)) {
      parsed.searchParams.set('sslmode', 'verify-full')
      return parsed.toString()
    }

    return rawUrl
  } catch {
    // Keep original value for non-standard URLs.
    return rawUrl
  }
}
