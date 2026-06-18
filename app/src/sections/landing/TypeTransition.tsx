import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface PhrasePair {
  prefix: string
  suffix: string
}

const phrases: PhrasePair[] = [
  { prefix: 'Your agents have no', suffix: 'memory' },
  { prefix: 'Your knowledge is', suffix: 'trapped' },
  { prefix: 'Your team repeats', suffix: 'mistakes' },
  { prefix: 'Make your org', suffix: 'unforgettable' },
]

export default function TypeTransition() {
  const [index, setIndex] = useState(0)
  const [isVisible, setIsVisible] = useState(true)

  const cycle = useCallback(() => {
    setIsVisible(false)
    setTimeout(() => {
      setIndex(prev => (prev + 1) % phrases.length)
      setIsVisible(true)
    }, 600)
  }, [])

  useEffect(() => {
    const timer = setInterval(cycle, 3500)
    return () => clearInterval(timer)
  }, [cycle])

  const current = phrases[index]

  return (
    <div className="w-full max-w-[36rem] mx-auto flex items-center justify-center" style={{ height: '16rem' }}>
      <div className="text-center w-full">
        <AnimatePresence mode="wait">
          {isVisible && (
            <motion.div
              key={index}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5, ease: 'easeInOut' }}
            >
              <div className="font-display font-bold leading-tight" style={{ fontSize: 'clamp(2.5rem, 6vw, 4.5rem)', color: '#FFFFFF' }}>
                <span className="block">{current.prefix}</span>
                <motion.span
                  className="block"
                  style={{ color: '#E040C8' }}
                  initial={{ y: 30, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ duration: 0.5, delay: 0.1, ease: [0.25, 0.46, 0.45, 0.94] }}
                >
                  {current.suffix}
                </motion.span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
