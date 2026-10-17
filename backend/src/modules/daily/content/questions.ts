import type { DailyCategory } from './categories'
import type { ContentScope } from '../domain/content'

// Perguntas do cartão `trivia` (Pergunta do dia): conhecimentos gerais de economia e finanças,
// sem data, múltipla escolha. O enunciado não entrega a resposta, as alternativas erradas são
// plausíveis e a explicação tem no máximo ~280 caracteres (seção 3.3). `correctIndex` varia de
// propósito. Fato de fora tem a frase do efeito no Brasil.
export interface QuestionSeed {
  key: string
  question: string
  options: [string, string, string, string]
  correctIndex: 0 | 1 | 2 | 3
  explanation: string
  source: string
  category: DailyCategory
  scope: ContentScope
}

export const QUESTION_SEEDS: readonly QuestionSeed[] = [
  {
    key: 'indice-da-meta-de-inflacao',
    question: 'Qual índice é a referência da meta de inflação no Brasil?',
    options: ['IGP-M', 'INPC', 'IPCA', 'IPC-Fipe'],
    correctIndex: 2,
    explanation:
      'O Banco Central persegue a meta medida pelo IPCA, índice oficial de inflação calculado pelo IBGE. O Conselho Monetário Nacional é quem fixa o valor da meta.',
    source:
      'Banco Central do Brasil, Sistema de Metas para a Inflação (bcb.gov.br); Decreto nº 3.088/1999.',
    category: 'juros-e-inflacao',
    scope: 'brasil',
  },
  {
    key: 'quem-define-a-selic',
    question: 'Qual órgão decide a meta da taxa Selic a cada reunião?',
    options: ['Tesouro Nacional', 'Copom', 'CVM', 'Ministério da Fazenda'],
    correctIndex: 1,
    explanation:
      'O Comitê de Política Monetária, formado pela diretoria do Banco Central, se reúne oito vezes por ano e fixa a meta da Selic para perseguir a meta de inflação.',
    source: 'Banco Central do Brasil, Copom (bcb.gov.br/controleinflacao/copom).',
    category: 'instituicoes',
    scope: 'brasil',
  },
  {
    key: 'o-que-foi-a-urv',
    question: 'Nos meses anteriores ao real, em 1994, o que era a URV?',
    options: [
      'Uma nova moeda que circulava ao lado do cruzeiro real',
      'Uma unidade de conta com valor atualizado todo dia, para alinhar os preços',
      'Um imposto sobre transações financeiras',
      'Um fundo que guardava os depósitos congelados',
    ],
    correctIndex: 1,
    explanation:
      'A Unidade Real de Valor era um indexador cujo valor em cruzeiros reais subia todo dia. Os preços passaram a ser referidos a ela, e em 1º de julho de 1994 a URV virou o real.',
    source:
      'Lei nº 8.880, de 27/05/1994 (planalto.gov.br); Banco Central do Brasil, Museu de Valores.',
    category: 'planos-e-moeda',
    scope: 'brasil',
  },
  {
    key: 'plano-collor-bloqueio',
    question: 'O que o Plano Collor, de 1990, fez com os depósitos acima de certo valor?',
    options: [
      'Converteu em ações de estatais',
      'Isentou de imposto de renda',
      'Bloqueou por 18 meses, com devolução em parcelas depois',
      'Trocou por dólares do Banco Central',
    ],
    correctIndex: 2,
    explanation:
      'Saldos acima de um limite em contas e na poupança ficaram retidos no Banco Central por 18 meses e foram devolvidos em 12 parcelas mensais, corrigidos.',
    source: 'Lei nº 8.024, de 12/04/1990 (planalto.gov.br).',
    category: 'planos-e-moeda',
    scope: 'brasil',
  },
  {
    key: 'quem-fiscaliza-acoes',
    question: 'Qual órgão fiscaliza o mercado de ações e protege quem investe nele?',
    options: ['Banco Central', 'CVM', 'Receita Federal', 'BNDES'],
    correctIndex: 1,
    explanation:
      'A Comissão de Valores Mobiliários foi criada em 1976 e regula e fiscaliza o mercado de capitais, como bolsa, companhias abertas e fundos.',
    source: 'Lei nº 6.385, de 07/12/1976 (planalto.gov.br).',
    category: 'instituicoes',
    scope: 'brasil',
  },
  {
    key: 'limite-do-fgc',
    question:
      'Qual é o limite de garantia ordinário do FGC por CPF em cada instituição financeira?',
    options: ['R$ 50 mil', 'R$ 100 mil', 'R$ 250 mil', 'R$ 1 milhão'],
    correctIndex: 2,
    explanation:
      'O FGC garante até R$ 250 mil por CPF e por instituição ou conglomerado, somando todos os produtos cobertos. Há ainda um teto de R$ 1 milhão a cada quatro anos.',
    source: 'Fundo Garantidor de Créditos, Regulamento e perguntas frequentes (fgc.org.br).',
    category: 'produtos-e-regras',
    scope: 'brasil',
  },
  {
    key: 'significado-de-b3',
    question: 'O nome B3 é formado pelas iniciais de quais palavras?',
    options: [
      'Bolsa, Bancos, Brasil',
      'Brasil, Bolsa, Balcão',
      'Bolsa, Bônus, Balanço',
      'Brasil, Banco, Bolsa',
    ],
    correctIndex: 1,
    explanation:
      'Em 2017, a BM&FBovespa uniu-se à Cetip, que registrava ativos negociados no balcão. O nome B3 reúne Brasil, Bolsa e Balcão.',
    source: 'B3, Nossa história (b3.com.br).',
    category: 'instituicoes',
    scope: 'brasil',
  },
  {
    key: 'isencao-pessoa-fisica',
    question:
      'Qual destas aplicações tem rendimento isento de imposto de renda para pessoa física?',
    options: ['CDB', 'LCI', 'Tesouro Selic', 'Fundo de renda fixa'],
    correctIndex: 1,
    explanation:
      'A Lei 11.033/2004 isentou do imposto de renda os rendimentos de LCI e LCA para pessoa física. CDB, Tesouro Direto e fundos têm imposto de renda sobre o rendimento.',
    source: 'Lei nº 11.033, de 21/12/2004, art. 3º (planalto.gov.br).',
    category: 'produtos-e-regras',
    scope: 'brasil',
  },
  {
    key: 'regime-cambial-desde-1999',
    question: 'Desde janeiro de 1999, que regime de câmbio o Brasil adota?',
    options: [
      'Câmbio fixo atrelado ao dólar',
      'Câmbio flutuante',
      'Banda cambial com teto e piso',
      'Câmbio atrelado ao ouro',
    ],
    correctIndex: 1,
    explanation:
      'O Banco Central deixou de sustentar a cotação dentro de limites e o preço do dólar passou a variar com a oferta e a procura. Ele ainda pode intervir, mas não fixa o valor.',
    source: 'Banco Central do Brasil, "10 anos de câmbio flutuante" (bcb.gov.br).',
    category: 'planos-e-moeda',
    scope: 'brasil',
  },
  {
    key: 'reunioes-do-copom',
    question: 'Quantas reuniões ordinárias o Copom faz por ano?',
    options: ['4', '6', '8', '12'],
    correctIndex: 2,
    explanation:
      'Desde 2006 são oito reuniões por ano, com intervalo de cerca de seis semanas. O calendário é divulgado pelo Banco Central com antecedência.',
    source: 'Banco Central do Brasil, Calendário das reuniões do Copom (bcb.gov.br).',
    category: 'juros-e-inflacao',
    scope: 'brasil',
  },
  {
    key: 'efeito-da-alta-da-selic',
    question: 'Em geral, o que tende a acontecer quando o Copom aumenta a Selic?',
    options: [
      'O crédito fica mais caro e a inflação tende a desacelerar',
      'O crédito fica mais barato e o consumo cresce',
      'O governo passa a gastar menos por lei',
      'O dólar cai sempre no mesmo dia',
    ],
    correctIndex: 0,
    explanation:
      'Juros mais altos encarecem empréstimos e financiamentos, estimulam a poupança e esfriam a demanda. É assim que o Banco Central tenta trazer a inflação para a meta.',
    source:
      'Banco Central do Brasil, Relatório de Inflação, caixa sobre transmissão da política monetária (bcb.gov.br).',
    category: 'juros-e-inflacao',
    scope: 'brasil',
  },
  {
    key: 'moeda-antes-do-real',
    question: 'Qual era a moeda brasileira imediatamente antes do real?',
    options: ['Cruzado novo', 'Cruzeiro real', 'Cruzeiro', 'Cruzado'],
    correctIndex: 1,
    explanation:
      'O cruzeiro real circulou de agosto de 1993 a junho de 1994 e foi trocado pelo real, na paridade de 2.750 cruzeiros reais por real.',
    source: 'Banco Central do Brasil, Museu de Valores, "Moedas do Brasil" (bcb.gov.br).',
    category: 'planos-e-moeda',
    scope: 'brasil',
  },
  {
    key: 'reacao-a-crise-asiatica',
    question:
      'Em 1997, uma crise cambial no Sudeste Asiático fez investidores fugirem de países emergentes. Como o Brasil reagiu para segurar o real?',
    options: [
      'Reduziu os juros para estimular a economia',
      'Elevou os juros de forma brusca',
      'Trocou a moeda por uma nova',
      'Fechou a bolsa por uma semana',
    ],
    correctIndex: 1,
    explanation:
      'Para evitar a fuga de dólares, o Banco Central elevou os juros com força em outubro de 1997. A crise reduziu as reservas do país e deixou a economia mais frágil no ano seguinte.',
    source: 'Banco Central do Brasil, Relatório Anual 1997 (bcb.gov.br).',
    category: 'crises-e-choques',
    scope: 'fora',
  },
  {
    key: 'circuit-breaker-10',
    question:
      'Na B3, o circuit breaker suspende as negociações por 30 minutos quando o Ibovespa cai quanto em relação ao fechamento anterior?',
    options: ['5%', '10%', '15%', '20%'],
    correctIndex: 1,
    explanation:
      'A queda de 10% suspende por 30 minutos. Se, na volta, a queda chegar a 15%, a pausa é de uma hora; com 20%, a B3 define o prazo.',
    source: 'B3, Circuit breaker (b3.com.br).',
    category: 'bolsa-e-acoes',
    scope: 'brasil',
  },
  {
    key: 'o-que-e-grau-de-investimento',
    question: 'O que é o grau de investimento de um país?',
    options: [
      'Limite de dívida permitido pelo FMI',
      'Nota de agência que indica baixo risco de calote',
      'Percentual do PIB aplicado em obras',
      'Nível de reservas internacionais',
    ],
    correctIndex: 1,
    explanation:
      'Agências como a S&P classificam a capacidade de pagar dívidas. Acima de certa nota, o país tem grau de investimento, e muitos fundos só podem comprar títulos de países assim.',
    source:
      "Standard & Poor's, escala de ratings soberanos; Banco Central do Brasil, glossário (bcb.gov.br).",
    category: 'risco-e-analise',
    scope: 'brasil',
  },
  {
    key: 'tesouro-que-acompanha-a-selic',
    question: 'Qual título do Tesouro Direto tem rendimento atrelado à taxa Selic?',
    options: ['Tesouro Prefixado', 'Tesouro IPCA+', 'Tesouro Selic', 'Tesouro Renda+ prefixado'],
    correctIndex: 2,
    explanation:
      'O Tesouro Selic acompanha a taxa básica de juros, o que o torna o mais indicado para a reserva de emergência, com pouca oscilação de preço no dia a dia.',
    source: 'Tesouro Nacional, Tesouro Direto: tipos de títulos (tesourodireto.com.br).',
    category: 'produtos-e-regras',
    scope: 'brasil',
  },
  {
    key: 'tesouro-ipca-mais',
    question: 'Como rende o Tesouro IPCA+?',
    options: [
      'Uma taxa fixa e nada mais',
      'A variação do dólar mais uma taxa',
      'A variação da inflação mais uma taxa fixa',
      'A Selic acumulada no período',
    ],
    correctIndex: 2,
    explanation:
      'O investidor recebe a inflação medida pelo IPCA mais uma taxa de juros combinada na compra. Assim, o poder de compra do dinheiro é preservado e ainda cresce.',
    source: 'Tesouro Nacional, Tesouro Direto: tipos de títulos (tesourodireto.com.br).',
    category: 'produtos-e-regras',
    scope: 'brasil',
  },
  {
    key: 'o-que-e-cdi',
    question: 'O que é a taxa DI, o CDI, tão usada como referência de investimentos?',
    options: [
      'A taxa dos empréstimos entre bancos, que acompanha a Selic',
      'A inflação dos serviços',
      'O rendimento da poupança',
      'A taxa que o governo paga aos poupadores',
    ],
    correctIndex: 0,
    explanation:
      'O CDI (Certificado de Depósito Interbancário) é a taxa dos empréstimos de um dia entre bancos. Fica quase igual à Selic e serve de referência para CDBs e fundos.',
    source: 'B3, Taxa DI (b3.com.br).',
    category: 'juros-e-inflacao',
    scope: 'brasil',
  },
  {
    key: 'quem-emite-moeda',
    question: 'Pela Constituição, quem tem competência exclusiva para emitir moeda no Brasil?',
    options: ['Casa da Moeda', 'Tesouro Nacional', 'Banco do Brasil', 'Banco Central'],
    correctIndex: 3,
    explanation:
      'O art. 164 diz que a União emite moeda exclusivamente por meio do Banco Central. A Casa da Moeda apenas fabrica cédulas e moedas por encomenda.',
    source: 'Constituição Federal de 1988, art. 164 (planalto.gov.br).',
    category: 'instituicoes',
    scope: 'brasil',
  },
  {
    key: 'o-que-faz-a-lrf',
    question: 'Qual é o foco da Lei de Responsabilidade Fiscal, de 2000?',
    options: [
      'Fixar o valor do salário mínimo',
      'Limitar gastos com pessoal e endividamento dos entes públicos',
      'Criar imposto sobre grandes fortunas',
      'Proibir a emissão de moeda',
    ],
    correctIndex: 1,
    explanation:
      'A Lei Complementar 101 impõe metas fiscais e limites de despesa com pessoal e de dívida a União, estados e municípios, e pune o descumprimento.',
    source: 'Lei Complementar nº 101, de 04/05/2000 (planalto.gov.br).',
    category: 'economia-geral',
    scope: 'brasil',
  },
  {
    key: 'produto-principal-do-imperio',
    question:
      'Qual produto liderou as exportações brasileiras da segunda metade do século XIX até 1930?',
    options: ['Açúcar', 'Borracha', 'Café', 'Algodão'],
    correctIndex: 2,
    explanation:
      'O café respondia por boa parte do valor exportado e financiava importações e investimentos. Por isso a crise de 1929 atingiu o Brasil tão fortemente.',
    source: 'IBGE, Estatísticas do Século XX, comércio exterior (ibge.gov.br).',
    category: 'economia-geral',
    scope: 'brasil',
  },
  {
    key: 'acao-ordinaria',
    question: 'Qual é a principal diferença entre ações ordinárias (ON) e preferenciais (PN)?',
    options: [
      'ON pagam sempre dividendo maior',
      'PN têm voto em todas as decisões',
      'ON dão direito a voto; PN têm preferência no recebimento de proventos',
      'ON só podem ser compradas por empresas',
    ],
    correctIndex: 2,
    explanation:
      'A ação ordinária dá direito de voto nas assembleias. A preferencial, em regra, não vota, mas tem prioridade na distribuição de dividendos e no reembolso de capital.',
    source: 'Lei nº 6.404, de 15/12/1976, arts. 15 a 17 (planalto.gov.br).',
    category: 'bolsa-e-acoes',
    scope: 'brasil',
  },
  {
    key: 'titulo-prefixado-e-juros',
    question:
      'Quando a taxa de juros de mercado sobe, o que tende a ocorrer com o preço de um título prefixado já comprado?',
    options: ['Sobe', 'Cai', 'Não muda nunca', 'Dobra'],
    correctIndex: 1,
    explanation:
      'O título antigo paga uma taxa menor que a nova, então vale menos hoje. Isso só vira prejuízo de verdade se o investidor vender antes do vencimento.',
    source:
      'Tesouro Nacional, Tesouro Direto: como funciona o preço dos títulos (tesourodireto.com.br).',
    category: 'risco-e-analise',
    scope: 'brasil',
  },
  {
    key: 'moratoria-do-mexico',
    question:
      'Qual país iniciou, em 1982, a crise da dívida na América Latina ao declarar que não pagaria sua dívida externa?',
    options: ['Argentina', 'Chile', 'México', 'Venezuela'],
    correctIndex: 2,
    explanation:
      'A moratória mexicana de agosto de 1982 fez os bancos fecharem o crédito a toda a região. O Brasil, também muito endividado em dólares, recorreu ao FMI em 1983.',
    source:
      'FMI, "The Latin American debt crisis" (imf.org); Banco Central do Brasil, Relatório Anual 1982.',
    category: 'crises-e-choques',
    scope: 'fora',
  },
  {
    key: 'teto-de-gastos-2016',
    question: 'O que limitava o teto de gastos, criado em 2016?',
    options: [
      'O crescimento da despesa federal à inflação do ano anterior',
      'O valor máximo da dívida dos estados',
      'O salário dos servidores',
      'O preço máximo dos combustíveis',
    ],
    correctIndex: 0,
    explanation:
      'A Emenda Constitucional 95 fixou que a despesa primária da União só poderia crescer pela inflação do ano anterior. Em 2023, foi substituída pelo arcabouço fiscal.',
    source:
      'Emenda Constitucional nº 95, de 15/12/2016 (planalto.gov.br); Lei Complementar nº 200/2023.',
    category: 'economia-geral',
    scope: 'brasil',
  },
  {
    key: 'faixa-do-inpc',
    question:
      'O INPC, índice de preços do IBGE, mede o custo de vida de famílias de qual faixa de renda?',
    options: [
      'De 1 a 5 salários mínimos',
      'Acima de 20 salários mínimos',
      'Só quem recebe benefício do governo',
      'Sem limite de renda',
    ],
    correctIndex: 0,
    explanation:
      'O INPC acompanha famílias com renda de 1 a 5 salários mínimos e é referência para reajustes de salários e benefícios. O IPCA cobre famílias de 1 a 40 salários mínimos.',
    source: 'IBGE, Índices de Preços ao Consumidor: notas metodológicas (ibge.gov.br).',
    category: 'juros-e-inflacao',
    scope: 'brasil',
  },
  {
    key: 'quem-administra-o-pix',
    question: 'Quem criou e administra o Pix, lançado em 2020?',
    options: ['A Febraban', 'O Banco Central', 'A B3', 'A Visa'],
    correctIndex: 1,
    explanation:
      'O Pix é um arranjo de pagamentos instantâneos do Banco Central, que define as regras. Bancos e fintechs participam, mas o sistema é público.',
    source: 'Banco Central do Brasil, Pix (bcb.gov.br/estabilidadefinanceira/pix).',
    category: 'instituicoes',
    scope: 'brasil',
  },
  {
    key: 'definicao-da-selic',
    question: 'A taxa Selic é, tecnicamente, a taxa média de quais operações?',
    options: [
      'Empréstimos pessoais dos grandes bancos',
      'Financiamentos de um dia lastreados em títulos públicos federais',
      'Cartões de crédito rotativos',
      'Depósitos em poupança',
    ],
    correctIndex: 1,
    explanation:
      'A Selic efetiva é a taxa média dos financiamentos diários feitos com títulos públicos federais. O Copom define a meta, e o Banco Central atua para a taxa efetiva ficar perto dela.',
    source: 'Banco Central do Brasil, Taxa Selic (bcb.gov.br/controleinflacao/taxaselic).',
    category: 'juros-e-inflacao',
    scope: 'brasil',
  },
  {
    key: 'novo-mercado',
    question: 'O que é o Novo Mercado da B3?',
    options: [
      'Mercado só para estrangeiros',
      'Segmento com regras de governança mais exigentes que a lei',
      'Bolsa de criptoativos',
      'Mercado de balcão para dívidas',
    ],
    correctIndex: 1,
    explanation:
      'Criado em 2000, é o nível mais alto de governança da B3. Entre outras regras, as empresas só podem ter ações ordinárias, com voto, e precisam de conselho independente.',
    source: 'B3, Novo Mercado: Regulamento de Listagem (b3.com.br).',
    category: 'bolsa-e-acoes',
    scope: 'brasil',
  },
  {
    key: 'quebra-do-lehman',
    question:
      'Qual banco de investimento americano foi à falência em setembro de 2008 e levou a crise a todo o mundo?',
    options: ['Goldman Sachs', 'Morgan Stanley', 'Lehman Brothers', 'JPMorgan'],
    correctIndex: 2,
    explanation:
      'A falência do Lehman Brothers paralisou o crédito mundial. No Brasil, estrangeiros retiraram dinheiro da bolsa, o Ibovespa despencou e o dólar disparou.',
    source:
      'Federal Reserve History, "The Great Recession and its aftermath" (federalreservehistory.org).',
    category: 'crises-e-choques',
    scope: 'fora',
  },
  {
    key: 'maior-parceiro-comercial',
    question: 'Desde 2009, qual país é o maior parceiro comercial do Brasil?',
    options: ['Estados Unidos', 'Argentina', 'Alemanha', 'China'],
    correctIndex: 3,
    explanation:
      'A China é o principal destino de soja, minério de ferro e petróleo brasileiros. O crescimento chinês pesa diretamente nas exportações do país.',
    source:
      'Ministério do Desenvolvimento, Indústria, Comércio e Serviços, Comex Stat (comexstat.mdic.gov.br).',
    category: 'economia-geral',
    scope: 'brasil',
  },
  {
    key: 'plano-cruzado',
    question: 'Qual foi a medida mais marcante do Plano Cruzado, de 1986?',
    options: [
      'Bloqueio dos depósitos bancários',
      'Congelamento de preços',
      'Abertura do câmbio',
      'Privatização de estatais',
    ],
    correctIndex: 1,
    explanation:
      'O governo congelou preços e salários e trocou a moeda pelo cruzado. A inflação caiu no início, mas voltou quando faltaram produtos e o congelamento perdeu força.',
    source: 'Decreto-Lei nº 2.283, de 27/02/1986 (planalto.gov.br).',
    category: 'planos-e-moeda',
    scope: 'brasil',
  },
  {
    key: 'o-que-e-spread-bancario',
    question: 'O que é o spread bancário?',
    options: [
      'Uma taxa cobrada por cada Pix',
      'A diferença entre o que o banco cobra de quem toma dinheiro e o que paga para captá-lo',
      'O imposto sobre empréstimos',
      'A multa por atraso em fatura',
    ],
    correctIndex: 1,
    explanation:
      'O spread cobre o risco de calote, os custos do banco, os impostos e o lucro. Quanto maior o spread, mais caro fica o crédito para o cliente.',
    source: 'Banco Central do Brasil, Relatório de Economia Bancária (bcb.gov.br).',
    category: 'produtos-e-regras',
    scope: 'brasil',
  },
  {
    key: 'quem-emite-tesouro-direto',
    question: 'Quem emite os títulos negociados no Tesouro Direto?',
    options: ['Banco Central', 'B3', 'Tesouro Nacional', 'Caixa Econômica'],
    correctIndex: 2,
    explanation:
      'Os títulos são emitidos pelo Tesouro Nacional, do governo federal. A B3 guarda os títulos em nome do investidor, e as corretoras e bancos intermediam a compra.',
    source: 'Tesouro Nacional, Tesouro Direto: perguntas frequentes (tesourodireto.com.br).',
    category: 'instituicoes',
    scope: 'brasil',
  },
  {
    key: 'cobertura-do-fgc',
    question: 'Qual destes investimentos tem a cobertura do FGC?',
    options: ['Ação de banco', 'Tesouro Selic', 'CDB', 'Cota de fundo imobiliário'],
    correctIndex: 2,
    explanation:
      'O FGC cobre CDB, LCI, LCA e depósitos, entre outros. Títulos do Tesouro têm a garantia do próprio governo, e ações e cotas de fundos não têm cobertura.',
    source: 'Fundo Garantidor de Créditos, Produtos garantidos (fgc.org.br).',
    category: 'produtos-e-regras',
    scope: 'brasil',
  },
  {
    key: 'regra-da-poupanca',
    question: 'Com a Selic em 8,5% ao ano ou menos, quanto rendem os novos depósitos da poupança?',
    options: ['100% da Selic', '70% da Selic mais a TR', '0,5% ao mês mais a TR', '50% do CDI'],
    correctIndex: 1,
    explanation:
      'Desde 2012, quando a Selic fica em 8,5% ou menos, a poupança rende 70% da Selic mais a TR. Acima disso, vale a regra antiga de 0,5% ao mês mais a TR.',
    source: 'Lei nº 12.703, de 07/08/2012 (planalto.gov.br).',
    category: 'produtos-e-regras',
    scope: 'brasil',
  },
  {
    key: 'o-que-e-pib',
    question: 'O que o PIB mede?',
    options: [
      'Todo o dinheiro que circula no país',
      'O valor dos bens e serviços finais produzidos no país em um período',
      'A dívida do governo',
      'O total de exportações',
    ],
    correctIndex: 1,
    explanation:
      'O Produto Interno Bruto soma o valor dos bens e serviços finais produzidos dentro do país. Quando o PIB cresce, a economia produziu mais.',
    source: 'IBGE, Contas Nacionais Trimestrais: notas metodológicas (ibge.gov.br).',
    category: 'economia-geral',
    scope: 'brasil',
  },
  {
    key: 'quem-calcula-ipca-e-pib',
    question: 'Qual instituição calcula tanto o IPCA quanto o PIB brasileiro?',
    options: ['Banco Central', 'IBGE', 'FGV', 'Tesouro Nacional'],
    correctIndex: 1,
    explanation:
      'O Instituto Brasileiro de Geografia e Estatística produz o IPCA, o PIB, o desemprego e o censo. A FGV calcula outros índices, como o IGP-M.',
    source: 'IBGE, Sobre o IBGE (ibge.gov.br).',
    category: 'instituicoes',
    scope: 'brasil',
  },
  {
    key: 'o-que-e-ipo',
    question: 'O que é um IPO?',
    options: [
      'Uma empresa que vende ações ao público pela primeira vez',
      'A compra de uma empresa por outra',
      'O pagamento de dividendos extras',
      'A saída de uma empresa da bolsa',
    ],
    correctIndex: 0,
    explanation:
      'No IPO (oferta pública inicial), a empresa abre o capital e passa a ter ações negociadas na bolsa. Com isso, capta dinheiro e ganha novos sócios.',
    source: 'CVM, Resolução CVM nº 160/2022 (cvm.gov.br); B3, Abrir capital (b3.com.br).',
    category: 'bolsa-e-acoes',
    scope: 'brasil',
  },
  {
    key: 'o-que-e-balanca-comercial',
    question: 'O que a balança comercial registra?',
    options: [
      'A diferença entre o que o país exporta e o que importa',
      'O peso dos produtos exportados',
      'As reservas em ouro',
      'O saldo do orçamento do governo',
    ],
    correctIndex: 0,
    explanation:
      'É a diferença entre o valor das exportações e o das importações de bens. Se vende mais do que compra, há superávit comercial; se compra mais, há déficit.',
    source:
      'Ministério do Desenvolvimento, Indústria, Comércio e Serviços, Balança Comercial (gov.br/mdic).',
    category: 'economia-geral',
    scope: 'brasil',
  },
  {
    key: 'mercado-de-baixa',
    question: 'No jargão de Wall Street, o que é um "bear market"?',
    options: [
      'Mercado em alta forte',
      'Mercado em queda prolongada',
      'Mercado fechado para estrangeiros',
      'Mercado de ações de baixo valor',
    ],
    correctIndex: 1,
    explanation:
      'É o mercado em queda prolongada, normalmente quando os preços caem 20% ou mais desde a máxima. O oposto é o "bull market". Os termos são usados também na bolsa brasileira.',
    source: 'U.S. Securities and Exchange Commission, Investor.gov glossary (investor.gov).',
    category: 'bolsa-e-acoes',
    scope: 'fora',
  },
  {
    key: 'maior-produtor-de-cafe',
    question: 'Qual país é o maior produtor mundial de café há mais de um século e meio?',
    options: ['Colômbia', 'Vietnã', 'Etiópia', 'Brasil'],
    correctIndex: 3,
    explanation:
      'O Brasil responde por cerca de um terço do café produzido no mundo. Por isso o clima e a safra brasileiros mexem com o preço internacional do produto.',
    source:
      'Companhia Nacional de Abastecimento (Conab), Acompanhamento da safra de café (conab.gov.br).',
    category: 'economia-geral',
    scope: 'brasil',
  },
  {
    key: 'quem-fixa-a-meta-de-inflacao',
    question: 'Quem fixa a meta de inflação que o Banco Central deve perseguir?',
    options: [
      'Congresso Nacional',
      'Conselho Monetário Nacional',
      'Copom',
      'Presidente da República',
    ],
    correctIndex: 1,
    explanation:
      'O Conselho Monetário Nacional, formado por ministros e pelo presidente do Banco Central, define a meta. O Copom decide a Selic para alcançá-la.',
    source:
      'Decreto nº 3.088, de 21/06/1999; Banco Central do Brasil, Metas para a Inflação (bcb.gov.br).',
    category: 'instituicoes',
    scope: 'brasil',
  },
  {
    key: 'inflacao-maior-que-o-rendimento',
    question:
      'Um investimento rende 6% ao ano e a inflação do ano é de 8%. O que acontece com o poder de compra desse dinheiro?',
    options: ['Aumenta', 'Fica igual', 'Diminui', 'Depende só do dólar'],
    correctIndex: 2,
    explanation:
      'O dinheiro cresceu menos do que os preços, então compra menos do que antes. Esse é o rendimento real negativo, mesmo com saldo maior na conta.',
    source:
      'Banco Central do Brasil, Cidadania Financeira, inflação e rendimento real (bcb.gov.br).',
    category: 'juros-e-inflacao',
    scope: 'brasil',
  },
  {
    key: 'meta-atual-de-inflacao',
    question: 'Qual é o centro da meta contínua de inflação do Brasil desde 2025?',
    options: ['2%', '3%', '4%', '4,5%'],
    correctIndex: 1,
    explanation:
      'O CMN fixou o centro em 3%, com tolerância de 1,5 ponto para cima ou para baixo. A meta só é considerada descumprida se a inflação ficar fora da faixa por seis meses seguidos.',
    source:
      'Banco Central do Brasil, Metas para a Inflação (bcb.gov.br/controleinflacao/metainflacao).',
    category: 'juros-e-inflacao',
    scope: 'brasil',
  },
  {
    key: 'data-ex-dividendo',
    question:
      'Na data ex, o que costuma acontecer com o preço de uma ação que vai pagar dividendos?',
    options: [
      'Cai aproximadamente o valor do provento',
      'Dobra',
      'A negociação é suspensa',
      'Sobe o valor do provento',
    ],
    correctIndex: 0,
    explanation:
      'Quem compra a partir da data ex não recebe o provento anunciado, então o preço se ajusta para baixo, em valor próximo ao do provento.',
    source: 'B3, Proventos em dinheiro e datas (b3.com.br).',
    category: 'bolsa-e-acoes',
    scope: 'brasil',
  },
  {
    key: 'dolar-sobe-e-exportador',
    question:
      'Quando o dólar sobe em relação ao real, o que acontece com o exportador brasileiro que recebe em dólares?',
    options: [
      'Recebe mais reais pelas mesmas vendas',
      'Recebe menos reais pelas mesmas vendas',
      'Precisa pagar imposto extra',
      'Não muda nada',
    ],
    correctIndex: 0,
    explanation:
      'Cada dólar recebido vale mais reais, então a receita em reais aumenta. Já quem importa ou tem dívida em dólar sente o contrário: paga mais caro.',
    source: 'Banco Central do Brasil, Cidadania Financeira, câmbio (bcb.gov.br).',
    category: 'planos-e-moeda',
    scope: 'brasil',
  },
]
