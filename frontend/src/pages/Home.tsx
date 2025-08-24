// home page: start capture of website, log progress, and delete everything button.
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { startArchive, jobStatus, deleteAllSites } from '../lib/api'

export default function Home() {
  const [url, setUrl] = useState('https://example.com')
  const [depth, setDepth] = useState(1)
  const [maxPages, setMaxPages] = useState<number | ''>('')
  const [log, setLog] = useState<string[]>([])
  const [running, setRunning] = useState(false)
  const [clearing, setClearing] = useState(false)
  const nav = useNavigate()

  // start new archive job and track progress until it finishes
  async function handleStart() {
    try {
      setRunning(true)
      setLog(l => [...l, `Starting capture for ${url}`])
      const { job_id } = await startArchive(url, depth, typeof maxPages === 'number' ? maxPages : undefined)
      setLog(l => [...l, `Job ${job_id} started`])

      // simple progress loop
      let done = false
      while (!done) {
        const s: any = await jobStatus(job_id)
        const pct = s.progress ?? 0
        const pages = s.details?.pages ?? s.details?.count_fetched ?? 0
        const limit = s.details?.limit ?? '?'
        setLog(l => [...l, `Status: ${s.status} (${pct}% | ${pages}/${limit} pages)`])
        if (s.status === 'success' || s.status === 'error') {
          done = true
          const host = s.host
          if (s.status === 'success') {
            // automatic jump to website detail page when done
            nav(`/site/${host}`)
          }
        } else {
          await new Promise(r => setTimeout(r, 1000))
        }
      }
    } catch (e: any) {
      setLog(l => [...l, `Error: ${e.message}`])
    } finally {
      setRunning(false)
    }
  }

  async function handleClearAll() {
    if (!confirm('Delete ALL archived sites and snapshots? This cannot be undone.')) return
    try {
      setClearing(true)
      await deleteAllSites()
      setLog(l => [...l, 'All snapshots deleted.'])
    } catch (e: any) {
      setLog(l => [...l, `Error deleting: ${e.message}`])
    } finally {
      setClearing(false)
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
        <input
          value={url}
          onChange={e => setUrl(e.target.value)}
          style={{ flex: 1, padding: 8 }}
          placeholder="https://example.com"
        />
        <label style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          Depth
          <input
            type="number"
            min={0}
            max={3}
            value={depth}
            onChange={e => setDepth(parseInt(e.target.value))}
            style={{ width: 80, padding: 8 }}
          />
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          Max pages
          <input
            type="number"
            min={1}
            placeholder="auto"
            value={maxPages}
            onChange={e => setMaxPages(e.target.value === '' ? '' : parseInt(e.target.value))}
            style={{ width: 100, padding: 8 }}
          />
        </label>
        <button onClick={handleStart} disabled={running} style={{ padding: '8px 12px' }}>
          Capture
        </button>
        <button
          onClick={handleClearAll}
          disabled={clearing || running}
          style={{ padding: '8px 12px', color: 'white', background: '#c0392b', border: 0, borderRadius: 4 }}
        >
          Clear everything
        </button>
      </div>
      <pre style={{ background: '#111', color: '#ddd', padding: 12, minHeight: 120, marginTop: 16, overflow: 'auto' }}>
        {log.join('\n')}
      </pre>
    </div>
  )
}
