import { describe, expect, it } from 'vitest'
import { getRegulatoryFact, isFactStale, REGULATORY_FACTS } from './regulatoryFacts'

const OFFICIAL_HOSTS = [
  'bcb.gov.br',
  'gov.br',
  'planalto.gov.br',
  'tesourodireto.com.br',
  'b3.com.br',
  'cvm.gov.br',
  'fgc.org.br',
  'ibge.gov.br',
  'anbima.com.br',
  'congressonacional.leg.br',
  'in.gov.br',
]

describe('fatos regulatórios (RC.1.3)', () => {
  it('cada fato tem id único, valor, fonte oficial https e data válida', () => {
    const ids = new Set<string>()
    for (const fact of REGULATORY_FACTS) {
      expect(ids.has(fact.id), `id duplicado ${fact.id}`).toBe(false)
      ids.add(fact.id)
      expect(fact.value.length, fact.id).toBeGreaterThan(10)
      const url = new URL(fact.source)
      expect(url.protocol, fact.id).toBe('https:')
      expect(
        OFFICIAL_HOSTS.some((h) => url.hostname === h || url.hostname.endsWith(`.${h}`)),
        `${fact.id}: fonte não oficial (${url.hostname})`,
      ).toBe(true)
      expect(fact.verifiedAt, fact.id).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(Number.isNaN(new Date(fact.verifiedAt).getTime()), fact.id).toBe(false)
    }
  })

  it('nenhum fato está com verificação vencida (mais de 12 meses)', () => {
    const stale = REGULATORY_FACTS.filter((f) => isFactStale(f)).map((f) => f.id)
    expect(stale, 'reverifique estes fatos na fonte e atualize verifiedAt').toEqual([])
  })

  it('isFactStale usa o limite de 12 meses', () => {
    expect(isFactStale({ verifiedAt: '2025-10-04' }, new Date('2026-10-04T00:00:00Z'))).toBe(false)
    expect(isFactStale({ verifiedAt: '2025-10-03' }, new Date('2026-10-04T00:00:00Z'))).toBe(true)
  })

  it('cobre os temas exigidos pela tarefa', () => {
    const ids = REGULATORY_FACTS.map((f) => f.id)
    for (const required of [
      'fgc-limite-por-cpf',
      'fgc-teto-global',
      'ir-renda-fixa-regressivo',
      'iof-renda-fixa-30-dias',
      'tesouro-custodia-b3',
      'poupanca-regra',
      'reserva-emergencia-bcb',
      'poupanca-isencao-ir-pf',
      'lci-lca-isencao-pf',
      'copom-reunioes',
      'meta-inflacao',
      'selic-definicao',
      'cdi-taxa-di',
      'tr-metodologia',
      'tr-historico-zero',
      'selic-cdi-valores-recentes',
      'dividendos-retencao-lei-15270',
      'jcp-aliquota',
      'fii-isencao-rendimentos',
      'etf-ir',
      'fii-distribuicao-minima',
      'acoes-preferenciais-lei-6404',
      'dividendo-obrigatorio',
      'b3-ticker-sufixos',
      'b3-liquidacao-acoes',
      'cvm-itr-dfp-prazos',
      'tesouro-vna-ipca',
      'ipca-abrangencia',
    ] as const) {
      expect(ids, required).toContain(required)
    }
  })

  it('getRegulatoryFact devolve o fato e falha para id desconhecido', () => {
    expect(getRegulatoryFact('fgc-limite-por-cpf').data).toEqual({ limitBRL: 250_000 })
    // @ts-expect-error id inexistente é erro de tipo e de execução
    expect(() => getRegulatoryFact('nao-existe')).toThrow()
  })
})
