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
    value: 'Até R$ 250 mil por CPF, por instituição associada ou por conglomerado financeiro.',
    data: { limitBRL: 250_000 },
    source: 'https://www.fgc.org.br/en/sobre-garantia-fgc',
    check: 'pagina-oficial',
    verifiedAt: '2026-10-04',
  },
  {
    id: 'fgc-teto-global',
    label: 'FGC: teto global em 4 anos',
    value:
      'No máximo R$ 1 milhão por CPF a cada período de 4 anos, contado a partir da data em que a instituição é declarada em liquidação.',
    data: { limitBRL: 1_000_000, windowYears: 4 },
    source: 'https://www.fgc.org.br/en/sobre-garantia-fgc',
    check: 'pagina-oficial',
    verifiedAt: '2026-10-04',
    note: 'Aplicações feitas até 21/12/2017 não entram no teto de R$ 1 milhão.',
  },
  {
    id: 'fgc-produtos',
    label: 'FGC: o que cobre e o que não cobre',
    value:
      'Garantia ordinária cobre depósitos e créditos em instituições associadas (conta corrente, poupança, CDB, RDB, LCI, LCA, LC). A página oficial lista como não cobertos: LIG, títulos públicos, CRI e título de capitalização. CRA também fica de fora, por ser emitido por securitizadora e não por instituição associada.',
    source: 'https://www.fgc.org.br/en/sobre-garantia-fgc',
    check: 'pagina-oficial',
    verifiedAt: '2026-10-04',
    note: 'A página lista os não cobertos (LIG, títulos públicos, CRI, capitalização). A lista de cobertos aparece em imagem; vem do material de perguntas e respostas do FGC. CRA não é citado nominalmente na página.',
  },
  {
    id: 'ir-renda-fixa-regressivo',
    label: 'IR sobre renda fixa: tabela regressiva',
    value:
      '22,5% em aplicações de até 180 dias, 20% de 181 a 360, 17,5% de 361 a 720 e 15% acima de 720 dias, retido na fonte sobre o rendimento.',
    data: { upTo180: 22.5, upTo360: 20, upTo720: 17.5, above720: 15 },
    source: 'https://www.planalto.gov.br/ccivil_03/_ato2004-2006/2004/lei/l11033.htm',
    check: 'pagina-oficial',
    verifiedAt: '2026-10-04',
    note: 'Lei 11.033/2004, art. 1º, incisos I a IV (texto lido). O art. 1º traz a anotação "Vide Medida Provisória nº 1.303, de 2025 / vigência encerrada".',
  },
  {
    id: 'iof-renda-fixa-30-dias',
    label: 'IOF em resgate de renda fixa antes de 30 dias',
    value:
      'Incide 1% ao dia sobre o valor resgatado, limitado ao rendimento, conforme tabela: 96% do rendimento no 1º dia, caindo a 0% no 30º dia.',
    data: { firstDayPctOfYield: 96, zeroFromDay: 30 },
    source: 'https://www.planalto.gov.br/ccivil_03/_ato2007-2010/2007/decreto/d6306.htm',
    check: 'pagina-oficial',
    verifiedAt: '2026-10-04',
    note: 'Decreto 6.306/2007, art. 32 e Anexo (texto lido). Tabela: 96, 93, 90, 86, 83, 80, 76, 73, 70, 66, 63, 60, 56, 53, 50, 46, 43, 40, 36, 33, 30, 26, 23, 20, 16, 13, 10, 6, 3, 0 (dias 1 a 30).',
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
      'Com a meta da Selic acima de 8,5% ao ano: 0,5% ao mês mais a TR. Com a meta em 8,5% ou menos: 70% da meta da Selic (mensalizada, vigente no início do período de rendimento) mais a TR.',
    data: { selicThresholdPct: 8.5, fixedMonthlyPct: 0.5, selicSharePct: 70 },
    source: 'https://www.planalto.gov.br/ccivil_03/_ato2011-2014/2012/lei/l12703.htm',
    check: 'pagina-oficial',
    verifiedAt: '2026-10-04',
    note: 'Lei 12.703/2012 (texto lido). Vale para depósitos a partir da MP 567/2012 (04/05/2012); saldos anteriores mantêm a regra antiga. 0,5% ao mês equivale a 6,168% ao ano composto. A isenção de IR da poupança para pessoa física aparece de forma indireta na Lei 9.250/1995, art. 16-A (rendimentos de poupança deduzidos da base do imposto mínimo); a norma específica de isenção não foi aberta.',
  },
  {
    id: 'lci-lca-isencao-pf',
    label: 'LCI, LCA, CRI e CRA: isenção de IR para pessoa física',
    value:
      'Isentos de IR, na fonte e na declaração, para pessoa física: LCI, CRI e LH (Lei 11.033/2004, art. 3º, II) e CDCA, LCA e CRA (art. 3º, IV). A MP 1.303/2025, que previa tributar, caducou em 08/10/2025.',
    source: 'https://www.planalto.gov.br/ccivil_03/_ato2004-2006/2004/lei/l11033.htm',
    check: 'pagina-oficial',
    verifiedAt: '2026-10-04',
    note: 'Texto lido no Planalto. O art. 3º traz "Vide Medida Provisória nº 1.303, de 2025 / vigência encerrada". A caducidade da MP vem da tramitação no Congresso (resultado de busca).',
  },
  {
    id: 'lci-lca-prazo-minimo',
    label: 'LCI e LCA: prazo mínimo de vencimento',
    value:
      'LCI: 6 meses em geral e 36 meses quando atualizada mensalmente por índice de preços (Resolução CMN 4.410, art. 4º, com redação da Res. 5.215/2025). LCA: 6 meses em geral (Res. 5.215/2025) e 12 meses quando atualizada por índice de preços. O prazo conta da data em que um terceiro adquire o título, e o emissor não pode recomprar antes dele.',
    data: {
      lciMonthsGeneral: 6,
      lciMonthsPriceIndexed: 36,
      lcaMonthsGeneral: 6,
      lcaMonthsPriceIndexed: 12,
    },
    source: 'https://normativos.bcb.gov.br/Lists/Normativos/Attachments/48547/Res_4410_v6_P.pdf',
    check: 'pagina-oficial',
    verifiedAt: '2026-10-04',
    note: 'LCI: texto consolidado lido no Banco Central (histórico: 90 dias, depois 12 meses em 02/2024, 9 meses em 08/2024, 6 meses a partir da Res. 5.215 de 22/05/2025). LCA: o consolidado aberto mostra só os prazos originais; o valor de 6 meses vem de resultado de busca e deve ser confirmado no consolidado atual antes de citar. A Fazenda registrou 9 meses para LCA e 12 para LCI em 02/2024: valores antigos.',
  },
  {
    id: 'copom-reunioes',
    label: 'Copom: reuniões por ano',
    value:
      'Oito reuniões ordinárias por ano, em geral em dois dias seguidos. O comunicado da decisão sai no segundo dia, a partir das 18h30. O calendário do ano seguinte é divulgado até o fim de junho.',
    data: { meetingsPerYear: 8, daysBetween: 45 },
    source: 'https://www.bcb.gov.br/en/monetarypolicy/committee',
    check: 'trecho-de-busca',
    verifiedAt: '2026-10-04',
    note: 'Regra do regulamento do Copom (resultado de busca no domínio do Banco Central). A página oficial só abre com JavaScript; reabrir pelo navegador antes de citar horário. Intervalo de cerca de 45 dias é consequência de 8 reuniões por ano.',
  },
  {
    id: 'meta-inflacao',
    label: 'Meta de inflação',
    value:
      'Meta de 3,00% medida pelo IPCA, com intervalo de tolerância de 1,5 ponto percentual para mais e para menos (de 1,50% a 4,50%), em vigor desde janeiro de 2025.',
    data: { targetPct: 3, tolerancePp: 1.5 },
    source: 'https://www.bcb.gov.br/content/ri/relatorioinflacao/202603/rpm202603p.pdf',
    check: 'pagina-oficial',
    verifiedAt: '2026-10-04',
    note: 'Relatório de Política Monetária de março de 2026 (texto lido), citando a Resolução CMN 5.141 de 26/06/2024.',
  },
  {
    id: 'dividendos-retencao-lei-15270',
    label: 'Dividendos: retenção na fonte (Lei 15.270/2025)',
    value:
      'A partir de janeiro de 2026, lucros e dividendos pagos por uma mesma empresa a uma mesma pessoa física residente acima de R$ 50 mil no mês sofrem retenção de 10% sobre o total. Abaixo disso, não há retenção. Não se sujeitam os lucros de resultados apurados até 2025 cuja distribuição foi aprovada até 31/12/2025.',
    data: { withholdingPct: 10, monthlyThresholdBRL: 50_000, effectiveFrom: '2026-01-01' },
    source: 'https://www.planalto.gov.br/ccivil_03/_ato2023-2026/2025/lei/l15270.htm',
    check: 'pagina-oficial',
    verifiedAt: '2026-10-04',
    note: 'Art. 6º-A da Lei 9.250/1995, incluído pela Lei 15.270 (texto lido). A mesma lei cria o imposto mínimo de pessoa física para rendimentos totais acima de R$ 600 mil por ano (alíquota cresce até 10% em R$ 1,2 milhão). Decisão D9: motor não modela; só lição.',
  },
  {
    id: 'jcp-aliquota',
    label: 'JCP: alíquota de IRRF',
    value:
      'Retenção de 17,5% na fonte sobre o JCP, na data do pagamento ou crédito. Era 15% até a Lei Complementar 224/2025.',
    data: { withholdingPct: 17.5, previousPct: 15, effectiveFrom: '2026-01-01' },
    source: 'https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp224.htm',
    check: 'pagina-oficial',
    verifiedAt: '2026-10-04',
    note: 'LC 224/2025, art. 8º (altera o art. 9º, §2º da Lei 9.249/1995), publicada em 26/12/2025; art. 14, III: demais dispositivos produzem efeitos a partir de 01/01/2026 (texto lido).',
  },
  {
    id: 'fii-isencao-rendimentos',
    label: 'FII: isenção de IR nos rendimentos distribuídos',
    value:
      'Rendimentos de FII e Fiagro com cotas negociadas exclusivamente em bolsa ou balcão organizado são isentos de IR para pessoa física, desde que o fundo tenha no mínimo 100 cotistas e o investidor não tenha 10% ou mais das cotas (nem direito a mais de 10% dos rendimentos).',
    data: { minShareholders: 100, maxStakePct: 10 },
    source: 'https://www.planalto.gov.br/ccivil_03/_ato2004-2006/2004/lei/l11033.htm',
    check: 'pagina-oficial',
    verifiedAt: '2026-10-04',
    note: 'Lei 11.033/2004, art. 3º, III e §§ (redação da Lei 14.754/2023 para os 100 cotistas; a versão de 500 cotistas da MP 1.184/2024 tem vigência encerrada). O ganho de capital na venda das cotas (20%) não foi aberto em texto; reconferir antes de citar.',
  },
  {
    id: 'fii-distribuicao-minima',
    label: 'FII: distribuição mínima de resultado',
    value:
      'O fundo deve distribuir aos cotistas no mínimo 95% dos lucros apurados em regime de caixa, com base em balanço semestral encerrado em 30 de junho e 31 de dezembro.',
    data: { minPayoutPct: 95 },
    source: 'https://www.planalto.gov.br/ccivil_03/leis/l9779.htm',
    check: 'pagina-oficial',
    verifiedAt: '2026-10-04',
    note: 'Lei 9.779/1999 (texto lido), parágrafo único do art. 10 da Lei 8.668/1993 na redação dada por ela. A distribuição mensal é prática de mercado, não exigência legal.',
  },
  {
    id: 'etf-ir',
    label: 'ETF de renda variável: imposto sobre o ganho',
    value:
      '15% sobre o ganho líquido na venda (20% em day trade), sem a isenção de R$ 20 mil em vendas no mês que vale só para ações; o investidor apura e paga o DARF até o último dia útil do mês seguinte.',
    data: { capitalGainPct: 15, dayTradePct: 20 },
    source:
      'https://www.in.gov.br/materia/-/asset_publisher/Kujrw0TZC2Mb/content/id/32827203/do1-2015-09-02-instrucao-normativa-n-1-585-de-31-de-agosto-de-2015-32827199',
    check: 'trecho-de-busca',
    verifiedAt: '2026-10-04',
    note: 'IN RFB 1.585/2015 (resultado de busca no Diário Oficial). O texto integral não foi lido; reconferir o artigo antes de citar o número do ato.',
  },
  {
    id: 'acoes-isencao-20-mil',
    label: 'Ações: isenção de IR em vendas até R$ 20 mil no mês',
    value:
      'Ganhos líquidos de pessoa física no mercado à vista de ações ficam isentos quando o total das vendas no mês é de até R$ 20 mil. A isenção vale para ações e ouro ativo financeiro, não para ETF nem FII.',
    data: { monthlySalesLimitBRL: 20_000 },
    source: 'https://www.planalto.gov.br/ccivil_03/_ato2004-2006/2004/lei/l11033.htm',
    check: 'pagina-oficial',
    verifiedAt: '2026-10-04',
    note: 'Lei 11.033/2004, art. 3º, I (texto lido). As alíquotas de 15% (swing trade) e 20% (day trade) não foram abertas nesta rodada.',
  },
  {
    id: 'acoes-preferenciais-lei-6404',
    label: 'Ações preferenciais: vantagens e limite',
    value:
      'As preferências da PN podem ser prioridade na distribuição de dividendo fixo ou mínimo e prioridade no reembolso de capital (Lei 6.404, art. 17). As PN sem voto, ou com voto restrito, não podem passar de 50% do total de ações emitidas (art. 15, §2º).',
    data: { maxNonVotingPreferredPct: 50 },
    source: 'https://www.planalto.gov.br/ccivil_03/leis/l6404consol.htm',
    check: 'pagina-oficial',
    verifiedAt: '2026-10-04',
    note: 'Texto consolidado lido. O art. 17 tem condições adicionais para PN sem voto negociada em bolsa (uma de três vantagens); reabrir o §1º ao reescrever a lição 2.3.',
  },
  {
    id: 'dividendo-obrigatorio',
    label: 'Dividendo obrigatório (Lei 6.404, art. 202)',
    value:
      'Os acionistas têm direito ao dividendo obrigatório definido no estatuto; se o estatuto for omisso, a metade do lucro líquido do exercício, ajustado pelas reservas legal e de contingências. Se o estatuto omisso for alterado para tratar do tema, o dividendo obrigatório não pode ser menor que 25% do lucro líquido ajustado.',
    data: { defaultPct: 50, minPctWhenStatuteAmended: 25 },
    source: 'https://www.planalto.gov.br/ccivil_03/leis/l6404consol.htm',
    check: 'pagina-oficial',
    verifiedAt: '2026-10-04',
    note: 'Corrige a auditoria, que dizia "25% se o estatuto for omisso": a regra supletiva do caput é metade do lucro; 25% é o piso do §2º.',
  },
  {
    id: 'b3-ticker-sufixos',
    label: 'Ticker da B3: o que significam o número final e o F',
    value:
      'Quatro letras identificam o emissor e o número final o tipo: 3 ordinária, 4 preferencial, 5 a 8 preferenciais das classes A a D, 11 para fundos, ETFs e units. A letra F no fim indica o mercado fracionário (1 a 99 ações); o lote padrão é de 100.',
    source:
      'https://borainvestir.b3.com.br/noticias/empresas/ticker-como-nasce-o-codigo-das-empresas-listadas-na-b3/',
    check: 'trecho-de-busca',
    verifiedAt: '2026-10-04',
    note: 'Material educacional da B3 (Bora Investir), resultado de busca. Os números de BDR (32 a 35, 39) não foram confirmados e não entram na lição.',
  },
  {
    id: 'b3-liquidacao-acoes',
    label: 'Data com, data ex e liquidação de ações',
    value:
      'Data com é o último dia em que a compra dá direito ao provento; a partir do dia seguinte, a data ex, o papel negocia sem o direito. A liquidação de ações na B3 é em D+2 (dois dias úteis após o negócio).',
    data: { settlementBusinessDays: 2 },
    source: 'https://borainvestir.b3.com.br/glossario/data-ex/',
    check: 'trecho-de-busca',
    verifiedAt: '2026-10-04',
    note: 'Glossário da B3. A auditoria dizia D+1 desde 2023, o que não se confirmou: a B3 informa D+2. Confirmar o ciclo de liquidação vigente na B3 antes de afirmar prazo exato.',
  },
  {
    id: 'cvm-itr-dfp-prazos',
    label: 'CVM: prazos de ITR e DFP',
    value:
      'O ITR é entregue em até 45 dias após o fim de cada trimestre; a DFP, em até 3 meses após o fim do exercício social.',
    data: { itrDays: 45, dfpMonths: 3 },
    source:
      'https://conteudo.cvm.gov.br/export/sites/cvm/legislacao/resolucoes/anexos/001/resol080consolid.pdf',
    check: 'trecho-de-busca',
    verifiedAt: '2026-10-04',
    note: 'Resolução CVM 80/2022 (resultado de busca no domínio da CVM). Texto consolidado não aberto.',
  },
  {
    id: 'tesouro-vna-ipca',
    label: 'Tesouro IPCA+: Valor Nominal Atualizado',
    value:
      'O VNA começou em R$ 1.000,00 em 15/07/2000 e é atualizado pela variação do IPCA, divulgado pelo IBGE entre os dias 10 e 15 de cada mês, com atualização pro rata entre as datas. No vencimento, o título paga o VNA corrigido, mais o rendimento da taxa contratada.',
    data: { baseDate: '2000-07-15', baseValueBRL: 1000 },
    source:
      'https://atendimento.b3.com.br/sys_attachment.do?sys_id=0fd1ea151b959610c44feb1a3b4bcb1f&sysparm_this_url=kb_knowledge.do%3Fsys_id%3Db1b12a151b959610c44feb1a3b4bcb27',
    check: 'trecho-de-busca',
    verifiedAt: '2026-10-04',
    note: 'Cálculo da rentabilidade dos títulos públicos (material da B3/Tesouro, resultado de busca). A regra do VNA em deflação não foi confirmada e não deve ser afirmada em lição.',
  },
  {
    id: 'ipca-abrangencia',
    label: 'IPCA: população de referência',
    value:
      'O IPCA, calculado pelo IBGE, cobre famílias residentes em áreas urbanas com renda monetária de 1 a 40 salários mínimos.',
    data: { minWages: 1, maxWages: 40 },
    source:
      'https://www.ibge.gov.br/estatisticas/economicas/precos-e-custos/9256-indice-nacional-de-precos-ao-consumidor-amplo.html',
    check: 'trecho-de-busca',
    verifiedAt: '2026-10-04',
    note: 'Resultado de busca no domínio do IBGE (estrutura de ponderação baseada na POF 2017-2018). A página bloqueou o acesso direto.',
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
