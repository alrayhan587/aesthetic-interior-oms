'use client'

type MeResponse = {
  id?: string | null
  fullName?: string | null
  userDepartments?: Array<{ department?: { name?: string | null } | null }>
  [key: string]: unknown
}

type MeCacheEntry = {
  savedAt: number
  data: MeResponse
}

const ME_CACHE_TTL_MS = 60_000
let meCache: MeCacheEntry | null = null
let meInFlight: Promise<MeResponse> | null = null

export async function fetchMeCached(force = false): Promise<MeResponse> {
  const now = Date.now()
  const cached = meCache
  const cacheIsFresh = cached && now - cached.savedAt < ME_CACHE_TTL_MS
  if (!force && cacheIsFresh) {
    return cached.data
  }

  if (!meInFlight) {
    meInFlight = fetch('/api/me')
      .then(async (res) => {
        const payload = (await res.json()) as MeResponse
        meCache = { savedAt: Date.now(), data: payload }
        return payload
      })
      .finally(() => {
        meInFlight = null
      })
  }

  return meInFlight
}
