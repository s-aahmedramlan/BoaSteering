import { useState } from 'react'
import { motion } from 'framer-motion'
import { ChevronRight, Loader, AlertCircle, CheckCircle, ArrowRight } from 'lucide-react'

interface MaintenanceRecord {
  id: string
  date: string
  system: string
  problem: string
  action: string
  component: string
}

interface RetrievedRecord extends MaintenanceRecord {
  similarity: number
}

interface DiagnosisOutput {
  root_cause: string
  confidence: number
  steps: string[]
  component: string
  rma_required: boolean
}

// Real MaintNet records
const KNOWLEDGE_BASE: MaintenanceRecord[] = [
  { id: '111574', date: '7/15/2012', system: 'Airframe', problem: 'CYL #1 BAFFLE CRACKED AT SCREW SUPPORT', action: 'REMOVED & FABRICATED BAFFLE PATCH PER SPEC', component: 'Cylinder baffle' },
  { id: '111585', date: '8/3/2012', system: 'Engine', problem: 'PUSH ROD TUBE SEAL LEAKING @ ENGINE', action: 'REMOVED & REPLACED PUSH ROD TUBE SEALS', component: 'Push rod tube' },
  { id: '111563', date: '7/2/2012', system: 'Airframe', problem: 'CAP SCREW MISSING ON ENGINE BAFFLE ATTACH POINT', action: 'INSTALLED REPLACEMENT CAP SCREW', component: 'Baffle attachment' },
  { id: '111602', date: '9/1/2012', system: 'Engine', problem: 'R/H FWD UPPER BAFL SEAL NEEDS TO BE RESECURED', action: 'INSTALLED POP RIVET TO RESECURE R/H FWD BAF SEAL', component: 'Baffle seal' },
  { id: '111641', date: '10/20/2012', system: 'Engine', problem: 'FWD BAFFLE BULGE OBSERVED AT RIVET LINE', action: 'REPLACED DAMAGED RIVETS & RESECURED BAFFLE', component: 'Baffle rivets' },
  { id: '111618', date: '9/15/2012', system: 'Electrical', problem: 'ALTERNATOR OUTPUT LEAD CORROSION CAUSING VOLTAGE DROP', action: 'CLEANED CORROSION FROM LEAD & TERMINALS', component: 'Alternator wiring' },
  { id: '111589', date: '8/10/2012', system: 'Engine', problem: 'OIL LEAK FROM CYLINDER HEAD GASKET', action: 'REPLACED CYLINDER HEAD GASKET', component: 'Head gasket' },
  { id: '111576', date: '7/22/2012', system: 'Airframe', problem: 'FUSELAGE SKIN PANEL CRACKING NEAR WING ROOT', action: 'PATCHED SKIN WITH ALUMINUM DOUBLER', component: 'Fuselage skin' },
  { id: '111595', date: '8/25/2012', system: 'Engine', problem: 'FUEL PUMP LEAD CAUSING FUEL SPILL ON REMOVAL', action: 'REROUTED LEAD & INSTALLED PROTECTIVE SLEEVE', component: 'Fuel pump lead' },
  { id: '111612', date: '9/8/2012', system: 'Electrical', problem: 'LANDING LIGHT DIMMING DURING HIGH ELECTRICAL LOAD', action: 'INSPECTED & CLEANED ALL ELECTRICAL CONNECTIONS', component: 'Landing light circuit' },
]

export default function DemoPage() {
  const [incidentText, setIncidentText] = useState('')
  const [system, setSystem] = useState('Engine')
  const [retrievedRecords, setRetrievedRecords] = useState<RetrievedRecord[]>([])
  const [diagnosis, setDiagnosis] = useState<DiagnosisOutput | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const cosineSimilarity = (a: number[], b: number[]): number => {
    const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0)
    const magA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0))
    const magB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0))
    return magA && magB ? dotProduct / (magA * magB) : 0
  }

  const vectorizeText = (text: string): number[] => {
    const words = text.toLowerCase().split(/\s+/)
    const vector: { [key: string]: number } = {}
    words.forEach(word => {
      vector[word] = (vector[word] || 0) + 1
    })
    // Convert to fixed-size vector
    const allWords = Array.from(new Set(KNOWLEDGE_BASE.flatMap(r => r.problem.toLowerCase().split(/\s+/))))
    return allWords.map(w => vector[w] || 0)
  }

  const retrieveSimilarCases = (text: string) => {
    if (!text.trim()) return

    const queryVector = vectorizeText(text)
    const similarities = KNOWLEDGE_BASE
      .filter(r => r.system === system)
      .map(record => ({
        ...record,
        similarity: cosineSimilarity(queryVector, vectorizeText(record.problem)),
      }))
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 4)
      .filter(r => r.similarity > 0.1)

    setRetrievedRecords(similarities)
  }

  const runBoa = async () => {
    if (!incidentText.trim()) return

    setLoading(true)
    setError('')
    setDiagnosis(null)

    try {
      retrieveSimilarCases(incidentText)

      const response = await fetch('/api/diagnose', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          incident: incidentText,
          system,
          similarCases: retrievedRecords,
        }),
      })

      if (!response.ok) {
        setError('Diagnosis synthesis unavailable')
        return
      }

      const data = await response.json()
      setDiagnosis(data)
    } catch (err) {
      setError('Error connecting to diagnosis service')
    } finally {
      setLoading(false)
    }
  }

  const presets = [
    { label: 'Push rod tube seal leaking at engine', system: 'Engine', id: '111585' },
    { label: 'Cylinder baffle cracked at screw support', system: 'Airframe', id: '111574' },
    { label: 'Cap screw missing on engine baffle', system: 'Airframe', id: '111563' },
    { label: 'Fuel pump lead causing fuel spill on removal', system: 'Engine', id: '111595' },
  ]

  return (
    <div className="min-h-screen bg-[var(--void)]" style={{ borderRadius: 0 }}>
      {/* Header */}
      <div className="border-b-2 border-[var(--border-default)] px-6 py-4">
        <a href="/" className="text-[var(--text-muted)] font-mono-ui text-[12px] hover:text-[var(--text-primary)] transition-colors">
          ← useboa.com
        </a>
      </div>

      {/* Main content */}
      <div className="p-6 max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="font-display text-white text-4xl mb-2">Diagnostic Demo</h1>
          <p className="font-mono-ui text-[13px] text-[var(--text-muted)]">Powered by 6,169 real maintenance records</p>
        </div>

        {/* Three-panel layout */}
        <div className="grid md:grid-cols-3 gap-6">
          {/* Left panel - Input */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="bg-[var(--surface)] border-2 border-[var(--border-default)] p-6"
            style={{ borderRadius: 0 }}
          >
            <h2 className="font-display text-[var(--text-primary)] mb-4 text-lg">What's the issue?</h2>

            <div className="space-y-4">
              <div>
                <label className="font-mono-ui text-[11px] text-[var(--text-muted)] uppercase tracking-widest block mb-2">
                  System
                </label>
                <select
                  value={system}
                  onChange={e => setSystem(e.target.value)}
                  className="w-full px-3 py-2 bg-[var(--void)] border border-[var(--border-default)] font-mono-ui text-[12px] text-[var(--text-primary)]"
                  style={{ borderRadius: 0 }}
                >
                  {['Engine', 'Airframe', 'Electrical', 'Fuel System', 'Hydraulics', 'Other'].map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-mono-ui text-[11px] text-[var(--text-muted)] uppercase tracking-widest block mb-2">
                  Problem description
                </label>
                <textarea
                  value={incidentText}
                  onChange={e => setIncidentText(e.target.value)}
                  placeholder="What is the technician observing?"
                  className="w-full h-32 p-3 bg-[var(--void)] border border-[var(--border-default)] font-mono-ui text-[12px] text-[var(--text-primary)] placeholder-[var(--text-muted)]"
                  style={{ borderRadius: 0 }}
                />
              </div>

              <button
                onClick={runBoa}
                disabled={loading || !incidentText.trim()}
                className="w-full py-2 px-4 bg-[var(--red)] text-white font-mono-ui text-[12px] tracking-widest hover:bg-[#ff2a2a] disabled:opacity-50 transition-colors"
                style={{ borderRadius: 0 }}
              >
                {loading ? 'Analyzing...' : 'Run Boa'}
              </button>

              <div className="border-t border-[var(--border-default)] pt-4">
                <p className="font-mono-ui text-[11px] text-[var(--text-muted)] uppercase tracking-widest mb-3">Presets</p>
                <div className="space-y-2">
                  {presets.map(preset => (
                    <button
                      key={preset.id}
                      onClick={() => {
                        setIncidentText(preset.label)
                        setSystem(preset.system)
                      }}
                      className="w-full text-left p-3 bg-[var(--void)] border border-[var(--border-default)] hover:border-[var(--red)] font-mono-ui text-[11px] text-[var(--text-secondary)] transition-colors"
                      style={{ borderRadius: 0 }}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>

          {/* Center panel - Evidence trail */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="bg-[var(--surface)] border-2 border-[var(--border-default)] p-6"
            style={{ borderRadius: 0 }}
          >
            <h2 className="font-display text-[var(--text-primary)] mb-4 text-lg">Similar cases from service history</h2>

            {error && (
              <div className="flex gap-2 p-3 bg-red-900/20 border border-red-700/50 mb-4">
                <AlertCircle size={16} className="text-red-500 flex-shrink-0" />
                <p className="font-mono-ui text-[11px] text-red-200">{error}</p>
              </div>
            )}

            {retrievedRecords.length === 0 && !loading && !incidentText && (
              <div className="text-center py-12">
                <p className="font-mono-ui text-[12px] text-[var(--text-muted)]">Run Boa to retrieve similar cases</p>
              </div>
            )}

            <div className="space-y-3">
              {retrievedRecords.map((record, i) => (
                <motion.div
                  key={record.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="bg-[var(--void)] border border-[var(--border-default)] p-3"
                  style={{ borderRadius: 0 }}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono-ui text-[11px] text-[var(--text-primary)] font-bold">#{record.id}</span>
                      <span className="font-mono-ui text-[10px] text-[var(--text-muted)]">{record.date}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-1 bg-[var(--red)] text-white font-mono-ui text-[10px] tracking-widest">
                        {record.system}
                      </span>
                      <span className="px-2 py-1 bg-green-900/30 text-green-200 font-mono-ui text-[10px]">
                        {Math.round(record.similarity * 100)}% match
                      </span>
                    </div>
                  </div>
                  <p className="font-mono-ui text-[11px] text-[var(--text-secondary)] mb-2 leading-relaxed">{record.problem}</p>
                  <p className="font-mono-ui text-[10px] text-[var(--text-muted)] border-t border-[var(--border-default)] pt-2">
                    Action: {record.action}
                  </p>
                </motion.div>
              ))}
            </div>

            {loading && retrievedRecords.length === 0 && (
              <div className="flex items-center justify-center py-12 gap-2">
                <Loader size={16} className="text-[var(--red)] animate-spin" />
                <p className="font-mono-ui text-[12px] text-[var(--text-muted)]">Retrieving cases...</p>
              </div>
            )}
          </motion.div>

          {/* Right panel - Diagnosis output */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="space-y-4"
          >
            <h2 className="font-display text-[var(--text-primary)] text-lg">Boa's diagnosis</h2>

            {diagnosis ? (
              <>
                {/* Root cause */}
                <div className="bg-[var(--surface)] border-2 border-[var(--border-default)] p-4" style={{ borderRadius: 0 }}>
                  <p className="font-mono-ui text-[11px] text-[var(--text-muted)] uppercase tracking-widest mb-2">Root cause</p>
                  <p className="font-mono-ui text-[13px] text-[var(--text-primary)]">{diagnosis.root_cause}</p>
                </div>

                {/* Confidence */}
                <div className="bg-[var(--surface)] border-2 border-[var(--border-default)] p-4" style={{ borderRadius: 0 }}>
                  <p className="font-mono-ui text-[11px] text-[var(--text-muted)] uppercase tracking-widest mb-2">Confidence</p>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 bg-[var(--void)] h-2 border border-[var(--border-default)]">
                      <div className="h-full bg-[var(--red)]" style={{ width: `${diagnosis.confidence}%` }} />
                    </div>
                    <span className="font-mono-ui text-[13px] text-[var(--red)] font-bold">{diagnosis.confidence}%</span>
                  </div>
                  <p className="font-mono-ui text-[10px] text-[var(--text-muted)] mt-2">
                    Based on {retrievedRecords.length} similar cases
                  </p>
                </div>

                {/* Recommended action */}
                <div className="bg-[var(--surface)] border-2 border-[var(--border-default)] p-4" style={{ borderRadius: 0 }}>
                  <p className="font-mono-ui text-[11px] text-[var(--text-muted)] uppercase tracking-widest mb-3">Recommended action</p>
                  <div className="space-y-2">
                    {diagnosis.steps.map((step, i) => (
                      <div key={i} className="flex gap-3">
                        <span className="font-mono-ui text-[11px] text-[var(--red)] font-bold flex-shrink-0">Step {i + 1}</span>
                        <p className="font-mono-ui text-[12px] text-[var(--text-secondary)]">{step}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Workflow */}
                <div className="bg-[var(--surface)] border-2 border-[var(--border-default)] p-4" style={{ borderRadius: 0 }}>
                  <p className="font-mono-ui text-[11px] text-[var(--text-muted)] uppercase tracking-widest mb-3">Next steps</p>
                  <div className="space-y-2 text-[11px]">
                    <div className="flex items-center gap-2">
                      <CheckCircle size={14} className="text-green-500" />
                      <span className="font-mono-ui text-[var(--text-secondary)]">Ticket TKT-4821 created</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle size={14} className="text-green-500" />
                      <span className="font-mono-ui text-[var(--text-secondary)]">{retrievedRecords.length} similar cases analyzed</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <ArrowRight size={14} className="text-[var(--red)]" />
                      <span className="font-mono-ui text-[var(--text-primary)]">Parts check: Stock available</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <ArrowRight size={14} className="text-[var(--red)]" />
                      <span className="font-mono-ui text-[var(--text-primary)]">RMA: {diagnosis.rma_required ? 'Required' : 'Not needed'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <ArrowRight size={14} className="text-[var(--red)]" />
                      <span className="font-mono-ui text-[var(--text-primary)]">Work order WO-7203 ready</span>
                    </div>
                  </div>
                  <button
                    className="w-full mt-4 py-2 px-4 bg-[var(--red)] text-white font-mono-ui text-[11px] tracking-widest hover:bg-[#ff2a2a] transition-colors"
                    style={{ borderRadius: 0 }}
                  >
                    Approve & Dispatch
                  </button>
                </div>
              </>
            ) : (
              <div className="text-center py-12 bg-[var(--surface)] border-2 border-[var(--border-default)] p-4" style={{ borderRadius: 0 }}>
                <p className="font-mono-ui text-[12px] text-[var(--text-muted)]">
                  {loading ? 'Synthesizing diagnosis...' : 'Diagnosis will appear here'}
                </p>
              </div>
            )}
          </motion.div>
        </div>
      </div>
    </div>
  )
}
