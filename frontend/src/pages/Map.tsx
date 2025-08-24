import React, { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

type GNode = { id: string }
type GEdge = { source: string; target: string }
type Graph = { nodes: GNode[]; edges: GEdge[] }

type Pos = { x: number; y: number; label: string }
type Layout = {
  W: number
  H: number
  positions: Record<string, Pos>
  edges: GEdge[]
  root?: string
}

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000'

export default function Map() {
  const { host, ts } = useParams<{ host: string; ts: string }>()
  const [graph, setGraph] = useState<Graph | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!host || !ts) { setErr('Missing host or timestamp'); setLoading(false); return }
      try {
        setLoading(true)
        const res = await fetch(`${API_BASE}/archive/${encodeURIComponent(host)}/${encodeURIComponent(ts)}/graph.json`)
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
        const data: Graph = await res.json()
        if (!cancelled) setGraph(data)
      } catch (e: any) {
        if (!cancelled) setErr(String(e?.message || e))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [host, ts])

  const layout = useMemo<Layout | null>(() => {
    if (!graph) return null

    const MAX = 250
    const nodes = (graph.nodes || []).slice(0, MAX)
    const edgesAll = graph.edges || []
    const keep = new Set(nodes.map(n => n.id))
    const edges = edgesAll.filter(e => keep.has(e.source) && keep.has(e.target))

    const root = chooseRoot(nodes)

    const out: Record<string, string[]> = {}
    for (const e of edges) {
      ;(out[e.source] ||= []).push(e.target)
    }

    // bfs
    const depth: Record<string, number> = {}
    if (root) {
      const q: string[] = [root]
      depth[root] = 0
      while (q.length) {
        const cur = q.shift() as string
        const d = depth[cur] || 0
        for (const nb of out[cur] || []) {
          if (!(nb in depth)) { depth[nb] = d + 1; q.push(nb) }
        }
      }
    }

    let maxDepth = 0
    const levelsObj: Record<number, string[]> = {}
    for (const id of keep) {
      const lv = (id in depth) ? depth[id] : Number.POSITIVE_INFINITY
      if (isFinite(lv)) {
        if (!levelsObj[lv]) levelsObj[lv] = []
        levelsObj[lv].push(id)
        if (lv > maxDepth) maxDepth = lv
      }
    }
    const unreachable = [...keep].filter(id => !(id in depth))
    const unreachableLevel = maxDepth + (root ? 1 : 0)
    if (unreachable.length) {
      levelsObj[unreachableLevel] = (levelsObj[unreachableLevel] || []).concat(unreachable)
      maxDepth = unreachableLevel
    }

    for (const key of Object.keys(levelsObj)) {
      const arr = levelsObj[Number(key)]
      arr.sort((a, b) => pathKey(a).localeCompare(pathKey(b)) || a.localeCompare(b))
    }

    const W = 1000, H = 600
    const marginX = 120, marginY = 40
    const colCount = root ? (maxDepth + 1) : Object.keys(levelsObj).length
    const colStep = colCount > 1 ? (W - 2 * marginX) / (colCount - 1) : 0

    const positions: Record<string, Pos> = {}
    for (const key of Object.keys(levelsObj)) {
      const lv = Number(key)
      const x = marginX + colStep * lv
      const arr = levelsObj[lv]
      const rows = arr.length
      const rowStep = rows > 0 ? (H - 2 * marginY) / (rows + 1) : 0
      arr.forEach((id, i) => {
        const y = marginY + (i + 1) * rowStep
        positions[id] = { x, y, label: safeLabel(id) }
      })
    }

    const keptEdges = edges.filter(e => positions[e.source] && positions[e.target])
    return { W, H, positions, edges: keptEdges, root }
  }, [graph])

  if (loading) return <div>Loading crawl map…</div>
  if (err) return <div style={{ color: '#c00' }}>Error loading graph: {err}</div>
  if (!graph || !layout) return <div>No graph data found. Try running a new capture first.</div>

  return (
    <div>
      <h3>Crawl map — {host} @ {ts}</h3>

      <svg width={layout.W} height={layout.H} style={{ border: '1px solid #e5e7eb', background: '#fff' }}>
        {layout.edges.map((e, idx) => {
          const a = layout.positions[e.source]
          const b = layout.positions[e.target]
          const midX = (a.x + b.x) / 2
          const d = `M ${a.x} ${a.y} C ${midX} ${a.y}, ${midX} ${b.y}, ${b.x} ${b.y}`
          return <path key={idx} d={d} stroke="#cbd5e1" strokeWidth={1} fill="none" />
        })}

        {Object.entries(layout.positions).map(([id, p]) => (
          <g key={id}>
            <circle cx={p.x} cy={p.y} r={9} fill={id === layout.root ? '#10b981' : '#6366f1'} />
            <text x={p.x + 12} y={p.y + 4} fontSize="12" fill="#111">{p.label}</text>
          </g>
        ))}
      </svg>

      <div style={{ marginTop: 8, color: '#6b7280' }}>
        {layout.root ? <span><span style={sw('#10b981')}></span> root</span> : 'No root detected; showing grouped layers.'}
      </div>

      <div style={{ marginTop: 8 }}>
        <Link to={`/site/${host}`}>← Back to site</Link>
      </div>
    </div>
  )
}

function chooseRoot(nodes: GNode[]): string | undefined {
  const withUrls = nodes.filter(n => {
    try { new URL(n.id); return true } catch { return false }
  })
  const home = withUrls.find(n => {
    try { return new URL(n.id).pathname === '/' } catch { return false }
  })
  if (home) return home.id
  if (!withUrls.length) return nodes[0]?.id
  return withUrls.sort((a, b) => (pathKey(a.id).length - pathKey(b.id).length))[0].id
}

function pathKey(u: string): string {
  try {
    const url = new URL(u)
    return url.pathname || '/'
  } catch {
    return u
  }
}

function safeLabel(u: string): string {
  const p = pathKey(u)
  return p.length > 40 ? p.slice(0, 37) + '…' : p
}

function sw(color: string): React.CSSProperties {
  return { display: 'inline-block', width: 12, height: 12, background: color, borderRadius: 3, marginRight: 6 }
}
