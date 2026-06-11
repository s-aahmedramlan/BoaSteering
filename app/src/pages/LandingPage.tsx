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
            { label: 'PRODUCT', id: 'product' },
            { label: 'HOW IT WORKS', id: 'how-it-works' },
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

          <button
            className="px-3 py-2 font-mono-ui text-[13px] tracking-widest transition-colors border ml-1"
            style={{
              color: scrolled ? 'var(--text-muted)' : 'rgba(255,255,255,0.75)',
              borderColor: scrolled ? 'var(--border-default)' : 'rgba(255,255,255,0.25)',
              borderRadius: 0,
            }}
            onClick={() => navigate('/login')}
          >
            LOG IN
          </button>
          <button
            className="px-4 py-2 bg-[var(--red)] text-white font-mono-ui text-[13px] tracking-widest hover:opacity-90 transition-opacity ml-px"
            onClick={() => navigate('/signup')}
            style={{ borderRadius: 0 }}
          >
            GET STARTED
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

        {/* Cycling type headline */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.55 }}
        >
          <TypeTransition />
        </motion.div>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.9 }}
          className="mt-6 font-mono-ui text-[12px] tracking-widest max-w-md mx-auto leading-relaxed"
          style={{ color: 'rgba(255,255,255,0.72)' }}
        >
          Every rule signed. Every source tracked. Every agent in sync.
        </motion.p>

        {/* CTA row */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 1.1 }}
          className="mt-10 flex items-center gap-px"
        >
          <button
            className="px-8 py-3 bg-[var(--red)] text-white font-mono-ui text-[12px] tracking-widest hover:bg-[#ff2a2a] transition-colors"
            onClick={() => navigate('/signup')}
            style={{ borderRadius: 0 }}
          >
            GET STARTED ›
          </button>
          <button
            className="px-8 py-3 font-mono-ui text-[12px] tracking-widest transition-colors"
            style={{ color: 'rgba(255,255,255,0.7)', borderRadius: 0 }}
            onMouseEnter={e => { (e.target as HTMLElement).style.color = '#ffffff' }}
            onMouseLeave={e => { (e.target as HTMLElement).style.color = 'rgba(255,255,255,0.7)' }}
          >
            WATCH DEMO
          </button>
        </motion.div>

      </div>
    </section>
  )
}

/* ─── PROBLEM ─── */
function ProblemSection() {
  const stats = [
    { value: '4.2 HRS', subtext: 'Average dev time lost to re-prompting per day' },
    { value: '73%', subtext: 'Org rules never formalized or tracked' },
    { value: '3×', subtext: 'Increase in repeated mistakes across teams' },
  ]

  return (
    <section id="problem" className="py-32 px-6 border-b-2 border-[var(--border-default)]">
      <div className="max-w-6xl mx-auto grid md:grid-cols-[55%_45%] gap-16 items-center">
        <FadeInSection>
          <h2
            className="font-display text-[var(--text-primary)]"
            style={{ fontSize: 'clamp(2rem, 4vw, 3rem)' }}
          >
            Institutional knowledge dies in the cracks
          </h2>
          <p className="mt-5 font-mono-ui text-[13px] text-[var(--text-secondary)] leading-relaxed max-w-[55ch] tracking-wide">
            Developers waste hours re-prompting agents with information other agents already learned. Rules live in Slack threads, Jira comments, code review notes — unsigned, untracked, forgotten.
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

/* ─── PRODUCT ─── */
function ProductSection() {
  return (
    <section id="product" className="py-32 px-6 bg-[var(--surface)] border-b-2 border-[var(--border-default)]">
      <div className="max-w-6xl mx-auto">
        <FadeInSection className="mb-12">
          <h2 className="font-display text-[var(--text-primary)]" style={{ fontSize: 'clamp(2rem, 4vw, 3rem)' }}>
            Your company's brain, finally organized
          </h2>
          <p className="mt-4 font-mono-ui text-[13px] text-[var(--text-secondary)] max-w-xl leading-relaxed tracking-wide">
            Boa sits between your developers and their agents, turning fragmented data into verified organizational memory every agent can pull from.
          </p>
          <div className="flex flex-wrap gap-px mt-6 bg-[var(--border-default)]">
            {[
              { label: 'Verified rules', icon: CheckCircle },
              { label: 'Source tracking', icon: Link2 },
              { label: 'Agent sync', icon: RefreshCw },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-2 bg-[var(--void)] px-4 py-2">
                <item.icon size={13} strokeWidth={2} className="text-[var(--red)]" />
                <span className="font-mono-ui text-[12px] uppercase tracking-widest text-[var(--text-secondary)]">{item.label}</span>
              </div>
            ))}
          </div>
        </FadeInSection>

        <FadeInSection delay={0.2}>
          <div className="border-2 border-[var(--border-default)] overflow-hidden">
            <img
              src="/docs-mockup.jpg"
              alt="Boa documentation interface"
              className="w-full"
            />
          </div>
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
    { heading: 'Ingest everything', body: 'Connect GitHub, Jira, Slack, and Confluence. Boa indexes every rule, decision, and pattern automatically.' },
    { heading: 'Verify and sign', body: 'Every rule is cryptographically signed by its author. Track lineage, ownership, and confidence at a glance.' },
    { heading: 'Sync to every agent', body: 'One developer teaches Boa once. Every agent on your team pulls from the same verified source of truth.' },
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
    { icon: Shield, industry: 'FINTECH', title: 'Verified decision trails', copy: 'Every policy decision traced to its source. Stakeholders see the full chain from rule to agent behavior.' },
    { icon: Stethoscope, industry: 'HEALTHCARE', title: 'Clinical protocols', copy: 'Treatment guidelines signed by medical directors. Agents never suggest outdated procedures.' },
    { icon: Crosshair, industry: 'DEFENSE', title: 'Mission-critical systems', copy: 'Classification-aware knowledge routing. The right agents access the right rules at the right time.' },
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
            Organizational truth, liberated.
          </h2>
          <p className="mt-8 font-mono-ui text-[13px] text-white/55 leading-relaxed max-w-lg mx-auto tracking-widest">
            A dynamic, verified memory for organizational truth. An agent armed with Boa operates with knowledge liberated from your organization.
          </p>
          <div className="mt-12 flex items-center justify-center gap-px">
            <button
              className="px-10 py-4 bg-[var(--red)] text-white font-mono-ui text-[12px] tracking-widest hover:bg-[#ff2a2a] transition-colors"
              onClick={() => navigate('/signup')}
              style={{ borderRadius: 0 }}
            >
              GET STARTED ›
            </button>
            <button
              className="px-10 py-4 border-2 border-white/25 text-white/60 font-mono-ui text-[12px] tracking-widest hover:border-white/50 hover:text-white transition-colors"
              style={{ borderRadius: 0 }}
            >
              TALK TO SALES
            </button>
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
            Verified organizational truth for AI agents.
          </p>
        </div>

        {[
          { title: 'PRODUCT', links: ['Features', 'Integrations', 'Security', 'Pricing'] },
          { title: 'COMPANY', links: ['About', 'Blog', 'Careers', 'Contact'] },
          { title: 'RESOURCES', links: ['Docs', 'API Reference', 'Status', 'Changelog'] },
        ].map((col, i) => (
          <div key={i}>
            <h4 className="font-mono-ui text-[12px] font-bold text-[var(--text-muted)] tracking-widest uppercase mb-4">{col.title}</h4>
            <ul className="space-y-2">
              {col.links.map(link => (
                <li key={link}>
                  <span className="font-mono-ui text-[12px] text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer transition-colors uppercase tracking-wider">{link}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="max-w-6xl mx-auto mt-12 pt-6 border-t-2 border-[var(--border-default)] flex flex-col md:flex-row justify-between items-center gap-4">
        <span className="font-mono-ui text-[12px] text-[var(--text-muted)] uppercase tracking-widest">© 2026 Boa. All rights reserved.</span>
        <div className="flex gap-4">
          {['GitHub', 'Twitter', 'LinkedIn'].map(social => (
            <span key={social} className="font-mono-ui text-[12px] text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer transition-colors uppercase tracking-widest">{social}</span>
          ))}
        </div>
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
      <ProductSection />
      <HowItWorksSection />
      <UseCasesSection />
      <ManifestoSection />
      <Footer />
    </div>
  )
}
