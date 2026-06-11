import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Sparkles, Send, Bot, CheckCircle, ExternalLink, Copy, Check,
} from 'lucide-react'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  sources?: { title: string; source: string; url: string; confidence: number }[]
  timestamp: Date
}

function SourceTag({ source, confidence }: { source: string; confidence: number }) {
  return (
    <span className="badge-subtle">
      {source.toUpperCase()} {confidence}%
    </span>
  )
}

const mockResponses: Record<string, { answer: string; sources: { title: string; source: string; url: string; confidence: number }[] }> = {
  'deployment process': {
    answer: `Our deployment process follows these steps:

1. Open a deployment PR with the label ":rocket: deploy"
2. Require 2 approvals from senior engineers
3. Run integration tests (must pass 100%)
4. Deploy to staging first, verify for 30 minutes
5. Deploy to production using the blue-green strategy
6. Monitor for 1 hour before declaring success

Important restrictions: No deployments after 4pm Friday, and critical fixes require incident commander approval.`,
    sources: [
      { title: 'Deployment Process', source: 'github', url: 'github.com/acme/boa-docs/wiki/Deployment', confidence: 98 },
      { title: 'BOA-138: Deployment freeze policy', source: 'jira', url: 'jira.acme.com/browse/BOA-138', confidence: 95 },
    ],
  },
  'api rate limit': {
    answer: `Our API rate limits are tiered:

- Free tier: 100 requests/minute
- Pro tier: 1,000 requests/minute
- Enterprise: 10,000 requests/minute with burst allowance

Rate limits are applied per organization, not per user. When exceeded, the API returns HTTP 429 with a Retry-After header.

Internal tools identified by service token are exempt from rate limits.`,
    sources: [
      { title: 'API Rate Limiting Policy', source: 'jira', url: 'jira.acme.com/browse/BOA-142', confidence: 95 },
    ],
  },
  'onboarding': {
    answer: `New team members follow this onboarding flow:

Day 1: Laptop MDM setup, join Slack channels (#engineering, #deployments, #incidents), get added to GitHub org and Jira, pair with onboarding buddy.

Week 1: Complete security training, review deployment process doc, shadow an on-call rotation, submit first PR.

Week 2-4: Take ownership of a "good first issue", attend architecture deep-dive, sign off on coding standards.`,
    sources: [
      { title: 'Onboarding Checklist v3', source: 'manual', url: 'boa.acme.com/docs/onboarding', confidence: 89 },
      { title: '#engineering onboarding thread', source: 'slack', url: 'acme.slack.com/archives/C0123', confidence: 72 },
    ],
  },
  'incident': {
    answer: `When an incident occurs, follow the severity-based response:

SEV-1 (outage/data loss/security breach): Page immediately, 15-minute response required.
SEV-2 (major degradation): Page within 30 min, 1-hour response.
SEV-3 (minor issue): Ticket during business hours.

Key roles: Incident Commander coordinates and decides, Communications Lead handles updates, Technical Lead investigates root cause.`,
    sources: [
      { title: 'Incident Response Playbook', source: 'github', url: 'github.com/acme/runbooks/incidents.md', confidence: 97 },
    ],
  },
}

function getMockResponse(query: string) {
  const lower = query.toLowerCase()
  for (const [key, response] of Object.entries(mockResponses)) {
    if (lower.includes(key)) return response
  }
  return {
    answer: `Based on your organization's knowledge base, I found relevant information about "${query}". The most relevant documents relate to our engineering processes and policies.\n\nWould you like me to show deployment docs, API policies, onboarding materials, or incident response procedures?`,
    sources: [
      { title: 'Deployment Process', source: 'github', url: 'github.com/acme/boa-docs', confidence: 72 },
      { title: 'Engineering Handbook', source: 'manual', url: 'boa.acme.com/docs', confidence: 65 },
    ],
  }
}

export default function AskPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const suggestedQuestions = [
    "What's our deployment process?",
    'What are the API rate limits?',
    'How do I onboard a new engineer?',
    "What's our incident response playbook?",
  ]

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isTyping])

  const handleSend = async (question?: string) => {
    const text = question || input.trim()
    if (!text) return

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      timestamp: new Date(),
    }

    setMessages(prev => [...prev, userMsg])
    setInput('')
    setIsTyping(true)

    await new Promise(r => setTimeout(r, 1200 + Math.random() * 800))

    const response = getMockResponse(text)
    const assistantMsg: Message = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: response.answer,
      sources: response.sources,
      timestamp: new Date(),
    }

    setIsTyping(false)
    setMessages(prev => [...prev, assistantMsg])
  }

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  return (
    <div className="flex flex-col h-[calc(100dvh)]">
      {/* HEADER */}
      <div className="shrink-0 px-6 py-4 border-b-2 border-[var(--border-default)] bg-[var(--surface)]">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="page-title">[ Ask Boa ]</h1>
            <p className="page-subtitle">/// Search verified organizational knowledge</p>
          </div>
          <Sparkles size={18} className="text-[var(--red)]" strokeWidth={2} />
        </div>
      </div>

      {/* MESSAGES */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center max-w-lg mx-auto">
            <div className="w-12 h-12 border-2 border-[var(--red)] flex items-center justify-center mb-6 bg-[var(--red-dim)]">
              <Sparkles size={20} className="text-[var(--red)]" strokeWidth={2} />
            </div>
            <h2 className="font-display text-xl text-[var(--text-primary)] mb-2 text-center uppercase tracking-widest">
              Query your knowledge base
            </h2>
            <p className="font-mono-ui text-[12px] text-[var(--text-muted)] mb-8 text-center uppercase tracking-widest leading-relaxed">
              Ask about processes, decisions, or rules your team has documented.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-px bg-[var(--border-default)] w-full">
              {suggestedQuestions.map(q => (
                <button
                  key={q}
                  onClick={() => handleSend(q)}
                  className="text-left px-4 py-3 bg-[var(--surface)] hover:bg-[var(--surface-elevated)] transition-colors border-l-2 border-l-transparent hover:border-l-[var(--red)]"
                  style={{ borderRadius: 0 }}
                >
                  <span className="font-mono-ui text-[12px] text-[var(--text-secondary)] uppercase tracking-wider leading-relaxed">
                    <span className="text-[var(--red)] mr-1">›</span>{q}
                  </span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="max-w-2xl mx-auto space-y-4">
            <AnimatePresence>
              {messages.map(msg => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.15 }}
                  className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : ''}`}
                >
                  {msg.role === 'assistant' && (
                    <div className="w-6 h-6 border-2 border-[var(--red)] flex items-center justify-center shrink-0 mt-1 bg-[var(--red-dim)]">
                      <Bot size={12} className="text-[var(--red)]" strokeWidth={2} />
                    </div>
                  )}
                  <div className={`max-w-[85%]`}>
                    <div
                      className={`px-4 py-3 border ${
                        msg.role === 'user'
                          ? 'bg-[var(--red)] text-[var(--void)] border-[var(--red)]'
                          : 'bg-[var(--surface)] border-[var(--border-default)]'
                      }`}
                      style={{ borderRadius: 0 }}
                    >
                      <div className={`font-mono-ui text-[13px] leading-relaxed whitespace-pre-wrap ${msg.role === 'user' ? 'font-bold uppercase tracking-wider' : 'text-[var(--text-secondary)]'}`}>
                        {msg.content}
                      </div>
                    </div>

                    {msg.role === 'assistant' && msg.sources && (
                      <div className="mt-1.5 flex flex-wrap items-center gap-2 px-1">
                        {msg.sources.map((source, i) => (
                          <div key={i} className="flex items-center gap-1.5">
                            <SourceTag source={source.source} confidence={source.confidence} />
                            <a
                              href={`https://${source.url}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-mono-ui text-[12px] text-[var(--text-muted)] hover:text-[var(--red)] flex items-center gap-0.5 transition-colors uppercase tracking-wider"
                            >
                              <ExternalLink size={9} />
                              {source.title}
                            </a>
                          </div>
                        ))}
                        <button
                          onClick={() => handleCopy(msg.id, msg.content)}
                          className="font-mono-ui text-[12px] text-[var(--text-muted)] hover:text-[var(--text-secondary)] flex items-center gap-0.5 transition-colors uppercase tracking-widest"
                        >
                          {copiedId === msg.id ? <Check size={9} className="text-[var(--terminal-green)]" /> : <Copy size={9} strokeWidth={2} />}
                          {copiedId === msg.id ? 'COPIED' : 'COPY'}
                        </button>
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {isTyping && (
              <div className="flex gap-3">
                <div className="w-6 h-6 border-2 border-[var(--red)] flex items-center justify-center shrink-0 bg-[var(--red-dim)]">
                  <Bot size={12} className="text-[var(--red)]" strokeWidth={2} />
                </div>
                <div className="px-4 py-3 border border-[var(--border-default)] bg-[var(--surface)]">
                  <div className="flex gap-1 items-center">
                    <span className="font-mono-ui text-[12px] text-[var(--text-muted)] uppercase tracking-widest mr-2">processing</span>
                    {[0, 1, 2].map(i => (
                      <span key={i} className="w-1.5 h-1.5 bg-[var(--red)] animate-pulse" style={{ animationDelay: `${i * 0.15}s`, borderRadius: 0 }} />
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* INPUT */}
      <div className="shrink-0 px-6 py-4 border-t-2 border-[var(--border-default)] bg-[var(--surface)]">
        <form
          onSubmit={e => { e.preventDefault(); handleSend() }}
          className="max-w-2xl mx-auto flex items-center gap-px bg-[var(--border-default)]"
          style={{ borderRadius: 0 }}
        >
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="ASK ABOUT YOUR ORGANIZATION'S KNOWLEDGE..."
            className="flex-1 h-11 px-4 bg-[var(--surface-elevated)] border-0 font-mono-ui text-[12px] uppercase tracking-widest text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none focus:bg-[var(--void)]"
            style={{ borderRadius: 0 }}
          />
          <button
            type="submit"
            disabled={!input.trim() || isTyping}
            className="h-11 w-12 bg-[var(--red)] text-[var(--void)] flex items-center justify-center hover:bg-[#ff2a2a] disabled:opacity-30 transition-colors shrink-0"
            style={{ borderRadius: 0 }}
          >
            <Send size={14} strokeWidth={2.5} />
          </button>
        </form>
      </div>
    </div>
  )
}
