// Interações da landing. O conteúdo (texto, gráficos) já vem no HTML; aqui só entra
// o que é movimento: valor piscando, demo de ordem e a cena 3D decorativa.

const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches
const brl = (x) =>
    'R$ ' +
    x.toLocaleString('pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })

function flash(el) {
    el.classList.add('flash')
    setTimeout(() => el.classList.remove('flash'), 400)
}

function lcg(seed) {
    let s = seed
    return () => {
        s = (s * 1664525 + 1013904223) % 4294967296
        return s / 4294967296
    }
}

// Valor do hero oscila de leve (price-flash). Valores só para ilustrar.
function initHeroTicker() {
    const el = document.getElementById('heroVal')
    if (!el || reduceMotion) return
    const r = lcg(99)
    let base = 10482.3
    setInterval(() => {
        base += (r() - 0.45) * 18
        el.textContent = brl(base)
        flash(el)
    }, 3200)
}

// Demo da primeira ordem, sem login e sem chamar a API.
function initDemo() {
    const out = document.getElementById('dQty')
    const tot = document.getElementById('dTot')
    const reward = document.getElementById('reward')
    if (!out || !tot || !reward) return
    const price = 24.8
    let qty = 10
    const update = () => {
        out.textContent = qty + (qty === 1 ? ' ação' : ' ações')
        tot.textContent = brl(qty * price)
        flash(tot)
    }
    document.getElementById('dMinus').addEventListener('click', () => {
        if (qty > 1) {
            qty--
            update()
        }
    })
    document.getElementById('dPlus').addEventListener('click', () => {
        if (qty < 500) {
            qty++
            update()
        }
    })
    document.getElementById('dBuy').addEventListener('click', () => {
        reward.hidden = false
        requestAnimationFrame(() => reward.classList.add('on'))
    })
}

// Cena 3D: só depois do load, em ociosidade, e nunca com economia de dados ou
// aparelho fraco. O chunk (three) é baixado sob demanda; o HTML não depende dele.
function initScene() {
    const canvas = document.getElementById('gl')
    if (!canvas) return
    const conn = navigator.connection
    const weak =
        (navigator.deviceMemory && navigator.deviceMemory < 4) || (navigator.hardwareConcurrency && navigator.hardwareConcurrency < 4)
    if ((conn && conn.saveData) || weak) return
    const run = () => import('./scene.js').then((m) => m.startScene(canvas, { reduceMotion })).catch(() => {})
    // Espera a página ficar interativa antes de baixar e iniciar o enfeite.
    const idle = () => setTimeout(() => (window.requestIdleCallback ? requestIdleCallback(run, { timeout: 3000 }) : run()), 1500)
    if (document.readyState === 'complete') idle()
    else addEventListener('load', idle, { once: true })
}

initHeroTicker()
initDemo()
initScene()
