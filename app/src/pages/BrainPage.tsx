import { useState, useRef, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search, FileText, Github, Bug, MessageSquare, Pencil,
  ChevronRight, ExternalLink, Clock, Bot, Copy, CheckCircle,
  Plus, BookOpen, Tag, RefreshCw
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { listFacts, verifyFact, deleteFact, timeAgo, type Fact } from '@/lib/api'

function SourceBadge({ source }: { source: string }) {
  const labels: Record<string, string> = {
    github: 'GIT',
    jira: 'JIRA',
    slack: 'SLACK',
    manual: 'MANUAL',
  }
  return (
    <span className="badge-subtle">
      {labels[source.toLowerCase()] || 'MANUAL'}
    </span>
  )
}

interface TreeItemProps {
  label: string
  icon: React.ComponentType<{ size?: number; className?: string; strokeWidth?: number }>
  items?: string[]
  active?: boolean
  onClick?: () => void
}

function TreeItem({ label, icon: Icon, items, active, onClick }: TreeItemProps) {
  const [expanded, setExpanded] = useState(true)
  return (
    <div>
      <button
        onClick={() => { onClick?.(); if (items) setExpanded(!expanded) }}
        className={`flex items-center gap-2 w-full px-2 py-1.5 font-mono-ui text-[12px] uppercase tracking-widest transition-colors ${
          active
            ? 'bg-[var(--red)] text-[var(--void)]'
            : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-black/[0.06]'
        }`}
        style={{ borderRadius: 0 }}
      >
        {items && (
          <ChevronRight size={11} strokeWidth={2} className={`transition-transform shrink-0 ${expanded ? 'rotate-90' : ''}`} />
        )}
        <Icon size={12} strokeWidth={2} className="shrink-0" />
        <span className="truncate">{label}</span>
      </button>
      <AnimatePresence>
        {expanded && items && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="ml-4 border-l-2 border-[var(--border-subtle)] pl-2 mt-px space-y-px overflow-hidden"
          >
            {items.map((item, i) => (
              <button
                key={i}
                onClick={onClick}
                className="flex items-center w-full px-2 py-1 font-mono-ui text-[12px] uppercase tracking-widest text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-black/[0.05] transition-colors truncate"
                style={{ borderRadius: 0 }}
              >
                <span className="text-[var(--red)] mr-1.5">›</span>
                {item}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function useDragResize(
  initial: number,
  min: number,
  max: number,
) {
  const [width, setWidth] = useState(initial)
  const dragging = useRef(false)
  const lastX = useRef(0)

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    dragging.current = true
    lastX.current = e.clientX

    const onMove = (ev: MouseEvent) => {
      if (!dragging.current) return
      const dx = ev.clientX - lastX.current
      lastX.current = ev.clientX
      setWidth(w => Math.min(max, Math.max(min, w + dx)))
    }
    const onUp = () => {
      dragging.current = false
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [min, max])

  return { width, onMouseDown }
}

function ResizeHandle({ onMouseDown }: { onMouseDown: (e: React.MouseEvent) => void }) {
  const [active, setActive] = useState(false)
  return (
    <div
      onMouseDown={onMouseDown}
      onMouseEnter={() => setActive(true)}
      onMouseLeave={() => setActive(false)}
      className="w-1 shrink-0 cursor-col-resize relative select-none"
      style={{
        borderRight: `2px solid ${active ? 'var(--red)' : 'var(--border-default)'}`,
        transition: 'border-color 0.15s',
      }}
    >
      {/* wider invisible hit area */}
      <div className="absolute inset-y-0 -left-1.5 -right-1.5" />
    </div>
  )
}

/** Convert a raw Fact from the API into the shape BrainPage renders */
function factToEntry(fact: Fact) {
  const primaryFile = fact.file_paths[0] ?? ''
  const agentContent = [
    `id: ${fact.id}`,
    fact.repo      ? `repo: ${fact.repo}`           : null,
    primaryFile    ? `file: ${primaryFile}`          : null,
    fact.author    ? `author: @${fact.author}`       : null,
    `verified: ${fact.verified}`,
    `hit_count: ${fact.hit_count}`,
    `captured: ${fact.created_at}`,
    fact.last_hit_at ? `last_hit: ${fact.last_hit_at}` : null,
  ].filter(Boolean).join('\n')

  return {
    id: fact.id,
    title: fact.content.slice(0, 60) + (fact.content.length > 60 ? '…' : ''),
    source: 'proxy' as const,
    lastUpdated: timeAgo(fact.created_at),
    originalUrl: fact.repo ? `https://github.com/${fact.repo}` : '',
    content: fact.content,
    agentContent,
    verified: fact.verified,
    repo: fact.repo,
    filePaths: fact.file_paths,
    rawId: fact.id,
  }
}

export default function BrainPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [agentView, setAgentView] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterVerified, setFilterVerified] = useState<boolean | null>(null)
  const [copied, setCopied] = useState(false)
  const [facts, setFacts] = useState<Fact[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const sidebar = useDragResize(224, 140, 360)
  const list = useDragResize(288, 180, 480)

  async function loadFacts() {
    setLoading(true)
    setError(null)
    try {
      const data = await listFacts()
      setFacts(data)
      if (data.length > 0 && !selectedId) setSelectedId(data[0].id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadFacts() }, [])

  async function handleVerify(id: string) {
    await verifyFact(id)
    setFacts(prev => prev.map(f => f.id === id ? { ...f, verified: true } : f))
  }

  async function handleDelete(id: string) {
    await deleteFact(id)
    setFacts(prev => {
      const next = prev.filter(f => f.id !== id)
      if (selectedId === id) setSelectedId(next[0]?.id ?? null)
      return next
    })
  }

  const entries = facts.map(factToEntry)

  const filteredEntries = entries.filter(e => {
    const matchesSearch = !searchQuery || e.content.toLowerCase().includes(searchQuery.toLowerCase()) || e.repo.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesFilter = filterVerified === null || e.verified === filterVerified
    return matchesSearch && matchesFilter
  })

  const selected = entries.find(e => e.id === selectedId) ?? entries[0] ?? null

  const handleCopy = () => {
    if (!selected) return
    navigator.clipboard.writeText(agentView ? selected.agentContent : selected.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const filters = [
    { key: null, label: 'ALL' },
    { key: true, label: 'VERIFIED' },
    { key: false, label: 'UNVERIFIED' },
  ]

  // Group entries by repo for the sidebar tree
  const repos = Array.from(new Set(entries.map(e => e.repo).filter(Boolean)))

  return (
    <div className="flex h-[calc(100dvh)]">
      {/* TREE SIDEBAR */}
      <aside style={{ width: sidebar.width }} className="shrink-0 overflow-y-auto bg-[var(--surface)]">
        <div className="flex items-center justify-between px-3 py-3 border-b-2 border-[var(--border-default)]">
          <span className="font-mono-ui text-[12px] uppercase tracking-widest text-[var(--text-muted)]">[ Browse ]</span>
          <button
            onClick={loadFacts}
            className="w-6 h-6 flex items-center justify-center border border-[var(--border-default)] text-[var(--text-muted)] hover:text-[var(--red)] hover:border-[var(--red)] transition-colors"
            style={{ borderRadius: 0 }}
          >
            <RefreshCw size={12} strokeWidth={2} />
          </button>
        </div>

        <div className="relative p-2 border-b border-[var(--border-subtle)]">
          <Search size={11} strokeWidth={2} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="SEARCH..."
            className="w-full pl-7 pr-2 py-1.5 bg-[var(--surface-elevated)] border border-[var(--border-default)] font-mono-ui text-[12px] uppercase tracking-widest text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none focus:border-[var(--red)]"
            style={{ borderRadius: 0 }}
          />
        </div>

        <div className="flex flex-wrap gap-px p-2 border-b border-[var(--border-subtle)] bg-[var(--border-subtle)]">
          {filters.map(f => (
            <button
              key={f.label}
              onClick={() => setFilterVerified(f.key)}
              className={`font-mono-ui text-[12px] tracking-widest px-2 py-1 transition-colors ${
                filterVerified === f.key
                  ? 'bg-[var(--red)] text-[var(--void)]'
                  : 'bg-[var(--surface)] text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
              }`}
              style={{ borderRadius: 0 }}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="py-1">
          {repos.length > 0 ? (
            repos.map(repo => (
              <TreeItem
                key={repo}
                label={repo}
                icon={Tag}
                items={entries.filter(e => e.repo === repo).map(e => e.title)}
                onClick={() => {
                  const first = entries.find(e => e.repo === repo)
                  if (first) setSelectedId(first.id)
                }}
              />
            ))
          ) : (
            <TreeItem label="All facts" icon={BookOpen} onClick={() => entries[0] && setSelectedId(entries[0].id)} />
          )}
        </div>
      </aside>

      <ResizeHandle onMouseDown={sidebar.onMouseDown} />

      {/* ENTRIES LIST */}
      <div style={{ width: list.width }} className="shrink-0 overflow-y-auto bg-[var(--surface)]">
        <div className="px-4 py-3 border-b-2 border-[var(--border-default)]">
          <h2 className="section-title bracket-label">Facts</h2>
          <p className="font-mono-ui text-[12px] text-[var(--text-muted)] mt-0.5 uppercase tracking-widest">{filteredEntries.length} total</p>
        </div>
        {loading ? (
          <div className="px-4 py-6 font-mono-ui text-[12px] text-[var(--text-muted)] uppercase tracking-widest">Loading…</div>
        ) : error ? (
          <div className="px-4 py-6 font-mono-ui text-[12px] text-[var(--red)] uppercase tracking-widest leading-relaxed">
            {error}<br /><span className="opacity-60">— server on :3333?</span>
          </div>
        ) : filteredEntries.length === 0 ? (
          <div className="px-4 py-6 font-mono-ui text-[12px] text-[var(--text-muted)] uppercase tracking-widest">No facts yet.</div>
        ) : (
          <div>
            {filteredEntries.map(entry => (
              <button
                key={entry.id}
                onClick={() => setSelectedId(entry.id)}
                className={`w-full text-left px-4 py-3 border-b border-[var(--border-subtle)] transition-colors ${
                  selected?.id === entry.id
                    ? 'bg-[var(--surface-elevated)] border-l-2 border-l-[var(--red)]'
                    : 'hover:bg-black/[0.04] border-l-2 border-l-transparent'
                }`}
                style={{ borderRadius: 0 }}
              >
                <div className="flex items-center gap-2 mb-1">
                  <SourceBadge source={entry.verified ? 'github' : 'manual'} />
                  <span className="font-mono-ui text-[12px] text-[var(--text-muted)]">{entry.lastUpdated}</span>
                </div>
                <h3 className={`font-display text-[12px] tracking-wider uppercase ${selected?.id === entry.id ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'}`}>
                  {entry.title}
                </h3>
              </button>
            ))}
          </div>
        )}
      </div>

      <ResizeHandle onMouseDown={list.onMouseDown} />

      {/* DETAIL VIEW */}
      <div className="flex-1 overflow-y-auto bg-[var(--void)]">
        {!selected ? (
          <div className="flex items-center justify-center h-full font-mono-ui text-[12px] text-[var(--text-muted)] uppercase tracking-widest">
            Select a fact
          </div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={selected.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.1 }}
            >
              {/* STICKY HEADER */}
              <div className="sticky top-0 bg-[var(--void)] border-b-2 border-[var(--border-default)] px-6 py-3 z-10">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <SourceBadge source={selected.verified ? 'github' : 'manual'} />
                    <h1 className="font-display text-[14px] tracking-widest text-[var(--text-primary)] truncate uppercase">{selected.title}</h1>
                  </div>
                  <div className="flex items-center gap-px shrink-0">
                    <button
                      onClick={() => setAgentView(!agentView)}
                      className={`flex items-center gap-1.5 font-mono-ui text-[12px] px-3 py-2 uppercase tracking-widest transition-colors ${
                        agentView
                          ? 'bg-[var(--red)] text-[var(--void)]'
                          : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-black/[0.06] border border-[var(--border-default)]'
                      }`}
                      style={{ borderRadius: 0 }}
                    >
                      <Bot size={12} strokeWidth={2} />
                      {agentView ? 'AGENT' : 'HUMAN'}
                    </button>
                    <button
                      onClick={handleCopy}
                      className="flex items-center gap-1.5 font-mono-ui text-[12px] px-3 py-2 uppercase tracking-widest text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-black/[0.06] border border-[var(--border-default)] transition-colors"
                      style={{ borderRadius: 0 }}
                    >
                      {copied ? <CheckCircle size={12} className="text-[var(--terminal-green)]" /> : <Copy size={12} strokeWidth={2} />}
                      {copied ? 'COPIED' : 'COPY'}
                    </button>
                    {selected.originalUrl && (
                      <a
                        href={selected.originalUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 font-mono-ui text-[12px] px-3 py-2 uppercase tracking-widest text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-black/[0.06] border border-[var(--border-default)] transition-colors"
                        style={{ borderRadius: 0 }}
                      >
                        <ExternalLink size={12} strokeWidth={2} />
                        REPO
                      </a>
                    )}
                    {!selected.verified && (
                      <button
                        onClick={() => handleVerify(selected.rawId)}
                        className="flex items-center gap-1.5 font-mono-ui text-[12px] px-3 py-2 uppercase tracking-widest text-[var(--terminal-green)] hover:bg-black/[0.06] border border-[var(--terminal-green)] transition-colors"
                        style={{ borderRadius: 0 }}
                      >
                        <CheckCircle size={12} strokeWidth={2} />
                        VERIFY
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(selected.rawId)}
                      className="flex items-center gap-1.5 font-mono-ui text-[12px] px-3 py-2 uppercase tracking-widest text-[var(--red)] hover:bg-black/[0.06] border border-[var(--red)] transition-colors"
                      style={{ borderRadius: 0 }}
                    >
                      <Pencil size={12} strokeWidth={2} />
                      DELETE
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-4 mt-2">
                  <span className="font-mono-ui text-[12px] text-[var(--text-muted)] flex items-center gap-1 uppercase tracking-widest">
                    <Clock size={10} /> Captured {selected.lastUpdated}
                  </span>
                  {selected.verified && (
                    <span className="font-mono-ui text-[12px] text-[var(--terminal-green)] flex items-center gap-1 uppercase tracking-widest">
                      <CheckCircle size={10} /> Verified
                    </span>
                  )}
                </div>
              </div>

              {/* CONTENT */}
              <div className="px-6 py-6 max-w-2xl">
                {agentView ? (
                  <div className="border-2 border-[var(--border-default)] p-4 bg-[var(--surface)]">
                    <div className="font-mono-ui text-[12px] text-[var(--red)] uppercase tracking-widest mb-3 border-b border-[var(--border-default)] pb-2">
                      {'>>> FACT METADATA ///'}
                    </div>
                    <pre className="font-mono-ui text-[12px] text-[var(--text-secondary)] leading-relaxed whitespace-pre-wrap overflow-x-auto">
                      {selected.agentContent}
                    </pre>
                  </div>
                ) : (
                  <div className="font-mono-ui text-[13px] text-[var(--text-secondary)] leading-relaxed whitespace-pre-wrap">
                    {selected.content}
                  </div>
                )}
              </div>
            </motion.div>
          </AnimatePresence>
        )}
      </div>
    </div>
  )
}
