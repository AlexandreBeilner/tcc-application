// Fatos regulatórios citados nas lições (tarefa RC.1.3 do backlog de revisão).
// Número de lei, alíquota, teto ou prazo que uma lição afirma vive aqui, com
// fonte oficial e data de verificação; o texto da lição nunca é a fonte. Só
// fonte primária entra em `source` (Banco Central, Receita Federal, Planalto,
// Tesouro Direto, B3, CVM, FGC, IBGE, Anbima): notícia serve para achar a
// fonte, não para ser registrada.
//
// `check` diz como o fato foi conferido: 'pagina-oficial' (texto da página do
// órgão aberto) ou 'trecho-de-busca' (o órgão aparece como resultado, mas a
// página não abriu para leitura integral). Fato 'trecho-de-busca' deve ser
// reaberto na fonte antes de virar texto de lição (regra de entrada da Fase 5).

export interface RegulatoryFact {
  id: string
  label: string
  // Frase curta e neutra, pronta para consulta do autor da lição.
  value: string
  // Números estruturados, para testes e para o texto da lição não divergir.
  data?: Record<string, number | string | number[]>
  source: string
  check: 'pagina-oficial' | 'trecho-de-busca'
  // Data (AAAA-MM-DD) em que o fato foi conferido na fonte.
  verifiedAt: string
  note?: string
}

export const MAX_FACT_AGE_DAYS = 365

export const REGULATORY_FACTS = [
  {
    id: 'fgc-limite-por-cpf',
    label: 'FGC: cobertura por CPF e por conglomerado financeiro',
    value: 'Até R$ 250 mil por CPF, por instituição ou conglomerado financeiro.',
    data: { limitBRL: 250_000 },
    source: 'https://www.fgc.org.br/en/sobre-garantia-fgc',
    check: 'pagina-oficial',
    verifiedAt: '2026-10-04',
  },
  {
    id: 'fgc-teto-global',
    label: 'FGC: teto global em 4 anos',
    value: 'No máximo R$ 1 milhão por CPF a cada período de 4 anos, somando todas as instituições.',
    data: { limitBRL: 1_000_000, windowYears: 4 },
    source: 'https://www.fgc.org.br/en/sobre-garantia-fgc',
    check: 'pagina-oficial',
    verifiedAt: '2026-10-04',
  },
  {
    id: 'fgc-produtos',
    label: 'FGC: o que cobre e o que não cobre',
    value:
      'Cobre conta corrente, poupança, CDB, RDB, LCI, LCA e LC. Não cobre título público (Tesouro Direto), CRI, CRA, LIG nem título de capitalização.',
    source: 'https://www.fgc.org.br/en/sobre-garantia-fgc',
    check: 'pagina-oficial',
    verifiedAt: '2026-10-04',
    note: 'A lista de cobertos vem do material de perguntas e respostas do FGC; a de não cobertos, da página de garantia.',
  },
  {
    id: 'ir-renda-fixa-regressivo',
    label: 'IR sobre renda fixa: tabela regressiva',
    value:
      '22,5% até 180 dias, 20% de 181 a 360, 17,5% de 361 a 720, 15% acima de 720 dias, sobre o rendimento.',
    data: { upTo180: 22.5, upTo360: 20, upTo720: 17.5, above720: 15 },
    source: 'https://www.planalto.gov.br/ccivil_03/_ato2004-2006/2004/lei/l11033.htm',
    check: 'trecho-de-busca',
    verifiedAt: '2026-10-04',
    note: 'Lei 11.033/2004, art. 1º. O Planalto não abriu para leitura integral; confirmado também na página do Tesouro Direto.',
  },
  {
    id: 'iof-renda-fixa-30-dias',
    label: 'IOF em resgate de renda fixa antes de 30 dias',
    value:
      'Incide 1% ao dia sobre o valor resgatado, limitado ao rendimento: 96% do rendimento no 1º dia, caindo até 0% no 30º dia.',
    data: { firstDayPctOfYield: 96, zeroFromDay: 30 },
    source: 'https://www.planalto.gov.br/ccivil_03/_ato2007-2010/2007/decreto/d6306.htm',
    check: 'trecho-de-busca',
    verifiedAt: '2026-10-04',
    note: 'Decreto 6.306/2007, Anexo. A tabela completa (96, 93, 90, 86, 83, 80, 76, 73, 70, 66, 63, 60, 56, 53, 50, 46, 43, 40, 36, 33, 30, 26, 23, 20, 16, 13, 10, 6, 3, 0) ainda precisa ser reaberta no texto integral antes de entrar em lição.',
  },
  {
    id: 'tesouro-custodia-b3',
    label: 'Tesouro Direto: taxa de custódia da B3',
    value:
      '0,20% ao ano sobre o valor dos títulos, provisionada diariamente. No Tesouro Selic não se cobra nada sobre até R$ 10 mil por CPF; acima disso, só sobre o excedente.',
    data: { annualPct: 0.2, selicExemptBRL: 10_000 },
    source: 'https://www.b3.com.br/pt_br/produtos-e-servicos/tarifas/tarifas-de-tesouro-direto/',
    check: 'pagina-oficial',
    verifiedAt: '2026-10-04',
  },
  {
    id: 'poupanca-regra',
    label: 'Poupança: regra de rendimento',
    value:
      'Com a Selic acima de 8,5% ao ano: 0,5% ao mês mais a TR. Com a Selic em 8,5% ou menos: 70% da Selic (em base mensal) mais a TR. Isenta de IR para pessoa física.',
    data: { selicThresholdPct: 8.5, fixedMonthlyPct: 0.5, selicSharePct: 70 },
    source: 'https://www.planalto.gov.br/ccivil_03/_ato2011-2014/2012/lei/l12703.htm',
    check: 'trecho-de-busca',
    verifiedAt: '2026-10-04',
    note: 'Lei 12.703/2012; vale para depósitos a partir de 04/05/2012. A isenção de IR da poupança vem da Lei 8.981/1995, art. 72, ainda não reaberta no texto.',
  },
  {
    id: 'lci-lca-isencao-pf',
    label: 'LCI, LCA, CRI e CRA: isenção de IR para pessoa física',
    value:
      'Rendimento isento de IR para pessoa física (Lei 11.033/2004, art. 3º). Segue vigente: a MP 1.303/2025, que previa tributar, caducou em 08/10/2025.',
    source: 'https://www.congressonacional.leg.br/materias/medidas-provisorias/-/mpv/169059',
    check: 'trecho-de-busca',
    verifiedAt: '2026-10-04',
    note: 'Fonte registrada é a tramitação da MP no Congresso. Reconferir o art. 3º no texto da Lei 11.033 junto com a tabela regressiva.',
  },
  {
    id: 'lci-lca-prazo-minimo',
    label: 'LCI e LCA: prazo mínimo de vencimento',
    value:
      'Emissões novas: LCI com no mínimo 12 meses e LCA com no mínimo 9 meses (antes eram 90 dias). Emissões antigas não mudam.',
    data: { lciMonths: 12, lcaMonths: 9 },
    source:
      'https://www.gov.br/fazenda/pt-br/assuntos/noticias/2024/fevereiro/cmn-ajusta-lastros-elegiveis-e-prazos-de-vencimento-dos-titulos-incentivados',
    check: 'trecho-de-busca',
    verifiedAt: '2026-10-04',
    note: 'Resolução CMN 5.118/2024. O exemplo de resgate em 60 dias das lições 1.5 e 1.6 não vale para emissão nova.',
  },
  {
    id: 'copom-reunioes',
    label: 'Copom: reuniões por ano',
    value:
      'Oito reuniões por ano, cada uma em dois dias, com intervalo médio de cerca de 45 dias. O calendário do ano seguinte sai até junho.',
    data: { meetingsPerYear: 8, daysBetween: 45 },
    source: 'https://www.bcb.gov.br/en/monetarypolicy/committee',
    check: 'trecho-de-busca',
    verifiedAt: '2026-10-04',
    note: 'Reuniões de 2026 vistas: 17-18/03, 16-17/06, 04-05/08, 15-16/09, 03-04/11, 08-09/12.',
  },
  {
    id: 'meta-inflacao',
    label: 'Meta de inflação',
    value:
      'Meta de 3,0% ao ano, com tolerância de 1,5 ponto percentual para cima e para baixo (de 1,5% a 4,5%).',
    data: { targetPct: 3, tolerancePp: 1.5 },
    source: 'https://www.bcb.gov.br/content/ri/relatorioinflacao/202603/rpm202603p.pdf',
    check: 'trecho-de-busca',
    verifiedAt: '2026-10-04',
    note: 'Relatório de Política Monetária do Banco Central, março de 2026.',
  },
  {
    id: 'dividendos-retencao-lei-15270',
    label: 'Dividendos: retenção na fonte (Lei 15.270/2025)',
    value:
      'Desde 01/01/2026, lucros e dividendos pagos por uma mesma empresa a uma mesma pessoa física residente acima de R$ 50 mil no mês sofrem retenção de 10% sobre o total. Abaixo disso, não há retenção. Dividendos aprovados até 31/12/2025 ficam fora.',
    data: { withholdingPct: 10, monthlyThresholdBRL: 50_000, effectiveFrom: '2026-01-01' },
    source:
      'https://www.gov.br/receitafederal/pt-br/assuntos/noticias/2025/dezembro/receita-federal-orienta-sobre-os-procedimentos-para-o-recolhimento-do-imposto-de-renda-retido-na-fonte-sobre-lucros-e-dividendos',
    check: 'trecho-de-busca',
    verifiedAt: '2026-10-04',
    note: 'Há também o imposto mínimo para alta renda (IRPFM) na mesma lei; não detalhado aqui. Vale também para FII, que paga rendimento, não dividendo, e segue a regra própria abaixo.',
  },
  {
    id: 'jcp-aliquota',
    label: 'JCP: alíquota de IRRF',
    value: 'Retenção de 17,5% na fonte sobre o JCP (era 15% até a Lei Complementar 224/2025).',
    data: { withholdingPct: 17.5, previousPct: 15 },
    source: 'https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp224.htm',
    check: 'trecho-de-busca',
    verifiedAt: '2026-10-04',
    note: 'Data exata de produção de efeitos da LC 224/2025 ainda precisa ser lida no texto antes de entrar em lição. O backlog e os anexos traziam 15%, que está desatualizado.',
  },
  {
    id: 'fii-isencao-rendimentos',
    label: 'FII: isenção de IR nos rendimentos distribuídos',
    value:
      'Rendimentos de FII negociado em bolsa são isentos de IR para pessoa física, desde que o fundo tenha no mínimo 100 cotistas e o investidor tenha menos de 10% das cotas. Ganho na venda das cotas paga 20%.',
    data: { minShareholders: 100, maxStakePct: 10, capitalGainPct: 20 },
    source: 'https://www.planalto.gov.br/ccivil_03/_ato2004-2006/2004/lei/l11033.htm',
    check: 'trecho-de-busca',
    verifiedAt: '2026-10-04',
    note: 'Lei 11.033/2004, art. 3º, III, e Lei 8.668/1993. Conferir no texto a redação atual do número mínimo de cotistas.',
  },
  {
    id: 'etf-ir',
    label: 'ETF de renda variável: imposto sobre o ganho',
    value:
      '15% sobre o ganho na venda, sem a isenção de R$ 20 mil em vendas no mês que existe só para ações.',
    data: { capitalGainPct: 15 },
    source:
      'https://www.gov.br/receitafederal/pt-br/assuntos/meu-imposto-de-renda/preenchimento/manual-mir/rendimentos/outros-rendimentos',
    check: 'trecho-de-busca',
    verifiedAt: '2026-10-04',
    note: 'A regra específica está na IN RFB 1.585/2015; reabrir antes de citar o número do ato.',
  },
  {
    id: 'acoes-isencao-20-mil',
    label: 'Ações: isenção de IR em vendas até R$ 20 mil no mês',
    value:
      'Vendas de ações de até R$ 20 mil no mês ficam isentas de IR sobre o ganho (swing trade). Acima disso, 15%; day trade, 20%. A isenção não vale para ETF nem FII.',
    data: { monthlySalesLimitBRL: 20_000, swingPct: 15, dayTradePct: 20 },
    source:
      'https://www.gov.br/receitafederal/pt-br/assuntos/meu-imposto-de-renda/preenchimento/manual-mir/rendimentos/outros-rendimentos',
    check: 'trecho-de-busca',
    verifiedAt: '2026-10-04',
    note: 'Lei 11.033/2004 e Lei 9.250/1995; reabrir o texto antes de citar o artigo.',
  },
] as const satisfies readonly RegulatoryFact[]

export type RegulatoryFactId = (typeof REGULATORY_FACTS)[number]['id']

export function getRegulatoryFact(id: RegulatoryFactId): RegulatoryFact {
  const fact = REGULATORY_FACTS.find((f) => f.id === id)
  if (!fact) throw new Error(`fato regulatório inexistente: ${id}`)
  return fact
}

export function isFactStale(
  fact: Pick<RegulatoryFact, 'verifiedAt'>,
  now: Date = new Date(),
): boolean {
  const ageDays = (now.getTime() - new Date(`${fact.verifiedAt}T00:00:00Z`).getTime()) / 86_400_000
  return ageDays > MAX_FACT_AGE_DAYS
}
