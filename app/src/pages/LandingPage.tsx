import { useRef, useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { motion, useInView, AnimatePresence } from 'framer-motion'
import { CheckCircle, Link2, RefreshCw, Shield, Stethoscope, Crosshair, Sun, Moon } from 'lucide-react'
import ParticleField from '../sections/landing/ParticleField'
import TypeTransition from '../sections/landing/TypeTransition'
import PixelReveal from '../sections/landing/PixelReveal'
import { useTheme } from '@/hooks/useTheme'

function FadeInSection({ children, className = '', delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: '-80px' })
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 32 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, delay, ease: [0.25, 0.46, 0.45, 0.94] }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

/* ─── NAV ─── */
function LandingNav() {
  const navigate = useNavigate()
  const { theme, toggle } = useTheme()
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 60)
    window.addEventListener('scroll', fn, { passive: true })
    return () => window.removeEventListener('scroll', fn)
  }, [])

  const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })

  return (
    <motion.header
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, delay: 0.1 }}
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 border-b-2 ${
        scrolled
          ? 'bg-[var(--void)] border-[var(--border-default)]'
          : 'bg-transparent border-transparent'
      }`}
      style={{ borderRadius: 0 }}
    >
      <div className="flex items-center justify-between h-14 px-6 max-w-7xl mx-auto">
        {/* Logo */}
        <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} style={{ borderRadius: 0 }}>
          <img src="/logoreal2.png" alt="Boa" style={{ width: '52px', height: '52px', objectFit: 'contain', borderRadius: 0 }} />
        </button>

        <nav className="hidden md:flex items-center gap-px">
          {[
            { label: 'PROBLEM', id: 'problem' },
            { label: 'USE CASES', id: 'use-cases' },
          ].map(item => (
            <button
              key={item.id}
              onClick={() => scrollTo(item.id)}
              className="px-3 py-2 font-mono-ui text-[13px] tracking-widest transition-colors"
              style={{ color: scrolled ? 'var(--text-muted)' : 'rgba(255,255,255,0.75)', borderRadius: 0 }}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className="flex items-center gap-px">
          {/* Theme toggle */}
          <button
            onClick={toggle}
            className="w-9 h-9 flex items-center justify-center transition-colors border"
            style={{
              color: scrolled ? 'var(--text-muted)' : 'rgba(255,255,255,0.75)',
              borderColor: scrolled ? 'var(--border-default)' : 'rgba(255,255,255,0.25)',
              borderRadius: 0,
            }}
            title={theme === 'light' ? 'Dark mode' : 'Light mode'}
          >
            {theme === 'light' ? <Moon size={14} strokeWidth={2} /> : <Sun size={14} strokeWidth={2} />}
          </button>
        </div>
      </div>
    </motion.header>
  )
}

/* ─── HERO ─── */
function HeroSection() {
  const navigate = useNavigate()

  return (
    <section
      className="relative min-h-screen flex items-center justify-center overflow-hidden border-b-2 border-[var(--border-default)]"
      style={{ backgroundColor: '#1A0A18' }}
    >
      {/* Pixelated background reveal */}
      <PixelReveal
        src="/bg.jpg"
        className="absolute inset-0 w-full h-full"
        style={{ objectFit: 'cover' }}
      />
      {/* Dark overlay for text legibility */}
      <div className="absolute inset-0 z-[1] pointer-events-none" style={{ backgroundColor: 'rgba(12, 4, 18, 0.52)' }} />
      {/* Content */}
      <div className="relative z-[2] flex flex-col items-center justify-center text-center px-6 max-w-4xl mx-auto pt-20">

        {/* Logo pill */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="mb-12"
        >
          <div
            className="logo-pill mx-auto relative"
            style={{ width: '190px', height: '71px' }}
          >
            <img
              src="/logo.png"
              alt="Boa"
              className="w-full h-full object-cover object-center"
              style={{ borderRadius: 0 }}
            />
            <div
              className="absolute inset-0"
              style={{ backgroundColor: '#C8189A', mixBlendMode: 'color', opacity: 0.72, borderRadius: 0 }}
            />
          </div>
        </motion.div>

        {/* Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.55 }}
          className="font-display text-white max-w-3xl"
          style={{ fontSize: 'clamp(2.5rem, 6vw, 5rem)', lineHeight: 1.1 }}
        >
          Diagnose hardware failures 10x faster.
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.9 }}
          className="mt-6 font-mono-ui text-[15px] tracking-widest max-w-2xl mx-auto leading-relaxed font-semibold"
          style={{ color: 'rgba(255,255,255,0.95)' }}
        >
          Boa transforms your organization's knowledge into AI agents that know your devices as well as your best technician.
        </motion.p>

        {/* CTA row */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 1.1 }}
          className="mt-10 flex items-center gap-px"
        >
          <a
            href="https://calendly.com/justin-shakergayen/30min"
            target="_blank"
            rel="noopener noreferrer"
            className="px-8 py-3 bg-[var(--red)] text-white font-mono-ui text-[12px] tracking-widest hover:bg-[#ff2a2a] transition-colors inline-block"
            style={{ borderRadius: 0 }}
          >
            BOOK A DEMO ›
          </a>
        </motion.div>

      </div>
    </section>
  )
}

/* ─── PROBLEM ─── */
function ProblemSection() {
  const stats = [
    { value: 'HOURS', subtext: 'Spent searching for diagnostic answers' },
    { value: '10+', subtext: 'Systems storing fragmented knowledge' },
    { value: '10x', subtext: 'Faster diagnosis with unified context' },
  ]

  return (
    <section id="problem" className="py-32 px-6 border-b-2 border-[var(--border-default)]">
      <div className="max-w-6xl mx-auto grid md:grid-cols-[55%_45%] gap-16 items-center">
        <FadeInSection>
          <h2
            className="font-display text-[var(--text-primary)]"
            style={{ fontSize: 'clamp(2rem, 4vw, 3rem)' }}
          >
            Your expertise shouldn't live in ten different systems.
          </h2>
          <p className="mt-5 font-mono-ui text-[13px] text-[var(--text-secondary)] leading-relaxed max-w-[55ch] tracking-wide">
            Every hardware company has valuable knowledge trapped inside spreadsheets, PDFs, ticket systems, engineering notes, email threads, and technician experience. When failures occur, teams spend hours searching for answers instead of solving problems.
          </p>
        </FadeInSection>

        <div className="space-y-px bg-[var(--border-default)]">
          {stats.map((stat, i) => (
            <FadeInSection key={i} delay={i * 0.1}>
              <div className="bg-[var(--surface)] px-6 py-5">
                <div className="font-display text-[var(--red)]" style={{ fontSize: '2.5rem', letterSpacing: '-0.04em' }}>{stat.value}</div>
                <div className="mt-1 font-mono-ui text-[12px] text-[var(--text-muted)] tracking-widest">{stat.subtext}</div>
              </div>
            </FadeInSection>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ─── OBJECTION 1: DATA ─── */
function DataSection() {
  return (
    <section id="product" className="py-32 px-6 bg-[var(--surface)] border-b-2 border-[var(--border-default)]">
      <div className="max-w-6xl mx-auto grid md:grid-cols-[55%_45%] gap-16 items-center">
        <FadeInSection>
          <h2 className="font-display text-[var(--text-primary)]" style={{ fontSize: 'clamp(2rem, 4vw, 3rem)' }}>
            Your data doesn't need to be perfect. That's our job.
          </h2>
          <p className="mt-5 font-mono-ui text-[13px] text-[var(--text-secondary)] leading-relaxed max-w-[55ch] tracking-wide">
            Incident reports in spreadsheets? Tribal knowledge in email threads? Docs scattered across drives? Boa ingests, structures, and transforms your existing data into a knowledge layer your agents can actually use. No data cleanup required on your end. We handle it.
          </p>
        </FadeInSection>
        <div className="bg-[var(--border-default)] p-px">
          <div className="bg-[var(--void)] p-8">
            <div className="font-mono-ui text-[11px] text-[var(--text-muted)] tracking-widest uppercase mb-4">How we ingest</div>
            <div className="space-y-3">
              {['Spreadsheets & PDFs', 'Ticketing systems', 'Engineering notes', 'Email archives', 'Service logs'].map((item, i) => (
                <div key={i} className="flex items-center gap-3">
                  <CheckCircle size={14} strokeWidth={2} className="text-[var(--red)] flex-shrink-0" />
                  <span className="font-mono-ui text-[12px] text-[var(--text-secondary)]">{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ─── OBJECTION 2: WORKFLOW ─── */
function WorkflowSection() {
  return (
    <section className="py-32 px-6 border-b-2 border-[var(--border-default)]">
      <div className="max-w-6xl mx-auto grid md:grid-cols-[45%_55%] gap-16 items-center">
        <div className="bg-[var(--border-default)] p-px order-last md:order-first">
          <div className="bg-[var(--surface)] p-8">
            <div className="font-mono-ui text-[11px] text-[var(--text-muted)] tracking-widest uppercase mb-6">The full workflow</div>
            <div className="space-y-4">
              {[
                { step: '01', label: 'Ticket in', desc: 'Issue enters your system' },
                { step: '02', label: 'Diagnosis', desc: 'Agent analyzes logs & history' },
                { step: '03', label: 'Parts rec', desc: 'Catalog lookup & approval' },
                { step: '04', label: 'Resolution', desc: 'Dispatch & continuous learning' },
              ].map((item, i) => (
                <div key={i} className="flex gap-4 pb-4 border-b border-[var(--border-default)] last:border-0">
                  <div className="text-[var(--red)] font-display text-sm font-bold">{item.step}</div>
                  <div>
                    <div className="font-mono-ui text-[12px] font-bold text-[var(--text-primary)]">{item.label}</div>
                    <div className="font-mono-ui text-[11px] text-[var(--text-muted)] mt-1">{item.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <FadeInSection>
          <h2 className="font-display text-[var(--text-primary)]" style={{ fontSize: 'clamp(2rem, 4vw, 3rem)' }}>
            We don't just give you a tool. We build the workflow.
          </h2>
          <p className="mt-5 font-mono-ui text-[13px] text-[var(--text-secondary)] leading-relaxed max-w-[55ch] tracking-wide">
            Boa designs and deploys the full diagnostic agentic workflow — tailored to how your team actually works. From ticket ingestion to diagnosis to resolution — end to end. Your technicians don't change how they work. They just work 10x faster.
          </p>
        </FadeInSection>
      </div>
    </section>
  )
}

/* ─── OBJECTION 3: CUSTOMIZATION ─── */
function CustomizationSection() {
  return (
    <section className="py-32 px-6 bg-[var(--surface)] border-b-2 border-[var(--border-default)]">
      <div className="max-w-6xl mx-auto grid md:grid-cols-[55%_45%] gap-16 items-center">
        <FadeInSection>
          <h2 className="font-display text-[var(--text-primary)]" style={{ fontSize: 'clamp(2rem, 4vw, 3rem)' }}>
            Built for your devices, not a generic demo.
          </h2>
          <p className="mt-5 font-mono-ui text-[13px] text-[var(--text-secondary)] leading-relaxed max-w-[55ch] tracking-wide">
            Every Boa deployment is trained on your specific hardware, failure modes, and institutional knowledge. Not a chatbot. Not a search tool. A diagnostic agent that knows your products as well as your best engineer.
          </p>
        </FadeInSection>
        <div className="bg-[var(--border-default)] p-px">
          <div className="bg-[var(--void)] p-8 space-y-px">
            {['Device telemetry', 'Failure trees', 'Maintenance logs', 'Diagnostic reasoning', 'Parts catalogs'].map((item, i) => (
              <div key={i} className="bg-[var(--surface)] px-4 py-3 flex items-center gap-3">
                <CheckCircle size={14} strokeWidth={2} className="text-[var(--red)] flex-shrink-0" />
                <span className="font-mono-ui text-[12px] text-[var(--text-secondary)]">{item}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

/* ─── PARTS RECOMMENDATION ─── */
function PartsSection() {
  return (
    <section className="py-32 px-6 border-b-2 border-[var(--border-default)]">
      <div className="max-w-6xl mx-auto grid md:grid-cols-[45%_55%] gap-16 items-center">
        <div className="bg-[var(--border-default)] p-px">
          <div className="bg-[var(--surface)] p-8">
            <div className="font-mono-ui text-[11px] text-[var(--text-muted)] tracking-widest uppercase mb-6 font-bold">Approval flow</div>
            <div className="space-y-3">
              <div className="bg-[var(--void)] p-4 border-l-2 border-[var(--red)]">
                <div className="font-mono-ui text-[11px] text-[var(--text-muted)] uppercase tracking-widest mb-1">Diagnosis</div>
                <div className="font-mono-ui text-[12px] text-[var(--text-primary)]">Bearing seal failure detected</div>
              </div>
              <div className="text-center text-[var(--text-muted)] font-mono-ui text-[11px]">↓</div>
              <div className="bg-[var(--void)] p-4 border-l-2 border-[var(--red)]">
                <div className="font-mono-ui text-[11px] text-[var(--text-muted)] uppercase tracking-widest mb-1">Parts</div>
                <div className="font-mono-ui text-[12px] text-[var(--text-primary)]">Part #BSL-447 · Qty: 2 · OEM supplier</div>
              </div>
              <div className="text-center text-[var(--text-muted)] font-mono-ui text-[11px]">↓</div>
              <div className="bg-[var(--void)] p-4 border-l-2 border-[var(--red)]">
                <div className="font-mono-ui text-[11px] text-[var(--text-muted)] uppercase tracking-widest mb-1">Approve</div>
                <div className="font-mono-ui text-[12px] text-[var(--text-primary)]">One click · no digging</div>
              </div>
            </div>
          </div>
        </div>
        <FadeInSection>
          <h2 className="font-display text-[var(--text-primary)]" style={{ fontSize: 'clamp(2rem, 4vw, 3rem)' }}>
            From Diagnosis to Doorstep
          </h2>
          <p className="mt-5 font-mono-ui text-[13px] text-[var(--text-secondary)] leading-relaxed max-w-[55ch] tracking-wide">
            Once Boa identifies the failure, it cross-references your parts catalog and prescribes exactly what needs to be ordered — part number, quantity, supplier. Your team reviews, approves, and moves on. No digging, no back and forth. Boa closes the loop.
          </p>
        </FadeInSection>
      </div>
    </section>
  )
}

/* ─── HOW IT WORKS ─── */
function HowItWorksSection() {
  const sectionRef = useRef<HTMLDivElement>(null)
  const scrollSpeedRef = useRef(0)
  const [activePanel, setActivePanel] = useState(0)

  useEffect(() => {
    const section = sectionRef.current
    if (!section) return
    const fn = () => {
      const rect = section.getBoundingClientRect()
      const progress = Math.max(0, Math.min(1, -rect.top / (rect.height - window.innerHeight)))
      scrollSpeedRef.current = progress * 0.02
      if (progress < 0.33) setActivePanel(0)
      else if (progress < 0.66) setActivePanel(1)
      else setActivePanel(2)
    }
    window.addEventListener('scroll', fn, { passive: true })
    return () => window.removeEventListener('scroll', fn)
  }, [])

  const panels = [
    { heading: 'Ingest your knowledge', body: 'Connect spreadsheets, PDFs, ticketing systems, and engineering notes. Boa structures every document, failure mode, and procedure automatically.' },
    { heading: 'Reason about failures', body: 'Deploy diagnostic agents trained on your devices, maintenance logs, and repair procedures. Agents identify root causes the way your best technician would.' },
    { heading: 'Recommend and resolve', body: 'From diagnosis to parts recommendation. Agents cross-reference your catalog and prescribe exactly what needs ordering, approval, and dispatch.' },
  ]

  return (
    <section id="how-it-works" ref={sectionRef} className="relative min-h-[200vh] border-b-2 border-[var(--border-default)]">
      <div className="sticky top-0 h-screen overflow-hidden">
        <ParticleField scrollSpeedRef={scrollSpeedRef} />
        <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
          <div className="text-center max-w-lg px-6">
              <AnimatePresence mode="wait">
              <motion.div
                key={activePanel}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.4 }}
              >
                <h2 className="font-display text-white" style={{ fontSize: 'clamp(2rem, 4vw, 3.5rem)' }}>
                  {panels[activePanel].heading}
                </h2>
                <p className="mt-4 font-mono-ui text-[12px] text-white/60 leading-relaxed tracking-widest">
                  {panels[activePanel].body}
                </p>
              </motion.div>
            </AnimatePresence>
            <div className="flex justify-center gap-px mt-10 bg-white/10 p-px w-fit mx-auto">
              {panels.map((_, i) => (
                <div
                  key={i}
                  className={`h-1 transition-all duration-300 ${i === activePanel ? 'w-12 bg-[var(--red)]' : 'w-4 bg-white/20'}`}
                  style={{ borderRadius: 0 }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ─── USE CASES ─── */
function UseCasesSection() {
  const cases = [
    { icon: Shield, industry: 'INDUSTRIAL', title: 'Reduce downtime', copy: 'Diagnostic agents diagnose failures in minutes instead of hours. Every moment counts when production is halted.' },
    { icon: Stethoscope, industry: 'MEDICAL DEVICES', title: 'Service quality', copy: 'Agents trained on clinical protocols and maintenance procedures. Consistent, reliable diagnostics across every technician and region.' },
    { icon: Crosshair, industry: 'IOT & ROBOTICS', title: 'Knowledge at scale', copy: 'Expertise captured once, deployed everywhere. New technicians diagnose with the competence of your most experienced engineers.' },
  ]

  return (
    <section id="use-cases" className="py-32 px-6 border-b-2 border-[var(--border-default)]">
      <div className="max-w-6xl mx-auto">
        <div>
          {cases.map((c, i) => (
            <FadeInSection key={i} delay={i * 0.1}>
              <div className="grid grid-cols-[120px_1fr_1fr] gap-8 py-8 border-b border-[var(--border-default)] last:border-0 items-start">
                <div>
                  <div className="w-9 h-9 border-2 border-[var(--red)] flex items-center justify-center mb-3">
                    <c.icon size={16} strokeWidth={2} className="text-[var(--red)]" />
                  </div>
                  <span className="font-mono-ui text-[12px] tracking-widest text-[var(--red)] uppercase font-bold">{c.industry}</span>
                </div>
                <h3 className="font-display text-[var(--text-primary)] text-base pt-1">{c.title}</h3>
                <p className="font-mono-ui text-[13px] text-[var(--text-secondary)] leading-relaxed">{c.copy}</p>
              </div>
            </FadeInSection>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ─── MANIFESTO / CTA ─── */
function ManifestoSection() {
  const navigate = useNavigate()

  return (
    <section id="manifesto" className="relative py-40 px-6 overflow-hidden border-b-2 border-[var(--border-default)]">
      {/* Background: snake scale image, heavy overlay */}
      <div className="absolute inset-0 z-0">
        <img src="/background.webp" alt="" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-black/80" />
      </div>

      <div className="relative z-10 text-center max-w-3xl mx-auto">
        <FadeInSection>
          <h2
            className="font-display text-white"
            style={{ fontSize: 'clamp(3rem, 8vw, 6rem)', letterSpacing: '-0.04em', lineHeight: 0.9 }}
          >
            Turn your operational knowledge into diagnostic intelligence.
          </h2>
          <p className="mt-8 font-mono-ui text-[13px] text-white/55 leading-relaxed max-w-lg mx-auto tracking-widest">
            Stop losing expertise in documents and ticket histories. Give every technician access to your organization's best knowledge.
          </p>
          <div className="mt-12 flex items-center justify-center">
            <a
              href="https://calendly.com/justin-shakergayen/30min"
              target="_blank"
              rel="noopener noreferrer"
              className="px-10 py-4 bg-[var(--red)] text-white font-mono-ui text-[12px] tracking-widest hover:bg-[#ff2a2a] transition-colors inline-block"
              style={{ borderRadius: 0 }}
            >
              BOOK A DEMO ›
            </a>
          </div>
        </FadeInSection>
      </div>
    </section>
  )
}

/* ─── FOOTER ─── */
function Footer() {
  return (
    <footer className="py-16 px-6 bg-[var(--surface)] border-t-2 border-[var(--border-default)]">
      <div className="max-w-6xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-12">
        <div className="col-span-2 md:col-span-1">
          <div className="mb-4">
            <div className="logo-pill" style={{ width: '80px', height: '30px' }}>
              <img src="/logo.png" alt="Boa" className="w-full h-full object-cover object-center" style={{ borderRadius: 0 }} />
            </div>
          </div>
          <p className="font-mono-ui text-[12px] text-[var(--text-muted)] uppercase tracking-widest leading-relaxed">
            Diagnostic AI for hardware companies.
          </p>
        </div>

      </div>

      <div className="max-w-6xl mx-auto mt-12 pt-6 border-t-2 border-[var(--border-default)]">
        <span className="font-mono-ui text-[12px] text-[var(--text-muted)] uppercase tracking-widest">© 2026 Boa. All rights reserved.</span>
      </div>
    </footer>
  )
}

/* ─── MAIN ─── */
export default function LandingPage() {
  return (
    <div className="bg-void min-h-screen">
      <LandingNav />
      <HeroSection />
      <ProblemSection />
      <DataSection />
      <WorkflowSection />
      <CustomizationSection />
      <PartsSection />
      <UseCasesSection />
      <ManifestoSection />
      <Footer />
    </div>
  )
}
