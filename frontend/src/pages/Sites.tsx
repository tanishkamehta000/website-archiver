import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

type SiteItem = {
  host: string
  snapshots: number
  last_ts?: string | null
  last_started?: string | null
}

export default function Sites() {
  const [items, setItems] = useState<SiteItem[]>([])
  const [loading, setLoading] = useState(true)
  const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000'

  useEffect(() => {
    async function go() {
      try {
        const res = await fetch(`${API_BASE}/api/sites`)
        if (!res.ok) throw new Error(await res.text())
        const data = await res.json()
        setItems(data)
      } catch (e) {
        console.error(e)
      } finally {
        setLoading(false)
      }
    }
    go()
  }, [])

  const fmtInt = (n?: number) =>
    typeof n === 'number' ? new Intl.NumberFormat().format(n) : '0'

  const fmtDate = (s?: string | null) => {
    if (!s) return 'None'
    const d = new Date(s)
    if (isNaN(d.getTime())) return s
    return d.toLocaleString()
  }

  if (loading) return <div>Loading sites…</div>

  return (
    <div>
      <h3>All sites</h3>

      <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, tableLayout: 'fixed' }}>
        <colgroup>
          <col style={{ width: '50%' }} />
          <col style={{ width: '15%' }} />
          <col style={{ width: '25%' }} />
          <col style={{ width: '10%' }} />
        </colgroup>
        <thead>
          <tr>
            <th style={thLeft}>Host</th>
            <th style={thRight}>Snapshots</th>
            <th style={thLeft}>Last captured</th>
            <th style={thLeft}>Open</th>
          </tr>
        </thead>
        <tbody>
          {items.map((s) => (
            <tr key={s.host}>
              <td style={tdLeft}>
                <span style={hostStyle}>{s.host}</span>
              </td>
              <td style={tdRight}>
                <span style={badge}>{fmtInt(s.snapshots)}</span>
              </td>
              <td style={tdLeft}>
                <span style={mono}>{fmtDate(s.last_started)}</span>
              </td>
              <td style={tdLeft}>
                <Link to={`/site/${s.host}`}>View</Link>
              </td>
            </tr>
          ))}
          {items.length === 0 && (
            <tr>
              <td style={tdEmpty} colSpan={4}>No sites yet.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

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

const hostStyle: React.CSSProperties = {
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  display: 'inline-block',
  maxWidth: '100%',
}

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
