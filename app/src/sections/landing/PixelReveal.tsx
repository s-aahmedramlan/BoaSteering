import { useEffect, useRef } from 'react'

interface Props {
  src: string
  className?: string
  style?: React.CSSProperties
}

const STEPS = [32, 16, 8, 4, 2, 1]
const STEP_MS = 110

export default function PixelReveal({ src, className = '', style }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const img = new Image()
    img.src = src

    let stepIndex = 0
    let timer: ReturnType<typeof setTimeout>

    const drawStep = (w: number, h: number) => {
      const blockSize = STEPS[stepIndex]

      // Draw at reduced resolution then scale up — crisp blocks
      const off = document.createElement('canvas')
      off.width = Math.max(1, Math.ceil(w / blockSize))
      off.height = Math.max(1, Math.ceil(h / blockSize))
      const offCtx = off.getContext('2d')!
      offCtx.imageSmoothingEnabled = false
      offCtx.drawImage(img, 0, 0, off.width, off.height)

      ctx.imageSmoothingEnabled = false
      ctx.clearRect(0, 0, w, h)
      ctx.drawImage(off, 0, 0, w, h)

      stepIndex++
      if (stepIndex < STEPS.length) {
        timer = setTimeout(() => drawStep(w, h), STEP_MS)
      }
    }

    img.onload = () => {
      const dpr = window.devicePixelRatio || 1
      const w = canvas.offsetWidth
      const h = canvas.offsetHeight
      canvas.width = w * dpr
      canvas.height = h * dpr
      ctx.scale(dpr, dpr)
      drawStep(w, h)
    }

    return () => clearTimeout(timer)
  }, [src])

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{ imageRendering: 'pixelated', ...style }}
    />
  )
}
