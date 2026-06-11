export interface Fact {
  id: string
  content: string
  file_paths: string[]
  author: string
  repo: string
  created_at: string
  hit_count: number
  last_hit_at: string | null
  verified: boolean
}

export interface FactStats {
  total: number
  verified: number
  repos: number
  added_today: number
  stale: number
}

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, options)
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`API ${path} → ${res.status}: ${body}`)
  }
  return res.json() as Promise<T>
}

export function listFacts(filters?: { repo?: string; verified?: boolean }): Promise<Fact[]> {
  const params = new URLSearchParams()
  if (filters?.repo) params.set('repo', filters.repo)
  if (filters?.verified !== undefined) params.set('verified', String(filters.verified))
  const qs = params.toString()
  return apiFetch<Fact[]>(`/facts${qs ? `?${qs}` : ''}`)
}

export function getFactStats(): Promise<FactStats> {
  return apiFetch<FactStats>('/facts/stats')
}

export function deleteFact(id: string): Promise<{ deleted: number }> {
  return apiFetch<{ deleted: number }>(`/facts/${id}`, { method: 'DELETE' })
}

export function verifyFact(id: string): Promise<{ id: string; verified: boolean }> {
  return apiFetch<{ id: string; verified: boolean }>(`/facts/${id}/verify`, { method: 'PATCH' })
}

/** Format a UTC timestamp as a relative "Xm ago" / "Xh ago" / "Xd ago" string */
export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d ago`
  return `${Math.floor(days / 7)}w ago`
}
