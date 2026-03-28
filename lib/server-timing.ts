export type TimedResult<T> = {
  value: T
  durationMs: number
}

export async function timeAsync<T>(fn: () => Promise<T>): Promise<TimedResult<T>> {
  const start = performance.now()
  const value = await fn()
  return { value, durationMs: performance.now() - start }
}

export function formatServerTiming(metric: string, durationMs: number, description?: string): string {
  const dur = Number.isFinite(durationMs) ? durationMs.toFixed(1) : '0'
  return description ? `${metric};dur=${dur};desc="${description}"` : `${metric};dur=${dur}`
}
