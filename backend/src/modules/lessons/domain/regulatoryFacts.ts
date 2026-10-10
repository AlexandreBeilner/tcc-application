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
    id: 'tesouro-resgate-liquidez',
    label: 'Tesouro Direto: prazo de liquidação do resgate',
    value:
      'O resgate de qualquer título pode ser creditado no mesmo dia útil, se pedido até cerca das 13h, ou no dia útil seguinte (D+1), se pedido depois disso. Só em dia útil.',
    data: { sameDayCutoffHour: 13 },
    source: 'https://www.tesourodireto.com.br/en/regras-e-regulamento',
    check: 'trecho-de-busca',
    verifiedAt: '2026-10-04',
    note: 'Resultado de busca no domínio do Tesouro Direto e do gov.br (notícia "Tesouro Direto passa a ter liquidação de resgate no mesmo dia"); as páginas retornaram 401/403 à leitura automática. A auditoria da RC.1.7 dizia só D+1: está desatualizada. Na lição, dizer "no mesmo dia útil ou no seguinte, conforme o horário" sem citar o horário exato; reabrir no navegador na RC.8.1.',
  },
  {
    id: 'tesouro-prefixado-regras',
    label: 'Tesouro Prefixado: LTN e NTN-F',
    value:
      'O Tesouro Prefixado (LTN) paga o valor de face de R$ 1.000 por título no vencimento, sem pagamentos antes. O Tesouro Prefixado com Juros Semestrais (NTN-F) paga juros a cada semestre e o principal no vencimento. Os dois vencem em 1º de janeiro do ano do vencimento.',
    data: { faceValueBRL: 1000 },
    source: 'https://www.tesourodireto.com.br/en/sobre-o-tesouro/regras-e-regulamento',
    check: 'trecho-de-busca',
    verifiedAt: '2026-10-05',
    note: 'A página de regras foi aberta e confirma a forma de pagamento da NTN-F (semestral nos juros, principal no vencimento) e usa exemplo de LTN com vencimento em 01/01. O valor de face de R$ 1.000 e o vencimento sempre em 1º de janeiro vêm do resultado de busca no domínio do Tesouro Direto; reabrir no navegador na RC.8.1. O cupom de 10% ao ano da NTN-F não foi confirmado na página e não entra nas lições.',
  },
  {
    id: 'tesouro-resgate-preco-mercado',
    label: 'Tesouro Direto: resgate antecipado a preço de mercado',
    value:
      'O Tesouro Nacional garante liquidez diária aos títulos e recompra o título antes do vencimento pelo valor de mercado do dia, então o retorno pode diferir da taxa contratada. Segurar até o vencimento garante a rentabilidade contratada.',
    source: 'https://www.tesourodireto.com.br/en/sobre-o-tesouro/regras-e-regulamento',
    check: 'pagina-oficial',
    verifiedAt: '2026-10-05',
    note: 'Página de regras e regulamento aberta: "o Tesouro Nacional recompra o título com base no valor de mercado".',
  },
  {
    id: 'reserva-emergencia-bcb',
    label: 'Reserva de emergência: onde aplicar (Banco Central)',
    value:
      'O Caderno de Educação Financeira do Banco Central orienta aplicar a reserva de emergência em investimento de alta liquidez e baixo risco, para o dinheiro estar disponível rápido e sem perdas. O Caderno não fixa um número de meses de despesas.',
    source:
      'https://www.bcb.gov.br/content/cidadaniafinanceira/documentos_cidadania/Cuidando_do_seu_dinheiro_Gestao_de_Financas_Pessoais/caderno_cidadania_financeira.pdf',
    check: 'pagina-oficial',
    verifiedAt: '2026-10-04',
    note: 'PDF baixado e lido (pdftotext): seção "Despesas emergenciais" (reserva para cobrir eventualidades e evitar o endividamento) e a dica "aplique sua reserva de emergência em um investimento de alta liquidez e baixo risco". As faixas de 3 a 6 meses (renda estável) e 6 a 12 (renda variável) NÃO constam do Caderno: são regra de bolso e a lição as rotula assim. Tesouro Reserva (lançado em 11/05/2026 por Tesouro, B3 e Banco do Brasil, rende 100% da Selic over, sem marcação a mercado, só para clientes do Banco do Brasil por ora) foi visto só em resultado de busca no gov.br; não entra na lição até a página abrir.',
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
    note: 'Lei 12.703/2012 (texto lido de novo em 2026-10-04: art. 1º, inciso II, alíneas a e b; art. 2º mantém TR mais 0,5% ao mês para saldos até 3 de maio de 2012, data da MP 567; a remuneração é da TR relativa ao aniversário do depósito mais a remuneração adicional). Vale para depósitos a partir da MP 567/2012 (04/05/2012); saldos anteriores mantêm a regra antiga. 0,5% ao mês equivale a 6,168% ao ano composto. A isenção de IR da poupança para pessoa física aparece de forma indireta na Lei 9.250/1995, art. 16-A (rendimentos de poupança deduzidos da base do imposto mínimo); a norma específica de isenção não foi aberta.',
  },
  {
    id: 'poupanca-isencao-ir-pf',
    label: 'Poupança: rendimento isento de IR para pessoa física',
    value:
      'Rendimentos de caderneta de poupança são isentos e não tributáveis na declaração de imposto de renda da pessoa física.',
    source:
      'https://www.gov.br/receitafederal/pt-br/assuntos/meu-imposto-de-renda/preenchimento/manual-mir/rendimentos/rendimentos-do-capital',
    check: 'pagina-oficial',
    verifiedAt: '2026-10-04',
    note: 'Manual do Meu Imposto de Renda, Receita Federal (página lida): lista poupança, LCI, LCA, CRI e CRA como rendimentos isentos e não tributáveis, "que só podem ser recebidos de Pessoa Jurídica" (ou seja, pagos pela instituição). Complementa o fato poupanca-regra, que só tinha a referência indireta da Lei 9.250.',
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
    id: 'selic-definicao',
    label: 'Selic: meta do Copom e taxa efetiva',
    value:
      'O Copom define a meta da Selic, que vigora por todo o período entre reuniões ordinárias. A taxa Selic efetiva é a média ponderada, pelo volume, das taxas das operações compromissadas de um dia útil com títulos públicos federais registrados no Selic.',
    source: 'https://www.bcb.gov.br/htms/copom_normas/a-hist.asp?frame=1',
    check: 'pagina-oficial',
    verifiedAt: '2026-10-04',
    note: 'Página do Copom lida (meta e vigência entre reuniões). A definição da taxa efetiva vem do material do Banco Central sobre a taxa Selic (resultado de busca no domínio bcb.gov.br).',
  },
  {
    id: 'cdi-taxa-di',
    label: 'CDI e taxa DI',
    value:
      'O CDI é o título que bancos usam para empréstimos de um dia útil entre si. A taxa DI, apurada pela B3, é a média ponderada dessas taxas, expressa ao ano com base em 252 dias úteis, e acompanha de perto a Selic. Rentabilidade de 100% do CDI é igual à taxa DI do período.',
    data: { businessDaysPerYear: 252 },
    source: 'https://borainvestir.b3.com.br/glossario/taxa-di/',
    check: 'pagina-oficial',
    verifiedAt: '2026-10-04',
    note: 'Glossário educacional da B3 (Bora Investir), páginas de CDI e de taxa DI lidas. Série diária da taxa DI no SGS do Banco Central (série 4389).',
  },
  {
    id: 'tr-metodologia',
    label: 'TR: como é calculada',
    value:
      'A Taxa Referencial é calculada pelo Banco Central a partir da TBF, que sai de taxas negociadas no mercado secundário de Letras do Tesouro Nacional (LTN), com um redutor R e piso de zero: TR = max {0; (1 + TBF) / R - 1}.',
    source: 'https://www.bcb.gov.br/htms/normativ/Resolucao4624.pdf?r=1',
    check: 'pagina-oficial',
    verifiedAt: '2026-10-04',
    note: 'Resolução CMN 4.624/2018 (texto lido: arts. 1º a 5º sobre TBF e LTN; o redutor R e o piso zero constam em resultado de busca no domínio bcb.gov.br sobre a norma anterior da metodologia, a Res. 3.354/2006; reabrir a 4.624 inteira antes de citar a fórmula do redutor em texto).',
  },
  {
    id: 'tr-historico-zero',
    label: 'TR: período em que ficou zerada',
    value:
      'A TR ficou zerada em grande parte do período entre fevereiro de 2017 e fevereiro de 2022, enquanto a Selic esteve baixa, e voltou a ser positiva com a alta dos juros. Em outubro de 2026 estava em cerca de 0,16% ao mês.',
    data: {
      zeroFrom: '2017-02-15',
      zeroUntil: '2022-02-28',
      recentMonthlyPct: 0.16,
      recentRefDate: '2026-10-01',
    },
    source: 'https://api.bcb.gov.br/dados/serie/bcdata.sgs.226/dados/ultimos/3?formato=json',
    check: 'pagina-oficial',
    verifiedAt: '2026-10-04',
    note: 'Série 226 (TR diária) do SGS consultada direto na API: 1.623 de 2.232 observações de 2017 a 2022 com valor zero, a última em 28/02/2022; 0,1616% ao mês em 01/10/2026. Corrige o texto de apoio que dizia a TR "hoje ~zero": com a Selic acima de 8,5% ela é positiva e entra na conta da poupança.',
  },
  {
    id: 'selic-cdi-valores-recentes',
    label: 'Selic e CDI: valores recentes (exemplo datado)',
    value:
      'Em outubro de 2026, a meta da Selic estava em 13,75% ao ano e a Selic efetiva e o CDI em 13,65% ao ano, cerca de 0,10 ponto percentual abaixo da meta.',
    data: { targetPct: 13.75, effectivePct: 13.65, cdiPct: 13.65, refDate: '2026-10-02' },
    source: 'https://api.bcb.gov.br/dados/serie/bcdata.sgs.432/dados/ultimos/3?formato=json',
    check: 'pagina-oficial',
    verifiedAt: '2026-10-04',
    note: 'SGS: série 432 (meta), 1178 (Selic efetiva) e 4389 (CDI). Número com data de validade: só entra em lição rotulado como exemplo datado, nunca como valor atual.',
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
    id: 'b3-ordens-tipos',
    label: 'B3: ordem a mercado e ordem limitada',
    value:
      'Na ordem a mercado, o investidor indica à instituição intermediária que quer comprar ou vender ao preço que estiver sendo praticado no mercado naquele momento. Na ordem limitada, comunica que quer negociar e estabelece os valores limites da negociação.',
    source: 'https://borainvestir.b3.com.br/glossario/ordem-a-mercado/',
    check: 'pagina-oficial',
    verifiedAt: '2026-10-05',
    note: 'Glossário do Bora Investir (B3), páginas "Ordem a Mercado" e "Ordem Limitada" lidas. O glossário da B3 define "spread" como diferença entre taxas de aplicação e captação (crédito), não como a distância entre melhor compra e melhor venda: a lição define o spread do livro de ofertas por conta própria, como conceito geral de mercado, sem citar a B3.',
  },
  {
    id: 'b3-horario-pregao',
    label: 'B3: fases do pregão de ações',
    value:
      'O mercado à vista de ações tem fases em dias úteis: cancelamento de ofertas, pré-abertura (leilão antes de abrir), negociação, call de fechamento e after-market. Em 05/10/2026: pré-abertura de 9h45 a 10h, negociação de 10h a 16h55, call de fechamento de 16h55 a 17h.',
    data: { openingHour: 10, closeMinuteOfDay: 1015 },
    source:
      'https://www.b3.com.br/pt_br/solucoes/plataformas/puma-trading-system/para-participantes-e-traders/horario-de-negociacao/acoes/',
    check: 'pagina-oficial',
    verifiedAt: '2026-10-05',
    note: 'Tabela de horários da B3 aberta. Os horários mudam ao longo do ano (resultados de busca da B3 mostram ajustes ligados ao horário de verão nos EUA), então a lição não cita horário: só as fases.',
  },
  {
    id: 'investidor-custos-acoes',
    label: 'Portal do Investidor (CVM): custos de investir em bolsa',
    value:
      'Os principais custos por negócio são a taxa de corretagem, a taxa de custódia, os emolumentos e a taxa de liquidação. A corretagem é livremente pactuada com a corretora (valor fixo, percentual ou misto) e algumas corretoras não repassam a custódia. Emolumentos e taxa de liquidação são cobrados pela bolsa sobre o volume.',
    source:
      'https://www.gov.br/investidor/pt-br/investir/como-investir/como-funciona-a-bolsa/taxas-e-custos',
    check: 'pagina-oficial',
    verifiedAt: '2026-10-05',
    note: 'Página do Portal do Investidor lida (publicada em 2022). Valores de tarifas e faixas de isenção da B3 mudam e não foram registrados; a lição não cita número de custo.',
  },
  {
    id: 'fundos-taxas-definicoes',
    label: 'Portal do Investidor (CVM): taxas de fundos de investimento',
    value:
      'A taxa de administração remunera o administrador pelos serviços legais e de manutenção. A taxa de gestão remunera o gestor pela escolha técnica dos investimentos. A taxa de performance é um prêmio pago ao gestor apenas se o rendimento do fundo superar um indicador de referência.',
    source:
      'https://www.gov.br/investidor/pt-br/investir/tipos-de-investimentos/fundos-de-investimentos',
    check: 'pagina-oficial',
    verifiedAt: '2026-10-05',
    note: 'Página do Portal do Investidor lida. Não define taxa de ingresso ou saída, então a lição não as cita.',
  },
  {
    id: 'b3-data-com-ex',
    label: 'Data com e data ex',
    value:
      'A data com é o último dia em que o ativo ainda confere direito ao provento anunciado. No dia seguinte, a data ex, a ação ou a cota de fundo imobiliário passa a ser negociada sem o direito. Quem comprar a partir da data ex não recebe.',
    source: 'https://borainvestir.b3.com.br/glossario/data-ex/',
    check: 'pagina-oficial',
    verifiedAt: '2026-10-06',
    note: 'Glossário da B3 (texto lido). Vale também para cotas de FII.',
  },
  {
    id: 'jcp-definicao',
    label: 'JCP: o que é',
    value:
      'Os juros sobre o capital próprio são uma remuneração paga ou creditada a sócios e acionistas, calculada sobre as contas do patrimônio líquido, e a empresa pode deduzi-los para apurar o lucro real.',
    source: 'https://www.planalto.gov.br/ccivil_03/leis/l9249.htm',
    check: 'trecho-de-busca',
    verifiedAt: '2026-10-06',
    note: 'Lei 9.249/1995, art. 9º (página do Planalto não abriu; texto lido em reprodução do artigo). O limite pela taxa de juros de longo prazo e a condição de lucros existem e não entram na lição. A alíquota está em `jcp-aliquota`.',
  },
  {
    id: 'fii-ganho-capital',
    label: 'FII: imposto sobre o ganho na venda de cotas',
    value:
      'O ganho de capital na venda de cotas de fundo de investimento imobiliário é tributado a 20%, seguindo as normas dos ganhos líquidos em renda variável.',
    data: { capitalGainPct: 20 },
    source: 'https://www.planalto.gov.br/ccivil_03/leis/l8668.htm',
    check: 'trecho-de-busca',
    verifiedAt: '2026-10-06',
    note: 'Lei 8.668/1993, art. 18 (redação de 1999), lido em reprodução do artigo; a página do Planalto não abriu. Reconferir antes de citar o número em lição (a RC.4.7 trata do imposto).',
  },
  {
    id: 'renda-variavel-aliquotas',
    label: 'Renda variável: alíquotas, DARF, dedo-duro e compensação',
    value:
      'Swing trade (venda em outro dia): 15% sobre o lucro, com isenção para vendas de ações de até R$ 20 mil no mês (conta o valor vendido, não o lucro). Day trade: 20% sobre o lucro, sem isenção. Retenção na fonte (dedo-duro): 0,005% sobre o valor da venda no swing trade e 1% no day trade. O imposto é pago em DARF até o último dia útil do mês seguinte à venda; atraso tem multa de 0,33% ao dia, limitada a 20%, e juros pela Selic. Prejuízo de swing trade não compensa lucro de day trade, e o contrário também vale; o prejuízo abate lucros futuros do mesmo tipo de operação. Declaração: ações em carteira em Bens e Direitos pelo custo de aquisição; ganho isento em Rendimentos Isentos; ganho tributado em Renda Variável.',
    data: {
      swingPct: 15,
      dayTradePct: 20,
      swingWithholdingPct: 0.005,
      dayTradeWithholdingPct: 1,
      monthlySalesLimitBRL: 20_000,
    },
    source:
      'https://borainvestir.b3.com.br/noticias/imposto-de-renda/renda-variavel-imposto-de-renda/comprou-ou-vendeu-acoes-veja-como-declarar-swing-trade-day-trade-e-proventos-no-imposto-de-renda/',
    check: 'pagina-oficial',
    verifiedAt: '2026-10-06',
    note: 'Matéria do Bora Investir (B3 Educação) aberta e lida. A página da Receita sobre isenções (gov.br/receitafederal, bolsa-de-valores-1/isencoes) confirma a isenção, que exclui day trade, ETF de ações e resgate de fundos de ações, mas não traz alíquotas nem DARF. A lição não cita o código do DARF nem o DARF mínimo, que não foram conferidos. O imposto sobre o ganho do FII (20%) segue em `fii-ganho-capital` (trecho de busca): a lição só o cita no widget com ressalva de que é de exemplo.',
  },
  {
    id: 'mp-1303-caducou',
    label: 'MP 1.303/2025 perdeu a validade',
    value:
      'A Câmara retirou a MP 1.303/2025 da pauta em 8/10/2025 (251 votos a 193) e ela perdeu a validade sem ser votada pelo Senado. Ela previa tributação unificada de 18% sobre aplicações financeiras a partir de 2026; as regras de imposto de renda variável continuam as de antes.',
    source: 'https://www.congressonacional.leg.br/materias/medidas-provisorias/-/mpv/169059',
    check: 'trecho-de-busca',
    verifiedAt: '2026-10-06',
    note: 'A página da MP no Congresso Nacional e a notícia da Câmara dos Deputados (camara.leg.br/noticias/1209479) apareceram na busca com vigência encerrada em 8/10/2025; o texto integral não foi aberto. A lição não menciona a MP: o fato fica registrado para o autor não reintroduzir as alíquotas de 17,5% e o limite trimestral.',
  },
  {
    id: 'orcamento-bcb-caderno',
    label:
      'Banco Central: orçamento pessoal (despesas fixas, variáveis e sazonais, superávit, pague-se primeiro)',
    value:
      'Despesas fixas não variam ou variam muito pouco (aluguel, prestação de financiamento); despesas variáveis mudam de um mês para o outro (conta de luz ou de água, conforme o consumo); há ainda compromissos sazonais (impostos, seguros, matrículas escolares). A regra de ouro é ter orçamento superavitário, ou seja, gastar menos do que se recebe. "Pague-se primeiro": separar o dinheiro da reserva assim que receber o salário, de preferência com transferência automática.',
    source:
      'https://www.bcb.gov.br/content/cidadaniafinanceira/documentos_cidadania/Cuidando_do_seu_dinheiro_Gestao_de_Financas_Pessoais/caderno_cidadania_financeira.pdf',
    check: 'pagina-oficial',
    verifiedAt: '2026-10-06',
    note: 'Caderno de Educação Financeira do Banco Central (versão nova, texto extraído e lido); o folheto "Orçamento Pessoal" (série II) confirma os 4 passos e a meta de despesa menor que receita. A regra 50/30/20 NÃO aparece no caderno: a lição a apresenta como regra de bolso popular, nunca como orientação oficial.',
  },
  {
    id: 'rotativo-limite-lei-14690',
    label: 'Cartão de crédito: limite de juros e encargos no rotativo e no parcelamento da fatura',
    value:
      'Lei 14.690/2023, art. 28, § 1º: sem limites aprovados no prazo de 90 dias da publicação da lei, o total cobrado a título de juros e encargos financeiros no crédito rotativo e no parcelamento do saldo da fatura não pode exceder o valor original da dívida. A regra vale também para emissores que não aderirem à autorregulação (§ 2º). Na prática, o teto de 100% passou a valer em janeiro de 2024.',
    data: { capPctOfOriginalDebt: 100 },
    source: 'https://www.planalto.gov.br/ccivil_03/_ato2023-2026/2023/lei/l14690.htm',
    check: 'pagina-oficial',
    verifiedAt: '2026-10-06',
    note: 'Texto da lei lido (art. 28, §§ 1º e 2º). A vigência em janeiro de 2024 e o regulamento do CMN vieram de páginas do governo federal que apareceram na busca (Fazenda e Secom), não abertas em leitura integral.',
  },
  {
    id: 'bcb-taxas-medias-credito-pf',
    label:
      'Banco Central: taxa média de juros do rotativo do cartão e do cheque especial (pessoa física)',
    value:
      'Em agosto de 2026, a taxa média mensal de juros de operações de crédito com recursos livres para pessoa física foi de 15,18% ao mês no cartão de crédito rotativo (série SGS 25477) e de 7,43% ao mês no cheque especial (série SGS 25463).',
    data: { rotativoMonthlyPct: 15.18, chequeEspecialMonthlyPct: 7.43, reference: '2026-08' },
    source:
      'https://dadosabertos.bcb.gov.br/dataset/25477-taxa-media-mensal-de-juros-das-operacoes-de-credito-com-recursos-livres---pessoas-fisicas---c',
    check: 'pagina-oficial',
    verifiedAt: '2026-10-06',
    note: 'Valores lidos pela API de séries temporais do Banco Central (api.bcb.gov.br, SGS 25477 e 25463; a página de dados abertos confirma o título do 25477 e do 25463). Média mensal ponderada pelas concessões, muda todo mês: a lição usa "cerca de" e diz que são números de 2026. O teto do consignado do INSS (1,80% ao mês em 2025) é decidido por conselho e já mudou mais de uma vez, por isso a lição não cita número.',
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
    id: 'securitizacao-patrimonio-separado',
    label: 'Securitização: regime fiduciário e patrimônio separado',
    value:
      'A companhia securitizadora pode instituir regime fiduciário sobre os recebíveis que lastreiam os certificados (CRI e CRA entre eles). Eles formam um patrimônio separado, que não responde perante os credores da securitizadora e só paga os titulares daquela emissão. Em emissões públicas há agente fiduciário, que atua em nome dos investidores.',
    source: 'https://www.planalto.gov.br/ccivil_03/_ato2019-2022/2022/lei/l14430.htm',
    check: 'pagina-oficial',
    verifiedAt: '2026-10-05',
    note: 'Lei 14.430/2022, arts. 25 a 27 (texto lido): art. 26, II e III (patrimônio separado e agente fiduciário em emissões públicas); art. 27, I, IV e VI (patrimônio que não se confunde com o comum, não responde por obrigações da securitizadora e responde só pelos certificados vinculados).',
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
  {
    id: 'acao-responsabilidade-limitada',
    label: 'Ação: responsabilidade limitada do acionista',
    value:
      'A companhia tem o capital dividido em ações, e a responsabilidade dos acionistas é limitada ao preço de emissão das ações que subscreveram ou adquiriram (Lei 6.404/1976, art. 1º).',
    source: 'https://www.planalto.gov.br/ccivil_03/leis/l6404consol.htm',
    check: 'pagina-oficial',
    verifiedAt: '2026-10-05',
    note: 'Texto consolidado lido (art. 1º). A lição diz que o acionista pode perder o que investiu e não responde pelas dívidas da empresa com outros bens.',
  },
  {
    id: 'b3-ipo-ofertas',
    label: 'B3: IPO, oferta primária e secundária, mercado primário',
    value:
      'IPO é o processo em que uma empresa privada oferece ações ao público pela primeira vez e passa a ser de capital aberto; sócios antigos, como fundadores, podem vender parte das ações na oferta. Oferta primária é a emissão de ações novas, com o dinheiro entrando no próprio emissor; oferta secundária é a venda de ações já existentes, com o dinheiro indo para os acionistas vendedores. Mercado primário é onde ocorrem os lançamentos de novas ações e títulos para a primeira aquisição.',
    source: 'https://borainvestir.b3.com.br/glossario/ipo/',
    check: 'pagina-oficial',
    verifiedAt: '2026-10-05',
    note: 'Glossário do Bora Investir (B3), páginas "IPO", "Oferta Primária", "Oferta Secundária", "Mercado Primário" e "Bookbuilding" lidas. O bookbuilding aparece só como "processo de formação de preços"; a explicação de como o preço de corte sai das ordens é didática, do widget. Lock-up, roadshow e norma da CVM não foram abertos e não entram na lição.',
  },
  {
    id: 'b3-ticker-estrutura',
    label: 'B3: estrutura do ticker (letras, 3, 4, 11 e BDR)',
    value:
      'O ticker tem quatro letras que remetem ao nome da empresa e um número que identifica o tipo de ação: 3 para ordinárias (ON) e 4 para preferenciais (PN). O número 11 é o mais abrangente e pode caracterizar fundos de investimento, ETFs e BDRs patrocinados nível I. BDRs são recibos de ações de empresas estrangeiras, com final 32 (patrocinado nível II), 33 (nível III), 34 ou 35 (não patrocinados). A empresa escolhe as letras; o número segue o padrão do tipo.',
    data: { onSuffix: 3, pnSuffix: 4, fundSuffix: 11 },
    source:
      'https://borainvestir.b3.com.br/noticias/empresas/ticker-como-nasce-o-codigo-das-empresas-listadas-na-b3/',
    check: 'pagina-oficial',
    verifiedAt: '2026-10-05',
    note: 'Matéria do Bora Investir (B3 Educação) aberta e lida. Ela não menciona unit, as classes 5 a 8 nem o F do fracionário (esses seguem em `b3-ticker-sufixos`, como trecho de busca); por isso a lição não cita unit nem as classes 5 a 8.',
  },
  {
    id: 'suitability-cvm30',
    label: 'Suitability: perfil do investidor (Resolução CVM 30)',
    value:
      'A corretora e outras instituições intermediárias precisam verificar se o produto é adequado ao perfil do cliente, medido por questionário sobre objetivos, situação financeira e conhecimento. O perfil é do investidor, não do produto. Os nomes das categorias (como conservador, moderado e arrojado) ficam por conta de cada instituição.',
    source:
      'https://www.gov.br/investidor/pt-br/educacional/publicacoes-educacionais/guias/guia-de-suitability-lancamento/@@download/file',
    check: 'pagina-oficial',
    verifiedAt: '2026-10-06',
    note: 'Guia de Suitability do Portal do Investidor (CVM) aberto; o PDF tem leitura difícil, então a lição não cita número de artigo nem número de perguntas, só a ideia (questionário, três dimensões, perfil da pessoa).',
  },
  {
    id: 'cvm-vieses-comportamentais',
    label: 'CVM Comportamental: vieses do investidor',
    value:
      'Aversão à perda: atribuímos mais importância às perdas que aos ganhos, o que leva a insistir em investimentos sem perspectiva, vender cedo o que está lucrando e reforçar posição perdedora para recuperar o prejuízo. Ancoragem: o investidor se prende ao preço de compra e mantém posição perdedora esperando voltar a ele. Autoconfiança excessiva: quem se crê melhor que a média negocia mais, paga mais custos e tem retorno menor. A CVM recomenda estratégia com limites definidos, reavaliar a carteira como se fosse dinheiro em caixa, evitar conferir cotações com frequência e desconfiar de pressa ("se não decidir agora, perderá").',
    source:
      'https://www.gov.br/investidor/pt-br/educacional/publicacoes-educacionais/cvm-comportamental/volume-1-vieses-do-investidor.pdf/@@display-file/file',
    check: 'pagina-oficial',
    verifiedAt: '2026-10-06',
    note: 'Série CVM Comportamental, volume 1 "Vieses do Investidor" (PDF, 2015), texto lido: seções Ancoragem, Aversão a Perda e Autoconfiança Excessiva. Efeito manada/adesão aparece só como resultado de busca e não foi aberto, então a lição não o cita. O estudo de 2006 com gestores (74% acima da média) é citado pela CVM, mas a lição não usa o número.',
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
