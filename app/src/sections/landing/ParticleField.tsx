import { useRef, useEffect } from 'react'
import * as THREE from 'three'

const PARTICLE_COUNT = 6000

const vertexShader = `
  uniform float uTime;
  uniform float uScrollSpeed;
  attribute vec3 color;
  attribute float size;
  attribute vec3 random;
  varying vec3 vColor;

  void main() {
    vec3 pos = position;
    float t = uTime * 0.05;
    pos.x += sin(t * random.x + random.y * 6.28) * 0.05;
    pos.y += cos(t * random.y + random.z * 6.28) * 0.05;
    pos.z += sin(t * random.z + random.x * 6.28) * 0.05;
    pos.y -= uScrollSpeed * 0.3;
    pos.x += uScrollSpeed * random.z * 0.1;
    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    gl_PointSize = size * (15.0 / -mvPosition.z);
    gl_Position = projectionMatrix * mvPosition;
    vColor = color;
  }
`

const fragmentShader = `
  precision mediump float;
  varying vec3 vColor;
  uniform float uTime;

  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float dist = length(uv);
    if (dist > 0.5) discard;
    float glow = 1.0 - smoothstep(0.0, 0.5, dist);
    glow = pow(glow, 1.8);
    float pulse = sin(uTime * 2.0 + length(vColor) * 10.0) * 0.1 + 0.9;
    vec3 color = vColor * glow * pulse;
    gl_FragColor = vec4(color, glow);
  }
`

interface ParticleFieldProps {
  scrollSpeedRef: React.MutableRefObject<number>
}

export default function ParticleField({ scrollSpeedRef }: ParticleFieldProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const rafRef = useRef<number>(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false })
    renderer.setClearColor(0x0a0a0f)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    rendererRef.current = renderer

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100)
    camera.position.z = 5

    // Geometry
    const positions = new Float32Array(PARTICLE_COUNT * 3)
    const colors = new Float32Array(PARTICLE_COUNT * 3)
    const sizes = new Float32Array(PARTICLE_COUNT)
    const randoms = new Float32Array(PARTICLE_COUNT * 3)

    const boaColor = new THREE.Color(0.22, 0.74, 0.58) // #38bd94

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 8
      positions[i * 3 + 1] = (Math.random() - 0.5) * 8
      positions[i * 3 + 2] = (Math.random() - 0.5) * 8

      const randColor = new THREE.Color()
      randColor.setHSL(Math.random(), 0.6 + Math.random() * 0.4, 0.6 + Math.random() * 0.3)
      const finalColor = randColor.clone().multiplyScalar(0.6).add(boaColor.clone().multiplyScalar(0.4))
      colors[i * 3] = finalColor.r
      colors[i * 3 + 1] = finalColor.g
      colors[i * 3 + 2] = finalColor.b

      sizes[i] = 0.02 + Math.random() * 0.1

      randoms[i * 3] = Math.random()
      randoms[i * 3 + 1] = Math.random()
      randoms[i * 3 + 2] = Math.random()
    }

    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1))
    geometry.setAttribute('random', new THREE.BufferAttribute(randoms, 3))

    const material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        uTime: { value: 0 },
        uScrollSpeed: { value: 0 },
      },
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })

    const points = new THREE.Points(geometry, material)
    scene.add(points)

    const clock = new THREE.Clock()

    const resize = () => {
      const w = canvas.clientWidth
      const h = canvas.clientHeight
      renderer.setSize(w, h)
      camera.aspect = w / h
      camera.updateProjectionMatrix()
    }
    resize()
    window.addEventListener('resize', resize)

    const animate = () => {
      rafRef.current = requestAnimationFrame(animate)
      material.uniforms.uTime.value = clock.getElapsedTime()
      material.uniforms.uScrollSpeed.value += (scrollSpeedRef.current - material.uniforms.uScrollSpeed.value) * 0.05
      scrollSpeedRef.current *= 0.95

      // Reset particles that fall below
      const posArray = geometry.attributes.position.array as Float32Array
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        if (posArray[i * 3 + 1] < -4) {
          posArray[i * 3 + 1] = 4
        }
      }
      geometry.attributes.position.needsUpdate = true

      renderer.render(scene, camera)
    }
    animate()

    return () => {
      cancelAnimationFrame(rafRef.current)
      window.removeEventListener('resize', resize)
      geometry.dispose()
      material.dispose()
      renderer.dispose()
    }
  }, [scrollSpeedRef])

  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
}
