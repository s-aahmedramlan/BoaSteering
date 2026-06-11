import { Outlet, useLocation, useNavigate } from 'react-router'
import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard,
  Brain,
  Sparkles,
  Settings,
  Search,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Sun,
  Moon,
} from 'lucide-react'
import { useTheme } from '@/hooks/useTheme'

const navItems = [
  { path: '/dashboard', label: 'DASHBOARD', icon: LayoutDashboard },
  { path: '/brain', label: 'BRAIN', icon: Brain },
  { path: '/ask', label: 'ASK AI', icon: Sparkles },
  { path: '/settings', label: 'SETTINGS', icon: Settings },
]

export default function AppShell() {
  const location = useLocation()
  const navigate = useNavigate()
  const [collapsed, setCollapsed] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const { theme, toggle: toggleTheme } = useTheme()

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setSearchOpen(prev => !prev)
      }
      if (e.key === 'Escape') {
        setSearchOpen(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const handleNav = useCallback((path: string) => {
    navigate(path)
  }, [navigate])

  return (
    <div className="flex min-h-[100dvh] w-screen overflow-hidden bg-void">
      <motion.aside
        initial={false}
        animate={{ width: collapsed ? 56 : 224 }}
        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        className="relative flex flex-col border-r-2 border-[var(--border-default)] bg-surface shrink-0"
        style={{ borderRadius: 0 }}
      >
        {/* LOGO */}
        <div className="border-b-2 border-[var(--border-default)] p-2">
          <button
            onClick={() => navigate('/dashboard')}
            className="block w-full"
            style={{ borderRadius: 0 }}
          >
            <img
              src="/logoreal2.png"
              alt="Boa"
              style={{ width: collapsed ? '48px' : '64px', height: collapsed ? '48px' : '64px', objectFit: 'contain', borderRadius: 0 }}
            />
          </button>
        </div>

        {/* SEARCH */}
        <div className="px-1.5 py-1.5 border-b border-[var(--border-subtle)]">
          <button
            onClick={() => setSearchOpen(true)}
            className="flex items-center gap-2 w-full px-2 py-1.5 transition-colors text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-black/[0.06]"
            style={{ borderRadius: 0 }}
          >
            <Search size={14} strokeWidth={2} />
            <AnimatePresence>
              {!collapsed && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center justify-between flex-1 min-w-0"
                >
                  <span className="font-mono-ui text-[12px] uppercase tracking-widest">Search</span>
                  <kbd className="font-mono-ui text-[12px] px-1 py-0.5 border border-[var(--border-default)] text-[var(--text-muted)]">⌘K</kbd>
                </motion.div>
              )}
            </AnimatePresence>
          </button>
        </div>

        {/* NAV */}
        <nav className="flex-1 px-1.5 py-2 space-y-px">
          {navItems.map(item => {
            const active = location.pathname === item.path
            const Icon = item.icon
            return (
              <button
                key={item.path}
                onClick={() => handleNav(item.path)}
                className={`flex items-center gap-2.5 w-full px-2 py-2 transition-colors duration-100 ${
                  active
                    ? 'bg-[var(--red)] text-[var(--void)]'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-black/[0.07]'
                }`}
                style={{ borderRadius: 0 }}
              >
                <Icon
                  size={15}
                  strokeWidth={2}
                  className="shrink-0"
                />
                <AnimatePresence>
                  {!collapsed && (
                    <motion.span
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="font-mono-ui text-[12px] tracking-widest uppercase whitespace-nowrap font-bold"
                    >
                      {item.label}
                    </motion.span>
                  )}
                </AnimatePresence>
              </button>
            )
          })}
        </nav>

        {/* THEME TOGGLE */}
        <div className="px-1.5 py-1.5 border-t border-[var(--border-subtle)]">
          <button
            onClick={toggleTheme}
            className="flex items-center gap-2.5 w-full px-2 py-2 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
            style={{ borderRadius: 0 }}
            title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
          >
            {theme === 'light'
              ? <Moon size={14} strokeWidth={2} />
              : <Sun size={14} strokeWidth={2} />
            }
            <AnimatePresence>
              {!collapsed && (
                <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="font-mono-ui text-[12px] uppercase tracking-widest whitespace-nowrap">
                  {theme === 'light' ? 'Dark mode' : 'Light mode'}
                </motion.span>
              )}
            </AnimatePresence>
          </button>
        </div>

        {/* SIGN OUT */}
        <div className="px-1.5 py-1.5 border-t-2 border-[var(--border-default)]">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2.5 w-full px-2 py-2 text-[var(--text-muted)] hover:text-[var(--red)] hover:bg-black/[0.05] transition-colors"
            style={{ borderRadius: 0 }}
          >
            <LogOut size={14} strokeWidth={2} />
            <AnimatePresence>
              {!collapsed && (
                <motion.span
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="font-mono-ui text-[12px] uppercase tracking-widest whitespace-nowrap"
                >
                  Sign Out
                </motion.span>
              )}
            </AnimatePresence>
          </button>
        </div>

        {/* COLLAPSE TOGGLE */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="absolute -right-3 top-16 w-6 h-6 bg-surface border-2 border-[var(--border-default)] flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[var(--red)] transition-colors z-10"
          style={{ borderRadius: 0 }}
        >
          {collapsed ? <ChevronRight size={10} strokeWidth={2.5} /> : <ChevronLeft size={10} strokeWidth={2.5} />}
        </button>
      </motion.aside>

      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>

      {/* SEARCH MODAL */}
      <AnimatePresence>
        {searchOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-start justify-center pt-[18vh] bg-black/70"
            onClick={() => setSearchOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.12 }}
              className="w-full max-w-lg border-2 border-[var(--red)] bg-[var(--surface)] overflow-hidden shadow-2xl"
              style={{ borderRadius: 0 }}
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 px-4 py-3 border-b-2 border-[var(--border-default)]">
                <span className="font-mono-ui text-[12px] text-[var(--red)] uppercase tracking-widest shrink-0">SEARCH //</span>
                <input
                  autoFocus
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="QUERY YOUR BRAIN..."
                  className="flex-1 bg-transparent text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none font-mono-ui text-sm uppercase tracking-widest"
                  style={{ borderRadius: 0 }}
                />
                <kbd className="font-mono-ui text-[12px] px-1.5 py-0.5 border border-[var(--border-default)] text-[var(--text-muted)]">ESC</kbd>
              </div>
              <div className="py-1">
                {[
                  { label: 'DASHBOARD', action: () => { navigate('/dashboard'); setSearchOpen(false) } },
                  { label: 'BRAIN', action: () => { navigate('/brain'); setSearchOpen(false) } },
                  { label: 'ASK AI', action: () => { navigate('/ask'); setSearchOpen(false) } },
                  { label: 'SETTINGS', action: () => { navigate('/settings'); setSearchOpen(false) } },
                ].map(item => (
                  <button
                    key={item.label}
                    onClick={item.action}
                    className="flex items-center w-full px-4 py-2.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-black/[0.07] transition-colors font-mono-ui text-[12px] tracking-widest uppercase"
                    style={{ borderRadius: 0 }}
                  >
                    <span className="text-[var(--red)] mr-2">›</span>
                    {item.label}
                  </button>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
