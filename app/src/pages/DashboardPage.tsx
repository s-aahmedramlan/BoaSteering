import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router'
import {
  Github, Bug, MessageSquare, FileText,
  RefreshCw, CheckCircle, AlertCircle, Clock,
  TrendingUp, Database, Zap, ArrowRight,
  GitBranch, Plus, File, ShieldCheck, ShieldAlert, User
} from 'lucide-react'
import { listFacts, getFactStats, verifyFact, deleteFact, timeAgo, type Fact, type FactStats } from '@/lib/api'

interface IntegrationRowProps {
  name: string
  icon: React.ComponentType<{ size?: number; className?: string; strokeWidth?: number }>
  connected: boolean
  items: string[]
  lastSync: string
  status: 'synced' | 'pending' | 'error'
}

function IntegrationRow({ name, icon: Icon, connected, items, lastSync, status }: IntegrationRowProps) {
  const statusLabel = status === 'synced' ? 'SYNCED' : status === 'pending' ? 'PENDING' : 'ERROR'
  const statusColor = status === 'synced' ? 'text-[var(--terminal-green)]' : status === 'pending' ? 'text-[var(--warning)]' : 'text-[var(--red)]'

  return (
    <div className="flex items-start gap-4 py-4 border-b border-[var(--border-subtle)] last:border-0">
      <div className="w-9 h-9 border border-[var(--border-default)] flex items-center justify-center shrink-0 bg-[var(--surface-elevated)]">
        <Icon size={16} strokeWidth={2} className="text-[var(--text-secondary)]" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-display text-[13px] text-[var(--text-primary)] tracking-wider">{name}</h3>
          <span className="font-mono-ui text-[12px] text-[var(--text-muted)] shrink-0">{lastSync}</span>
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className={`font-mono-ui text-[12px] tracking-widest ${statusColor}`}>{statusLabel}</span>
        </div>
        {connected ? (
          <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
            {items.map((item, i) => (
              <span key={i} className="inline-flex items-center gap-1 font-mono-ui text-[12px] text-[var(--text-muted)] uppercase tracking-wider">
                <GitBranch size={10} strokeWidth={2} />
                {item}
              </span>
            ))}
          </div>
        ) : (
          <button className="flex items-center gap-1 mt-2 font-mono-ui text-[12px] uppercase tracking-widest text-[var(--text-muted)] hover:text-[var(--red)] transition-colors border border-[var(--border-default)] px-2 py-1 hover:border-[var(--red)]">
            <Plus size={10} strokeWidth={2} />
            CONNECT
          </button>
        )}
      </div>
    </div>
  )
}

interface ActivityRowProps {
  sourceIcon: React.ComponentType<{ size?: number; className?: string; strokeWidth?: number }>
  action: string
  detail: string
  time: string
}

function ActivityRow({ sourceIcon: Icon, action, detail, time }: ActivityRowProps) {
  return (
    <div className="row-item items-start">
      <div className="w-7 h-7 border border-[var(--border-default)] flex items-center justify-center shrink-0 mt-0.5 bg-[var(--surface-elevated)]">
        <Icon size={12} strokeWidth={2} className="text-[var(--text-muted)]" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-2">
          <span className="font-display text-[12px] text-[var(--text-primary)] tracking-wider">{action.toUpperCase()}</span>
          <span className="font-mono-ui text-[12px] text-[var(--text-muted)] shrink-0">{time}</span>
        </div>
        <p className="font-mono-ui text-[12px] text-[var(--text-muted)] mt-0.5 truncate">{detail}</p>
      </div>
    </div>
  )
}

// verified = a current team member with authority has explicitly endorsed this fact.
// committed = just means it's in the repo. a previous dev could have written it.
// commit hash traces provenance — who wrote it and when — but not whether it still holds.
interface FactRowProps {
  fact: Fact
  onVerify: (id: string) => void
  onDelete: (id: string) => void
}

function FactRow({ fact, onVerify, onDelete }: FactRowProps) {
  const primaryFile = fact.file_paths[0] ?? ''
  const ago = timeAgo(fact.created_at)

  return (
    <div className="grid gap-4 px-5 py-4 border-b border-[var(--border-subtle)] last:border-0 hover:bg-[var(--hover-overlay-sm)] transition-colors"
      style={{ gridTemplateColumns: '52px 1fr auto' }}>

      {/* Hit count */}
      <div className="flex flex-col items-center justify-center">
        <span className="font-mono-ui text-[18px] font-bold leading-none" style={{ color: fact.hit_count >= 8 ? 'var(--red)' : 'var(--text-primary)' }}>{fact.hit_count}</span>
        <span className="font-mono-ui text-[12px] text-[var(--text-muted)] uppercase tracking-widest mt-0.5">hits</span>
      </div>

      {/* Fact body */}
      <div className="min-w-0">
        <p className="font-mono-ui text-[13px] text-[var(--text-primary)] leading-snug">{fact.content}</p>
        {/* Source chain: repo → file → author */}
        <div className="flex items-center gap-0 mt-2 font-mono-ui text-[12px] text-[var(--text-muted)] flex-wrap">
          {fact.repo && (
            <>
              <span className="inline-flex items-center gap-1 uppercase tracking-wider">
                <GitBranch size={10} strokeWidth={2} />
                {fact.repo}
              </span>
              <span className="mx-1.5 opacity-40">·</span>
            </>
          )}
          {primaryFile && (
            <>
              <span className="inline-flex items-center gap-1 uppercase tracking-wider">
                <File size={10} strokeWidth={2} />
                {primaryFile}
              </span>
              <span className="mx-1.5 opacity-40">·</span>
            </>
          )}
          {fact.author && (
            <span className="inline-flex items-center gap-1 uppercase tracking-wider">
              <User size={10} strokeWidth={2} />
              @{fact.author}
            </span>
          )}
        </div>
      </div>

      {/* Right: badge + actions + time */}
      <div className="flex flex-col items-end justify-between gap-2 shrink-0">
        {fact.verified ? (
          <span className="inline-flex items-center gap-1 font-mono-ui text-[12px] text-[var(--terminal-green)] uppercase tracking-widest border border-[var(--terminal-green)] px-1.5 py-0.5">
            <ShieldCheck size={10} strokeWidth={2} />
            VERIFIED
          </span>
        ) : (
          <div className="flex flex-col items-end gap-1">
            <span className="inline-flex items-center gap-1 font-mono-ui text-[12px] text-[var(--warning)] uppercase tracking-widest border border-[var(--warning)] px-1.5 py-0.5">
              <ShieldAlert size={10} strokeWidth={2} />
              UNVERIFIED
            </span>
            <button
              onClick={() => onVerify(fact.id)}
              className="font-mono-ui text-[11px] uppercase tracking-widest text-[var(--text-muted)] hover:text-[var(--terminal-green)] transition-colors"
            >
              VERIFY →
            </button>
          </div>
        )}
        <div className="flex items-center gap-2">
          <button
            onClick={() => onDelete(fact.id)}
            className="font-mono-ui text-[11px] uppercase tracking-widest text-[var(--text-muted)] hover:text-[var(--red)] transition-colors"
          >
            DELETE
          </button>
          <span className="font-mono-ui text-[12px] text-[var(--text-muted)]">{ago}</span>
        </div>
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const navigate = useNavigate()
  const [authorFilter, setAuthorFilter] = useState<string | null>(null)
  const [facts, setFacts] = useState<Fact[]>([])
  const [stats, setStats] = useState<FactStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function loadData() {
    setLoading(true)
    setError(null)
    try {
      const [factsData, statsData] = await Promise.all([listFacts(), getFactStats()])
      setFacts(factsData)
      setStats(statsData)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadData() }, [])

  async function handleVerify(id: string) {
    await verifyFact(id)
    setFacts(prev => prev.map(f => f.id === id ? { ...f, verified: true } : f))
    setStats(prev => prev ? { ...prev, verified: prev.verified + 1 } : prev)
  }

  async function handleDelete(id: string) {
    await deleteFact(id)
    setFacts(prev => prev.filter(f => f.id !== id))
    setStats(prev => prev ? { ...prev, total: prev.total - 1 } : prev)
  }

  const authors = Array.from(new Set(facts.map(f => f.author).filter(Boolean)))
  const filteredFacts = facts.filter(f => !authorFilter || f.author === authorFilter)

  const integrations = [
    {
      name: 'GitHub', icon: Github,
      connected: true, items: ['boa-frontend', 'boa-backend', 'boa-docs'],
      lastSync: '2m ago', status: 'synced' as const,
    },
    {
      name: 'Jira', icon: Bug,
      connected: true, items: ['BOA-142', 'BOA-138', 'BOA-129'],
      lastSync: '15m ago', status: 'synced' as const,
    },
    {
      name: 'Slack', icon: MessageSquare,
      connected: true, items: ['#engineering', '#deployments', '#incidents'],
      lastSync: '5m ago', status: 'synced' as const,
    },
    {
      name: 'Confluence', icon: FileText,
      connected: false, items: [],
      lastSync: '--', status: 'pending' as const,
    },
  ]

  const activities = [
    { sourceIcon: Github, action: 'New PR merged', detail: 'feat/auth-flow: updated deployment process doc from PR description', time: '2m ago' },
    { sourceIcon: Bug, action: 'Rule extracted', detail: 'BOA-142: API rate limiting at 100 req/min per org tier', time: '15m ago' },
    { sourceIcon: MessageSquare, action: 'Decision captured', detail: '#engineering: migrate from Redis to Valkey for cache layer', time: '32m ago' },
    { sourceIcon: Github, action: 'Wiki updated', detail: 'boa-docs: onboarding checklist v3 with security review step', time: '1h ago' },
    { sourceIcon: Bug, action: 'Issue resolved', detail: 'BOA-138: deployment freeze policy, no deploys after 4pm Fri', time: '2h ago' },
    { sourceIcon: MessageSquare, action: 'Alert acknowledged', detail: '#incidents: PagerDuty rotation updated, on-call @sarah', time: '3h ago' },
  ]

  const pendingItems = stats?.stale
    ? [`${stats.stale} stale fact(s) detected — not hit in 30+ days`]
    : []

  const statCards = [
    { label: 'Total entries', value: stats ? stats.total.toLocaleString() : '—', change: stats ? `+${stats.added_today} today` : '', icon: Database },
    { label: 'Repos tracked', value: stats ? String(stats.repos) : '—', change: '4 integrations', icon: Zap },
    { label: 'Agents synced', value: '12', change: '+2 this week', icon: TrendingUp },
    { label: 'Verified rules', value: stats ? stats.verified.toLocaleString() : '—', change: stats && stats.total > 0 ? `${Math.round((stats.verified / stats.total) * 100)}% confidence` : '', icon: CheckCircle },
  ]

  return (
    <div className="page-shell">
      {/* PAGE HEADER */}
      <div className="page-header">
        <div>
          <h1 className="page-title">[ Dashboard ]</h1>
          <p className="page-subtitle">/// Boa proxy on localhost:3333</p>
        </div>
        <button
          className="flex items-center gap-2 px-4 py-2 bg-[var(--red)] text-[var(--void)] font-mono-ui text-[12px] uppercase tracking-widest font-bold hover:bg-[#ff2a2a] transition-colors"
          onClick={() => navigate('/ask')}
          style={{ borderRadius: 0 }}
        >
          <Zap size={13} strokeWidth={2} />
          ASK AI
        </button>
      </div>

      {/* STATS GRID */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-[var(--border-default)] mb-10">
        {statCards.map(stat => (
          <div key={stat.label} className="bg-[var(--surface)] p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="stat-label">[ {stat.label.toUpperCase()} ]</span>
              <stat.icon size={13} strokeWidth={2} className="text-[var(--text-muted)]" />
            </div>
            <div className="stat-value">{stat.value}</div>
            <div className="font-mono-ui text-[12px] text-[var(--red)] mt-2 uppercase tracking-wider">{stat.change}</div>
          </div>
        ))}
      </div>

      {/* FACT FEED */}
      <section className="mb-10 border-2 border-[var(--border-default)] bg-[var(--surface)]">
        <div className="flex items-center justify-between px-5 py-3 border-b-2 border-[var(--border-default)]">
          <h2 className="section-title bracket-label">Knowledge propagation</h2>
          <div className="flex items-center gap-3">
            <span className="font-mono-ui text-[12px] text-[var(--text-muted)] uppercase tracking-widest">
              {filteredFacts.length} facts
            </span>
            <button
              onClick={loadData}
              className="flex items-center gap-1 font-mono-ui text-[12px] text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors uppercase tracking-widest"
            >
              <RefreshCw size={10} strokeWidth={2} />
              REFRESH
            </button>
          </div>
        </div>

        {/* Author filter */}
        <div className="flex items-center gap-px px-5 py-2.5 border-b border-[var(--border-default)] bg-[var(--void)] flex-wrap">
          <span className="font-mono-ui text-[12px] text-[var(--text-muted)] uppercase tracking-widest mr-3">Filter by author</span>
          {['All', ...authors].map(a => {
            const key = a === 'All' ? null : a
            return (
              <button
                key={a}
                onClick={() => setAuthorFilter(key)}
                className="px-2.5 py-1 font-mono-ui text-[12px] uppercase tracking-widest transition-colors"
                style={{
                  borderRadius: 0,
                  background: authorFilter === key ? 'var(--red)' : 'var(--surface)',
                  color: authorFilter === key ? 'var(--void)' : 'var(--text-muted)',
                  border: '1px solid var(--border-default)',
                }}
              >
                {a === 'All' ? 'ALL' : `@${a}`}
              </button>
            )
          })}
        </div>

        {loading ? (
          <div className="px-5 py-8 font-mono-ui text-[12px] text-[var(--text-muted)] uppercase tracking-widest">
            Loading facts…
          </div>
        ) : error ? (
          <div className="px-5 py-8 font-mono-ui text-[12px] text-[var(--red)] uppercase tracking-widest">
            {error}
            <span className="ml-2 opacity-60">— is the server running on :3333?</span>
          </div>
        ) : filteredFacts.length === 0 ? (
          <div className="px-5 py-8 font-mono-ui text-[12px] text-[var(--text-muted)] uppercase tracking-widest">
            No facts yet — start the proxy and make an Anthropic API call.
          </div>
        ) : (
          <div>
            {filteredFacts.map(fact => (
              <FactRow key={fact.id} fact={fact} onVerify={handleVerify} onDelete={handleDelete} />
            ))}
          </div>
        )}
      </section>

      {/* MAIN CONTENT */}
      <div className="grid lg:grid-cols-[1fr_340px] gap-px bg-[var(--border-default)]">
        {/* LEFT COLUMN */}
        <div className="bg-[var(--void)] space-y-px">
          {/* INTEGRATIONS */}
          <section className="bg-[var(--surface)]">
            <div className="flex items-center justify-between px-5 py-3 border-b-2 border-[var(--border-default)]">
              <h2 className="section-title bracket-label">Integrations</h2>
              <button
                className="font-mono-ui text-[12px] uppercase tracking-widest text-[var(--text-muted)] hover:text-[var(--red)] flex items-center gap-1 transition-colors"
                onClick={() => navigate('/settings')}
              >
                MANAGE
                <ArrowRight size={10} strokeWidth={2} />
              </button>
            </div>
            <div className="px-5">
              {integrations.map(integration => (
                <IntegrationRow key={integration.name} {...integration} />
              ))}
            </div>
          </section>

          {/* PENDING REVIEW */}
          {pendingItems.length > 0 && (
            <section className="bg-[var(--surface)]">
              <div className="flex items-center gap-2 px-5 py-3 border-b-2 border-[var(--border-default)]">
                <AlertCircle size={13} className="text-[var(--warning)]" strokeWidth={2} />
                <h2 className="section-title bracket-label">Pending review</h2>
                <span className="font-mono-ui text-[12px] px-1.5 py-0.5 border border-[var(--warning)] text-[var(--warning)] tracking-wider">{pendingItems.length}</span>
              </div>
              <div className="px-5">
                {pendingItems.map((item, i) => (
                  <div key={i} className="py-3.5 border-b border-[var(--border-subtle)] last:border-0 font-mono-ui text-[12px] text-[var(--text-secondary)] leading-relaxed px-3 bg-[var(--red-dim)]">
                    {item}
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        {/* ACTIVITY LOG */}
        <section className="bg-[var(--surface)]">
          <div className="flex items-center justify-between px-5 py-3 border-b-2 border-[var(--border-default)]">
            <h2 className="section-title bracket-label">Activity</h2>
            <button
              onClick={loadData}
              className="flex items-center gap-1 font-mono-ui text-[12px] text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors uppercase tracking-widest"
            >
              <RefreshCw size={10} strokeWidth={2} />
              REFRESH
            </button>
          </div>
          <div className="px-4">
            {activities.map((activity, i) => (
              <ActivityRow key={i} {...activity} />
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
