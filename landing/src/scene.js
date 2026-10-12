// Cena decorativa do hero: candles em ondas, verdes quando sobem e vermelhos quando
// caem. Importa só o que usa, para o chunk ficar o menor possível.
import {
    BoxGeometry,
    Color,
    InstancedBufferAttribute,
    InstancedMesh,
    MeshBasicMaterial,
    Object3D,
    PerspectiveCamera,
    Scene,
    WebGLRenderer,
} from 'three'

const CAM_Y = 6.5
const CAM_Z = 12.5
const COLS = 26
const ROWS = 7
const N = COLS * ROWS

const wave = (x, z, t) => 1.4 + Math.sin(x * 0.45 + t + z * 0.6) * 0.9 + Math.sin(x * 0.9 - t * 1.3) * 0.4

export function startScene(canvas, { reduceMotion }) {
    let renderer
    try {
        renderer = new WebGLRenderer({ canvas, alpha: true, antialias: false, powerPreference: 'low-power' })
    } catch {
        return // sem WebGL: a página fica como está
    }
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.25))

    const scene = new Scene()
    const camera = new PerspectiveCamera(40, 1, 0.1, 100)
    camera.position.set(0, CAM_Y, CAM_Z)
    camera.lookAt(0, 1, 0)

    const mesh = new InstancedMesh(new BoxGeometry(0.62, 1, 0.62), new MeshBasicMaterial(), N)
    mesh.instanceColor = new InstancedBufferAttribute(new Float32Array(N * 3), 3)
    scene.add(mesh)

    const dummy = new Object3D()
    const color = new Color()
    let gain
    let loss
    const readTheme = () => {
        const css = getComputedStyle(document.documentElement)
        gain = new Color(css.getPropertyValue('--gain').trim())
        loss = new Color(css.getPropertyValue('--loss').trim())
    }
    readTheme()
    matchMedia('(prefers-color-scheme: light)').addEventListener('change', readTheme)

    const resize = () => {
        renderer.setSize(canvas.clientWidth, canvas.clientHeight, false)
        camera.aspect = canvas.clientWidth / canvas.clientHeight
        camera.updateProjectionMatrix()
    }
    resize()
    addEventListener('resize', resize)

    let mx = 0
    let my = 0
    if (!reduceMotion) {
        addEventListener(
            'pointermove',
            (e) => {
                mx = e.clientX / innerWidth - 0.5
                my = e.clientY / innerHeight - 0.5
            },
            { passive: true },
        )
    }

    function frame(t) {
        let i = 0
        for (let z = 0; z < ROWS; z++) {
            for (let x = 0; x < COLS; x++, i++) {
                const px = (x - COLS / 2) * 0.75
                const pz = (z - ROWS / 2) * 1.5
                const a = wave(px, z, t)
                const h = Math.max(0.15, a)
                dummy.position.set(px, h / 2 - 1, pz)
                dummy.scale.set(1, h, 1)
                dummy.updateMatrix()
                mesh.setMatrixAt(i, dummy.matrix)
                mesh.setColorAt(i, color.copy(wave(px, z, t + 0.05) >= a ? gain : loss).multiplyScalar(1 - z / (ROWS + 2)))
            }
        }
        mesh.instanceMatrix.needsUpdate = true
        mesh.instanceColor.needsUpdate = true
        camera.position.x += (mx * 3 - camera.position.x) * 0.04
        camera.position.y += (CAM_Y - my * 2 - camera.position.y) * 0.04
        camera.lookAt(0, 1, 0)
        renderer.render(scene, camera)
    }

    frame(2)
    if (reduceMotion) return

    // 30 quadros por segundo bastam para um fundo decorativo. Se o aparelho não dá conta (média de
    // mais de 28 ms por quadro nos últimos 30), a animação para no último quadro: o resto da página
    // nunca paga por um enfeite.
    const FRAME_MS = 33
    const SLOW_MS = 28
    let raf = 0
    let visible = true
    let last = 0
    let spent = 0
    let frames = 0
    const t0 = performance.now()
    const loop = (now) => {
        raf = requestAnimationFrame(loop)
        if (now - last < FRAME_MS) return
        last = now
        const began = performance.now()
        frame(((now - t0) / 1000) * 0.6)
        spent += performance.now() - began
        if (++frames === 30) {
            if (spent / frames > SLOW_MS) {
                stop()
                visible = false
                canvas.dataset.paused = 'slow-device'
                return
            }
            spent = 0
            frames = 0
        }
    }
    const start = () => {
        if (!raf && visible && !document.hidden) raf = requestAnimationFrame(loop)
    }
    const stop = () => {
        cancelAnimationFrame(raf)
        raf = 0
    }
    new IntersectionObserver((entries) => {
        visible = entries[0].isIntersecting
        visible ? start() : stop()
    }).observe(canvas)
    document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()))
    start()
}
