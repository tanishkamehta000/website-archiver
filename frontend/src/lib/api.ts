const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000'

/** start new archive job and return its job_id. */
export async function startArchive(url: string, depth = 1, max_pages?: number) {
  const body: any = { url, depth }
  if (typeof max_pages === 'number') body.max_pages = max_pages
  const res = await fetch(`${API_BASE}/api/archive`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json() as Promise<{ job_id: string }>
}

export async function jobStatus(jobId: string) {
  const res = await fetch(`${API_BASE}/api/archive/${encodeURIComponent(jobId)}/status`)
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function listSnapshots(host: string) {
  const res = await fetch(`${API_BASE}/api/site/${host}/snapshots`)
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

/** delete single snapshot */
export async function deleteSnapshot(host: string, ts: string) {
  const res = await fetch(`${API_BASE}/api/site/${host}/${ts}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function deleteSite(host: string) {
  const res = await fetch(`${API_BASE}/api/site/${host}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function deleteAllSites() {
  const res = await fetch(`${API_BASE}/api/sites?confirm=ALL`, { method: 'DELETE' })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}
