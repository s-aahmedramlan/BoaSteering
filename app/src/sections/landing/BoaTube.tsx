import { useRef, useMemo } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'

const vertexShader = `
  uniform float time;
  varying vec2 vUv;
  varying vec3 vNormal;
  varying float vDisplacement;

  void main() {
    vec3 pos = position;
    float t = time * 0.15;
    float angle = atan(pos.y, pos.x);
    float radius = length(pos.xy);

    float wave1 = sin(pos.z * 1.5 + t) * 0.4;
    float wave2 = sin(pos.z * 2.5 + t * 1.2 + angle * 2.0) * 0.3;
    float wave3 = sin(pos.z * 4.0 + t * 0.8 + angle * 3.0) * 0.15;

    float displacement = wave1 + wave2 + wave3;
    vDisplacement = displacement;
    pos.xy += normalize(pos.xy) * displacement;

    float twist = sin(pos.z * 0.5 + t * 0.3) * 0.3;
    float cosT = cos(twist);
    float sinT = sin(twist);
    pos.xy = mat2(cosT, -sinT, sinT, cosT) * pos.xy;

    vec4 worldPosition = modelMatrix * instanceMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * viewPosition * worldPosition;
    vUv = uv;
    vNormal = normalize(normalMatrix * normal);
  }
`

const fragmentShader = `
  precision mediump float;
  uniform float time;
  uniform vec3 color1;
  uniform vec3 color2;
  uniform vec3 color3;
  varying vec2 vUv;
  varying vec3 vNormal;
  varying float vDisplacement;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }

  void main() {
    float pattern = sin(vUv.y * 30.0 + vDisplacement * 5.0) * 0.5 + 0.5;
    float scalePattern = sin(vUv.x * 50.0 + vUv.y * 20.0) * 0.5 + 0.5;
    float noiseVal = noise(vUv * 10.0 + time * 0.05);

    float colorMix = pattern * scalePattern;
    vec3 baseColor = mix(color1, color2, colorMix);
    baseColor = mix(baseColor, color3, noiseVal * 0.3);

    float fresnel = pow(1.0 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 3.0);
    vec3 iridescent = vec3(0.1, 0.4, 0.3) * fresnel;
    baseColor += iridescent;

    vec3 lightDir = normalize(vec3(1.0, 1.0, 1.0));
    float diff = max(dot(vNormal, lightDir), 0.0);
    vec3 finalColor = baseColor * (0.6 + diff * 0.4);
    finalColor += iridescent * 0.5;

    float scales = sin(vUv.x * 100.0) * sin(vUv.y * 100.0);
    finalColor -= scales * 0.05;

    gl_FragColor = vec4(finalColor, 1.0);
  }
`

function TubeMesh() {
  const meshRef = useRef<THREE.InstancedMesh>(null)
  const materialRef = useRef<THREE.ShaderMaterial>(null)

  const { geometry, material } = useMemo(() => {
    const points: THREE.Vector3[] = []
    for (let i = 0; i < 8; i++) {
      points.push(new THREE.Vector3(
        (Math.random() - 0.5) * 14,
        (Math.random() - 0.5) * 14,
        Math.random() * 14
      ))
    }
    const path = new THREE.CatmullRomCurve3(points)
    const geo = new THREE.TubeGeometry(path, 128, 0.6, 32, false)
    const mat = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        time: { value: 0 },
        color1: { value: new THREE.Color(0.05, 0.25, 0.12) },
        color2: { value: new THREE.Color(0.08, 0.40, 0.28) },
        color3: { value: new THREE.Color(0.12, 0.55, 0.38) },
      },
      side: THREE.DoubleSide,
    })
    return { geometry: geo, material: mat }
  }, [])

  const matrices = useMemo(() => {
    const mats: THREE.Matrix4[] = []
    for (let i = 0; i < 8; i++) {
      const matrix = new THREE.Matrix4()
      const rotation = new THREE.Matrix4().makeRotationY((i * 0.05) * Math.PI * 2)
      const translation = new THREE.Matrix4().makeTranslation(
        Math.sin(i * 0.8) * 0.5,
        Math.cos(i * 0.6) * 0.3,
        0
      )
      matrix.multiply(translation).multiply(rotation)
      mats.push(matrix)
    }
    return mats
  }, [])

  useFrame(({ clock, camera }) => {
    if (materialRef.current) {
      materialRef.current.uniforms.time.value = clock.getElapsedTime()
    }
    const t = clock.getElapsedTime()
    camera.position.x = Math.sin(t * 0.1) * 3
    camera.position.y = Math.cos(t * 0.1) * 3
    camera.lookAt(0, 0, 0)
  })

  return (
    <instancedMesh ref={meshRef} args={[geometry, material, 8]}>
      {matrices.map((matrix, i) => (
        <primitive key={i} object={matrix} attach={`matrix-${i}`} />
      ))}
      <primitive object={material} ref={materialRef} attach="material" />
    </instancedMesh>
  )
}

export default function BoaTube() {
  return (
    <div className="absolute inset-0 z-0">
      <Canvas
        camera={{ position: [0, 0, 18], fov: 45 }}
        gl={{ antialias: true, alpha: true }}
        dpr={Math.min(window.devicePixelRatio, 2)}
      >
        <ambientLight intensity={0.3} />
        <directionalLight position={[5, 5, 5]} intensity={0.8} />
        <TubeMesh />
      </Canvas>
    </div>
  )
}
