import { describe, expect, it } from 'vitest'
import raw from '../../public/_headers?raw'

// Guarda do `public/_headers` (LW.3.16): a CSP e o cache são o que o Cloudflare Pages serve em produção,
// então uma edição descuidada (CSP frouxa, `sw.js` com cache longo, linha acima do limite do Pages) tem de falhar aqui.

function parseRules(text: string): Map<string, Map<string, string>> {
    const rules = new Map<string, Map<string, string>>()
    let current: Map<string, string> | null = null
    for (const line of text.split('\n')) {
        if (!line.trim() || line.trim().startsWith('#')) continue
        if (!/^\s/.test(line)) {
            current = new Map()
            rules.set(line.trim(), current)
            continue
        }
        const index = line.indexOf(':')
        current?.set(line.slice(0, index).trim().toLowerCase(), line.slice(index + 1).trim())
    }
    return rules
}

const rules = parseRules(raw)
const csp = rules.get('/*')?.get('content-security-policy') ?? ''

function directive(name: string): string[] {
    const found = csp
        .split(';')
        .map((part) => part.trim().split(/\s+/))
        .find(([head]) => head === name)
    return found ? found.slice(1) : []
}

describe('public/_headers', () => {
    it('respeita o limite do Pages (2000 caracteres por linha, 100 regras)', () => {
        for (const line of raw.split('\n')) expect(line.length).toBeLessThanOrEqual(2000)
        expect(rules.size).toBeLessThanOrEqual(100)
    })

    it('tem CSP restritiva, sem eval nem script inline', () => {
        expect(directive('default-src')).toEqual(["'self'"])
        expect(directive('script-src')).not.toContain("'unsafe-inline'")
        expect(directive('script-src')).not.toContain("'unsafe-eval'")
        expect(directive('object-src')).toEqual(["'none'"])
        expect(directive('frame-ancestors')).toEqual(["'none'"])
        expect(directive('base-uri')).toEqual(["'self'"])
        expect(directive('worker-src')).toEqual(["'self'"])
    })

    it('libera só o necessário: a API própria, sem origem de terceiro', () => {
        expect(directive('connect-src')).toEqual(["'self'", 'https://api.selucra.com.br', 'https://api-staging.selucra.com.br'])
        expect(directive('script-src')).toEqual(["'self'"])
        expect(directive('frame-src')).toEqual(["'none'"])
        for (const name of ['script-src', 'connect-src', 'frame-src', 'img-src']) {
            expect(directive(name)).not.toContain('*')
            expect(directive(name)).not.toContain('https:')
        }
    })

    it('manda os cabeçalhos de segurança em todas as rotas', () => {
        const all = rules.get('/*')
        expect(all?.get('x-content-type-options')).toBe('nosniff')
        expect(all?.get('referrer-policy')).toBeTruthy()
        expect(all?.get('strict-transport-security')).toMatch(/max-age=\d{7,}/)
        expect(all?.get('x-robots-tag')).toContain('noindex')
    })

    it('nunca guarda o HTML, o service worker e o manifesto em cache longo; assets com hash são imutáveis', () => {
        for (const path of ['/', '/index.html', '/sw.js', '/manifest.webmanifest', '/offline.html']) {
            expect(rules.get(path)?.get('cache-control')).toBe('no-cache')
        }
        expect(rules.get('/assets/*')?.get('cache-control')).toContain('immutable')
    })
})
