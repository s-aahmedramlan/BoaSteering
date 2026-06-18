import { useState } from 'react'
import { useNavigate, Link } from 'react-router'
import { motion } from 'framer-motion'
import { Input } from '@/components/ui/input'
import { UserPlus, Github, Chrome, CheckCircle } from 'lucide-react'

export default function SignupPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [orgName, setOrgName] = useState('')
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState(1)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (step === 1) { setStep(2); return }
    setLoading(true)
    await new Promise(r => setTimeout(r, 800))
    setLoading(false)
    navigate('/dashboard')
  }

  return (
    <div className="min-h-[100dvh] bg-void flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-sm"
      >
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex justify-center">
            <img src="/logoreal2.png" alt="Boa" style={{ width: '88px', height: '88px', objectFit: 'contain', borderRadius: 0 }} />
          </Link>
          <h1 className="mt-8 font-display text-xl text-[var(--text-primary)]">
            {step === 1 ? 'Create your account' : 'Set up your workspace'}
          </h1>
          <p className="mt-2 font-mono-ui text-[12px] text-[var(--text-muted)] tracking-wide">
            {step === 1 ? 'Start building organizational truth' : 'Almost there'}
          </p>
          <div className="flex justify-center gap-px mt-5 bg-[var(--border-default)] w-fit mx-auto">
            {[1, 2].map(s => (
              <div key={s} className={`h-1 transition-all ${s <= step ? 'w-8 bg-[#1a7a3a]' : 'w-4 bg-[var(--surface-elevated)]'}`} style={{ borderRadius: 0 }} />
            ))}
          </div>
        </div>

        {step === 1 && (
          <>
            <div className="space-y-px bg-[var(--border-default)]">
              <button
                className="w-full h-11 flex items-center justify-center gap-2 bg-[var(--surface)] text-[var(--text-primary)] font-mono-ui text-[12px] tracking-widest uppercase hover:bg-[var(--surface-elevated)] transition-colors"
                onClick={() => setStep(2)}
                style={{ borderRadius: 0 }}
              >
                <Chrome size={15} strokeWidth={2} />
                Continue with Google
              </button>
              <button
                className="w-full h-11 flex items-center justify-center gap-2 bg-[var(--surface)] text-[var(--text-primary)] font-mono-ui text-[12px] tracking-widest uppercase hover:bg-[var(--surface-elevated)] transition-colors"
                onClick={() => setStep(2)}
                style={{ borderRadius: 0 }}
              >
                <Github size={15} strokeWidth={2} />
                Continue with GitHub
              </button>
            </div>
            <div className="flex items-center gap-3 my-6">
              <div className="flex-1 border-t border-[var(--border-default)]" />
              <span className="font-mono-ui text-[12px] uppercase tracking-widest text-[var(--text-muted)]">or with email</span>
              <div className="flex-1 border-t border-[var(--border-default)]" />
            </div>
          </>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          {step === 1 ? (
            <>
              <div>
                <label className="block font-mono-ui text-[12px] uppercase tracking-widest text-[var(--text-muted)] mb-1.5">Work email</label>
                <Input type="email" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="you@company.com" className="h-10 input-clean" required />
              </div>
              <div>
                <label className="block font-mono-ui text-[12px] uppercase tracking-widest text-[var(--text-muted)] mb-1.5">Password</label>
                <Input type="password" value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="Min 8 characters" className="h-10 input-clean" required minLength={8} />
              </div>
            </>
          ) : (
            <motion.div initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.25 }}>
              <div>
                <label className="block font-mono-ui text-[12px] uppercase tracking-widest text-[var(--text-muted)] mb-1.5">Organization name</label>
                <Input type="text" value={orgName} onChange={e => setOrgName(e.target.value)}
                  placeholder="Acme Corp" className="h-10 input-clean" required />
              </div>
              <div className="mt-5 border border-[var(--border-default)] p-4 space-y-3">
                {['Connect your first integration', 'Invite your team', 'Start capturing truth'].map((item, i) => (
                  <div key={i} className="flex items-center gap-2.5 font-mono-ui text-[12px] text-[var(--text-secondary)]">
                    <CheckCircle size={13} strokeWidth={2} className="text-[var(--terminal-green)] shrink-0" />
                    {item}
                  </div>
                ))}
              </div>
            </motion.div>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full h-11 bg-[#1a7a3a] text-white font-mono-ui text-[12px] tracking-widest uppercase hover:bg-[#1e8f44] disabled:opacity-40 transition-colors flex items-center justify-center gap-2 mt-1"
            style={{ borderRadius: 0 }}
          >
            {loading ? 'Creating account...' : step === 1 ? 'Continue ›' : (<><UserPlus size={14} strokeWidth={2} />Create workspace</>)}
          </button>
        </form>

        <p className="mt-6 text-center font-mono-ui text-[12px] text-[var(--text-muted)] tracking-wide">
          Already have an account?{' '}
          <Link to="/login" className="text-[var(--text-primary)] underline underline-offset-2">Sign in</Link>
        </p>
      </motion.div>
    </div>
  )
}
