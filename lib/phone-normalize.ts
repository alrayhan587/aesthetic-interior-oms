import 'server-only'

type NormalizePhoneOptions = {
  preferBangladesh?: boolean
}

const LOCALIZED_DIGITS: Record<string, string> = {
  '০': '0',
  '১': '1',
  '২': '2',
  '৩': '3',
  '৪': '4',
  '৫': '5',
  '৬': '6',
  '৭': '7',
  '৮': '8',
  '৯': '9',
  '٠': '0',
  '١': '1',
  '٢': '2',
  '٣': '3',
  '٤': '4',
  '٥': '5',
  '٦': '6',
  '٧': '7',
  '٨': '8',
  '٩': '9',
}

function normalizeDigits(value: string): string {
  return value.replace(/[০-৯٠-٩]/g, (char) => LOCALIZED_DIGITS[char] ?? char)
}

function stripJidSuffix(value: string): string {
  const atIndex = value.indexOf('@')
  const withoutDomain = atIndex > 0 ? value.slice(0, atIndex) : value
  const colonIndex = withoutDomain.indexOf(':')
  return colonIndex > 0 ? withoutDomain.slice(0, colonIndex) : withoutDomain
}

function extractPhoneLikeCandidates(value: string): string[] {
  const normalized = normalizeDigits(stripJidSuffix(value))
  const matches = normalized.match(/(?:\+|00)?\d[\d\s().-]{7,}\d/g) ?? []
  if (matches.length > 0) return matches

  return /\d/.test(normalized) ? [normalized] : []
}

function normalizeDigitsOnly(digitsRaw: string, options: NormalizePhoneOptions): string | null {
  let digits = digitsRaw.replace(/\D/g, '')
  if (!digits) return null

  if (digits.startsWith('00')) {
    digits = digits.slice(2)
  }

  if (options.preferBangladesh) {
    if (/^8801[3-9]\d{8}$/.test(digits)) return `+${digits}`
    if (/^01[3-9]\d{8}$/.test(digits)) return `+880${digits.slice(1)}`
    if (/^1[3-9]\d{8}$/.test(digits)) return `+880${digits}`
  }

  if (digits.length >= 10 && digits.length <= 15) {
    return `+${digits}`
  }

  return null
}

export function normalizePhoneSmart(
  value: string | null | undefined,
  options: NormalizePhoneOptions = {},
): string | null {
  if (!value) return null
  const trimmed = value.trim()
  if (!trimmed) return null

  const candidates = extractPhoneLikeCandidates(trimmed)
  for (const candidate of candidates) {
    const normalized = normalizeDigitsOnly(candidate, options)
    if (normalized) return normalized
  }

  return null
}

export function buildPhoneLookupVariants(phone: string): string[] {
  const normalized = normalizePhoneSmart(phone, { preferBangladesh: true })
  if (!normalized) return []

  const digits = normalized.replace(/\D/g, '')
  const variants = new Set<string>([normalized, digits])

  if (/^8801[3-9]\d{8}$/.test(digits)) {
    variants.add(`01${digits.slice(3)}`)
  }

  return Array.from(variants)
}
