import { useEffect, useMemo, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { listSnapshots, startArchive, jobStatus } from '../lib/api'

type Snap = {
  ts: string
  started_at: string
  root_url: string
  count_fetched?: number
  bytes_stored?: number
  status?: string
}

export default function SiteDetail() {
  const { host } = useParams<{ host: string }>()
  const [snaps, setSnaps] = useState<Snap[]>([])
  const [loading, setLoading] = useState(false)
  const [depth, setDepth] = useState(1)
  const [maxPages, setMaxPages] = useState<number | ''>('')
  const [recapturing, setRecapturing] = useState(false)
  const [log, setLog] = useState<string[]>([])
  const [leftTs, setLeftTs] = useState<string>('')
  const [rightTs, setRightTs] = useState<string>('')

  const nav = useNavigate()
  const latest = useMemo(() => snaps[0], [snaps])

  async function refresh() {
    if (!host) return
    setLoading(true)
    try {
      const data = await listSnapshots(host)
      setSnaps(data)
      if (data?.length) {
        setLeftTs(data[0].ts)
        setRightTs(data[Math.min(1, data.length - 1)].ts)
      }
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { refresh() }, [host])

  async function handleRecapture() {
    if (!host) return
    if (!latest?.root_url) { alert('No previous root URL found'); return }
    try {
      setRecapturing(true)
      setLog(l => [...l, `Recapturing ${host} from ${latest.root_url}`])
      const { job_id } = await startArchive(latest.root_url, depth, typeof maxPages === 'number' ? maxPages : undefined)
      setLog(l => [...l, `Job ${job_id} started`])
      let done = false
      while (!done) {
        const s: any = await jobStatus(job_id)
        const pct = s.progress ?? 0
        const pages = s.details?.pages ?? 0
        const limit = s.details?.limit ?? '?'
        setLog(l => [...l, `Status: ${s.status} (${pct}% | ${pages}/${limit} pages)`])
        if (s.status === 'success' || s.status === 'error') {
          done = true
          if (s.status === 'success') { await refresh(); setLog(l => [...l, 'Recapture completed']) }
          else { setLog(l => [...l, `Recapture failed: ${s.error || 'unknown'}`]) }
        } else {
          await new Promise(r => setTimeout(r, 1000))
        }
      }
    } catch (e: any) {
      setLog(l => [...l, `Error: ${e.message}`])
    } finally {
      setRecapturing(false)
    }
  }

  return (
    <div>
      <h3>Site: {host}</h3>

      <div style={{ display: 'flex', gap: 12, alignItems: 'center', margin: '12px 0', flexWrap: 'wrap' }}>
        <div>Recapture URL: <code>{latest?.root_url || 'unknown'}</code></div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          Depth
          <input type="number" min={0} max={3} value={depth} onChange={e => setDepth(parseInt(e.target.value))} style={{ width: 80, padding: 6 }} />
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          Max pages
          <input type="number" min={1} placeholder="auto" value={maxPages} onChange={e => setMaxPages(e.target.value === '' ? '' : parseInt(e.target.value))} style={{ width: 100, padding: 6 }} />
        </label>
        <button onClick={handleRecapture} disabled={recapturing || !latest?.root_url}>Recapture</button>
      </div>

      <pre style={{ background: '#111', color: '#ddd', padding: 12, minHeight: 80, overflow: 'auto' }}>
        {log.join('\n')}
      </pre>

      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 12 }}>
        <thead>
          <tr>
            <th align="left">Timestamp</th>
            <th align="left">Captured at</th>
            <th align="right">Pages</th>
            <th align="right">Size</th>
            <th align="left">Open</th>
            <th align="left">Map</th>
          </tr>
        </thead>
        <tbody>
          {snaps.map(s => (
            <tr key={s.ts}>
              <td>{s.ts}</td>
              <td>{s.started_at}</td>
              <td align="right">{s.count_fetched ?? '—'}</td>
              <td align="right">{s.bytes_stored != null ? Math.round(s.bytes_stored / 1024) + ' KB' : '—'}</td>
              <td><Link to={`/view/${host}/${s.ts}`}>View</Link></td>
              <td><Link to={`/map/${host}/${s.ts}`}>Map</Link></td>
            </tr>
          ))}
          {snaps.length === 0 && (
            <tr><td colSpan={6} style={{ padding: 12, color: '#777' }}>No snapshots yet.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
