import { useState } from 'react'
import { useNavigate, Link } from 'react-router'
import { motion } from 'framer-motion'
import { Input } from '@/components/ui/input'
import { LogIn, Github, Chrome } from 'lucide-react'

export default function LoginPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
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
          <h1 className="mt-8 font-display text-xl text-[var(--text-primary)]">Welcome back</h1>
          <p className="mt-2 font-mono-ui text-[12px] text-[var(--text-muted)] tracking-wide">Sign in to your organization brain</p>
        </div>

        <div className="space-y-px bg-[var(--border-default)]">
          <button
            className="w-full h-11 flex items-center justify-center gap-2 bg-[var(--surface)] text-[var(--text-primary)] font-mono-ui text-[12px] tracking-widest uppercase hover:bg-[var(--surface-elevated)] transition-colors"
            onClick={() => navigate('/dashboard')}
            style={{ borderRadius: 0 }}
          >
            <Chrome size={15} strokeWidth={2} />
            Continue with Google
          </button>
          <button
            className="w-full h-11 flex items-center justify-center gap-2 bg-[var(--surface)] text-[var(--text-primary)] font-mono-ui text-[12px] tracking-widest uppercase hover:bg-[var(--surface-elevated)] transition-colors"
            onClick={() => navigate('/dashboard')}
            style={{ borderRadius: 0 }}
          >
            <Github size={15} strokeWidth={2} />
            Continue with GitHub
          </button>
        </div>

        <div className="flex items-center gap-3 my-6">
          <div className="flex-1 border-t border-[var(--border-default)]" />
          <span className="font-mono-ui text-[12px] uppercase tracking-widest text-[var(--text-muted)]">or</span>
          <div className="flex-1 border-t border-[var(--border-default)]" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block font-mono-ui text-[12px] uppercase tracking-widest text-[var(--text-muted)] mb-1.5">Email</label>
            <Input type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="you@company.com" className="h-10 input-clean" required />
          </div>
          <div>
            <label className="block font-mono-ui text-[12px] uppercase tracking-widest text-[var(--text-muted)] mb-1.5">Password</label>
            <Input type="password" value={password} onChange={e => setPassword(e.target.value)}
              placeholder="••••••••" className="h-10 input-clean" required />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full h-11 bg-[#1a7a3a] text-white font-mono-ui text-[12px] tracking-widest uppercase hover:bg-[#1e8f44] disabled:opacity-40 transition-colors flex items-center justify-center gap-2"
            style={{ borderRadius: 0 }}
          >
            {loading ? 'Signing in...' : (<><LogIn size={14} strokeWidth={2} />Sign in</>)}
          </button>
        </form>

        <p className="mt-6 text-center font-mono-ui text-[12px] text-[var(--text-muted)] tracking-wide">
          No account?{' '}
          <Link to="/signup" className="text-[var(--text-primary)] underline underline-offset-2">
            Get started
          </Link>
        </p>
      </motion.div>
    </div>
  )
}
