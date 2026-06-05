/**
 * Dependency graph — all 6 UX features:
 *  1. Orientation strip: explains top-vs-bottom meaning
 *  2. Tab auto-categorisation: subtitle from file-name patterns
 *  3. Click-to-focus: locks graph on one node + its connections; Escape resets
 *  4. Search: finds files across all tabs, auto-switches tab
 *  5. Mini-card: components ≤3 files skip the canvas entirely
 *  6. "Check impact" bridge: hover button → switch to Impact Area tab
 */
import { createContext, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ReactFlow, ReactFlowProvider,
  Background, Controls,
  Handle, Position,
  useNodesState, useEdgesState, useReactFlow,
  type Node, type Edge, type NodeProps,
  BackgroundVariant, MarkerType,
} from '@xyflow/react'
import dagre from '@dagrejs/dagre'
import '@xyflow/react/dist/style.css'

// ─── Types ────────────────────────────────────────────────────────────────────

interface DepEntry { uses: string[]; used_by: string[] }

interface NodeData extends Record<string, unknown> {
  label:       string
  fullPath:    string
  usesCount:   number
  usedByCount: number
  isHub:       boolean
  role:        'hub' | 'sink' | 'source' | 'normal'
  dimmed:      boolean
  focused:     boolean
  connected:   boolean   // direct neighbour of focused node
  highlighted: boolean   // search match
}

export interface Props {
  deps:           Record<string, DepEntry>
  maxNodes?:      number
  onCheckImpact?: (filePath: string) => void
}

// ─── Contexts (avoids threading props through ReactFlow node data) ────────────

const ImpactCtx = createContext<((path: string) => void) | null>(null)

// ─── Role / colour ────────────────────────────────────────────────────────────

function roleOf(usedBy: number, uses: number, total: number): NodeData['role'] {
  if (total >= 5)           return 'hub'
  if (usedBy > uses * 1.5) return 'sink'
  if (uses > usedBy * 1.5) return 'source'
  return 'normal'
}

const ROLE = {
  hub:    { bg: '#1a0f00', border: '#f97316', text: '#fed7aa', dot: '#f97316' },
  sink:   { bg: '#001510', border: '#34d399', text: '#a7f3d0', dot: '#34d399' },
  source: { bg: '#00091a', border: '#60a5fa', text: '#bfdbfe', dot: '#60a5fa' },
  normal: { bg: '#0d1117', border: '#334155', text: '#94a3b8', dot: '#64748b' },
}

// ─── Custom node ──────────────────────────────────────────────────────────────

function DepNode({ data }: NodeProps) {
  const d  = data as NodeData
  const st = ROLE[d.role]

  const opacity = d.dimmed ? 0.08 : 1

  // Border: focused = thick glow in role colour; connected = semi-bright role colour; highlighted = amber
  const borderColor = d.focused
    ? st.border
    : d.connected
    ? st.border
    : d.highlighted
    ? '#fbbf24'
    : st.border

  const borderWidth = d.focused ? 2.5 : d.connected ? 1.5 : 1

  const boxShadow = d.focused
    ? `0 0 0 3px ${st.border}55, 0 0 18px ${st.border}44`
    : d.connected
    ? `0 0 0 1px ${st.border}33`
    : 'none'

  // Slightly lift background on focus/connected
  const bg = d.focused
    ? st.border + '22'   // faint role-tinted background
    : d.connected
    ? st.bg
    : st.bg

  return (
    <div
      style={{
        background: bg,
        borderColor,
        borderWidth,
        boxShadow,
        minWidth: 165, maxWidth: 215,
        opacity,
        transition: 'opacity 0.2s, box-shadow 0.2s, border-color 0.2s',
      }}
      className="rounded-xl border px-3 py-2.5"
    >
      <Handle type="target" position={Position.Top}
        style={{ background: st.border, width: 7, height: 7, border: 'none' }} />

      <p className="text-[11px] font-bold font-mono truncate leading-tight" style={{ color: st.text }}>
        {d.label}
      </p>
      <p className="text-[9px] font-mono mt-0.5 truncate opacity-40" style={{ color: st.text }}
        title={d.fullPath}>{d.fullPath}</p>

      <div className="flex items-center gap-3 mt-2 pt-1.5 border-t border-white/5 flex-wrap">
        {d.usedByCount > 0 && (
          <span className="text-[9px] font-semibold text-emerald-400">↑ {d.usedByCount} rely on this</span>
        )}
        {d.usesCount > 0 && (
          <span className="text-[9px] font-semibold text-blue-400">↓ uses {d.usesCount}</span>
        )}
        {d.isHub && (
          <span className="ml-auto text-[8px] font-black text-orange-300 bg-orange-500/20 border border-orange-500/30 px-1.5 py-0.5 rounded-full">
            HUB
          </span>
        )}
      </div>

      <Handle type="source" position={Position.Bottom}
        style={{ background: st.border, width: 7, height: 7, border: 'none' }} />
    </div>
  )
}

const NODE_TYPES = { dep: DepNode }
const NODE_W = 215, NODE_H = 85

// ─── Dagre layout ─────────────────────────────────────────────────────────────

function layout(nodes: Node[], edges: Edge[]): Node[] {
  const g = new dagre.graphlib.Graph()
  g.setDefaultEdgeLabel(() => ({}))
  g.setGraph({ rankdir: 'TB', nodesep: 35, ranksep: 90, marginx: 50, marginy: 50 })
  nodes.forEach(n => g.setNode(n.id, { width: NODE_W, height: NODE_H }))
  edges.forEach(e => g.setEdge(e.source, e.target))
  dagre.layout(g)
  return nodes.map(n => {
    const p = g.node(n.id)
    return { ...n,
      position:       { x: p.x - NODE_W / 2, y: p.y - NODE_H / 2 },
      targetPosition: Position.Top,
      sourcePosition: Position.Bottom,
    }
  })
}

// ─── Connected-component finder ───────────────────────────────────────────────

interface Component { id: string; name: string; category: string; files: string[] }

const CATEGORY_RULES: [RegExp, string][] = [
  [/route|controller|handler|endpoint/i, 'Route Handlers'],
  [/service|manager|provider/i,          'Services'],
  [/util|helper|common|shared/i,         'Shared Utilities'],
  [/component|widget/i,                  'UI Components'],
  [/model|schema|entity|type/i,          'Data Models'],
  [/config|setting|env|constant/i,       'Configuration'],
  [/test|spec/i,                         'Tests'],
  [/middleware|interceptor/i,            'Middleware'],
  [/store|reducer|context|state/i,       'State Management'],
  [/hook/i,                              'Hooks'],
  [/page|view|screen/i,                  'Pages / Views'],
]

function guessCategory(files: string[]): string {
  for (const [re, label] of CATEGORY_RULES) {
    if (files.some(f => re.test(f))) return label
  }
  // Fall back to most-common parent directory
  const dirs = files.map(f => f.split('/').slice(-2, -1)[0]).filter(Boolean)
  if (dirs.length) {
    const freq: Record<string, number> = {}
    dirs.forEach(d => { freq[d] = (freq[d] ?? 0) + 1 })
    const top = Object.entries(freq).sort((a, b) => b[1] - a[1])[0]?.[0]
    if (top && top !== 'src') return top.charAt(0).toUpperCase() + top.slice(1)
  }
  return 'Related Files'
}

function findComponents(deps: Record<string, DepEntry>): Component[] {
  const adj = new Map<string, Set<string>>()
  const link = (a: string, b: string) => {
    if (!adj.has(a)) adj.set(a, new Set())
    if (!adj.has(b)) adj.set(b, new Set())
    adj.get(a)!.add(b); adj.get(b)!.add(a)
  }
  Object.entries(deps).forEach(([id, d]) => {
    if (!adj.has(id)) adj.set(id, new Set())
    ;(d.uses    ?? []).forEach(u => link(id, u))
    ;(d.used_by ?? []).forEach(u => link(id, u))
  })

  const visited = new Set<string>()
  const raw: string[][] = []
  for (const start of adj.keys()) {
    if (visited.has(start)) continue
    const comp: string[] = []
    const q = [start]
    while (q.length) {
      const n = q.shift()!
      if (visited.has(n)) continue
      visited.add(n); comp.push(n)
      adj.get(n)?.forEach(nb => { if (!visited.has(nb)) q.push(nb) })
    }
    raw.push(comp)
  }

  raw.sort((a, b) => b.length - a.length)
  return raw.map((files, i) => {
    const leader = [...files].filter(f => deps[f])
      .sort((a, b) => {
        const ta = (deps[a]?.uses.length ?? 0) + (deps[a]?.used_by.length ?? 0)
        const tb = (deps[b]?.uses.length ?? 0) + (deps[b]?.used_by.length ?? 0)
        return tb - ta
      })[0] ?? files[0]
    return {
      id:       String(i),
      name:     leader.split('/').pop()?.replace(/\.[^.]+$/, '') ?? leader,
      category: guessCategory(files),
      files,
    }
  })
}

// ─── Build RF nodes + edges for one component ─────────────────────────────────

const BASE_EDGE_STYLE = { stroke: '#1e3a5f', strokeWidth: 1.5 }
const BASE_MARKER     = { type: MarkerType.ArrowClosed, color: '#1e3a5f', width: 14, height: 14 }

function buildComponent(
  files: string[], deps: Record<string, DepEntry>, search: string,
): { nodes: Node[]; edges: Edge[] } {
  const inSet  = new Set(files)
  const sq     = search.toLowerCase()

  const nodes: Node[] = files.filter(f => deps[f]).map(f => {
    const d      = deps[f]
    const uses   = (d.uses    ?? []).filter(u => inSet.has(u))
    const usedBy = (d.used_by ?? []).filter(u => inSet.has(u))
    const total  = uses.length + usedBy.length
    const role   = roleOf(usedBy.length, uses.length, total)
    return {
      id: f, type: 'dep', position: { x: 0, y: 0 },
      data: {
        label:       f.split('/').pop() ?? f,
        fullPath:    f,
        usesCount:   uses.length,
        usedByCount: usedBy.length,
        isHub:       total >= 5,
        role,
        dimmed:      false,
        focused:     false,
        connected:   false,
        highlighted: sq ? f.toLowerCase().includes(sq) : false,
      } satisfies NodeData,
      style: { background: ROLE[role].bg, border: `1px solid ${ROLE[role].border}` },
    }
  })

  const nodeIds = new Set(nodes.map(n => n.id))
  const edges: Edge[] = []
  nodes.forEach(n => {
    ;(deps[n.id]?.uses ?? []).filter(t => nodeIds.has(t)).forEach(t =>
      edges.push({ id: `${n.id}->${t}`, source: n.id, target: t,
                   type: 'smoothstep', style: BASE_EDGE_STYLE,
                   markerEnd: BASE_MARKER })
    )
  })
  return { nodes: layout(nodes, edges), edges }
}

// ─── Feature 5: Mini-card for ≤3-file components ─────────────────────────────
// Renders compact node cards (same width as graph nodes) centred vertically.

function MiniCard({ files, deps, onCheckImpact }: {
  files: string[]; deps: Record<string, DepEntry>; onCheckImpact?: (p: string) => void
}) {
  const sorted = [...files].filter(f => deps[f]).sort((a, b) => {
    const ta = (deps[a]?.uses.length ?? 0) + (deps[a]?.used_by.length ?? 0)
    const tb = (deps[b]?.uses.length ?? 0) + (deps[b]?.used_by.length ?? 0)
    return tb - ta
  })

  return (
    <div className="w-full flex flex-col items-center gap-0 py-8"
      style={{ background: '#050d1a', borderRadius: '1rem', border: '1px solid #1e293b' }}>
      {sorted.map((f, i) => {
        const d      = deps[f]
        const uses   = (d?.uses    ?? []).filter(u => files.includes(u)).length
        const usedBy = (d?.used_by ?? []).filter(u => files.includes(u)).length
        const role   = roleOf(d?.used_by.length ?? 0, d?.uses.length ?? 0,
                              (d?.uses.length ?? 0) + (d?.used_by.length ?? 0))
        const st = ROLE[role]

        return (
          <div key={f} className="flex flex-col items-center w-full" style={{ maxWidth: NODE_W }}>
            {/* Connector from previous card */}
            {i > 0 && (
              <div className="flex flex-col items-center my-1">
                <div className="w-px h-5 bg-slate-700" />
                <span className="text-[9px] text-slate-600 leading-none my-0.5">imports</span>
                <div className="w-px h-5 bg-slate-700" />
                <svg className="w-2.5 h-2.5 text-slate-600" viewBox="0 0 10 10" fill="currentColor">
                  <polygon points="5,10 0,0 10,0" />
                </svg>
              </div>
            )}

            {/* Node card — matches DepNode dimensions/style */}
            <div className="w-full rounded-xl border px-3 py-2.5 shadow-lg"
              style={{ background: st.bg, borderColor: st.border, borderWidth: 1 }}>
              <p className="text-[11px] font-bold font-mono truncate leading-tight"
                style={{ color: st.text }}>{f.split('/').pop()}</p>
              <p className="text-[9px] font-mono mt-0.5 truncate opacity-40"
                style={{ color: st.text }} title={f}>{f}</p>

              <div className="flex items-center gap-3 mt-2 pt-1.5 border-t border-white/5 flex-wrap">
                {usedBy > 0 && (
                  <span className="text-[9px] font-semibold text-emerald-400">
                    ↑ {usedBy} rely on this
                  </span>
                )}
                {uses > 0 && (
                  <span className="text-[9px] font-semibold text-blue-400">
                    ↓ uses {uses}
                  </span>
                )}
              </div>

              {onCheckImpact && (
                <button onClick={() => onCheckImpact(f)}
                  title="Switches to Impact Area tab with this file pre-loaded for analysis"
                  className="mt-2 w-full text-[9px] font-semibold text-orange-300
                             bg-orange-500/10 border border-orange-500/20 rounded-lg py-1
                             hover:bg-orange-500/20 transition-colors">
                  → Check impact if changed
                </button>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Combined info bar (orientation + legend + hints) ────────────────────────

function GraphInfoBar() {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 px-4 py-2.5 rounded-xl border border-surface-border/50 bg-surface-raised/20 text-[10px]">

      {/* Flow direction */}
      <div className="flex items-center gap-2 shrink-0">
        <div className="flex items-center gap-1">
          <span className="text-emerald-400 font-bold text-xs leading-none">↑</span>
          <span className="text-emerald-400/80 font-medium">relied on by others</span>
        </div>
        <span className="text-slate-600">·</span>
        <div className="flex items-center gap-1">
          <svg className="w-3 h-3 text-slate-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
          </svg>
          <span className="text-slate-500">importer to imported</span>
        </div>
        <span className="text-slate-600">·</span>
        <div className="flex items-center gap-1">
          <span className="text-blue-400 font-bold text-xs leading-none">↓</span>
          <span className="text-blue-400/80 font-medium">relies on others</span>
        </div>
      </div>

      {/* Divider */}
      <div className="w-px h-4 bg-slate-700/60 shrink-0 hidden sm:block" />

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        {([
          [ROLE.hub.dot,    'Hub',      'risky to change',  'text-orange-300'],
          [ROLE.sink.dot,   'Shared',   'many import this', 'text-emerald-300'],
          [ROLE.source.dot, 'Consumer', 'imports many',     'text-blue-300'],
          [ROLE.normal.dot, 'Normal',   'few connections',  'text-slate-400'],
        ] as [string, string, string, string][]).map(([color, label, desc, textCls]) => (
          <div key={label} className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
            <span className={`font-semibold ${textCls}`}>{label}</span>
            <span className="text-slate-600">· {desc}</span>
          </div>
        ))}
      </div>


    </div>
  )
}

// ─── Full ReactFlow graph for one component ───────────────────────────────────

function ComponentGraphInner({ files, deps, search, onCheckImpact }: {
  files: string[]; deps: Record<string, DepEntry>
  search: string; onCheckImpact?: (p: string) => void
}) {
  const rf = useReactFlow()
  const { nodes: initN, edges: initE } = useMemo(
    () => buildComponent(files, deps, search), [files, deps, search]
  )
  const [nodes, setNodes, onNodesChange] = useNodesState(initN)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initE)
  const [focusedId, setFocusedId]       = useState<string | null>(null)
  const [focusedRole, setFocusedRole]   = useState<NodeData['role']>('normal')
  const baseEdgesRef  = useRef(initE)
  const containerRef  = useRef<HTMLDivElement>(null)

  // Ctrl + scroll → zoom; plain scroll → page scrolls normally
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault()
        const factor = e.deltaY < 0 ? 1.12 : 0.89
        rf.zoomTo(rf.getZoom() * factor, { duration: 0 })
      }
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [rf])

  // Rebuild on deps / search change
  useEffect(() => {
    const { nodes: n, edges: e } = buildComponent(files, deps, search)
    setNodes(n); setEdges(e)
    baseEdgesRef.current = e
    setFocusedId(null)
  }, [files, deps, search, setNodes, setEdges])

  // Focus logic: highlight cluster + zoom in
  useEffect(() => {
    if (!focusedId) {
      setEdges(baseEdgesRef.current)
      setNodes(ns => ns.map(n => ({
        ...n, data: { ...n.data, dimmed: false, focused: false, connected: false }
      })))
      setTimeout(() => rf.fitView({ padding: 0.2, duration: 450 }), 10)
      return
    }

    const connectedIds = new Set<string>()
    baseEdgesRef.current.forEach(e => {
      if (e.source === focusedId) connectedIds.add(e.target)
      if (e.target === focusedId) connectedIds.add(e.source)
    })

    // Style edges
    setEdges(baseEdgesRef.current.map(e => {
      const active = e.source === focusedId || e.target === focusedId
      return {
        ...e,
        animated:  active,
        style:     active ? { stroke: '#60a5fa', strokeWidth: 2 } : { stroke: '#0f172a22', strokeWidth: 0.5 },
        markerEnd: active ? { type: MarkerType.ArrowClosed, color: '#60a5fa', width: 14, height: 14 } : BASE_MARKER,
      }
    }))

    // Style nodes
    setNodes(ns => {
      const updated = ns.map(n => ({
        ...n, data: {
          ...n.data,
          dimmed:    !connectedIds.has(n.id) && n.id !== focusedId,
          focused:   n.id === focusedId,
          connected: connectedIds.has(n.id),
        }
      }))
      return updated
    })

    // Zoom to the focused cluster (focused + direct neighbours)
    const clusterIds = new Set([focusedId, ...connectedIds])
    const clusterNodes = rf.getNodes().filter(n => clusterIds.has(n.id))
    if (clusterNodes.length > 0) {
      const xs = clusterNodes.map(n => n.position.x)
      const ys = clusterNodes.map(n => n.position.y)
      const pad = 80
      rf.fitBounds(
        {
          x:      Math.min(...xs) - pad,
          y:      Math.min(...ys) - pad,
          width:  Math.max(...xs) - Math.min(...xs) + NODE_W + pad * 2,
          height: Math.max(...ys) - Math.min(...ys) + NODE_H + pad * 2,
        },
        { duration: 450 },
      )
    }

    // Track role for pill colour
    const focusedNode = rf.getNodes().find(n => n.id === focusedId)
    if (focusedNode) setFocusedRole((focusedNode.data as NodeData).role)
  }, [focusedId, setEdges, setNodes, rf])

  // Escape resets focus
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') setFocusedId(null) }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [])

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setFocusedId(prev => prev === node.id ? null : node.id)
  }, [])

  const onInit = useCallback((instance: any) => {
    setTimeout(() => instance.fitView({ padding: 0.2, maxZoom: 1 }), 50)
  }, [])

  const height = Math.max(340, Math.min(620, nodes.length * 58 + 80))
  const focusedRoleStyle = ROLE[focusedRole]

  return (
    <ImpactCtx.Provider value={onCheckImpact ?? null}>
      <style>{`
        .react-flow__controls { box-shadow: none !important; }
        .react-flow__controls-button { background:#1e293b!important; border-color:#334155!important; }
        .react-flow__controls-button svg { fill:#94a3b8!important; }
        .react-flow__controls-button:hover { background:#334155!important; }
        .react-flow__controls-button:hover svg { fill:#e2e8f0!important; }
        .react-flow__node { outline: none !important; }
      `}</style>

      <div ref={containerRef} className="w-full rounded-2xl border border-surface-border overflow-hidden relative"
        style={{ height, background: '#050d1a' }}>

        {/* Focused-node pill — top-centre with "Check impact" button */}
        {focusedId && (
          <div className="absolute top-2.5 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2
                          bg-surface-card/95 backdrop-blur-sm rounded-full pl-2.5 pr-1 py-1
                          border text-[10px]"
            style={{ borderColor: focusedRoleStyle.border + '66' }}>
            <span className="w-1.5 h-1.5 rounded-full animate-pulse shrink-0"
              style={{ background: focusedRoleStyle.border }} />
            <span className="text-slate-300 font-medium">
              <code className="font-mono" style={{ color: focusedRoleStyle.text }}>
                {focusedId.split('/').pop()}
              </code>
            </span>
            {onCheckImpact && (
              <button
                onClick={() => onCheckImpact(focusedId)}
                title="Switches to Impact Area tab with this file pre-loaded for analysis"
                className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[9px] font-bold
                           text-orange-300 bg-orange-500/15 border border-orange-500/30
                           hover:bg-orange-500/25 transition-colors ml-1"
              >
                Check impact →
              </button>
            )}
            <button onClick={() => setFocusedId(null)}
              className="px-1.5 py-0.5 rounded-full text-slate-500 hover:text-white transition-colors ml-0.5">
              ✕
            </button>
          </div>
        )}

        <ReactFlow
          nodes={nodes} edges={edges}
          onNodesChange={onNodesChange} onEdgesChange={onEdgesChange}
          nodeTypes={NODE_TYPES}
          onNodeClick={onNodeClick}
          onPaneClick={() => setFocusedId(null)}
          onInit={onInit}
          minZoom={0.1} maxZoom={3}
          zoomOnScroll={false}
          preventScrolling={false}
          elementsSelectable={false}
          nodesFocusable={false}
          proOptions={{ hideAttribution: true }}
          style={{ background: '#050d1a' }}
        >
          <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="#1e293b" />
          <Controls showZoom={false} showInteractive={false}
            style={{ background: '#0f172a', border: '1px solid #1e293b' }} />
        </ReactFlow>

        {/* Focus hint — bottom-right */}
        <div className="absolute bottom-3 right-3 z-10 pointer-events-none select-none
                        flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg
                        bg-slate-800/60 backdrop-blur-sm border border-slate-700/50 text-[8px]">
          <svg className="w-2.5 h-2.5 text-slate-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5" />
          </svg>
          <span className="text-slate-400">Click node to focus</span>
          <span className="text-slate-700">·</span>
          <kbd className="px-1 py-px rounded border border-slate-600 bg-slate-700/80 text-[8px] font-bold text-slate-300 leading-none">Esc</kbd>
          <span className="text-slate-400">to reset</span>
        </div>

        {/* Keyboard hint — top-right, two lines */}
        <div className="absolute top-3 right-3 z-10 pointer-events-none select-none
                        flex flex-col gap-1.5 items-center px-2.5 py-2 rounded-lg
                        bg-slate-800/60 backdrop-blur-sm border border-slate-700/50">
          {/* Line 1: zoom */}
          <div className="flex items-center gap-1">
            <kbd className="inline-flex items-center px-1 py-px rounded border border-slate-600
                            bg-slate-700/80 text-[8px] font-bold text-slate-300 leading-none">
              Ctrl
            </kbd>
            <span className="text-slate-600 text-[8px]">+</span>
            <kbd className="inline-flex items-center px-1 py-px rounded border border-slate-600
                            bg-slate-700/80 text-[8px] font-bold text-slate-300 leading-none">
              Scroll
            </kbd>
            <span className="text-slate-400 text-[8px]">to zoom</span>
          </div>
          {/* Divider */}
          <div className="w-full h-px bg-slate-700/50" />
          {/* Line 2: pan */}
          <div className="flex items-center gap-1">
            <kbd className="inline-flex items-center px-1 py-px rounded border border-slate-600
                            bg-slate-700/80 leading-none">
              <svg className="w-2.5 h-2.5 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M7 11.5V14m0-2.5v-6a1.5 1.5 0 113 0m-3 6a1.5 1.5 0 00-3 0v2a7.5 7.5 0 0015 0v-5a1.5 1.5 0 00-3 0m-6-3V11m0-5.5v-1a1.5 1.5 0 013 0v1m0 0V11m0-5.5a1.5 1.5 0 013 0v3m0 0V11" />
              </svg>
            </kbd>
            <span className="text-slate-400 text-[8px]">drag to pan</span>
          </div>
        </div>
      </div>
    </ImpactCtx.Provider>
  )
}

function ComponentGraph(props: Parameters<typeof ComponentGraphInner>[0]) {
  return (
    <ReactFlowProvider>
      <ComponentGraphInner {...props} />
    </ReactFlowProvider>
  )
}


// ─── Public component ─────────────────────────────────────────────────────────

const MAX_TABS = 8

export default function DependencyGraph({ deps, onCheckImpact }: Props) {
  const components = useMemo(() => findComponents(deps), [deps])
  const [active, setActive]   = useState(0)
  const [search, setSearch]   = useState('')

  const { tabs, isolates } = useMemo(() => {
    const multi      = components.filter(c => c.files.length >= 2)
    const singletons = components.filter(c => c.files.length < 2)
    return {
      tabs:     multi.slice(0, MAX_TABS),
      isolates: [...multi.slice(MAX_TABS), ...singletons].flatMap(c => c.files),
    }
  }, [components])

  const allTabs = useMemo(() => [
    ...tabs,
    ...(isolates.length > 0
      ? [{ id: 'isolates', name: 'Standalone', category: 'Files with no connections', files: isolates }]
      : []),
  ], [tabs, isolates])

  // Feature 4: auto-switch tab on search
  useEffect(() => {
    if (!search) return
    const sq = search.toLowerCase()
    const idx = allTabs.findIndex(t => t.files.some(f => f.toLowerCase().includes(sq)))
    if (idx !== -1 && idx !== active) setActive(idx)
  }, [search]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { setActive(0) }, [deps])

  if (allTabs.length === 0) {
    return (
      <div className="flex items-center justify-center h-40 rounded-2xl border border-surface-border bg-surface-card">
        <p className="text-sm text-slate-400">No dependency data available.</p>
      </div>
    )
  }

  const current   = allTabs[active]
  const isMini    = current.files.length <= 3

  return (
    <div className="space-y-3">

      {/* Info bar: orientation + legend + hints */}
      <GraphInfoBar />

      {/* Feature 4: Search */}
      <div className="relative">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none"
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
        </svg>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search for a file across all groups…"
          className="w-full bg-surface-raised border border-surface-border rounded-xl pl-9 pr-4 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500/50 transition-colors"
        />
        {search && (
          <button onClick={() => setSearch('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">✕</button>
        )}
      </div>

      {/* Feature 2: Component chips */}
      <div className="flex items-start gap-1.5 flex-wrap">
        {allTabs.map((tab, i) => {
          const sq   = search.toLowerCase()
          const hits = sq ? tab.files.filter(f => f.toLowerCase().includes(sq)).length : 0
          const isActive = i === active
          return (
            <button
              key={tab.id}
              onClick={() => setActive(i)}
              className={[
                'flex flex-col items-start px-3 py-2 rounded-xl border text-left transition-all duration-150',
                isActive
                  ? 'bg-blue-500/10 border-blue-400/45 shadow-[0_0_0_1px_rgba(96,165,250,0.1)]'
                  : 'bg-surface-raised/20 border-slate-700/40 hover:bg-surface-raised/40 hover:border-slate-600/60',
              ].join(' ')}
            >
              <div className="flex items-center gap-1.5">
                <span className={`text-xs font-bold transition-colors ${
                  isActive ? 'text-blue-100' : 'text-slate-400'
                }`}>
                  {tab.name}
                </span>
                {hits > 0 && (
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-yellow-500/20 text-yellow-300 border border-yellow-500/30">
                    {hits} match{hits !== 1 ? 'es' : ''}
                  </span>
                )}
                <span className={[
                  'text-[9px] font-mono px-1.5 py-0.5 rounded-full border transition-colors',
                  isActive
                    ? 'bg-blue-500/20 text-blue-300 border-blue-400/30'
                    : 'bg-surface-raised text-slate-500 border-slate-700/50',
                ].join(' ')}>
                  {tab.files.length}
                </span>
              </div>
              <span className={`text-[9px] mt-0.5 transition-colors ${
                isActive ? 'text-blue-300/60' : 'text-slate-600'
              }`}>
                {tab.category}
              </span>
            </button>
          )
        })}
      </div>

      {/* Feature 5: Mini-card vs full graph */}
      {isMini ? (
        <MiniCard files={current.files} deps={deps} onCheckImpact={onCheckImpact} />
      ) : (
        <ComponentGraph
          key={current.id}
          files={current.files} deps={deps}
          search={search}
          onCheckImpact={onCheckImpact}
        />
      )}

      <p className="text-[10px] text-slate-500 text-right">
        {current.files.length} files in this group ·{' '}
        {allTabs.length} group{allTabs.length !== 1 ? 's' : ''} total
      </p>
    </div>
  )
}
