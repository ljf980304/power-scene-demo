import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import type { Device, DeviceStatus } from '@/types'

export interface SceneStats {
  fps: number
  calls: number
  triangles: number
}

export interface SceneCallbacks {
  onHover?: (device: Device | null) => void
  onSelect?: (device: Device | null) => void
  onStats?: (stats: SceneStats) => void
}

export type SceneScenario = 'substation' | 'transmission'

const STATUS_COLORS: Record<DeviceStatus, number> = {
  normal: 0x4aa3ff,
  warning: 0xffb340,
  fault: 0xff5b6a,
  offline: 0x8c98a4,
}

const SUN_DIRECTION = new THREE.Vector3(-0.42, 0.55, -0.5).normalize()
const SKY_TOP = new THREE.Color('#2c5f8d')
const SKY_HORIZON = new THREE.Color('#dbe5eb')
const SUN_COLOR = new THREE.Color('#fff0cc')
const FOG_COLOR = new THREE.Color('#b7c7d4')

interface SurfaceTextures {
  map: THREE.CanvasTexture
  bump: THREE.CanvasTexture
}

function clampChannel(value: number): number {
  return value < 0 ? 0 : value > 255 ? 255 : value
}

function createNoiseCanvas(size: number, base: [number, number, number], variance: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) return canvas

  const image = ctx.createImageData(size, size)
  const data = image.data
  for (let i = 0; i < data.length; i += 4) {
    const noise = (Math.random() - 0.5) * variance
    data[i] = clampChannel(base[0] + noise)
    data[i + 1] = clampChannel(base[1] + noise)
    data[i + 2] = clampChannel(base[2] + noise)
    data[i + 3] = 255
  }
  ctx.putImageData(image, 0, 0)
  return canvas
}

function createSurfaceTexture(
  base: [number, number, number],
  repeat: number,
  variance: number,
  stains: number,
): SurfaceTextures {
  const size = 512
  const canvas = createNoiseCanvas(size, base, variance)
  const ctx = canvas.getContext('2d')
  if (ctx) {
    for (let i = 0; i < stains; i += 1) {
      const x = Math.random() * size
      const y = Math.random() * size
      const radius = 24 + Math.random() * 110
      const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius)
      const dark = Math.random() > 0.45
      gradient.addColorStop(0, dark ? 'rgba(38,38,38,0.16)' : 'rgba(255,255,255,0.08)')
      gradient.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = gradient
      ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2)
    }
  }

  const map = new THREE.CanvasTexture(canvas)
  map.wrapS = THREE.RepeatWrapping
  map.wrapT = THREE.RepeatWrapping
  map.repeat.set(repeat, repeat)
  map.colorSpace = THREE.SRGBColorSpace
  map.anisotropy = 8

  const bump = new THREE.CanvasTexture(createNoiseCanvas(256, [128, 128, 128], 44))
  bump.wrapS = THREE.RepeatWrapping
  bump.wrapT = THREE.RepeatWrapping
  bump.repeat.set(repeat, repeat)
  bump.anisotropy = 4

  return { map, bump }
}

function createChainLinkTexture(repeatX: number): THREE.CanvasTexture {
  const size = 128
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (ctx) {
    ctx.clearRect(0, 0, size, size)
    ctx.strokeStyle = 'rgba(150, 158, 164, 0.95)'
    ctx.lineWidth = 2.5
    for (let i = -size; i < size * 2; i += 16) {
      ctx.beginPath()
      ctx.moveTo(i, 0)
      ctx.lineTo(i + size, size)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(i + size, 0)
      ctx.lineTo(i, size)
      ctx.stroke()
    }
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.repeat.set(repeatX, 1)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

function createRoadTexture(): THREE.CanvasTexture {
  const size = 128
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (ctx) {
    const image = ctx.createImageData(size, size)
    for (let i = 0; i < image.data.length; i += 4) {
      const value = 54 + Math.random() * 16
      image.data[i] = value
      image.data[i + 1] = value + 2
      image.data[i + 2] = value + 5
      image.data[i + 3] = 255
    }
    ctx.putImageData(image, 0, 0)

    ctx.fillStyle = 'rgba(226, 218, 178, 0.8)'
    for (let x = 4; x < size; x += 34) {
      ctx.fillRect(x, size / 2 - 1.5, 18, 3)
    }
    ctx.fillStyle = 'rgba(232, 234, 236, 0.5)'
    ctx.fillRect(0, 4, size, 1.5)
    ctx.fillRect(0, size - 5, size, 1.5)
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 8
  return texture
}

function createFacadeTexture(): THREE.CanvasTexture {
  const size = 256
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (ctx) {
    ctx.fillStyle = '#9aa0a3'
    ctx.fillRect(0, 0, size, size)
    for (let i = 0; i < 500; i += 1) {
      ctx.fillStyle = `rgba(0, 0, 0, ${Math.random() * 0.05})`
      ctx.fillRect(Math.random() * size, Math.random() * size, 3, 3)
    }

    const cols = 4
    const rows = 4
    const margin = 10
    const cellWidth = (size - margin * 2) / cols
    const cellHeight = (size - margin * 2) / rows

    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        const x = margin + col * cellWidth + cellWidth * 0.18
        const y = margin + row * cellHeight + cellHeight * 0.2
        const width = cellWidth * 0.64
        const height = cellHeight * 0.55
        const lit = Math.random() > 0.82
        ctx.fillStyle = lit ? 'rgba(198, 214, 220, 0.9)' : 'rgba(45, 64, 76, 0.92)'
        ctx.fillRect(x, y, width, height)
        ctx.strokeStyle = 'rgba(228, 232, 234, 0.35)'
        ctx.lineWidth = 1
        ctx.strokeRect(x, y, width, height)
      }
    }
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 4
  return texture
}

function createFieldTexture(): THREE.CanvasTexture {
  const size = 256
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (ctx) {
    ctx.fillStyle = '#a9ad7e'
    ctx.fillRect(0, 0, size, size)

    // 作物垄沟
    for (let y = 6; y < size; y += 18) {
      ctx.fillStyle = 'rgba(92, 84, 52, 0.32)'
      ctx.fillRect(0, y, size, 4)
      ctx.fillStyle = 'rgba(220, 222, 170, 0.12)'
      ctx.fillRect(0, y + 5, size, 2)
    }

    for (let i = 0; i < 700; i += 1) {
      ctx.fillStyle = `rgba(70, 66, 42, ${Math.random() * 0.18})`
      ctx.fillRect(Math.random() * size, Math.random() * size, 2, 2)
    }
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 4
  return texture
}

function createStainTexture(): THREE.CanvasTexture {
  const size = 256
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (ctx) {
    for (let i = 0; i < 5; i += 1) {
      const x = size / 2 + (Math.random() - 0.5) * 54
      const y = size / 2 + (Math.random() - 0.5) * 54
      const radius = size * (0.22 + Math.random() * 0.2)
      const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius)
      gradient.addColorStop(0, 'rgba(20, 18, 15, 0.42)')
      gradient.addColorStop(0.6, 'rgba(20, 18, 15, 0.22)')
      gradient.addColorStop(1, 'rgba(20, 18, 15, 0)')
      ctx.fillStyle = gradient
      ctx.fillRect(0, 0, size, size)
    }
  }
  return new THREE.CanvasTexture(canvas)
}

function createContactShadowTexture(): THREE.CanvasTexture {
  const size = 256
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (ctx) {
    const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
    gradient.addColorStop(0, 'rgba(0,0,0,0.6)')
    gradient.addColorStop(0.45, 'rgba(0,0,0,0.32)')
    gradient.addColorStop(0.75, 'rgba(0,0,0,0.09)')
    gradient.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, size, size)
  }
  return new THREE.CanvasTexture(canvas)
}

function createStrut(from: THREE.Vector3, to: THREE.Vector3, material: THREE.Material): THREE.Mesh {
  const direction = new THREE.Vector3().subVectors(to, from)
  const length = direction.length()
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, length, 6), material)
  mesh.position.copy(from).add(to).multiplyScalar(0.5)
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize())
  mesh.castShadow = true
  return mesh
}

export class SceneManager {
  private readonly container: HTMLElement
  private readonly devices: Device[]
  private readonly callbacks: SceneCallbacks
  private readonly scenario: SceneScenario

  private readonly defaultCameraPosition = new THREE.Vector3()
  private readonly defaultTarget = new THREE.Vector3()

  private readonly scene = new THREE.Scene()
  private readonly camera = new THREE.PerspectiveCamera(38, 1, 0.1, 900)
  private readonly renderer: THREE.WebGLRenderer
  private controls!: OrbitControls
  private composer!: EffectComposer
  private bloomPass!: UnrealBloomPass
  private envTarget: THREE.WebGLRenderTarget | null = null

  private readonly raycaster = new THREE.Raycaster()
  private readonly pointer = new THREE.Vector2()
  private readonly clock = new THREE.Clock()
  private pointerDownAt: { x: number; y: number } | null = null

  private readonly groups = new Map<string, THREE.Group>()
  private readonly pickables: THREE.Object3D[] = []
  private readonly pulseGroups: THREE.Group[] = []
  private readonly flowMaterials: THREE.MeshBasicMaterial[] = []

  private hoveredId: string | null = null
  private selectedId: string | null = null
  private selectedHelper: THREE.BoxHelper | null = null

  private frameId = 0
  private statsElapsed = 0
  private frameCount = 0
  private disposed = false

  private readonly resizeObserver: ResizeObserver

  private readonly textures = {
    asphalt: createSurfaceTexture([74, 78, 82], 8, 22, 18),
    concrete: createSurfaceTexture([150, 146, 138], 10, 15, 16),
    metal: createSurfaceTexture([190, 194, 198], 3, 12, 8),
    grass: createSurfaceTexture([96, 100, 78], 56, 18, 12),
  }

  private readonly concreteMaterial = new THREE.MeshStandardMaterial({
    map: this.textures.concrete.map,
    bumpMap: this.textures.concrete.bump,
    bumpScale: 0.004,
    roughness: 0.94,
    metalness: 0.04,
  })

  private readonly padMaterial = new THREE.MeshStandardMaterial({
    map: this.textures.concrete.map,
    bumpMap: this.textures.concrete.bump,
    bumpScale: 0.01,
    color: 0xbdb8ae,
    roughness: 0.95,
    metalness: 0.02,
  })

  private readonly shadowMaterial = new THREE.MeshBasicMaterial({
    map: createContactShadowTexture(),
    transparent: true,
    depthWrite: false,
    opacity: 0.75,
  })

  private readonly shadowGeometry = new THREE.PlaneGeometry(1, 1)

  constructor(
    container: HTMLElement,
    devices: Device[],
    callbacks: SceneCallbacks = {},
    scenario: SceneScenario = 'substation',
  ) {
    this.container = container
    this.devices = devices
    this.callbacks = callbacks
    this.scenario = scenario

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.setClearColor(FOG_COLOR, 1)
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 0.96
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.info.autoReset = false
    container.appendChild(this.renderer.domElement)

    this.buildScene()
    this.bindEvents()

    this.resizeObserver = new ResizeObserver(() => this.resize())
    this.resizeObserver.observe(container)
    this.resize()
    this.animate()
  }

  private buildScene() {
    if (this.scenario === 'transmission') {
      this.defaultCameraPosition.set(66, 40, 120)
      this.defaultTarget.set(0, 6, -8)
    } else {
      this.defaultCameraPosition.set(26, 15, 29)
      this.defaultTarget.set(0, 3, 0)
    }
    this.camera.position.copy(this.defaultCameraPosition)

    this.controls = new OrbitControls(this.camera, this.renderer.domElement)
    this.controls.target.copy(this.defaultTarget)
    this.controls.enableDamping = true
    this.controls.dampingFactor = 0.08
    this.controls.minDistance = 9
    this.controls.maxDistance = this.scenario === 'transmission' ? 260 : 170
    this.controls.maxPolarAngle = Math.PI * 0.47
    this.controls.update()

    this.setupEnvironment()

    if (this.scenario === 'transmission') {
      this.buildTransmissionScene()
    } else {
      this.buildGround()
      this.buildGroundDetails()
      this.buildDevices()
      this.buildBusbars()
      this.buildFence()
      this.buildControlBuilding()
      this.buildLampPosts()
      this.buildSurroundings()
      this.buildTrees()
      this.buildTransmissionLine()
    }

    this.setupComposer()
  }

  private setupEnvironment() {
    this.scene.fog = new THREE.Fog(FOG_COLOR, 110, 360)

    const sky = this.createSkyDome()
    this.scene.add(sky)

    const envScene = new THREE.Scene()
    const envSky = this.createSkyDome()
    envScene.add(envSky)
    const pmrem = new THREE.PMREMGenerator(this.renderer)
    this.envTarget = pmrem.fromScene(envScene, 0.04, 0.1, 1200)
    this.scene.environment = this.envTarget.texture
    this.scene.environmentIntensity = 0.65
    pmrem.dispose()
    envSky.geometry.dispose()
    ;(envSky.material as THREE.Material).dispose()

    const hemisphere = new THREE.HemisphereLight(0xd8e6f2, 0x6d6558, 0.4)
    this.scene.add(hemisphere)

    const sun = new THREE.DirectionalLight(0xfff0d6, 2.95)
    sun.position.copy(SUN_DIRECTION).multiplyScalar(100)
    sun.castShadow = true
    sun.shadow.mapSize.set(2048, 2048)
    sun.shadow.camera.near = 1
    sun.shadow.camera.far = 260
    sun.shadow.camera.left = -55
    sun.shadow.camera.right = 55
    sun.shadow.camera.top = 55
    sun.shadow.camera.bottom = -55
    sun.shadow.bias = -0.0004
    sun.shadow.normalBias = 0.035
    this.scene.add(sun)

    const fill = new THREE.DirectionalLight(0x9fc4e5, 0.4)
    fill.position.set(45, 25, 60)
    this.scene.add(fill)
  }

  private createSkyDome(): THREE.Mesh {
    const geometry = new THREE.SphereGeometry(450, 32, 20)
    const material = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        topColor: { value: SKY_TOP },
        horizonColor: { value: SKY_HORIZON },
        sunColor: { value: SUN_COLOR },
        sunDirection: { value: SUN_DIRECTION },
      },
      vertexShader: /* glsl */ `
        varying vec3 vWorldPosition;
        void main() {
          vec4 worldPosition = modelMatrix * vec4(position, 1.0);
          vWorldPosition = worldPosition.xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 topColor;
        uniform vec3 horizonColor;
        uniform vec3 sunColor;
        uniform vec3 sunDirection;
        varying vec3 vWorldPosition;

        void main() {
          vec3 direction = normalize(vWorldPosition);
          float height = clamp(direction.y, 0.0, 1.0);
          vec3 color = mix(horizonColor, topColor, pow(height, 0.58));

          float sun = max(dot(direction, normalize(sunDirection)), 0.0);
          color += sunColor * pow(sun, 420.0) * 4.0;
          color += sunColor * pow(sun, 14.0) * 0.22;

          float aboveGround = smoothstep(-0.12, 0.02, direction.y);
          color = mix(vec3(0.19, 0.20, 0.21), color, aboveGround);
          gl_FragColor = vec4(color, 1.0);
        }
      `,
    })
    const sky = new THREE.Mesh(geometry, material)
    sky.frustumCulled = false
    return sky
  }

  private setupComposer() {
    const target = new THREE.WebGLRenderTarget(1, 1, {
      type: THREE.HalfFloatType,
      samples: 4,
    })
    this.composer = new EffectComposer(this.renderer, target)
    this.composer.addPass(new RenderPass(this.scene, this.camera))
    this.bloomPass = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.28, 0.55, 0.85)
    this.composer.addPass(this.bloomPass)
    this.composer.addPass(new OutputPass())
  }

  private buildGround() {
    const roadMap = this.textures.asphalt.map.clone()
    roadMap.repeat.set(8, 1)
    roadMap.needsUpdate = true
    const roadBump = this.textures.asphalt.bump.clone()
    roadBump.repeat.set(8, 1)
    roadBump.needsUpdate = true
    const asphaltMaterial = new THREE.MeshStandardMaterial({
      map: roadMap,
      bumpMap: roadBump,
      bumpScale: 0.02,
      roughness: 0.97,
      metalness: 0.02,
    })

    const drivewayMap = this.textures.asphalt.map.clone()
    drivewayMap.repeat.set(1.5, 7)
    drivewayMap.needsUpdate = true
    const drivewayBump = this.textures.asphalt.bump.clone()
    drivewayBump.repeat.set(1.5, 7)
    drivewayBump.needsUpdate = true
    const drivewayMaterial = new THREE.MeshStandardMaterial({
      map: drivewayMap,
      bumpMap: drivewayBump,
      bumpScale: 0.02,
      roughness: 0.97,
      metalness: 0.02,
    })

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(400, 400),
      new THREE.MeshStandardMaterial({
        map: this.textures.grass.map,
        bumpMap: this.textures.grass.bump,
        bumpScale: 0.03,
        roughness: 1,
        metalness: 0,
      }),
    )
    ground.rotation.x = -Math.PI / 2
    ground.receiveShadow = true
    this.scene.add(ground)

    const apron = new THREE.Mesh(new THREE.PlaneGeometry(48, 48), this.concreteMaterial)
    apron.rotation.x = -Math.PI / 2
    apron.position.y = 0.02
    apron.receiveShadow = true
    this.scene.add(apron)

    // 进站道路,从南侧围栏外延伸到场地
    const driveway = new THREE.Mesh(new THREE.PlaneGeometry(7, 34), drivewayMaterial)
    driveway.rotation.x = -Math.PI / 2
    driveway.position.set(0, 0.008, 41)
    driveway.receiveShadow = true
    this.scene.add(driveway)

    const road = new THREE.Mesh(new THREE.PlaneGeometry(48, 6), asphaltMaterial)
    road.rotation.x = -Math.PI / 2
    road.position.set(0, 0.03, 13)
    road.receiveShadow = true
    this.scene.add(road)

    const lineMaterial = new THREE.MeshStandardMaterial({
      color: 0xd8b13c,
      roughness: 0.8,
      metalness: 0.05,
    })
    for (const z of [2.2, 5.8]) {
      const line = new THREE.Mesh(new THREE.PlaneGeometry(46, 0.14), lineMaterial)
      line.rotation.x = -Math.PI / 2
      line.position.set(0, 0.045, z)
      this.scene.add(line)
    }

    const trench = new THREE.Mesh(
      new THREE.BoxGeometry(42, 0.06, 0.9),
      new THREE.MeshStandardMaterial({ color: 0x3d444a, roughness: 0.92, metalness: 0.05 }),
    )
    trench.position.set(0, 0.05, -0.2)
    trench.receiveShadow = true
    this.scene.add(trench)
  }

  private buildGroundDetails() {
    const stainMaterial = new THREE.MeshStandardMaterial({
      map: createStainTexture(),
      color: 0x2c2823,
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
      roughness: 1,
      metalness: 0,
    })

    const stains: Array<[number, number, number, number, number]> = [
      [1.2, -1.4, 3.2, 2.2, 0.4],
      [9.4, -1.2, 2.6, 1.8, -0.3],
      [-2.6, 6.2, 2.2, 1.6, 0.2],
      [5.5, 13.2, 3.4, 1.4, 0.75],
      [-11, 2, 1.8, 1.2, -0.5],
    ]
    const details = new THREE.Group()
    for (const [x, z, width, depth, rotation] of stains) {
      const stain = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), stainMaterial)
      stain.rotation.x = -Math.PI / 2
      stain.rotation.z = rotation
      stain.position.set(x, 0.085, z)
      details.add(stain)
    }

    const manholeMaterial = new THREE.MeshStandardMaterial({
      color: 0x3c4247,
      metalness: 0.6,
      roughness: 0.5,
    })
    for (const [x, z] of [
      [-13, 16],
      [14, 1],
      [-6, 10],
    ]) {
      const cover = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.03, 20), manholeMaterial)
      cover.position.set(x, 0.07, z)
      cover.receiveShadow = true
      details.add(cover)
    }

    mergeGroupMeshes(details)
    this.scene.add(details)
  }

  private buildDevices() {
    const pads = new THREE.Group()
    for (const device of this.devices) {
      if (device.type === 'busbar') continue

      const group = this.createDevice(device)
      group.position.set(...device.position)
      group.userData.deviceId = device.id
      group.userData.baseEmissive = this.baseIntensityFor(device.status)
      this.groups.set(device.id, group)
      this.scene.add(group)
      this.registerPickable(group, device.id)

      this.addPad(device, pads)

      if (device.status === 'fault') {
        this.pulseGroups.push(group)
      }
    }

    mergeGroupMeshes(pads)
    this.scene.add(pads)
  }

  private addPad(device: Device, parent: THREE.Group) {
    let width = 0
    let depth = 0
    switch (device.type) {
      case 'transformer':
        width = 5.4
        depth = 4.2
        break
      case 'switchgear':
        width = 4.8
        depth = 2.4
        break
      case 'tower':
        width = 5.6
        depth = 5.6
        break
      default:
        return
    }

    const [x, , z] = device.position
    const pad = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), this.padMaterial)
    pad.rotation.x = -Math.PI / 2
    pad.position.set(x, 0.06, z)
    pad.receiveShadow = true
    parent.add(pad)

    const shadow = new THREE.Mesh(this.shadowGeometry, this.shadowMaterial)
    shadow.rotation.x = -Math.PI / 2
    shadow.position.set(x, 0.075, z)
    shadow.scale.set(width * 0.92, depth * 0.92, 1)
    parent.add(shadow)
  }

  private registerPickable(group: THREE.Group, deviceId: string) {
    group.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.userData.deviceId = deviceId
        this.pickables.push(object)
      }
    })
  }

  private createDevice(device: Device): THREE.Group {
    switch (device.type) {
      case 'transformer':
        return this.createTransformer(device)
      case 'switchgear':
        return this.createSwitchgear(device)
      case 'tower':
        return this.createTower(device)
      default:
        return new THREE.Group()
    }
  }

  private roundedBox(width: number, height: number, depth: number, radius = 0.04): THREE.BufferGeometry {
    return new RoundedBoxGeometry(width, height, depth, 2, radius)
  }

  private surfaceMaterial(
    device: Device,
    color: number,
    roughness = 0.5,
    metalness = 0.55,
  ): THREE.MeshStandardMaterial {
    return new THREE.MeshStandardMaterial({
      color,
      map: this.textures.metal.map,
      bumpMap: this.textures.metal.bump,
      bumpScale: 0.012,
      metalness,
      roughness,
      emissive: STATUS_COLORS[device.status],
      emissiveIntensity: this.baseIntensityFor(device.status),
    })
  }

  private porcelainMaterial(): THREE.MeshStandardMaterial {
    return new THREE.MeshStandardMaterial({
      color: 0x8d8375,
      roughness: 0.35,
      metalness: 0.08,
    })
  }

  private phaseMaterial(index: number): THREE.MeshStandardMaterial {
    const colors = [0x9c8a5c, 0x6a8574, 0x8f6a63]
    return new THREE.MeshStandardMaterial({
      color: colors[index % colors.length],
      roughness: 0.45,
      metalness: 0.3,
    })
  }

  private statusLampMaterial(device: Device): THREE.MeshStandardMaterial {
    const color = STATUS_COLORS[device.status]
    const material = new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 2.4,
      roughness: 0.25,
      metalness: 0.1,
    })
    material.userData.statusLight = true
    return material
  }

  private createTransformer(device: Device): THREE.Group {
    const group = new THREE.Group()
    const body = this.surfaceMaterial(device, 0x9fa8ad, 0.52, 0.45)
    const dark = this.surfaceMaterial(device, 0x6e777d, 0.55, 0.6)
    const porcelain = this.porcelainMaterial()

    const base = new THREE.Mesh(this.roundedBox(3.9, 0.32, 2.7, 0.04), dark)
    base.position.y = 0.16
    base.castShadow = true
    base.receiveShadow = true
    group.add(base)

    const tank = new THREE.Mesh(this.roundedBox(3.4, 2.3, 2.2, 0.09), body)
    tank.position.y = 1.6
    tank.castShadow = true
    tank.receiveShadow = true
    group.add(tank)

    for (const side of [-1, 1]) {
      for (let i = 0; i < 7; i += 1) {
        const fin = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.7, 1.9), dark)
        fin.position.set(side * 1.92, 1.55, -0.69 + i * 0.23)
        fin.castShadow = true
        group.add(fin)
      }
      for (const y of [0.66, 2.44]) {
        const header = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 2.0, 10), dark)
        header.rotation.x = Math.PI / 2
        header.position.set(side * 1.92, y, 0)
        header.castShadow = true
        group.add(header)
      }
    }

    const conservator = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 2.4, 20), body)
    conservator.rotation.z = Math.PI / 2
    conservator.position.set(0, 3.52, -0.62)
    conservator.castShadow = true
    group.add(conservator)

    for (const x of [-0.7, 0.7]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.55, 0.1), dark)
      leg.position.set(x, 3.2, -0.62)
      leg.castShadow = true
      group.add(leg)
    }

    for (let i = 0; i < 3; i += 1) {
      const x = -1.05 + i * 1.05
      const core = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 1.15, 12), porcelain)
      core.position.set(x, 3.3, 0.1)
      core.castShadow = true
      group.add(core)

      for (let s = 0; s < 5; s += 1) {
        const shed = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.21, 0.06, 14), porcelain)
        shed.position.set(x, 2.85 + s * 0.17, 0.1)
        shed.castShadow = true
        group.add(shed)
      }

      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.12, 10), dark)
      cap.position.set(x, 3.93, 0.1)
      group.add(cap)
    }

    const cabinet = new THREE.Mesh(this.roundedBox(0.78, 1.35, 0.55, 0.03), dark)
    cabinet.position.set(2.05, 0.95, 0.7)
    cabinet.castShadow = true
    group.add(cabinet)

    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 12), this.statusLampMaterial(device))
    lamp.position.set(2.05, 1.55, 0.99)
    group.add(lamp)

    mergeGroupMeshes(group)
    return group
  }

  private createSwitchgear(device: Device): THREE.Group {
    const group = new THREE.Group()
    const body = this.surfaceMaterial(device, 0xa7afb6, 0.5, 0.5)
    const dark = this.surfaceMaterial(device, 0x5f686e, 0.5, 0.65)
    const lampMaterial = this.statusLampMaterial(device)

    const plinth = new THREE.Mesh(this.roundedBox(4.5, 0.25, 1.6, 0.03), this.padMaterial)
    plinth.position.y = 0.125
    plinth.castShadow = true
    plinth.receiveShadow = true
    group.add(plinth)

    for (let i = 0; i < 3; i += 1) {
      const x = i * 1.32 - 1.32
      const cabinet = new THREE.Mesh(this.roundedBox(1.15, 2.0, 1.0, 0.05), body)
      cabinet.position.set(x, 1.25, 0)
      cabinet.castShadow = true
      cabinet.receiveShadow = true
      group.add(cabinet)

      const door = new THREE.Mesh(new THREE.BoxGeometry(0.92, 1.7, 0.03), dark)
      door.position.set(x, 1.3, 0.505)
      door.castShadow = true
      group.add(door)

      const handle = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.3, 0.05), dark)
      handle.position.set(x + 0.33, 1.35, 0.55)
      group.add(handle)

      const indicator = new THREE.Mesh(new THREE.SphereGeometry(0.075, 12, 12), lampMaterial)
      indicator.position.set(x, 1.78, 0.56)
      group.add(indicator)

      for (let v = 0; v < 4; v += 1) {
        const vent = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.03, 0.02), dark)
        vent.position.set(x, 0.75 + v * 0.09, 0.525)
        group.add(vent)
      }
    }

    const tray = new THREE.Mesh(new THREE.BoxGeometry(4.0, 0.12, 0.72), dark)
    tray.position.y = 2.32
    tray.castShadow = true
    group.add(tray)

    for (let i = 0; i < 3; i += 1) {
      const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 3.4, 10), this.phaseMaterial(i))
      pipe.rotation.z = Math.PI / 2
      pipe.position.set(0, 2.46, -0.22 + i * 0.22)
      pipe.castShadow = true
      group.add(pipe)
    }

    mergeGroupMeshes(group)
    return group
  }

  private createTower(device: Device): THREE.Group {
    const group = new THREE.Group()
    const steel = this.surfaceMaterial(device, 0x8b9399, 0.42, 0.72)
    const porcelain = this.porcelainMaterial()
    const height = 11
    const baseHalf = 1.9
    const topHalf = 0.5

    const corners = (y: number, half: number) => [
      new THREE.Vector3(-half, y, -half),
      new THREE.Vector3(half, y, -half),
      new THREE.Vector3(half, y, half),
      new THREE.Vector3(-half, y, half),
    ]

    const bottom = corners(0, baseHalf)
    const top = corners(height, topHalf)

    for (let i = 0; i < 4; i += 1) {
      const foundation = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.5, 1.0), this.concreteMaterial)
      foundation.position.set(bottom[i].x, 0.25, bottom[i].z)
      foundation.castShadow = true
      foundation.receiveShadow = true
      group.add(foundation)

      group.add(createStrut(bottom[i], top[i], steel))
      group.add(createStrut(bottom[i], top[(i + 1) % 4], steel))
    }

    for (const y of [3.4, 6.4, 9.2]) {
      const ratio = y / height
      const half = THREE.MathUtils.lerp(baseHalf, topHalf, ratio)
      const ring = corners(y, half)
      for (let i = 0; i < 4; i += 1) {
        group.add(createStrut(ring[i], ring[(i + 1) % 4], steel))
      }
    }

    for (const y of [7.4, 9.6]) {
      const armWidth = 7.6 - y * 0.2
      const arm = new THREE.Mesh(new THREE.BoxGeometry(armWidth, 0.12, 0.12), steel)
      arm.position.set(0, y, 0)
      arm.castShadow = true
      group.add(arm)

      for (const x of [-armWidth * 0.42, 0, armWidth * 0.42]) {
        group.add(createStrut(new THREE.Vector3(x, y, 0), new THREE.Vector3(0, y + 1.1, 0), steel))

        const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.55, 8), steel)
        rod.position.set(x, y - 0.28, 0)
        group.add(rod)

        for (let s = 0; s < 4; s += 1) {
          const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.05, 10), porcelain)
          disc.position.set(x, y - 0.12 - s * 0.11, 0)
          disc.castShadow = true
          group.add(disc)
        }
      }
    }

    mergeGroupMeshes(group)
    return group
  }

  private buildBusbars() {
    const texture = createFlowTexture()
    const flowMaterial = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
    })
    this.flowMaterials.push(flowMaterial)

    for (const device of this.devices) {
      if (device.type !== 'busbar') continue

      const [x, y, z] = device.position
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(x - 20, y, z),
        new THREE.Vector3(x - 9, y + 0.7, z),
        new THREE.Vector3(x, y + 1, z),
        new THREE.Vector3(x + 9, y + 0.7, z),
        new THREE.Vector3(x + 20, y, z),
      ])

      const group = new THREE.Group()
      group.userData.deviceId = device.id
      group.userData.baseEmissive = 0.03

      const shell = new THREE.Mesh(
        new THREE.TubeGeometry(curve, 96, 0.12, 12, false),
        new THREE.MeshStandardMaterial({
          color: 0xaeb6bb,
          metalness: 0.82,
          roughness: 0.38,
          emissive: STATUS_COLORS[device.status],
          emissiveIntensity: 0.03,
        }),
      )
      shell.castShadow = true
      group.add(shell)

      const flow = new THREE.Mesh(new THREE.TubeGeometry(curve, 96, 0.095, 10, false), flowMaterial)
      group.add(flow)

      this.groups.set(device.id, group)
      this.scene.add(group)
      this.registerPickable(group, device.id)
      this.addBusbarSupports(curve, z)

      if (device.status === 'fault') {
        this.pulseGroups.push(group)
      }
    }
  }

  private addBusbarSupports(curve: THREE.CatmullRomCurve3, z: number) {
    const steel = new THREE.MeshStandardMaterial({ color: 0x7d858b, metalness: 0.7, roughness: 0.45 })
    const porcelain = this.porcelainMaterial()
    const group = new THREE.Group()

    for (const offset of [-16, -8, 0, 8, 16]) {
      const t = (offset + 20) / 40
      const point = curve.getPointAt(t)
      const baseY = 0.35
      const topY = point.y - 0.16
      const insulatorBottom = topY - 1.5
      const columnHeight = Math.max(0.7, insulatorBottom - baseY)

      const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.42, 0.5, 10), this.concreteMaterial)
      foot.position.set(point.x, 0.25, z)
      foot.castShadow = true
      foot.receiveShadow = true
      group.add(foot)

      // 钢管支柱 + 顶部支柱绝缘子,符合 110kV 户外配电装置的常见结构
      const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.15, columnHeight, 10), steel)
      rod.position.set(point.x, baseY + columnHeight / 2, z)
      rod.castShadow = true
      group.add(rod)

      for (let s = 0; s < 8; s += 1) {
        const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.055, 12), porcelain)
        disc.position.set(point.x, insulatorBottom + 0.12 + s * 0.17, z)
        disc.castShadow = true
        group.add(disc)
      }

      const clamp = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.12, 0.3), steel)
      clamp.position.set(point.x, topY, z)
      clamp.castShadow = true
      group.add(clamp)
    }

    mergeGroupMeshes(group)
    this.scene.add(group)
  }

  private buildFence() {
    const half = 24
    const steel = new THREE.MeshStandardMaterial({ color: 0x6d767c, metalness: 0.7, roughness: 0.45 })
    this.addFenceSide(-half, -half, half, -half, 2.15, steel)
    this.addFenceSide(half, -half, half, half, 2.15, steel)
    this.addFenceSide(half, half, -half, half, 2.15, steel)
    this.addFenceSide(-half, half, -half, -half, 2.15, steel)
  }

  private addFenceSide(
    x1: number,
    z1: number,
    x2: number,
    z2: number,
    height: number,
    steel: THREE.MeshStandardMaterial,
  ) {
    const dx = x2 - x1
    const dz = z2 - z1
    const length = Math.hypot(dx, dz)
    const angle = Math.atan2(dz, dx)
    const midX = (x1 + x2) / 2
    const midZ = (z1 + z2) / 2

    const frame = new THREE.Group()
    for (const railY of [0.12, 1.05, height - 0.06]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(length, 0.07, 0.07), steel)
      rail.position.set(midX, railY, midZ)
      rail.rotation.y = -angle
      rail.castShadow = true
      frame.add(rail)
    }

    const count = Math.max(2, Math.round(length / 3))
    for (let i = 0; i <= count; i += 1) {
      const t = i / count
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.14, height, 0.14), steel)
      post.position.set(x1 + dx * t, height / 2, z1 + dz * t)
      post.castShadow = true
      frame.add(post)
    }
    mergeGroupMeshes(frame)
    this.scene.add(frame)

    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(length, height - 0.2),
      new THREE.MeshStandardMaterial({
        map: createChainLinkTexture(length / 2.4),
        transparent: true,
        alphaTest: 0.35,
        side: THREE.DoubleSide,
        color: 0xc8ced2,
        metalness: 0.5,
        roughness: 0.6,
      }),
    )
    mesh.position.set(midX, (height - 0.2) / 2 + 0.1, midZ)
    mesh.rotation.y = -angle
    this.scene.add(mesh)
  }

  private buildControlBuilding() {
    const group = new THREE.Group()

    const body = new THREE.Mesh(this.roundedBox(14, 6, 6, 0.06), this.concreteMaterial)
    body.position.y = 3
    body.castShadow = true
    body.receiveShadow = true
    group.add(body)

    const roof = new THREE.Mesh(
      new THREE.BoxGeometry(14.6, 0.35, 6.6),
      new THREE.MeshStandardMaterial({ color: 0x59636a, metalness: 0.15, roughness: 0.85 }),
    )
    roof.position.y = 6.2
    roof.castShadow = true
    group.add(roof)

    const glass = new THREE.MeshStandardMaterial({
      color: 0x54707f,
      metalness: 0.35,
      roughness: 0.35,
      emissive: 0x0a1a24,
      emissiveIntensity: 0.3,
    })
    const band = new THREE.Mesh(new THREE.BoxGeometry(14.06, 1.0, 6.06), glass)
    band.position.y = 4.55
    group.add(band)

    const doorMaterial = new THREE.MeshStandardMaterial({ color: 0x4c565d, metalness: 0.6, roughness: 0.4 })
    const door = new THREE.Mesh(new THREE.BoxGeometry(1.5, 2.3, 0.08), doorMaterial)
    door.position.set(4.2, 1.15, 3.04)
    group.add(door)

    const mullion = new THREE.MeshStandardMaterial({ color: 0x2b343a, metalness: 0.45, roughness: 0.5 })
    for (let i = 0; i < 8; i += 1) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.09, 1.04, 6.1), mullion)
      bar.position.set(-6.3 + i * 1.8, 4.55, 0)
      bar.castShadow = true
      group.add(bar)
    }

    const canopy = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.16, 1.3), doorMaterial)
    canopy.position.set(4.2, 2.7, 3.55)
    canopy.castShadow = true
    group.add(canopy)

    mergeGroupMeshes(group)
    group.position.set(-12, 0, -20)
    this.scene.add(group)
  }

  private buildLampPosts() {
    const steel = new THREE.MeshStandardMaterial({ color: 0x747d83, metalness: 0.7, roughness: 0.4 })
    const headMaterial = new THREE.MeshStandardMaterial({
      color: 0xd8dde0,
      emissive: 0xfff3d6,
      emissiveIntensity: 0.12,
      roughness: 0.4,
    })

    for (const x of [-21, 21]) {
      const group = new THREE.Group()
      const direction = x < 0 ? 1 : -1

      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 7.5, 10), steel)
      pole.position.y = 3.75
      pole.castShadow = true
      group.add(pole)

      const arm = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.08, 0.08), steel)
      arm.position.set(direction * 1.0, 7.45, 0)
      arm.castShadow = true
      group.add(arm)

      const head = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.16, 0.32), headMaterial)
      head.position.set(direction * 1.95, 7.36, 0)
      head.castShadow = true
      group.add(head)

      group.position.set(x, 0, -6)
      this.scene.add(group)
    }
  }

  private buildSurroundings() {
    this.buildRoads()
    this.buildCityBlocks()
    this.buildNeighborSubstation()
    this.buildStreetLights()
    this.buildVehicles()
  }

  private buildRoads() {
    const addRoad = (length: number, width: number, x: number, z: number, rotationZ: number) => {
      const map = createRoadTexture()
      map.repeat.set(length / 24, 1)
      const material = new THREE.MeshStandardMaterial({ map, roughness: 0.95, metalness: 0.02 })
      const road = new THREE.Mesh(new THREE.PlaneGeometry(length, width), material)
      road.rotation.x = -Math.PI / 2
      road.rotation.z = rotationZ
      road.position.set(x, 0.016, z)
      road.receiveShadow = true
      this.scene.add(road)
    }

    addRoad(240, 12, 0, 45, 0)
    addRoad(200, 10, 60, 0, Math.PI / 2)

    const sidewalkMaterial = new THREE.MeshStandardMaterial({ color: 0x9c9890, roughness: 0.95 })
    const sidewalks = new THREE.Group()
    for (const z of [37.8, 52.2]) {
      // 在进站道路处断开,避免人行道横穿站前引道
      for (const x of [-62, 62]) {
        const sidewalk = new THREE.Mesh(new THREE.PlaneGeometry(116, 1.6), sidewalkMaterial)
        sidewalk.rotation.x = -Math.PI / 2
        sidewalk.position.set(x, 0.02, z)
        sidewalk.receiveShadow = true
        sidewalks.add(sidewalk)
      }
    }
    for (const x of [54.2, 65.8]) {
      const sidewalk = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 200), sidewalkMaterial)
      sidewalk.rotation.x = -Math.PI / 2
      sidewalk.position.set(x, 0.02, 0)
      sidewalk.receiveShadow = true
      sidewalks.add(sidewalk)
    }
    mergeGroupMeshes(sidewalks)
    this.scene.add(sidewalks)
  }

  private buildCityBlocks() {
    const facadeTexture = createFacadeTexture()
    const facadeMaterials = [0x9aa1a4, 0xb0a79b, 0x8a949a].map((color, index) => {
      const map = facadeTexture.clone()
      map.repeat.set(2 + (index % 2), 3 + (index % 3))
      map.needsUpdate = true
      return new THREE.MeshStandardMaterial({ map, color, roughness: 0.85, metalness: 0.05 })
    })
    const roofMaterial = new THREE.MeshStandardMaterial({ color: 0x5c646a, roughness: 0.9, metalness: 0.08 })

    // x, z, width, depth, height
    const blocks: Array<[number, number, number, number, number]> = [
      [-52, -48, 12, 10, 18],
      [-68, -56, 10, 9, 24],
      [-40, -66, 16, 12, 12],
      [34, -52, 14, 10, 20],
      [44, -64, 12, 12, 15],
      [82, -48, 18, 14, 9],
      [-88, -16, 14, 12, 16],
      [-96, 4, 12, 10, 22],
      [-78, 22, 16, 12, 11],
      [86, 8, 24, 16, 8],
      [112, 22, 22, 14, 7],
      [104, -8, 18, 14, 10],
      [-20, 66, 12, 10, 18],
      [-4, 76, 14, 12, 22],
      [18, 64, 10, 10, 14],
      [42, 72, 16, 12, 10],
      [76, 60, 12, 12, 16],
      [-64, 70, 14, 10, 12],
      [-84, 84, 18, 12, 9],
      [-120, 40, 16, 14, 12],
      [-130, -20, 14, 12, 8],
      // 远景楼群,利用雾效形成城市天际线,避免远处只剩空地
      [-30, -170, 20, 16, 30],
      [12, -192, 24, 18, 38],
      [64, -166, 18, 16, 26],
      [-92, -182, 20, 20, 32],
      [124, -172, 16, 14, 22],
      [-152, -122, 22, 18, 24],
      [162, -84, 20, 18, 20],
      [152, 62, 18, 16, 24],
      [-164, 82, 20, 16, 28],
      [6, 150, 20, 16, 26],
      [-54, 138, 18, 16, 20],
    ]

    const city = new THREE.Group()
    blocks.forEach(([x, z, width, depth, height], index) => {
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(width, height, depth),
        facadeMaterials[index % facadeMaterials.length],
      )
      mesh.position.set(x, height / 2, z)
      city.add(mesh)

      const roof = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), roofMaterial)
      roof.rotation.x = -Math.PI / 2
      roof.position.set(x, height + 0.02, z)
      city.add(roof)

      if (height > 14 && index % 2 === 0) {
        const cap = new THREE.Mesh(new THREE.BoxGeometry(width * 0.28, 1.4, depth * 0.28), roofMaterial)
        cap.position.set(x + width * 0.18, height + 0.7, z - depth * 0.12)
        city.add(cap)
      }
    })

    mergeGroupMeshes(city)
    this.scene.add(city)
  }

  private fakeDevice(type: Device['type'], position: [number, number, number], status: DeviceStatus): Device {
    return {
      id: `CTX-${type}-${position[0]}-${position[2]}`,
      name: '场景设备',
      type,
      status,
      voltage: 110,
      current: 0,
      load: 0,
      lng: 0,
      lat: 0,
      position,
    }
  }

  private buildNeighborSubstation() {
    const centerX = -78
    const centerZ = -38
    const group = new THREE.Group()

    const pad = new THREE.Mesh(new THREE.PlaneGeometry(30, 22), this.padMaterial)
    pad.rotation.x = -Math.PI / 2
    pad.position.y = 0.02
    pad.receiveShadow = true
    group.add(pad)

    const transformerSpecs: Array<[number, number, DeviceStatus]> = [
      [-6, -2, 'normal'],
      [6, -2, 'warning'],
    ]
    for (const [lx, lz, status] of transformerSpecs) {
      const transformer = this.createTransformer(this.fakeDevice('transformer', [lx, 0, lz], status))
      transformer.position.set(lx, 0, lz)
      group.add(transformer)

      const padShadow = new THREE.Mesh(this.shadowGeometry, this.shadowMaterial)
      padShadow.rotation.x = -Math.PI / 2
      padShadow.position.set(lx, 0.05, lz)
      padShadow.scale.set(4.8, 3.8, 1)
      group.add(padShadow)
    }

    const steel = new THREE.MeshStandardMaterial({ color: 0x7d858b, metalness: 0.7, roughness: 0.45 })
    const porcelain = this.porcelainMaterial()
    const busbarMaterial = new THREE.MeshStandardMaterial({
      color: 0xaeb6bb,
      metalness: 0.82,
      roughness: 0.38,
    })

    const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 26, 10), busbarMaterial)
    tube.rotation.z = Math.PI / 2
    tube.position.set(0, 5.4, -8)
    tube.castShadow = true
    group.add(tube)

    for (const bx of [-9, 0, 9]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 4.9, 8), steel)
      post.position.set(bx, 2.45, -8)
      group.add(post)
      for (let s = 0; s < 5; s += 1) {
        const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.05, 10), porcelain)
        disc.position.set(bx, 4.7 + s * 0.16, -8)
        group.add(disc)
      }
    }

    const building = new THREE.Group()
    const body = new THREE.Mesh(new THREE.BoxGeometry(9, 3.4, 4.5), this.concreteMaterial)
    body.position.y = 1.7
    body.castShadow = true
    body.receiveShadow = true
    building.add(body)
    const glass = new THREE.Mesh(
      new THREE.BoxGeometry(9.06, 0.7, 4.56),
      new THREE.MeshStandardMaterial({ color: 0x54707f, roughness: 0.35, metalness: 0.35 }),
    )
    glass.position.y = 2.6
    building.add(glass)
    building.position.set(-8, 0, 8)
    group.add(building)

    mergeGroupMeshes(group)
    group.position.set(centerX, 0, centerZ)
    this.scene.add(group)

    const halfX = 15
    const halfZ = 11
    this.addFenceSide(centerX - halfX, centerZ - halfZ, centerX + halfX, centerZ - halfZ, 2, steel)
    this.addFenceSide(centerX + halfX, centerZ - halfZ, centerX + halfX, centerZ + halfZ, 2, steel)
    this.addFenceSide(centerX + halfX, centerZ + halfZ, centerX - halfX, centerZ + halfZ, 2, steel)
    this.addFenceSide(centerX - halfX, centerZ + halfZ, centerX - halfX, centerZ - halfZ, 2, steel)
  }

  private buildStreetLights() {
    const steel = new THREE.MeshStandardMaterial({ color: 0x747d83, metalness: 0.7, roughness: 0.4 })
    const headMaterial = new THREE.MeshStandardMaterial({
      color: 0xd8dde0,
      emissive: 0xfff3d6,
      emissiveIntensity: 0.12,
      roughness: 0.4,
    })

    const lights = new THREE.Group()
    for (const x of [-80, -40, 20, 80]) {
      const group = new THREE.Group()

      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.11, 6.8, 8), steel)
      pole.position.y = 3.4
      pole.castShadow = true
      group.add(pole)

      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 1.4), steel)
      arm.position.set(0, 6.7, -0.7)
      group.add(arm)

      const head = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.14, 0.7), headMaterial)
      head.position.set(0, 6.6, -1.4)
      group.add(head)

      group.position.set(x, 0, 54)
      lights.add(group)
    }

    mergeGroupMeshes(lights)
    this.scene.add(lights)
  }

  private buildVehicles() {
    const wheelMaterial = new THREE.MeshStandardMaterial({ color: 0x1f2427, roughness: 0.9 })
    const glassMaterial = new THREE.MeshStandardMaterial({ color: 0x263b48, metalness: 0.6, roughness: 0.2 })

    const addCar = (color: number, x: number, z: number, rotation: number) => {
      const group = new THREE.Group()
      const bodyMaterial = new THREE.MeshStandardMaterial({ color, metalness: 0.55, roughness: 0.35 })

      const body = new THREE.Mesh(new RoundedBoxGeometry(4.2, 0.85, 1.8, 2, 0.12), bodyMaterial)
      body.position.y = 0.82
      body.castShadow = true
      group.add(body)

      const cabin = new THREE.Mesh(new RoundedBoxGeometry(2.0, 0.7, 1.55, 2, 0.1), glassMaterial)
      cabin.position.set(-0.25, 1.5, 0)
      cabin.castShadow = true
      group.add(cabin)

      for (const wx of [-1.4, 1.4]) {
        for (const wz of [-0.86, 0.86]) {
          const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.24, 12), wheelMaterial)
          wheel.rotation.x = Math.PI / 2
          wheel.position.set(wx, 0.34, wz)
          group.add(wheel)
        }
      }

      mergeGroupMeshes(group)
      group.position.set(x, 0, z)
      group.rotation.y = rotation
      this.scene.add(group)
    }

    addCar(0xd7dbde, 12, 13.2, 0)
    addCar(0x8e3b3b, 60, 30, Math.PI / 2)
    addCar(0x3d5b7a, 60, -18, Math.PI / 2)
  }

  private buildTransmissionScene() {
    this.buildRuralGround()
    this.buildDevices()
    this.buildTransmissionWires()
    this.buildFarmland()
    this.buildVillage()
    this.buildRuralTrees()
    this.buildHills()
  }

  private buildRuralGround() {
    // 大范围地面单独调整贴图重复与旋转,避免明显的网格状重复
    const grassMap = this.textures.grass.map.clone()
    grassMap.repeat.set(26, 26)
    grassMap.center.set(0.5, 0.5)
    grassMap.rotation = 0.38
    grassMap.needsUpdate = true
    const grassBump = this.textures.grass.bump.clone()
    grassBump.repeat.set(26, 26)
    grassBump.center.set(0.5, 0.5)
    grassBump.rotation = 0.38
    grassBump.needsUpdate = true

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(600, 600),
      new THREE.MeshStandardMaterial({
        map: grassMap,
        bumpMap: grassBump,
        bumpScale: 0.03,
        roughness: 1,
        metalness: 0,
      }),
    )
    ground.rotation.x = -Math.PI / 2
    ground.receiveShadow = true
    this.scene.add(ground)

    // 沿线路走向的巡线检修道路
    const pathMap = this.textures.concrete.map.clone()
    pathMap.repeat.set(2, 60)
    pathMap.needsUpdate = true
    const pathBump = this.textures.concrete.bump.clone()
    pathBump.repeat.set(2, 60)
    pathBump.needsUpdate = true
    const path = new THREE.Mesh(
      new THREE.PlaneGeometry(5, 420),
      new THREE.MeshStandardMaterial({
        map: pathMap,
        bumpMap: pathBump,
        bumpScale: 0.02,
        color: 0xb9ab92,
        roughness: 0.98,
        metalness: 0.02,
      }),
    )
    path.rotation.x = -Math.PI / 2
    path.position.set(9, 0.016, 0)
    path.receiveShadow = true
    this.scene.add(path)
  }

  private buildTransmissionWires() {
    const wireMaterial = new THREE.MeshStandardMaterial({ color: 0x2e3439, metalness: 0.4, roughness: 0.7 })
    const wires = new THREE.Group()
    const towers = this.devices
      .filter((device) => device.type === 'tower')
      .slice()
      .sort((a, b) => a.position[2] - b.position[2])

    for (let i = 0; i < towers.length - 1; i += 1) {
      const from = towers[i].position
      const to = towers[i + 1].position

      for (const y of [7.4, 9.6]) {
        const armWidth = 7.6 - y * 0.2
        for (const offset of [-armWidth * 0.42, 0, armWidth * 0.42]) {
          const start = new THREE.Vector3(from[0] + offset, y, from[2])
          const end = new THREE.Vector3(to[0] + offset, y, to[2])
          const mid = new THREE.Vector3(
            (start.x + end.x) / 2,
            y - 1.9,
            (start.z + end.z) / 2,
          )
          const curve = new THREE.CatmullRomCurve3([start, mid, end])
          wires.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 26, 0.035, 5, false), wireMaterial))
        }
      }
    }

    mergeGroupMeshes(wires)
    this.scene.add(wires)
  }

  private buildFarmland() {
    const fieldTexture = createFieldTexture()
    const fieldColors = [0x9aa06b, 0x8f9a63, 0xa8a878, 0x7f8f5d]
    const materials = fieldColors.map(
      (color) =>
        new THREE.MeshStandardMaterial({
          map: fieldTexture,
          color,
          roughness: 1,
          metalness: 0,
        }),
    )

    // x, z, width, depth, 材质序号
    const patches: Array<[number, number, number, number, number]> = [
      [-120, -95, 50, 36, 0],
      [-120, -45, 50, 36, 1],
      [-120, 5, 50, 36, 2],
      [-120, 55, 50, 36, 3],
      [-120, 105, 50, 36, 0],
      [112, -100, 52, 40, 1],
      [112, -40, 52, 40, 0],
      [112, 30, 52, 40, 2],
      [112, 80, 52, 40, 3],
      [-40, 150, 70, 40, 2],
      [50, 140, 60, 36, 1],
      // 线路附近的田块,避免空旷草地过于单调
      [58, -70, 44, 30, 3],
      [62, -8, 44, 30, 0],
      [56, 56, 44, 30, 2],
      [-40, -72, 40, 28, 1],
      [-42, 74, 40, 28, 3],
    ]

    const fields = new THREE.Group()
    for (const [x, z, width, depth, index] of patches) {
      const patch = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), materials[index])
      patch.rotation.x = -Math.PI / 2
      patch.position.set(x, 0.014, z)
      patch.receiveShadow = true
      fields.add(patch)
    }

    mergeGroupMeshes(fields)
    this.scene.add(fields)
  }

  private buildVillage() {
    const wallMaterial = new THREE.MeshStandardMaterial({
      map: this.textures.concrete.map,
      color: 0xc7bfae,
      roughness: 0.92,
      metalness: 0.02,
    })
    const roofMaterial = new THREE.MeshStandardMaterial({ color: 0x6b4a3f, roughness: 0.88, metalness: 0.05 })

    // x, z, 宽, 高, 深
    const houses: Array<[number, number, number, number, number]> = [
      [-70, -46, 8, 4, 6],
      [-84, -44, 7, 3.6, 5.5],
      [-72, -28, 9, 5.6, 7],
      [-88, -26, 7, 3.6, 5.5],
      [-70, -10, 8, 3.8, 6],
      [-86, -6, 8, 5.4, 6],
      [-72, 8, 7, 3.6, 5.5],
      [-88, 10, 8, 4, 6],
      [-70, 24, 9, 3.8, 7],
      [-86, 26, 7, 3.6, 5.5],
    ]

    const village = new THREE.Group()
    houses.forEach(([x, z, width, height, depth], index) => {
      const body = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), wallMaterial)
      body.position.set(x, height / 2, z)
      body.castShadow = true
      body.receiveShadow = true
      village.add(body)

      if (index % 3 === 2) {
        // 平屋顶,带一圈女儿墙
        const slab = new THREE.Mesh(new THREE.BoxGeometry(width + 0.5, 0.3, depth + 0.5), roofMaterial)
        slab.position.set(x, height + 0.15, z)
        slab.castShadow = true
        village.add(slab)
      } else {
        const roofHeight = 1.7 + (index % 3) * 0.35
        const radius = (Math.max(width, depth) / Math.SQRT2) * 1.08
        const roof = new THREE.Mesh(new THREE.ConeGeometry(radius, roofHeight, 4), roofMaterial)
        roof.rotation.y = Math.PI / 4
        roof.position.set(x, height + roofHeight / 2, z)
        roof.castShadow = true
        village.add(roof)
      }
    })

    mergeGroupMeshes(village)
    this.scene.add(village)
  }

  private buildRuralTrees() {
    const positions: Array<[number, number, number]> = [
      [-30, -140, 1.1],
      [24, -120, 1.2],
      [-38, -80, 0.9],
      [30, -60, 1.1],
      [-34, -20, 1.0],
      [28, 0, 0.9],
      [-30, 40, 1.1],
      [30, 60, 1.0],
      [-28, 100, 0.95],
      [26, 120, 1.1],
      [-55, -35, 0.9],
      [-55, 20, 1.0],
      [-50, 50, 0.95],
      [-96, -70, 1.1],
      [-102, -30, 1.2],
      [-98, 0, 0.9],
      [-104, 40, 1.1],
      [-96, 60, 1.0],
      [-108, -120, 1.2],
      [120, -130, 1.0],
      [100, -20, 1.1],
      [130, 60, 1.0],
      [70, -140, 0.9],
      [0, 130, 1.0],
      [-70, 80, 1.0],
      [80, 100, 1.1],
    ]
    this.addTrees(positions)
  }

  private buildHills() {
    const hillMaterial = new THREE.MeshStandardMaterial({
      color: 0x4c5b48,
      roughness: 1,
      metalness: 0,
      flatShading: true,
    })
    const hills: Array<[number, number, number, number]> = [
      [-180, -220, 90, 0.32],
      [40, -270, 120, 0.28],
      [190, -190, 80, 0.35],
      [-240, 60, 100, 0.3],
      [230, 100, 90, 0.26],
    ]

    const group = new THREE.Group()
    for (const [x, z, radius, scaleY] of hills) {
      const hill = new THREE.Mesh(new THREE.SphereGeometry(radius, 18, 10), hillMaterial)
      hill.scale.y = scaleY
      hill.position.set(x, -radius * scaleY * 0.45, z)
      group.add(hill)
    }

    mergeGroupMeshes(group)
    this.scene.add(group)
  }

  private buildTrees() {
    const positions: Array<[number, number, number]> = [
      [-34, -16, 1.0],
      [-38, 6, 1.2],
      [-30, 30, 0.9],
      [-12, 38, 1.1],
      [16, 36, 1.0],
      [36, 22, 1.2],
      [40, -2, 1.0],
      [32, -30, 1.1],
      [8, -38, 0.9],
      [-20, -34, 1.0],
      [-46, -40, 1.2],
      [-58, -28, 1.0],
      [-36, -56, 0.9],
      [30, -36, 1.1],
      [44, -40, 1.0],
      [70, -76, 1.0],
      [-70, 10, 1.0],
      [-60, 32, 1.1],
      [-44, 50, 0.9],
      [-28, 58, 1.0],
      [10, 60, 1.1],
      [34, 56, 0.9],
      [74, 52, 1.0],
      [72, 30, 1.1],
      [50, 8, 0.9],
      [-100, 12, 1.2],
      [-108, -12, 1.0],
      [98, 2, 1.1],
      [122, 8, 0.9],
      [86, -72, 1.0],
    ]

    // 沿站前道路和东侧道路的行道树,让街道两侧有连续的绿化
    for (const x of [-90, -70, -50, -30, -10, 10, 30, 50, 70, 90]) {
      positions.push([x, 36.8, 0.9])
      positions.push([x, 53.2, 0.9])
    }
    for (const z of [-90, -65, -15, 10, 70, 90]) {
      positions.push([53.2, z, 0.85])
      positions.push([66.8, z, 0.85])
    }

    this.addTrees(positions)
  }

  private addTrees(positions: Array<[number, number, number]>) {
    const trunkMaterial = new THREE.MeshStandardMaterial({ color: 0x5a4734, roughness: 0.95 })
    const leafMaterial = new THREE.MeshStandardMaterial({ color: 0x3f5a3a, roughness: 0.9 })
    const forest = new THREE.Group()

    for (const [x, z, scale] of positions) {
      const tree = new THREE.Group()

      const trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.16 * scale, 0.24 * scale, 2.4 * scale, 7),
        trunkMaterial,
      )
      trunk.position.y = 1.2 * scale
      trunk.castShadow = true
      tree.add(trunk)

      const lower = new THREE.Mesh(new THREE.SphereGeometry(1.5 * scale, 12, 10), leafMaterial)
      lower.scale.set(1, 0.82, 1)
      lower.position.y = 2.9 * scale
      lower.castShadow = true
      tree.add(lower)

      const upper = new THREE.Mesh(new THREE.SphereGeometry(1.05 * scale, 10, 8), leafMaterial)
      upper.scale.set(1, 0.9, 1)
      upper.position.y = 4.0 * scale
      upper.castShadow = true
      tree.add(upper)

      tree.position.set(x, 0, z)
      forest.add(tree)
    }

    mergeGroupMeshes(forest)
    this.scene.add(forest)
  }

  private buildTransmissionLine() {
    const wireMaterial = new THREE.MeshStandardMaterial({ color: 0x2e3439, metalness: 0.4, roughness: 0.7 })

    for (const device of this.devices) {
      if (device.type !== 'tower') continue
      const x = device.position[0]
      const lineZs = [-14, -74, -134]

      for (const z of lineZs.slice(1)) {
        const fake: Device = {
          ...device,
          id: `TW-LINE-${x}-${z}`,
          name: '线路杆塔',
          status: 'normal',
          position: [x, 0, z],
        }
        const tower = this.createDistantTower(fake)
        tower.position.set(x, 0, z)
        this.scene.add(tower)
      }

      for (let i = 0; i < lineZs.length - 1; i += 1) {
        const z0 = lineZs[i]
        const z1 = lineZs[i + 1]
        for (const offset of [-2.6, 0, 2.6]) {
          const start = new THREE.Vector3(x + offset, 8.55, z0)
          const mid = new THREE.Vector3(x + offset * 1.25, 5.6, (z0 + z1) / 2)
          const end = new THREE.Vector3(x + offset, 8.55, z1)
          const curve = new THREE.CatmullRomCurve3([start, mid, end])
          const wire = new THREE.Mesh(new THREE.TubeGeometry(curve, 30, 0.03, 5, false), wireMaterial)
          this.scene.add(wire)
        }
      }
    }
  }

  private createDistantTower(device: Device): THREE.Group {
    const group = new THREE.Group()
    const steel = this.surfaceMaterial(device, 0x7f878d, 0.45, 0.7)
    const height = 11
    const baseHalf = 1.9
    const topHalf = 0.5

    const corners = (y: number, half: number) => [
      new THREE.Vector3(-half, y, -half),
      new THREE.Vector3(half, y, -half),
      new THREE.Vector3(half, y, half),
      new THREE.Vector3(-half, y, half),
    ]

    const bottom = corners(0, baseHalf)
    const top = corners(height, topHalf)

    for (let i = 0; i < 4; i += 1) {
      group.add(createStrut(bottom[i], top[i], steel))
      group.add(createStrut(bottom[i], top[(i + 1) % 4], steel))
    }

    for (const y of [3.6, 7.2, 10.4]) {
      const half = THREE.MathUtils.lerp(baseHalf, topHalf, y / height)
      const ring = corners(y, half)
      for (let i = 0; i < 4; i += 1) {
        group.add(createStrut(ring[i], ring[(i + 1) % 4], steel))
      }
    }

    for (const y of [7.4, 9.6]) {
      const armWidth = 7.6 - y * 0.2
      const arm = new THREE.Mesh(new THREE.BoxGeometry(armWidth, 0.1, 0.1), steel)
      arm.position.set(0, y, 0)
      group.add(arm)
    }

    mergeGroupMeshes(group)
    return group
  }

  private baseIntensityFor(status: DeviceStatus): number {
    switch (status) {
      case 'warning':
        return 0.032
      case 'fault':
        return 0.05
      case 'offline':
        return 0.008
      default:
        return 0.03
    }
  }

  private bindEvents() {
    const canvas = this.renderer.domElement
    canvas.addEventListener('pointermove', this.handlePointerMove)
    canvas.addEventListener('pointerdown', this.handlePointerDown)
    canvas.addEventListener('click', this.handleClick)
    document.addEventListener('visibilitychange', this.handleVisibility)
  }

  private updatePointer(event: { clientX: number; clientY: number }) {
    const rect = this.renderer.domElement.getBoundingClientRect()
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
  }

  private pickDeviceId(): string | null {
    this.raycaster.setFromCamera(this.pointer, this.camera)
    const hits = this.raycaster.intersectObjects(this.pickables, false)
    return hits.length > 0 ? ((hits[0].object.userData.deviceId as string) ?? null) : null
  }

  private handlePointerMove = (event: PointerEvent) => {
    this.updatePointer(event)
    const nextId = this.pickDeviceId()
    if (nextId === this.hoveredId) return

    this.hoveredId = nextId
    this.applyHighlights()
    this.renderer.domElement.style.cursor = nextId ? 'pointer' : 'grab'
    this.callbacks.onHover?.(this.findDevice(nextId))
  }

  private handlePointerDown = (event: PointerEvent) => {
    this.pointerDownAt = { x: event.clientX, y: event.clientY }
  }

  private handleClick = (event: MouseEvent) => {
    // 拖拽旋转/平移结束后浏览器仍会派发 click,位移超过阈值时忽略本次拾取
    const start = this.pointerDownAt
    this.pointerDownAt = null
    if (start && Math.hypot(event.clientX - start.x, event.clientY - start.y) > 4) return

    this.updatePointer(event)
    const nextId = this.pickDeviceId()
    this.select(nextId)
  }

  select(id: string | null) {
    this.selectedId = id
    this.applyHighlights()
    this.updateHelper()
    this.callbacks.onSelect?.(this.findDevice(id))
  }

  private updateHelper() {
    if (this.selectedHelper) {
      this.scene.remove(this.selectedHelper)
      this.selectedHelper.geometry.dispose()
      ;(this.selectedHelper.material as THREE.Material).dispose()
      this.selectedHelper = null
    }
    if (!this.selectedId) return
    const group = this.groups.get(this.selectedId)
    if (!group) return
    this.selectedHelper = new THREE.BoxHelper(group, 0x36e2d0)
    this.scene.add(this.selectedHelper)
  }

  private baseIntensity(group: THREE.Group): number {
    return (group.userData.baseEmissive as number | undefined) ?? 0.04
  }

  private applyHighlights() {
    for (const [id, group] of this.groups) {
      if (id === this.selectedId) {
        this.setEmissive(group, 0.32)
      } else if (id === this.hoveredId) {
        this.setEmissive(group, 0.18)
      } else {
        this.setEmissive(group, this.baseIntensity(group))
      }
    }
  }

  private setEmissive(group: THREE.Group, intensity: number) {
    group.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return
      const materials = Array.isArray(object.material) ? object.material : [object.material]
      for (const material of materials) {
        if (!(material instanceof THREE.MeshStandardMaterial)) continue
        if (material.userData.statusLight) continue
        material.emissiveIntensity = intensity
      }
    })
  }

  private findDevice(id: string | null): Device | null {
    if (!id) return null
    return this.devices.find((item) => item.id === id) ?? null
  }

  private handleVisibility = () => {
    if (document.hidden) {
      cancelAnimationFrame(this.frameId)
      this.frameId = 0
    } else if (!this.frameId && !this.disposed) {
      this.clock.getDelta()
      this.animate()
    }
  }

  private animate = () => {
    if (this.disposed) return
    this.frameId = requestAnimationFrame(this.animate)

    const delta = this.clock.getDelta()
    const elapsed = this.clock.getElapsedTime()

    for (const material of this.flowMaterials) {
      if (material.map) {
        material.map.offset.x -= delta * 0.32
      }
    }

    for (const group of this.pulseGroups) {
      const id = group.userData.deviceId as string | undefined
      if (!id || id === this.hoveredId || id === this.selectedId) continue
      this.setEmissive(group, 0.05 + (Math.sin(elapsed * 4) + 1) * 0.05)
    }

    if (this.selectedHelper) {
      this.selectedHelper.update()
    }

    this.controls.update()

    this.renderer.info.reset()
    this.composer.render(delta)

    this.frameCount += 1
    this.statsElapsed += delta
    if (this.statsElapsed >= 0.5) {
      this.callbacks.onStats?.({
        fps: Math.round(this.frameCount / this.statsElapsed),
        calls: this.renderer.info.render.calls,
        triangles: this.renderer.info.render.triangles,
      })
      this.frameCount = 0
      this.statsElapsed = 0
    }
  }

  resetCamera() {
    this.camera.position.copy(this.defaultCameraPosition)
    this.controls.target.copy(this.defaultTarget)
    this.controls.update()
  }

  private resize() {
    const width = this.container.clientWidth
    const height = this.container.clientHeight
    if (width === 0 || height === 0) return
    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(width, height, false)
    this.composer.setSize(width, height)
  }

  dispose() {
    this.disposed = true
    cancelAnimationFrame(this.frameId)
    this.resizeObserver.disconnect()

    const canvas = this.renderer.domElement
    canvas.removeEventListener('pointermove', this.handlePointerMove)
    canvas.removeEventListener('pointerdown', this.handlePointerDown)
    canvas.removeEventListener('click', this.handleClick)
    document.removeEventListener('visibilitychange', this.handleVisibility)

    this.controls.dispose()
    this.composer.dispose()
    this.bloomPass.dispose()
    this.envTarget?.dispose()

    this.scene.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return
      object.geometry.dispose()
      const materials = Array.isArray(object.material) ? object.material : [object.material]
      for (const material of materials) {
        if (material instanceof THREE.MeshStandardMaterial || material instanceof THREE.MeshBasicMaterial) {
          material.map?.dispose()
          if (material instanceof THREE.MeshStandardMaterial) {
            material.bumpMap?.dispose()
          }
        }
        material.dispose()
      }
    })

    if (this.selectedHelper) {
      this.selectedHelper.geometry.dispose()
      ;(this.selectedHelper.material as THREE.Material).dispose()
    }

    this.renderer.dispose()
    canvas.remove()
  }
}

/**
 * 把同一个 Group 内使用相同材质的静态网格合并成一个 Mesh。
 * 场景里大量重复的小零件(散热片、绝缘子、栏杆、支撑柱)是 draw call 的主要来源,
 * 合并后渲染开销显著下降,且不影响材质高亮(仍共享同一个材质实例)。
 */
function mergeGroupMeshes(root: THREE.Object3D): void {
  root.updateMatrixWorld(true)
  const inverseRoot = new THREE.Matrix4().copy(root.matrixWorld).invert()
  const buckets = new Map<THREE.Material, THREE.Mesh[]>()

  root.traverse((object) => {
    if (object === root || !(object instanceof THREE.Mesh)) return
    if (object.userData.noMerge || Array.isArray(object.material)) return
    const list = buckets.get(object.material) ?? []
    list.push(object)
    buckets.set(object.material, list)
  })

  const relative = new THREE.Matrix4()
  for (const [material, meshes] of buckets) {
    if (meshes.length < 2) continue

    const geometries: THREE.BufferGeometry[] = []
    let castShadow = false
    let receiveShadow = false
    for (const mesh of meshes) {
      // 混合 indexed / non-indexed 几何体无法合并,统一转成非索引
      const geometry = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone()
      relative.multiplyMatrices(inverseRoot, mesh.matrixWorld)
      geometry.applyMatrix4(relative)
      geometries.push(geometry)
      castShadow = castShadow || mesh.castShadow
      receiveShadow = receiveShadow || mesh.receiveShadow
    }

    const merged = mergeGeometries(geometries, false)
    for (const geometry of geometries) geometry.dispose()
    if (!merged) continue

    const mesh = new THREE.Mesh(merged, material)
    mesh.castShadow = castShadow
    mesh.receiveShadow = receiveShadow
    for (const old of meshes) old.removeFromParent()
    root.add(mesh)
  }
}

function createFlowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 64
  canvas.height = 8
  const ctx = canvas.getContext('2d')
  if (ctx) {
    ctx.fillStyle = '#0a2036'
    ctx.fillRect(0, 0, 64, 8)
    const gradient = ctx.createLinearGradient(0, 0, 64, 0)
    gradient.addColorStop(0, 'rgba(54, 226, 208, 0)')
    gradient.addColorStop(0.5, 'rgba(54, 226, 208, 1)')
    gradient.addColorStop(1, 'rgba(54, 226, 208, 0)')
    ctx.fillStyle = gradient
    ctx.fillRect(10, 1, 44, 6)
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.repeat.set(26, 1)
  return texture
}
