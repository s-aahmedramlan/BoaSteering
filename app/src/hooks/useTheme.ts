import { useState, useEffect } from 'react'

export type Theme = 'light' | 'dark'

function applyTheme(theme: Theme) {
  document.documentElement.setAttribute('data-theme', theme)
  localStorage.setItem('boa-theme', theme)
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => {
    const stored = localStorage.getItem('boa-theme') as Theme | null
    if (stored) return stored
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  })

  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  // apply on mount before first paint
  useEffect(() => {
    const stored = localStorage.getItem('boa-theme') as Theme | null
    const initial = stored ?? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    applyTheme(initial as Theme)
    setTheme(initial as Theme)
  }, [])

  const toggle = () => setTheme(t => (t === 'light' ? 'dark' : 'light'))

  return { theme, toggle }
}
