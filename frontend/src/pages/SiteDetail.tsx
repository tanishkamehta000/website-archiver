// site details page: shows all snapshots, recapture, local view, and map
import { useEffect, useMemo, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { listSnapshots, startArchive, jobStatus } from '../lib/api'

//snapshot def
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

  const latest = useMemo(() => snaps[0], [snaps])

  // list all snapshots for this host
  async function refresh() {
    if (!host) return
    setLoading(true)
    try {
      const data = await listSnapshots(host)
      setSnaps(data)
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { refresh() }, [host])

  // take new snapshots, but use the same root url
  async function handleRecapture() {
    if (!host) return
    if (!latest?.root_url) { alert('No previous root URL found'); return }
    try {
      setRecapturing(true)
      setLog(l => [...l, `Recapturing ${host} from ${latest.root_url}`])
      const { job_id } = await startArchive(
        latest.root_url,
        depth,
        typeof maxPages === 'number' ? maxPages : undefined
      )
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
          if (s.status === 'success') {
            await refresh()
            setLog(l => [...l, 'Recapture completed'])
          } else {
            setLog(l => [...l, `Recapture failed: ${s.error || 'unknown'}`])
          }
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

  const fmtInt = (n?: number) =>
    typeof n === 'number' ? new Intl.NumberFormat().format(n) : '—'

  const fmtDate = (s?: string) => {
    if (!s) return '—'
    const d = new Date(s)
    return isNaN(d.getTime()) ? s : d.toLocaleString()
  }

  const fmtBytes = (b?: number) => {
    if (b == null) return '—'
    const units = ['B','KB','MB','GB','TB']
    let v = b, i = 0
    while (v >= 1024 && i < units.length - 1) { v /= 1024; i++ }
    return `${(i === 0 ? v : Math.round(v * 10) / 10)} ${units[i]}`
  }

  return (
    <div>
      <h3>Site: {host}</h3>

      <div style={{ display: 'flex', gap: 12, alignItems: 'center', margin: '12px 0', flexWrap: 'wrap' }}>
        <div>Recapture URL: <code>{latest?.root_url || 'unknown'}</code></div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          Depth
          <input
            type="number" min={0} max={3}
            value={depth} onChange={e => setDepth(parseInt(e.target.value))}
            style={{ width: 80, padding: 6 }}
          />
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          Max pages
          <input
            type="number" min={1} placeholder="auto"
            value={maxPages}
            onChange={e => setMaxPages(e.target.value === '' ? '' : parseInt(e.target.value))}
            style={{ width: 100, padding: 6 }}
          />
        </label>
        <button onClick={handleRecapture} disabled={recapturing || !latest?.root_url}>Recapture</button>
      </div>

      {/* job logging */}
      <pre style={{ background: '#111', color: '#ddd', padding: 12, minHeight: 80, overflow: 'auto' }}>
        {log.join('\n')}
      </pre>

      <h4 style={{ marginTop: 16, marginBottom: 8 }}>Snapshots</h4>

      <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, tableLayout: 'fixed' }}>
        <colgroup>
          <col style={{ width: '24%' }} />
          <col style={{ width: '28%' }} />
          <col style={{ width: '14%' }} />
          <col style={{ width: '14%' }} /> 
          <col style={{ width: '10%' }} />
          <col style={{ width: '10%' }} />
        </colgroup>
        <thead>
          <tr>
            <th style={thLeft}>Timestamp</th>
            <th style={thLeft}>Captured at</th>
            <th style={thRight}>Pages</th>
            <th style={thRight}>Size</th>
            <th style={thLeft}>Open</th>
            <th style={thLeft}>Map</th>
          </tr>
        </thead>
        <tbody>
          {snaps.map(s => (
            <tr key={s.ts}>
              <td style={tdLeft}><span style={mono}>{s.ts}</span></td>
              <td style={tdLeft}><span style={mono}>{fmtDate(s.started_at)}</span></td>
              <td style={tdRight}>
                <span style={badge}>{fmtInt(s.count_fetched)}</span>
              </td>
              <td style={tdRight}>{fmtBytes(s.bytes_stored)}</td>
              <td style={tdLeft}><Link to={`/view/${host}/${s.ts}`}>View</Link></td>
              <td style={tdLeft}><Link to={`/map/${host}/${s.ts}`}>Map</Link></td>
            </tr>
          ))}
          {(!loading && snaps.length === 0) && (
            <tr>
              <td style={tdEmpty} colSpan={6}>No snapshots yet.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

// same table styles as all sites page
const thBase: React.CSSProperties = {
  textAlign: 'left',
  fontWeight: 700,
  padding: '10px 12px',
  borderBottom: '1px solid #e5e7eb',
  background: '#fafafa',
}
const thLeft = thBase
const thRight: React.CSSProperties = { ...thBase, textAlign: 'right' }

const tdBase: React.CSSProperties = {
  padding: '10px 12px',
  borderBottom: '1px solid #f0f2f5',
  verticalAlign: 'middle',
}
const tdLeft = tdBase
const tdRight: React.CSSProperties = { ...tdBase, textAlign: 'right' }
const tdEmpty: React.CSSProperties = { ...tdBase, color: '#777', textAlign: 'center' }

const badge: React.CSSProperties = {
  display: 'inline-block',
  minWidth: 28,
  textAlign: 'center',
  padding: '2px 8px',
  borderRadius: 12,
  background: '#f2f4f7',
}

const mono: React.CSSProperties = {
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
}