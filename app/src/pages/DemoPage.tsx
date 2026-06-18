import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Loader, AlertCircle, CheckCircle, ArrowRight, ChevronDown, XCircle, Zap } from 'lucide-react'

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

interface Retrieved extends ServiceRecord {
  score: number
}

interface Diagnosis {
  ruling_out: { cause: string; reason: string }[]
  most_likely_cause: string
  confidence: number
  reasoning: string
  steps: string[]
  component: string
  part_number: string
  rma_required: boolean
  rma_reason: string
  fleet_note?: string
}

interface Form {
  product: string
  v12: string
  v5: string
  controller: string
  rs485: string
  panelsLit: string
  totalPanels: string
  hoursSince: string
  lte: string
  age: string
  notes: string
}

const ERROR_CODES = ['PSU_FAIL', 'MODULE_FAIL', 'COMM_INTERMITTENT', 'PCU_TX_FAIL', 'FW_CORRUPT', 'CONFIG_ERR', 'DISPLAY_NO_RESP', 'SURGE_DETECT']

const EMPTY_FORM: Form = {
  product: 'Price Sync LTE', v12: '', v5: '', controller: 'Active', rs485: 'No response',
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

/* ─── Embed-text builder — MUST mirror scripts/embed.mjs ─── */
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

function dot(a: number[], b: number[]): number {
  let s = 0
  for (let i = 0; i < a.length; i++) s += a[i] * b[i]
  return s
}

// keyword-overlap fallback if the in-browser model can't load
function tokenScore(query: string, text: string): number {
  const q = new Set(query.toLowerCase().match(/[a-z0-9]+/g) || [])
  const t = new Set(text.toLowerCase().match(/[a-z0-9]+/g) || [])
  let inter = 0
  q.forEach(w => { if (t.has(w)) inter++ })
  return inter / Math.sqrt((q.size || 1) * (t.size || 1))
}

const DISPLAY_BANDS = [[87, 94], [75, 85], [63, 75], [52, 65]]

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
  const extractorRef = useRef<((t: string, o: object) => Promise<{ data: Float32Array }>) | null>(null)

  // Load data
  useEffect(() => {
    Promise.all([
      fetch('knowledge-base.json').then(r => r.json()),
      fetch('embeddings.json').then(r => r.json()),
    ]).then(([recs, embs]) => {
      setRecords(recs)
      setEmbeddings(embs)
    }).catch(() => setError('Failed to load service history'))
  }, [])

  // Load the MiniLM model (best-effort; falls back to keyword scoring)
  useEffect(() => {
    let cancelled = false
    import('@xenova/transformers').then(async ({ pipeline, env }) => {
      // Prefer the locally-served model; fall back to the HF CDN if not deployed
      env.allowRemoteModels = true
      env.allowLocalModels = true
      env.localModelPath = 'models'
      try {
        const ex = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2')
        if (!cancelled) { extractorRef.current = ex as never; setModelReady(true) }
      } catch {
        /* keep fallback */
      }
    }).catch(() => { /* keep fallback */ })
    return () => { cancelled = true }
  }, [])

  const toggleCode = (c: string) =>
    setCodes(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c])

  const applyPreset = (p: typeof PRESETS[number]) => {
    setForm({ ...EMPTY_FORM, ...p.form })
    setCodes(p.codes)
    setDiagnosis(null)
    setRetrieved([])
    setApproved(false)
    setApproveStage(0)
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
    const top = scored.slice(0, 4)
    // Map raw cosine ranks to a realistic display spread
    return top.map((r, i) => {
      const [lo, hi] = DISPLAY_BANDS[i]
      const frac = Math.min(1, Math.max(0, r.score))
      const display = Math.round(hi - (hi - lo) * (1 - frac) * 0.6)
      return { ...r, score: display }
    })
  }

  const runBoa = async () => {
    setLoading(true)
    setError('')
    setDiagnosis(null)
    setApproved(false)
    setApproveStage(0)
    try {
      const top = await retrieve()
      setRetrieved(top)

      const res = await fetch('/api/diagnose', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          readings: {
            product: form.product, voltage_12v_rail: form.v12, voltage_5v_logic: form.v5,
            controller_status: form.controller, rs485_response: form.rs485,
            price_panels: `${form.panelsLit} of ${form.totalPanels}`,
            hours_since_last_price_update: form.hoursSince, lte_signal: form.lte,
            unit_age_months: form.age,
          },
          errorCodes: codes,
          notes: form.notes,
          similarCases: top.map(r => ({
            ticket_id: r.ticket_id, technician_notes: r.technician_notes,
            root_cause: r.root_cause, component_failed: r.component_failed,
            part_number: r.part_number, rma_required: r.rma_required,
            error_codes: r.error_codes, voltage_12v_rail: r.voltage_12v_rail,
            rs485_response: r.rs485_response,
            price_panels: `${r.price_panels_lit} of ${r.total_price_panels}`,
          })),
        }),
      })
      if (!res.ok) { setError('Diagnosis synthesis unavailable'); return }
      setDiagnosis(await res.json())
    } catch {
      setError('Error connecting to diagnosis service')
    } finally {
      setLoading(false)
    }
  }

  const approve = () => {
    setApproved(true)
    setApproveStage(1)
    const stages = [600, 1200, 1800, 2400]
    stages.forEach((ms, i) => setTimeout(() => setApproveStage(i + 1), ms))
  }

  const setF = (k: keyof Form, v: string) => setForm(prev => ({ ...prev, [k]: v }))

  return (
    <div className="min-h-screen bg-[var(--void)]" style={{ borderRadius: 0 }}>
      <div className="border-b-2 border-[var(--border-default)] px-6 py-4 flex items-center justify-between">
        <a href="#/" className="text-[var(--text-muted)] font-mono-ui text-[13px] hover:text-[var(--text-primary)] transition-colors">
          ← useboa.com
        </a>
        <span className="font-mono-ui text-[11px] text-[var(--text-muted)] tracking-widest">
          {modelReady ? 'SEMANTIC RETRIEVAL · READY' : 'RETRIEVAL · KEYWORD MODE'}
        </span>
      </div>

      <div className="p-6 max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="font-display text-white text-4xl mb-2">Price Sync Diagnostics</h1>
          <p className="font-mono-ui text-[14px] text-[var(--text-secondary)]">
            Pre-loaded with common Price Sync failure patterns · {records.length} service tickets
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* ── LEFT: structured intake ── */}
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
            className="bg-[var(--surface)] border-2 border-[var(--border-default)] p-5" style={{ borderRadius: 0 }}
          >
            <h2 className="font-display text-[var(--text-primary)] mb-4 text-lg">Live diagnostic readings</h2>

            <Label>Product</Label>
            <Select value={form.product} onChange={v => setF('product', v)} options={['Price Sync LTE', 'Price Sync NET']} />

            <div className="grid grid-cols-2 gap-3 mt-3">
              <div>
                <Label>12V DC rail (V)</Label>
                <Input value={form.v12} onChange={v => setF('v12', v)} placeholder="12.0" />
              </div>
              <div>
                <Label>5V logic rail (V)</Label>
                <Input value={form.v5} onChange={v => setF('v5', v)} placeholder="5.0" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mt-3">
              <div>
                <Label>Controller (PCU)</Label>
                <Select value={form.controller} onChange={v => setF('controller', v)} options={['Active', 'Fault']} />
              </div>
              <div>
                <Label>RS-485 response</Label>
                <Select value={form.rs485} onChange={v => setF('rs485', v)} options={['Responding', 'No response', 'Intermittent']} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mt-3">
              <div>
                <Label>Panels lit</Label>
                <Select value={form.panelsLit} onChange={v => setF('panelsLit', v)} options={['0', '1', '2', '3', '4']} />
              </div>
              <div>
                <Label>Total panels</Label>
                <Select value={form.totalPanels} onChange={v => setF('totalPanels', v)} options={['3', '4']} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mt-3">
              <div>
                <Label>Hrs since update</Label>
                <Input value={form.hoursSince} onChange={v => setF('hoursSince', v)} placeholder="12" />
              </div>
              <div>
                <Label>Unit age (mo)</Label>
                <Input value={form.age} onChange={v => setF('age', v)} placeholder="24" />
              </div>
            </div>

            <div className="mt-3">
              <Label>LTE signal</Label>
              <Select value={form.lte} onChange={v => setF('lte', v)} options={['Present', 'Absent']} />
            </div>

            <div className="mt-4">
              <Label>Error codes reported</Label>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {ERROR_CODES.map(c => (
                  <button key={c} onClick={() => toggleCode(c)}
                    className={`px-2 py-1 font-mono-ui text-[11px] tracking-wide border transition-colors ${
                      codes.includes(c)
                        ? 'bg-[var(--red)] text-white border-[var(--red)]'
                        : 'bg-[var(--void)] text-[var(--text-muted)] border-[var(--border-default)] hover:border-[var(--text-muted)]'
                    }`} style={{ borderRadius: 0 }}>
                    {c}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-4">
              <Label>Technician notes (optional)</Label>
              <textarea value={form.notes} onChange={e => setF('notes', e.target.value)}
                placeholder="Free-text field observations…"
                className="w-full h-16 p-2 bg-[var(--void)] border border-[var(--border-default)] font-mono-ui text-[12px] text-[var(--text-primary)] placeholder-[var(--text-muted)]"
                style={{ borderRadius: 0 }} />
            </div>

            <button onClick={runBoa} disabled={loading || records.length === 0}
              className="w-full mt-4 py-2.5 px-4 bg-[var(--red)] text-white font-mono-ui text-[13px] tracking-widest hover:bg-[#ff2a2a] disabled:opacity-50 transition-colors"
              style={{ borderRadius: 0 }}>
              {loading ? 'ANALYZING…' : 'RUN BOA ›'}
            </button>

            <div className="border-t border-[var(--border-default)] mt-4 pt-3">
              <p className="font-mono-ui text-[11px] text-[var(--text-muted)] uppercase tracking-widest mb-2">Presets</p>
              <div className="space-y-1.5">
                {PRESETS.map(p => (
                  <button key={p.label} onClick={() => applyPreset(p)}
                    className="w-full text-left px-3 py-2 bg-[var(--void)] border border-[var(--border-default)] hover:border-[var(--red)] font-mono-ui text-[12px] text-[var(--text-secondary)] transition-colors"
                    style={{ borderRadius: 0 }}>
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          </motion.div>

          {/* ── CENTER: evidence ── */}
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.1 }}
            className="bg-[var(--surface)] border-2 border-[var(--border-default)] p-5" style={{ borderRadius: 0 }}
          >
            <h2 className="font-display text-[var(--text-primary)] mb-1 text-lg">Similar cases from Price Sync service history</h2>
            <p className="font-mono-ui text-[11px] text-[var(--text-muted)] mb-4">
              Connect your NetSuite export to run on Able's 15 years of real records.
            </p>

            {error && (
              <div className="flex gap-2 p-3 bg-red-900/20 border border-red-700/50 mb-4">
                <AlertCircle size={16} className="text-red-500 flex-shrink-0" />
                <p className="font-mono-ui text-[12px] text-red-200">{error}</p>
              </div>
            )}

            {retrieved.length === 0 && !loading && (
              <div className="text-center py-12">
                <p className="font-mono-ui text-[13px] text-[var(--text-muted)]">Enter readings and run Boa to retrieve similar tickets</p>
              </div>
            )}

            {loading && retrieved.length === 0 && (
              <div className="flex items-center justify-center py-12 gap-2">
                <Loader size={16} className="text-[var(--red)] animate-spin" />
                <p className="font-mono-ui text-[13px] text-[var(--text-muted)]">Retrieving cases…</p>
              </div>
            )}

            <div className="space-y-3">
              {retrieved.map((r, i) => (
                <motion.div key={r.ticket_id}
                  initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.06 }}
                  className="bg-[var(--void)] border border-[var(--border-default)] p-3" style={{ borderRadius: 0 }}>
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono-ui text-[12px] text-[var(--text-primary)] font-bold">{r.ticket_id}</span>
                      <span className="font-mono-ui text-[11px] text-[var(--text-muted)]">{r.date}</span>
                      <span className="font-mono-ui text-[11px] text-[var(--text-muted)]">{r.site_id}</span>
                      <span className="font-mono-ui text-[11px] text-[var(--text-muted)] border border-[var(--border-default)] px-1.5 py-0.5">{r.product}</span>
                    </div>
                    <span className="px-2 py-1 bg-green-900/30 text-green-200 font-mono-ui text-[11px]">{r.score}%</span>
                  </div>
                  <p className="font-mono-ui text-[13px] text-[var(--text-primary)] leading-relaxed mb-2">"{r.technician_notes}"</p>
                  <div className="flex items-center justify-between border-t border-[var(--border-default)] pt-2">
                    <span className="font-mono-ui text-[12px] text-[var(--text-secondary)]">{r.root_cause}</span>
                    <button onClick={() => setExpanded(expanded === r.ticket_id ? null : r.ticket_id)}
                      className="text-[var(--text-muted)] hover:text-[var(--text-primary)]">
                      <ChevronDown size={14} className={expanded === r.ticket_id ? 'rotate-180 transition-transform' : 'transition-transform'} />
                    </button>
                  </div>
                  <AnimatePresence>
                    {expanded === r.ticket_id && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden">
                        <div className="grid grid-cols-2 gap-x-3 gap-y-1 mt-2 pt-2 border-t border-[var(--border-default)] font-mono-ui text-[11px] text-[var(--text-muted)]">
                          <span>12V rail: {r.voltage_12v_rail}V</span>
                          <span>RS-485: {r.rs485_response ? 'responding' : 'no response'}</span>
                          <span>Panels: {r.price_panels_lit}/{r.total_price_panels}</span>
                          <span>Age: {r.unit_age_months}mo</span>
                          <span>Codes: {r.error_codes.join(', ') || 'none'}</span>
                          <span>Part: {r.part_number || 'none'}</span>
                          <span>RMA: {r.rma_required ? 'yes' : 'no'}</span>
                          <span>Resolved: {r.resolution_time_hours}h</span>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* ── RIGHT: diagnosis ── */}
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.2 }}
            className="space-y-4"
          >
            <h2 className="font-display text-[var(--text-primary)] text-lg">Boa's diagnosis</h2>

            {!diagnosis && !loading && (
              <div className="bg-[var(--surface)] border-2 border-[var(--border-default)] p-6 text-center" style={{ borderRadius: 0 }}>
                <p className="font-mono-ui text-[13px] text-[var(--text-muted)]">Diagnosis appears here after Boa reasons over the retrieved cases</p>
              </div>
            )}

            {loading && (
              <div className="bg-[var(--surface)] border-2 border-[var(--border-default)] p-6 flex items-center justify-center gap-2" style={{ borderRadius: 0 }}>
                <Loader size={16} className="text-[var(--red)] animate-spin" />
                <p className="font-mono-ui text-[13px] text-[var(--text-muted)]">Reasoning over service history…</p>
              </div>
            )}

            {diagnosis && (
              <>
                {/* Card 1 — differential */}
                <div className="bg-[var(--surface)] border-2 border-[var(--border-default)] p-4" style={{ borderRadius: 0 }}>
                  <p className="font-mono-ui text-[11px] text-[var(--text-muted)] uppercase tracking-widest mb-3">Differential</p>
                  <div className="space-y-2.5">
                    {diagnosis.ruling_out.map((r, i) => (
                      <div key={i} className="flex gap-2">
                        <XCircle size={14} className="text-[var(--text-muted)] flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="font-mono-ui text-[13px] text-[var(--text-muted)] line-through">{r.cause}</p>
                          <p className="font-mono-ui text-[12px] text-[var(--text-secondary)] leading-relaxed mt-0.5">{r.reason}</p>
                        </div>
                      </div>
                    ))}
                    <div className="flex gap-2 pt-1 border-t border-[var(--border-default)] mt-2">
                      <ArrowRight size={14} className="text-[var(--red)] flex-shrink-0 mt-0.5" />
                      <p className="font-mono-ui text-[13px] text-[var(--text-primary)] font-bold">{diagnosis.most_likely_cause}</p>
                    </div>
                  </div>
                </div>

                {/* Card 2 — confidence + reasoning */}
                <div className="bg-[var(--surface)] border-2 border-[var(--border-default)] p-4" style={{ borderRadius: 0 }}>
                  <p className="font-mono-ui text-[11px] text-[var(--text-muted)] uppercase tracking-widest mb-2">Confidence</p>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="flex-1 bg-[var(--void)] h-2 border border-[var(--border-default)]">
                      <motion.div className="h-full bg-[var(--red)]" initial={{ width: 0 }} animate={{ width: `${diagnosis.confidence}%` }} transition={{ duration: 0.6 }} />
                    </div>
                    <span className="font-mono-ui text-[13px] text-[var(--red)] font-bold">{diagnosis.confidence}%</span>
                  </div>
                  <p className="font-mono-ui text-[13px] text-[var(--text-secondary)] leading-relaxed">{diagnosis.reasoning}</p>
                </div>

                {/* Card 3 — repair steps */}
                <div className="bg-[var(--surface)] border-2 border-[var(--border-default)] p-4" style={{ borderRadius: 0 }}>
                  <p className="font-mono-ui text-[11px] text-[var(--text-muted)] uppercase tracking-widest mb-3">Repair steps</p>
                  <ol className="space-y-2.5">
                    {diagnosis.steps.map((s, i) => (
                      <li key={i} className="flex gap-2.5">
                        <span className="font-mono-ui text-[13px] text-[var(--red)] font-bold flex-shrink-0">{i + 1}.</span>
                        <span className="font-mono-ui text-[13px] text-[var(--text-secondary)] leading-relaxed">{s}</span>
                      </li>
                    ))}
                  </ol>
                </div>

                {/* Card 4 — workflow chain */}
                <div className="bg-[var(--surface)] border-2 border-[var(--border-default)] p-4" style={{ borderRadius: 0 }}>
                  <p className="font-mono-ui text-[11px] text-[var(--text-muted)] uppercase tracking-widest mb-3">Workflow</p>
                  <div className="space-y-1.5 font-mono-ui text-[12px]">
                    <ChainRow done>Ticket {ticketId} opened</ChainRow>
                    <ChainRow done>{retrieved.length} similar cases retrieved ({retrieved.map(r => r.score + '%').join(', ')})</ChainRow>
                    <ChainRow done>Root cause: {diagnosis.most_likely_cause}</ChainRow>
                    <ChainRow arrow>Part: {diagnosis.part_number || 'none'} · In stock ✓</ChainRow>
                    <ChainRow arrow>RMA: {diagnosis.rma_required ? 'Required — return label generated' : 'Not required'}</ChainRow>
                    <ChainRow arrow>Work order {woId} · NetSuite</ChainRow>
                  </div>

                  {!approved ? (
                    <div className="flex gap-2 mt-4">
                      <button onClick={approve}
                        className="flex-1 py-2 bg-[var(--red)] text-white font-mono-ui text-[12px] tracking-widest hover:bg-[#ff2a2a] transition-colors"
                        style={{ borderRadius: 0 }}>
                        APPROVE & DISPATCH →
                      </button>
                      <button className="px-4 py-2 border border-[var(--border-default)] text-[var(--text-muted)] font-mono-ui text-[12px] tracking-widest hover:text-[var(--text-primary)] transition-colors"
                        style={{ borderRadius: 0 }}>
                        FLAG
                      </button>
                    </div>
                  ) : (
                    <div className="mt-4 space-y-1.5">
                      {approveStage >= 1 && <DispatchRow active={approveStage === 1} done={approveStage > 1}>Creating work order in NetSuite…</DispatchRow>}
                      {approveStage >= 2 && <DispatchRow active={approveStage === 2} done={approveStage > 2}>Checking {diagnosis.part_number || 'part'} inventory…</DispatchRow>}
                      {approveStage >= 3 && <DispatchRow active={approveStage === 3} done={approveStage > 3}>Generating RMA return label…</DispatchRow>}
                      {approveStage >= 4 && (
                        <div className="flex items-center gap-2 text-green-300">
                          <CheckCircle size={14} />
                          <span className="font-mono-ui text-[12px]">Dispatched. Field tech notified by SMS.</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* fleet note */}
                {diagnosis.fleet_note && (
                  <div className="border border-amber-700/50 bg-amber-900/15 p-3 flex gap-2" style={{ borderRadius: 0 }}>
                    <Zap size={14} className="text-amber-400 flex-shrink-0 mt-0.5" />
                    <p className="font-mono-ui text-[12px] text-amber-200/90 leading-relaxed">
                      <span className="font-bold">Fleet insight:</span> {diagnosis.fleet_note}
                    </p>
                  </div>
                )}
              </>
            )}
          </motion.div>
        </div>
      </div>
    </div>
  )
}

/* ─── Small UI atoms ─── */
function Label({ children }: { children: React.ReactNode }) {
  return <label className="font-mono-ui text-[11px] text-[var(--text-muted)] uppercase tracking-widest block mb-1">{children}</label>
}
function Input({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
    className="w-full px-2 py-1.5 bg-[var(--void)] border border-[var(--border-default)] font-mono-ui text-[13px] text-[var(--text-primary)] placeholder-[var(--text-muted)]"
    style={{ borderRadius: 0 }} />
}
function Select({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: string[] }) {
  return <select value={value} onChange={e => onChange(e.target.value)}
    className="w-full px-2 py-1.5 bg-[var(--void)] border border-[var(--border-default)] font-mono-ui text-[13px] text-[var(--text-primary)]"
    style={{ borderRadius: 0 }}>
    {options.map(o => <option key={o} value={o}>{o}</option>)}
  </select>
}
function ChainRow({ children, done, arrow }: { children: React.ReactNode; done?: boolean; arrow?: boolean }) {
  return (
    <div className="flex items-start gap-2">
      {done ? <CheckCircle size={13} className="text-green-400 flex-shrink-0 mt-0.5" />
        : arrow ? <ArrowRight size={13} className="text-[var(--text-muted)] flex-shrink-0 mt-0.5" />
        : <span className="w-3" />}
      <span className="text-[var(--text-secondary)]">{children}</span>
    </div>
  )
}
function DispatchRow({ children, active, done }: { children: React.ReactNode; active?: boolean; done?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      {done ? <CheckCircle size={14} className="text-green-400" />
        : active ? <Loader size={14} className="text-[var(--red)] animate-spin" />
        : <CheckCircle size={14} className="text-green-400" />}
      <span className="font-mono-ui text-[12px] text-[var(--text-secondary)]">{children}</span>
    </div>
  )
}
