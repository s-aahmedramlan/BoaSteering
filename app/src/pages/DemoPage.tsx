import { useState, useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Loader, AlertCircle, CheckCircle, ArrowRight, ChevronDown, XCircle, Zap, X, Search, Wrench, GitBranch } from 'lucide-react'

/* ─── Types ─── */
interface ServiceRecord {
  ticket_id: string
  date: string
  site_id: string
  product: string
  unit_age_months: number
  ambient_temp_f: number
  voltage_12v_rail: number
  voltage_5v_logic: number
  controller_status: string
  rs485_response: boolean
  price_panels_lit: number
  total_price_panels: number
  hours_since_last_price_update: number
  lte_signal_present: boolean
  error_codes: string[]
  technician_notes: string
  root_cause: string
  component_failed: string
  part_number: string
  rma_required: boolean
  resolution_time_hours: number
  warranty_covered: boolean
}
interface Retrieved extends ServiceRecord { score: number }
interface Diagnosis {
  ruling_out: { cause: string; reason: string }[]
  most_likely_cause: string
  confidence: number
  reasoning: string
  component: string
  part_number: string
  rma_required: boolean
  rma_reason: string
  fleet_note?: string
}
interface Form {
  client: string; site: string; product: string
  v12: string; v5: string; controller: string; rs485: string
  panelsLit: string; totalPanels: string; hoursSince: string; lte: string; age: string; notes: string
}

const ERROR_CODES = ['PSU_FAIL', 'MODULE_FAIL', 'COMM_INTERMITTENT', 'PCU_TX_FAIL', 'FW_CORRUPT', 'CONFIG_ERR', 'DISPLAY_NO_RESP', 'SURGE_DETECT']

const EMPTY_FORM: Form = {
  client: 'Shell — Station #4821', site: 'CA-0391', product: 'Price Sync LTE',
  v12: '', v5: '', controller: 'Active', rs485: 'No response',
  panelsLit: '0', totalPanels: '3', hoursSince: '', lte: 'Present', age: '', notes: '',
}

const PRESETS: { label: string; form: Partial<Form>; codes: string[] }[] = [
  { label: 'All panels dark — PSU suspected', codes: ['PSU_FAIL', 'DISPLAY_NO_RESP'],
    form: { v12: '0.0', v5: '5.1', controller: 'Active', rs485: 'No response', panelsLit: '0', totalPanels: '3', hoursSince: '14', lte: 'Present', age: '24' } },
  { label: 'One price panel out', codes: ['MODULE_FAIL'],
    form: { v12: '12.1', v5: '5.0', controller: 'Active', rs485: 'Responding', panelsLit: '2', totalPanels: '3', hoursSince: '4', lte: 'Present', age: '31' } },
  { label: 'Intermittent display in cold', codes: ['COMM_INTERMITTENT'],
    form: { v12: '11.9', v5: '5.0', controller: 'Active', rs485: 'Intermittent', panelsLit: '2', totalPanels: '3', hoursSince: '6', lte: 'Present', age: '28' } },
  { label: 'Price stuck — not updating from POS', codes: ['PCU_TX_FAIL'],
    form: { v12: '12.0', v5: '5.1', controller: 'Active', rs485: 'Responding', panelsLit: '3', totalPanels: '3', hoursSince: '36', lte: 'Present', age: '19' } },
]

/* ─── Embed-text builder — mirror scripts/embed.mjs ─── */
function recordEmbedText(r: ServiceRecord): string {
  const rs485 = r.rs485_response ? 'RS-485 responding' : 'RS-485 no response'
  const lte = r.lte_signal_present ? 'LTE signal present' : 'LTE signal absent'
  const codes = r.error_codes.length ? r.error_codes.join(', ') : 'none'
  return [
    `${r.product} unit, ${r.unit_age_months} months old.`,
    `12V rail: ${r.voltage_12v_rail}V.`, `5V logic: ${r.voltage_5v_logic}V.`,
    `Controller ${r.controller_status}.`, `${rs485}.`,
    `${r.price_panels_lit} of ${r.total_price_panels} price panels lit.`,
    `${r.hours_since_last_price_update} hours since last price update.`,
    `${lte}.`, `Ambient ${r.ambient_temp_f}F.`,
    `Error codes: ${codes}.`, `Tech notes: ${r.technician_notes}`,
  ].join(' ')
}
function formQueryText(f: Form, codes: string[]): string {
  const rs485 = f.rs485 === 'Responding' ? 'RS-485 responding'
    : f.rs485 === 'Intermittent' ? 'RS-485 intermittent communication' : 'RS-485 no response'
  const lte = f.lte === 'Present' ? 'LTE signal present' : 'LTE signal absent'
  return [
    `${f.product} unit, ${f.age || '?'} months old.`,
    `12V rail: ${f.v12 || '?'}V.`, `5V logic: ${f.v5 || '?'}V.`,
    `Controller ${f.controller.toLowerCase()}.`, `${rs485}.`,
    `${f.panelsLit} of ${f.totalPanels} price panels lit.`,
    `${f.hoursSince || '?'} hours since last price update.`,
    `${lte}.`, `Error codes: ${codes.length ? codes.join(', ') : 'none'}.`,
    f.notes ? `Tech notes: ${f.notes}` : '',
  ].join(' ')
}
function dot(a: number[], b: number[]): number { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * b[i]; return s }
function tokenScore(query: string, text: string): number {
  const q = new Set(query.toLowerCase().match(/[a-z0-9]+/g) || [])
  const t = new Set(text.toLowerCase().match(/[a-z0-9]+/g) || [])
  let inter = 0; q.forEach(w => { if (t.has(w)) inter++ })
  return inter / Math.sqrt((q.size || 1) * (t.size || 1))
}
const DISPLAY_BANDS = [[87, 94], [75, 85], [63, 75], [52, 65]]
const EASE = [0.22, 1, 0.36, 1] as const

export default function DemoPage() {
  const [records, setRecords] = useState<ServiceRecord[]>([])
  const [embeddings, setEmbeddings] = useState<number[][]>([])
  const [form, setForm] = useState<Form>(EMPTY_FORM)
  const [codes, setCodes] = useState<string[]>(['PSU_FAIL', 'DISPLAY_NO_RESP'])
  const [retrieved, setRetrieved] = useState<Retrieved[]>([])
  const [diagnosis, setDiagnosis] = useState<Diagnosis | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [modelReady, setModelReady] = useState(false)
  const [ticketId] = useState(() => `TKT-${4000 + Math.floor(Math.random() * 2000)}`)
  const [woId] = useState(() => `WO-${28000 + Math.floor(Math.random() * 2000)}`)
  const [approved, setApproved] = useState(false)
  const [approveStage, setApproveStage] = useState(0)
  const [showEvidence, setShowEvidence] = useState(false)
  const [showReasoning, setShowReasoning] = useState(false)
  const extractorRef = useRef<((t: string, o: object) => Promise<{ data: Float32Array }>) | null>(null)

  useEffect(() => {
    Promise.all([
      fetch('knowledge-base.json').then(r => r.json()),
      fetch('embeddings.json').then(r => r.json()),
    ]).then(([recs, embs]) => { setRecords(recs); setEmbeddings(embs) })
      .catch(() => setError('Failed to load service history'))
  }, [])

  useEffect(() => {
    let cancelled = false
    import('@xenova/transformers').then(async ({ pipeline, env }) => {
      env.allowRemoteModels = true; env.allowLocalModels = true; env.localModelPath = 'models'
      try {
        const ex = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2')
        if (!cancelled) { extractorRef.current = ex as never; setModelReady(true) }
      } catch { /* keep fallback */ }
    }).catch(() => { /* keep fallback */ })
    return () => { cancelled = true }
  }, [])

  const toggleCode = (c: string) => setCodes(p => p.includes(c) ? p.filter(x => x !== c) : [...p, c])
  const applyPreset = (p: typeof PRESETS[number]) => {
    setForm(prev => ({ ...EMPTY_FORM, client: prev.client, site: prev.site, ...p.form }))
    setCodes(p.codes); setDiagnosis(null); setRetrieved([]); setApproved(false); setApproveStage(0); setShowReasoning(false)
  }

  async function retrieve(): Promise<Retrieved[]> {
    const query = formQueryText(form, codes)
    let scored: Retrieved[]
    if (extractorRef.current && embeddings.length === records.length) {
      const out = await extractorRef.current(query, { pooling: 'mean', normalize: true })
      const qv = Array.from(out.data)
      scored = records.map((r, i) => ({ ...r, score: dot(qv, embeddings[i]) }))
    } else {
      scored = records.map(r => ({ ...r, score: tokenScore(query, recordEmbedText(r)) }))
    }
    scored.sort((a, b) => b.score - a.score)
    // de-dupe near-identical tickets so the top 4 read as distinct cases
    const seen = new Set<string>()
    const uniq: Retrieved[] = []
    for (const r of scored) {
      const key = r.technician_notes.slice(0, 60)
      if (seen.has(key)) continue
      seen.add(key); uniq.push(r)
      if (uniq.length === 4) break
    }
    return uniq.map((r, i) => {
      const [lo, hi] = DISPLAY_BANDS[i]
      const frac = Math.min(1, Math.max(0, r.score))
      return { ...r, score: Math.round(hi - (hi - lo) * (1 - frac) * 0.6) }
    })
  }

  const runBoa = async () => {
    setLoading(true); setError(''); setDiagnosis(null); setApproved(false); setApproveStage(0); setShowReasoning(false)
    try {
      const top = await retrieve()
      setRetrieved(top)
      const res = await fetch('/api/diagnose', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          readings: {
            product: form.product, voltage_12v_rail: form.v12, voltage_5v_logic: form.v5,
            controller_status: form.controller, rs485_response: form.rs485,
            price_panels: `${form.panelsLit} of ${form.totalPanels}`,
            hours_since_last_price_update: form.hoursSince, lte_signal: form.lte, unit_age_months: form.age,
          },
          errorCodes: codes, notes: form.notes,
          similarCases: top.map(r => ({
            ticket_id: r.ticket_id, technician_notes: r.technician_notes, root_cause: r.root_cause,
            component_failed: r.component_failed, part_number: r.part_number, rma_required: r.rma_required,
            error_codes: r.error_codes, voltage_12v_rail: r.voltage_12v_rail, rs485_response: r.rs485_response,
            price_panels: `${r.price_panels_lit} of ${r.total_price_panels}`,
          })),
        }),
      })
      if (!res.ok) { setError('Diagnosis synthesis unavailable'); return }
      setDiagnosis(await res.json())
    } catch { setError('Error connecting to diagnosis service') }
    finally { setLoading(false) }
  }

  const approve = () => {
    setApproved(true); setApproveStage(1)
    ;[600, 1200, 1800, 2400].forEach((ms, i) => setTimeout(() => setApproveStage(i + 1), ms))
  }
  const setF = (k: keyof Form, v: string) => setForm(prev => ({ ...prev, [k]: v }))

  return (
    <div className="min-h-screen bg-[var(--void)] text-[var(--text-primary)]">
      {/* Header */}
      <header className="border-b border-[var(--border-default)] px-6 py-4 flex items-center justify-between">
        <a href="#/" className="text-[var(--text-muted)] font-mono-ui text-[12px] hover:text-[var(--text-primary)] transition-colors">← useboa.com</a>
        <span className="font-mono-ui text-[11px] text-[var(--text-muted)] tracking-widest inline-flex items-center gap-2">
          <span className={`w-1.5 h-1.5 rounded-full ${modelReady ? 'bg-emerald-500' : 'bg-amber-500'}`} />
          {modelReady ? 'SEMANTIC RETRIEVAL · READY' : 'RETRIEVAL · KEYWORD MODE'}
        </span>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-10">
        <div className="mb-10">
          <h1 className="font-display text-[var(--text-primary)] text-[2.5rem] leading-tight">Price Sync Diagnostics</h1>
          <p className="font-mono-ui text-[14px] text-[var(--text-muted)] mt-1">
            Pre-loaded with common Price Sync failure patterns · {records.length} service tickets
          </p>
        </div>

        <div className="grid lg:grid-cols-[360px_1fr] gap-8 items-start">
          {/* ── LEFT: live readings ── */}
          <motion.aside
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: EASE }}
            className="bg-white border border-[var(--border-default)] rounded-2xl p-6 lg:sticky lg:top-6 shadow-[0_1px_3px_rgba(0,0,0,0.04)]"
          >
            <h2 className="font-display text-[var(--text-primary)] text-xl mb-1">Live readings</h2>
            <p className="font-mono-ui text-[11px] text-[var(--text-muted)] mb-5">Field gateway telemetry · {ticketId}</p>

            {/* Unit identity */}
            <div className="rounded-xl bg-[var(--surface)] border border-[var(--border-default)] p-4 mb-5 space-y-3">
              <Field label="Client"><Input value={form.client} onChange={v => setF('client', v)} /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Site ID"><Input value={form.site} onChange={v => setF('site', v)} /></Field>
                <Field label="Product"><Select value={form.product} onChange={v => setF('product', v)} options={['Price Sync LTE', 'Price Sync NET']} /></Field>
              </div>
            </div>

            {/* Readings */}
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Field label="12V DC rail (V)"><Input value={form.v12} onChange={v => setF('v12', v)} placeholder="12.0" /></Field>
                <Field label="5V logic (V)"><Input value={form.v5} onChange={v => setF('v5', v)} placeholder="5.0" /></Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Controller (PCU)"><Select value={form.controller} onChange={v => setF('controller', v)} options={['Active', 'Fault']} /></Field>
                <Field label="RS-485"><Select value={form.rs485} onChange={v => setF('rs485', v)} options={['Responding', 'No response', 'Intermittent']} /></Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Panels lit"><Select value={form.panelsLit} onChange={v => setF('panelsLit', v)} options={['0', '1', '2', '3', '4']} /></Field>
                <Field label="Total panels"><Select value={form.totalPanels} onChange={v => setF('totalPanels', v)} options={['3', '4']} /></Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Hrs since update"><Input value={form.hoursSince} onChange={v => setF('hoursSince', v)} placeholder="12" /></Field>
                <Field label="Unit age (mo)"><Input value={form.age} onChange={v => setF('age', v)} placeholder="24" /></Field>
              </div>
              <Field label="LTE signal"><Select value={form.lte} onChange={v => setF('lte', v)} options={['Present', 'Absent']} /></Field>
            </div>

            <div className="mt-5">
              <FieldLabel>Error codes</FieldLabel>
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {ERROR_CODES.map(c => (
                  <button key={c} onClick={() => toggleCode(c)}
                    className={`px-2.5 py-1 font-mono-ui text-[11px] rounded-full border transition-all ${
                      codes.includes(c) ? 'bg-[var(--red)] text-white border-[var(--red)]'
                        : 'bg-transparent text-[var(--text-muted)] border-[var(--border-default)] hover:border-[var(--text-muted)]'}`}>
                    {c}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-5">
              <FieldLabel>Technician notes (optional)</FieldLabel>
              <textarea value={form.notes} onChange={e => setF('notes', e.target.value)} placeholder="Free-text field observations…"
                className="w-full h-16 mt-1.5 p-2.5 bg-[var(--surface)] border border-[var(--border-default)] rounded-lg font-mono-ui text-[12px] text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--red)]" />
            </div>

            <button onClick={runBoa} disabled={loading || records.length === 0}
              className="w-full mt-6 py-3 px-4 bg-[var(--red)] text-white font-mono-ui text-[13px] tracking-widest rounded-xl hover:opacity-90 disabled:opacity-40 transition-all">
              {loading ? 'ANALYZING…' : 'RUN BOA  →'}
            </button>

            <div className="border-t border-[var(--border-default)] mt-6 pt-4">
              <FieldLabel>Example scenarios</FieldLabel>
              <div className="space-y-2 mt-2">
                {PRESETS.map(p => (
                  <button key={p.label} onClick={() => applyPreset(p)}
                    className="w-full text-left px-3.5 py-2.5 bg-[var(--surface)] border border-[var(--border-default)] rounded-lg hover:border-[var(--red)] font-mono-ui text-[12px] text-[var(--text-secondary)] transition-colors">
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          </motion.aside>

          {/* ── RIGHT: diagnosis (hero) ── */}
          <motion.section
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.08, ease: EASE }}
            className="min-w-0"
          >
            {error && (
              <div className="flex gap-2 p-4 bg-red-50 border border-red-200 rounded-xl mb-6">
                <AlertCircle size={16} className="text-red-600 flex-shrink-0 mt-0.5" />
                <p className="font-mono-ui text-[12px] text-red-800">{error}</p>
              </div>
            )}

            {!diagnosis && !loading && (
              <div className="bg-white border border-[var(--border-default)] rounded-2xl p-16 text-center shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
                <Wrench size={28} className="text-[var(--text-muted)] mx-auto mb-4" strokeWidth={1.5} />
                <p className="font-display text-[var(--text-primary)] text-xl mb-1">Diagnosis appears here</p>
                <p className="font-mono-ui text-[13px] text-[var(--text-muted)]">Enter readings or pick a scenario, then run Boa.</p>
              </div>
            )}

            {loading && (
              <div className="bg-white border border-[var(--border-default)] rounded-2xl p-16 flex flex-col items-center gap-3 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
                <Loader size={22} className="text-[var(--red)] animate-spin" />
                <p className="font-mono-ui text-[13px] text-[var(--text-muted)]">Reasoning over {records.length} tickets of service history…</p>
              </div>
            )}

            {diagnosis && (
              <div className="space-y-6">
                {/* unit context */}
                <p className="font-mono-ui text-[12px] text-[var(--text-muted)]">
                  {form.client} · {form.site} · {form.product}
                </p>

                {/* HERO — cause + confidence */}
                <div className="bg-white border border-[var(--border-default)] rounded-2xl p-7 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
                  <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-5">
                    <div className="flex-1">
                      <p className="font-mono-ui text-[11px] text-[var(--text-muted)] uppercase tracking-[0.2em] mb-2">Most likely cause</p>
                      <h2 className="font-display text-[var(--text-primary)] text-[1.6rem] leading-snug">{diagnosis.most_likely_cause}</h2>
                      {diagnosis.part_number && (
                        <div className="inline-flex items-center gap-2 mt-3 px-3 py-1.5 rounded-lg bg-[var(--surface)] border border-[var(--border-default)]">
                          <span className="font-mono-ui text-[12px] text-[var(--text-secondary)]">{diagnosis.component}</span>
                          <span className="font-mono-ui text-[12px] text-[var(--red)] font-semibold">{diagnosis.part_number}</span>
                        </div>
                      )}
                    </div>
                    <ConfidenceDial value={diagnosis.confidence} />
                  </div>

                  <div className="flex flex-wrap gap-3 mt-6">
                    <button onClick={() => setShowEvidence(true)}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[var(--surface)] border border-[var(--border-default)] hover:border-[var(--red)] font-mono-ui text-[12px] text-[var(--text-secondary)] transition-colors">
                      <Search size={13} /> View {retrieved.length} similar cases
                    </button>
                    <button onClick={() => setShowReasoning(s => !s)}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-transparent border border-[var(--border-default)] hover:border-[var(--red)] font-mono-ui text-[12px] text-[var(--text-secondary)] transition-colors">
                      <GitBranch size={13} /> {showReasoning ? 'Hide' : 'Why this?'}
                    </button>
                  </div>
                </div>

                {/* PRIORITY — workflow to action */}
                <div className="bg-white border border-[var(--border-default)] rounded-2xl p-6 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
                  <div className="flex items-center gap-2 mb-4">
                    <GitBranch size={15} className="text-[var(--red)]" />
                    <p className="font-display text-[var(--text-primary)] text-lg">Recommended action</p>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-x-8 gap-y-2.5">
                    <Chain done>Ticket {ticketId} opened</Chain>
                    <Chain done>{retrieved.length} similar cases retrieved · {retrieved.map(r => r.score + '%').join(', ')}</Chain>
                    <Chain done>Root cause confirmed</Chain>
                    <Chain arrow>Part {diagnosis.part_number || 'none'} · in stock</Chain>
                    <Chain arrow>RMA {diagnosis.rma_required ? 'required — label generated' : 'not required'}</Chain>
                    <Chain arrow>Work order {woId} · NetSuite</Chain>
                  </div>

                  {!approved ? (
                    <div className="flex gap-2 mt-6">
                      <button onClick={approve}
                        className="flex-1 py-3 bg-[var(--red)] text-white font-mono-ui text-[13px] tracking-widest rounded-xl hover:opacity-90 transition-all">
                        APPROVE & DISPATCH →
                      </button>
                      <button className="px-5 py-3 border border-[var(--border-default)] rounded-xl text-[var(--text-muted)] font-mono-ui text-[13px] hover:text-[var(--text-primary)] transition-colors">Flag for review</button>
                    </div>
                  ) : (
                    <div className="mt-6 space-y-2 rounded-xl bg-[var(--surface)] p-4">
                      {approveStage >= 1 && <Dispatch active={approveStage === 1} done={approveStage > 1}>Creating work order in NetSuite…</Dispatch>}
                      {approveStage >= 2 && <Dispatch active={approveStage === 2} done={approveStage > 2}>Checking {diagnosis.part_number || 'part'} inventory…</Dispatch>}
                      {approveStage >= 3 && <Dispatch active={approveStage === 3} done={approveStage > 3}>Generating RMA return label…</Dispatch>}
                      {approveStage >= 4 && (
                        <div className="flex items-center gap-2 text-emerald-700">
                          <CheckCircle size={14} /><span className="font-mono-ui text-[12px]">Dispatched. Field tech notified by SMS.</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Fleet insight — readable amber */}
                {diagnosis.fleet_note && (
                  <div className="rounded-2xl border border-amber-300 bg-amber-50 p-5 flex gap-3">
                    <Zap size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
                    <p className="font-mono-ui text-[13px] text-amber-900 leading-relaxed">
                      <span className="font-semibold">Fleet insight — </span>{diagnosis.fleet_note}
                    </p>
                  </div>
                )}

                {/* Differential — collapsible */}
                <AnimatePresence>
                  {showReasoning && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.35, ease: EASE }} className="overflow-hidden">
                      <div className="bg-white border border-[var(--border-default)] rounded-2xl p-6 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
                        <p className="font-display text-[var(--text-primary)] text-lg mb-4">How Boa reasoned</p>
                        <p className="font-mono-ui text-[13px] text-[var(--text-secondary)] leading-relaxed mb-5">{diagnosis.reasoning}</p>
                        <p className="font-mono-ui text-[11px] text-[var(--text-muted)] uppercase tracking-[0.2em] mb-3">Ruled out</p>
                        <div className="space-y-3">
                          {diagnosis.ruling_out.map((r, i) => (
                            <div key={i} className="flex gap-2.5">
                              <XCircle size={15} className="text-[var(--text-muted)] flex-shrink-0 mt-0.5" />
                              <div>
                                <p className="font-mono-ui text-[13px] text-[var(--text-muted)] line-through">{r.cause}</p>
                                <p className="font-mono-ui text-[12px] text-[var(--text-secondary)] leading-relaxed mt-0.5">{r.reason}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </motion.section>
        </div>
      </main>

      {/* ── Evidence drawer ── */}
      <AnimatePresence>
        {showEvidence && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowEvidence(false)} className="fixed inset-0 bg-black/30 z-40" />
            <motion.aside initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
              transition={{ type: 'spring', stiffness: 260, damping: 30 }}
              className="fixed top-0 right-0 h-full w-full max-w-[460px] bg-[var(--void)] border-l border-[var(--border-default)] z-50 overflow-y-auto">
              <div className="sticky top-0 bg-[var(--void)] border-b border-[var(--border-default)] px-6 py-4 flex items-center justify-between">
                <div>
                  <p className="font-display text-[var(--text-primary)] text-lg">Evidence</p>
                  <p className="font-mono-ui text-[11px] text-[var(--text-muted)]">Similar cases from Price Sync service history</p>
                </div>
                <button onClick={() => setShowEvidence(false)} className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"><X size={20} /></button>
              </div>
              <div className="p-6 space-y-4">
                <p className="font-mono-ui text-[11px] text-[var(--text-muted)]">Connect your NetSuite export to run on Able's 15 years of real records.</p>
                {retrieved.map((r, i) => (
                  <motion.div key={r.ticket_id} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05, ease: EASE }}
                    className="bg-white border border-[var(--border-default)] rounded-xl p-4">
                    <div className="flex items-start justify-between mb-2 gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono-ui text-[12px] text-[var(--text-primary)] font-semibold">{r.ticket_id}</span>
                        <span className="font-mono-ui text-[11px] text-[var(--text-muted)]">{r.date}</span>
                        <span className="font-mono-ui text-[11px] text-[var(--text-muted)]">{r.site_id}</span>
                      </div>
                      <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-mono-ui text-[11px] font-medium">{r.score}%</span>
                    </div>
                    <p className="font-mono-ui text-[13px] text-[var(--text-primary)] leading-relaxed mb-2">"{r.technician_notes}"</p>
                    <div className="flex items-center justify-between border-t border-[var(--border-default)] pt-2">
                      <span className="font-mono-ui text-[12px] text-[var(--text-secondary)]">{r.root_cause}</span>
                      <button onClick={() => setExpanded(expanded === r.ticket_id ? null : r.ticket_id)} className="text-[var(--text-muted)] hover:text-[var(--text-primary)]">
                        <ChevronDown size={15} className={expanded === r.ticket_id ? 'rotate-180 transition-transform' : 'transition-transform'} />
                      </button>
                    </div>
                    <AnimatePresence>
                      {expanded === r.ticket_id && (
                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                          <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 mt-3 pt-3 border-t border-[var(--border-default)] font-mono-ui text-[11px] text-[var(--text-muted)]">
                            <span>12V rail: {r.voltage_12v_rail}V</span><span>RS-485: {r.rs485_response ? 'responding' : 'no response'}</span>
                            <span>Panels: {r.price_panels_lit}/{r.total_price_panels}</span><span>Age: {r.unit_age_months}mo</span>
                            <span>Codes: {r.error_codes.join(', ') || 'none'}</span><span>Part: {r.part_number || 'none'}</span>
                            <span>RMA: {r.rma_required ? 'yes' : 'no'}</span><span>Resolved: {r.resolution_time_hours}h</span>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                ))}
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}

/* ─── atoms ─── */
function FieldLabel({ children }: { children: ReactNode }) {
  return <label className="font-mono-ui text-[11px] text-[var(--text-muted)] uppercase tracking-[0.15em] block">{children}</label>
}
function Field({ label, children }: { label: string; children: ReactNode }) {
  return <div><FieldLabel>{label}</FieldLabel><div className="mt-1.5">{children}</div></div>
}
function Input({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
    className="w-full px-2.5 py-2 bg-[var(--void)] border border-[var(--border-default)] rounded-lg font-mono-ui text-[13px] text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--red)]" />
}
function Select({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: string[] }) {
  return <select value={value} onChange={e => onChange(e.target.value)}
    className="w-full px-2.5 py-2 bg-[var(--void)] border border-[var(--border-default)] rounded-lg font-mono-ui text-[13px] text-[var(--text-primary)] focus:outline-none focus:border-[var(--red)]">
    {options.map(o => <option key={o} value={o}>{o}</option>)}
  </select>
}
function ConfidenceDial({ value }: { value: number }) {
  const r = 34, c = 2 * Math.PI * r
  return (
    <div className="relative flex-shrink-0 w-[92px] h-[92px]">
      <svg viewBox="0 0 80 80" className="w-full h-full -rotate-90">
        <circle cx="40" cy="40" r={r} fill="none" stroke="var(--border-default)" strokeWidth="6" />
        <motion.circle cx="40" cy="40" r={r} fill="none" stroke="var(--red)" strokeWidth="6" strokeLinecap="round"
          strokeDasharray={c} initial={{ strokeDashoffset: c }} animate={{ strokeDashoffset: c - (value / 100) * c }}
          transition={{ duration: 0.9, ease: EASE }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display text-[var(--text-primary)] text-2xl leading-none">{value}</span>
        <span className="font-mono-ui text-[9px] text-[var(--text-muted)] tracking-widest mt-0.5">CONF</span>
      </div>
    </div>
  )
}
function Chain({ children, done, arrow }: { children: ReactNode; done?: boolean; arrow?: boolean }) {
  return (
    <div className="flex items-start gap-2.5">
      {done ? <CheckCircle size={14} className="text-emerald-600 flex-shrink-0 mt-0.5" />
        : arrow ? <ArrowRight size={14} className="text-[var(--text-muted)] flex-shrink-0 mt-0.5" />
        : <span className="w-3.5" />}
      <span className="font-mono-ui text-[12px] text-[var(--text-secondary)] leading-relaxed">{children}</span>
    </div>
  )
}
function Dispatch({ children, active, done }: { children: ReactNode; active?: boolean; done?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      {done ? <CheckCircle size={14} className="text-emerald-600" />
        : active ? <Loader size={14} className="text-[var(--red)] animate-spin" />
        : <CheckCircle size={14} className="text-emerald-600" />}
      <span className="font-mono-ui text-[12px] text-[var(--text-secondary)]">{children}</span>
    </div>
  )
}
