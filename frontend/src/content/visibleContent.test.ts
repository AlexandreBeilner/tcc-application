import ts from 'typescript'
import { describe, expect, it } from 'vitest'
import baselineJson from './contentViolationsBaseline.json'

// RC.1.1: varredura de texto visível ao usuário no frontend (JSX, atributos e
// literais de prosa), com as mesmas regras do backend e do engine. Áreas de
// admin ficam fora (não são usuário final). Baseline = dívida que a RC.1.4
// zera; só pode encolher. Ao encolher, o teste imprime o baseline novo
// pra colar em contentViolationsBaseline.json.

// Lê o fonte via bundler (sem tipos de node, o tsconfig do app não os inclui).
const SOURCES = import.meta.glob(
    [
        '../**/*.{ts,tsx}',
        '!../**/*.test.{ts,tsx}',
        '!../**/{admin,PainelAdmin,CriarEventoMacro,test,content,storage,PlatformNote}/**',
        // Painel admin da Fase N: fora do escopo de usuário final.
        '!../**/Admin*/**',
        '!../**/{BotActivityPanel,BotHealthPanel,MonitorBookPanel,SchedulerPanel,TickRunList,MacroEventTriggerForm}/**',
    ],
    {
        query: '?raw',
        import: 'default',
        eager: true,
    },
) as Record<string, string>

const RULES: Array<{ id: string; pattern: RegExp }> = [
    { id: 'tcc', pattern: /\bTCC\b/ },
    { id: 'spec', pattern: /\bspec\b|\bespecifica[cç][aã]o\b/i },
    { id: 'capitulo', pattern: /\bcap\.\s*\d/i },
    { id: 'backlog', pattern: /\bbacklog\b/i },
    { id: 'motor', pattern: /\bmotor\b/i },
    { id: 'nesta-plataforma', pattern: /\b(nesta|desta|na) plataforma\b|\ba plataforma registra\b/i },
    { id: 'simulado', pattern: /simulad/i },
    { id: 'travessao', pattern: /—/ },
    { id: 'numero-de-licao', pattern: /\bli[cç][aã]o\s+\d/i },
    { id: 'sandbox', pattern: /sandbox/i },
    { id: 'jargao-tecnico', pattern: /\b(tick|temporizador|endpoint|payload)\b/i },
    { id: 'chave-tcc', pattern: /^tcc\./ },
]

// Placeholder de dado ('—' sozinho) é permitido.
const isPlaceholder = (text: string) => /^[\s—]*$/.test(text)

export function extractVisibleStrings(fileName: string, source: string): string[] {
    const sf = ts.createSourceFile(
        fileName,
        source,
        ts.ScriptTarget.Latest,
        true,
        fileName.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
    )
    const out: string[] = []
    const visit = (node: ts.Node) => {
        if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) return
        if (ts.isJsxText(node)) {
            out.push(node.getText(sf))
        } else if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
            const parent = node.parent
            const inJsxAttr = ts.isJsxAttribute(parent)
            const isProse = /\s/.test(node.text.trim()) && /[a-zà-ú]/i.test(node.text)
            const isStorageKey = /^tcc\./.test(node.text)
            if (inJsxAttr || isProse || isStorageKey) out.push(node.text)
        } else if (ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node)) {
            if (/\s/.test(node.text.trim())) out.push(node.text)
        }
        ts.forEachChild(node, visit)
    }
    visit(sf)
    return out.map((text) => text.trim()).filter((text) => text !== '' && !isPlaceholder(text))
}

function collectCounts(): Record<string, number> {
    const counts: Record<string, number> = {}
    for (const [file, source] of Object.entries(SOURCES)) {
        const rel = file.replace(/^\.\.\//, '')
        for (const text of extractVisibleStrings(file, source)) {
            for (const rule of RULES) {
                if (rule.pattern.test(text)) {
                    const key = `${rule.id}|${rel}`
                    counts[key] = (counts[key] ?? 0) + 1
                }
            }
        }
    }
    return counts
}

describe('texto visível do frontend (RC.1.1)', () => {
    it('extrai JSX, atributos e prosa, ignorando imports e placeholders', () => {
        const strings = extractVisibleStrings(
            'x.tsx',
            `import a from 'tcc proibido aqui'\nconst k = 'market_closed'\nconst m = 'Recotada pelo motor'\nexport const C = () => <p title="Dica">Olá — mundo {x}</p>\nconst d = <b>—</b>`,
        )
        expect(strings).toContain('Recotada pelo motor')
        expect(strings).toContain('Dica')
        expect(strings).toContain('Olá — mundo')
        expect(strings).not.toContain('market_closed')
        expect(strings).not.toContain('tcc proibido aqui')
        expect(strings).not.toContain('—')
    })

    it('não introduz violação nova e mantém o baseline encolhendo', () => {
        const current = collectCounts()

        const baseline = baselineJson as Record<string, number>
        const added: string[] = []
        const stale: string[] = []
        for (const key of new Set([...Object.keys(current), ...Object.keys(baseline)])) {
            const now = current[key] ?? 0
            const before = baseline[key] ?? 0
            if (now > before) added.push(`${key} (${before} -> ${now})`)
            if (now < before) stale.push(`${key} (${before} -> ${now})`)
        }
        expect(added, 'texto proibido novo em UI (regra|arquivo)').toEqual([])
        expect(
            stale,
            `violações resolvidas: encolha o baseline para\n${JSON.stringify(Object.fromEntries(Object.entries(current).sort(([a], [b]) => a.localeCompare(b))), null, 2)}`,
        ).toEqual([])
    })
})
