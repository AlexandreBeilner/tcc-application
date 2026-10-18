import type { DailyCategory } from './categories'
import type { ContentScope } from '../domain/content'

// Eventos da Linha do tempo (cartão `timeline`). Cada evento traz fonte primária, categoria e o
// marcador Brasil/fora; fato de fora explica o efeito no Brasil (seção 3.3). `label` é o nome curto
// mostrado ao jogador e NÃO pode entregar o ano. `explanation` aparece depois de ordenar.
export interface EventSeed {
  key: string
  year: number
  label: string
  explanation: string
  source: string
  category: DailyCategory
  scope: ContentScope
}

export const EVENT_SEEDS: readonly EventSeed[] = [
  {
    key: 'banco-do-brasil-1808',
    year: 1808,
    label: 'Criação do primeiro Banco do Brasil',
    explanation:
      'Com a corte portuguesa no Rio de Janeiro, nasceu o primeiro banco do país, que emitia papel-moeda e financiava o governo.',
    source: 'Alvará de 12/10/1808; Banco do Brasil, memória institucional (bb.com.br).',
    category: 'instituicoes',
    scope: 'brasil',
  },
  {
    key: 'bolsa-de-sao-paulo-1890',
    year: 1890,
    label: 'Fundação da bolsa de São Paulo, origem da B3',
    explanation:
      'A bolsa paulista, que começou negociando fundos públicos, é a origem da Bovespa e, depois de fusões, da B3.',
    source: 'B3, Nossa história (b3.com.br).',
    category: 'bolsa-e-acoes',
    scope: 'brasil',
  },
  {
    key: 'quebra-da-bolsa-1929',
    year: 1929,
    label: 'Quebra da Bolsa de Nova York',
    explanation:
      'A crise derrubou a demanda mundial por café, principal produto de exportação do Brasil, e o preço do grão despencou.',
    source: 'FGV CPDOC, Dicionário Histórico-Biográfico Brasileiro, verbete "Crise de 1929".',
    category: 'crises-e-choques',
    scope: 'fora',
  },
  {
    key: 'cruzeiro-1942',
    year: 1942,
    label: 'O cruzeiro substitui o réis',
    explanation:
      'O Decreto-Lei 4.791 trocou o réis pelo cruzeiro, na primeira de várias trocas de moeda do século XX no Brasil.',
    source: 'Decreto-Lei nº 4.791, de 5/10/1942 (planalto.gov.br).',
    category: 'planos-e-moeda',
    scope: 'brasil',
  },
  {
    key: 'bretton-woods-1944',
    year: 1944,
    label: 'Conferência de Bretton Woods',
    explanation:
      'Criou o FMI e o Banco Mundial e fixou as moedas ao dólar. O Brasil participou da conferência e entrou nas duas instituições.',
    source: 'FMI, História (imf.org); Banco Central do Brasil, Museu de Valores.',
    category: 'instituicoes',
    scope: 'fora',
  },
  {
    key: 'fgts-1966',
    year: 1966,
    label: 'Criação do FGTS',
    explanation:
      'A Lei 5.107 criou o Fundo de Garantia do Tempo de Serviço, com depósito mensal do empregador em conta do trabalhador.',
    source: 'Lei nº 5.107, de 13/09/1966 (legis.senado.leg.br).',
    category: 'produtos-e-regras',
    scope: 'brasil',
  },
  {
    key: 'minidesvalorizacoes-1968',
    year: 1968,
    label: 'Começam as minidesvalorizações do câmbio',
    explanation:
      'Em vez de grandes saltos, o governo passou a desvalorizar a moeda em pequenos ajustes frequentes, método que durou anos.',
    source:
      'Banco Central do Brasil, Museu de Valores, "Moedas do Brasil" e Revista Brasileira de Economia (FGV).',
    category: 'planos-e-moeda',
    scope: 'brasil',
  },
  {
    key: 'banco-central-1964',
    year: 1964,
    label: 'Lei que cria o Banco Central e o CMN',
    explanation:
      'A Lei 4.595 criou o Banco Central e o Conselho Monetário Nacional. O BC começou a funcionar em 1965.',
    source: 'Lei nº 4.595, de 31/12/1964 (planalto.gov.br).',
    category: 'instituicoes',
    scope: 'brasil',
  },
  {
    key: 'mercado-de-capitais-1965',
    year: 1965,
    label: 'Lei do Mercado de Capitais',
    explanation:
      'A Lei 4.728 disciplinou o mercado de capitais e deu base legal às corretoras e ao registro de emissões de valores mobiliários.',
    source: 'Lei nº 4.728, de 14/07/1965 (planalto.gov.br).',
    category: 'instituicoes',
    scope: 'brasil',
  },
  {
    key: 'fim-dolar-ouro-1971',
    year: 1971,
    label: 'Os EUA acabam com a conversão do dólar em ouro',
    explanation:
      'O dólar deixou de ter lastro em ouro e as moedas passaram a oscilar. O Brasil, que atrelava o câmbio ao dólar, sentiu a instabilidade.',
    source:
      'Federal Reserve History, "Nixon Ends Convertibility of U.S. Dollars to Gold" (federalreservehistory.org).',
    category: 'planos-e-moeda',
    scope: 'fora',
  },
  {
    key: 'choque-petroleo-1973',
    year: 1973,
    label: 'Primeiro choque do petróleo',
    explanation:
      'O preço do barril quadruplicou. O Brasil importava a maior parte do petróleo que consumia, e a conta externa e a inflação pioraram.',
    source: 'Banco Central do Brasil, Relatório Anual 1973; Petrobras, memória institucional.',
    category: 'crises-e-choques',
    scope: 'fora',
  },
  {
    key: 'cvm-1976',
    year: 1976,
    label: 'Criação da CVM',
    explanation:
      'A Lei 6.385 criou a Comissão de Valores Mobiliários, que fiscaliza o mercado de ações e protege quem investe.',
    source: 'Lei nº 6.385, de 7/12/1976 (planalto.gov.br).',
    category: 'instituicoes',
    scope: 'brasil',
  },
  {
    key: 'choque-juros-1979',
    year: 1979,
    label: 'Segundo choque do petróleo e disparada dos juros americanos',
    explanation:
      'Parte da dívida externa brasileira tinha juros flutuantes. Com a alta dos juros nos EUA, pagá-la ficou muito mais caro.',
    source: 'Banco Central do Brasil, Relatório Anual 1980; Federal Reserve History.',
    category: 'crises-e-choques',
    scope: 'fora',
  },
  {
    key: 'moratoria-mexico-1982',
    year: 1982,
    label: 'México declara moratória',
    explanation:
      'O crédito externo secou para toda a América Latina. O Brasil, muito endividado em dólares, teve de recorrer ao FMI no ano seguinte.',
    source:
      'FMI, "The Latin American debt crisis" (imf.org); Banco Central do Brasil, Relatório Anual 1982.',
    category: 'crises-e-choques',
    scope: 'fora',
  },
  {
    key: 'plano-cruzado-1986',
    year: 1986,
    label: 'Plano Cruzado',
    explanation:
      'Congelou preços e trocou o cruzeiro pelo cruzado. A inflação caiu no começo, mas voltou quando o congelamento perdeu força.',
    source: 'Decreto-Lei nº 2.283, de 27/02/1986 (planalto.gov.br).',
    category: 'planos-e-moeda',
    scope: 'brasil',
  },
  {
    key: 'moratoria-brasil-1987',
    year: 1987,
    label: 'Brasil suspende o pagamento de juros da dívida externa',
    explanation:
      'Com as reservas esgotadas, o país suspendeu o pagamento dos juros aos bancos estrangeiros, o que afastou o crédito externo.',
    source: 'Banco Central do Brasil, Relatório Anual 1987.',
    category: 'crises-e-choques',
    scope: 'brasil',
  },
  {
    key: 'plano-verao-1989',
    year: 1989,
    label: 'Plano Verão',
    explanation:
      'Criou o cruzado novo, cortando três zeros da moeda, e congelou preços de novo. A inflação seguiu em alta nos meses seguintes.',
    source: 'Medida Provisória nº 32, de 15/01/1989; IBGE, série histórica do IPCA/INPC.',
    category: 'planos-e-moeda',
    scope: 'brasil',
  },
  {
    key: 'plano-collor-1990',
    year: 1990,
    label: 'Plano Collor',
    explanation:
      'Trouxe de volta o cruzeiro e bloqueou por 18 meses os saldos acima de um limite em contas e na poupança.',
    source:
      'Medida Provisória nº 168, de 15/03/1990; Lei nº 8.024, de 12/04/1990 (planalto.gov.br).',
    category: 'planos-e-moeda',
    scope: 'brasil',
  },
  {
    key: 'mercosul-1991',
    year: 1991,
    label: 'Assinatura do Tratado de Assunção, base do Mercosul',
    explanation:
      'Brasil, Argentina, Paraguai e Uruguai combinaram reduzir tarifas entre si, o que abriu o comércio e a economia do país.',
    source: 'Tratado de Assunção, 26/03/1991 (mercosur.int); Decreto nº 350, de 21/11/1991.',
    category: 'economia-geral',
    scope: 'brasil',
  },
  {
    key: 'cruzeiro-real-1993',
    year: 1993,
    label: 'Cruzeiro real',
    explanation:
      'A moeda ganhou nova troca, com corte de três zeros. Com a inflação ainda altíssima, serviu de ponte para o plano que viria no ano seguinte.',
    source: 'Medida Provisória nº 336, de 28/07/1993; Banco Central do Brasil, Museu de Valores.',
    category: 'planos-e-moeda',
    scope: 'brasil',
  },
  {
    key: 'plano-real-1994',
    year: 1994,
    label: 'Plano Real',
    explanation:
      'Depois de meses de URV, o real entrou em circulação em 1º de julho de 1994. A inflação, que beirava 5.000% em 12 meses, desabou.',
    source:
      'Lei nº 8.880, de 27/05/1994 (planalto.gov.br); Banco Central do Brasil, Museu de Valores.',
    category: 'planos-e-moeda',
    scope: 'brasil',
  },
  {
    key: 'fgc-1995',
    year: 1995,
    label: 'Criação do FGC',
    explanation:
      'O Fundo Garantidor de Créditos nasceu para proteger quem deixa dinheiro em bancos e financeiras se uma instituição quebrar.',
    source: 'Resolução CMN nº 2.211, de 16/11/1995 (bcb.gov.br).',
    category: 'instituicoes',
    scope: 'brasil',
  },
  {
    key: 'proer-1995',
    year: 1995,
    label: 'Programa Proer de socorro a bancos',
    explanation:
      'Com a queda da inflação, bancos que viviam dela passaram a ter perdas. O Proer facilitou a venda e a reestruturação dessas instituições.',
    source: 'Resolução CMN nº 2.208, de 03/11/1995 (bcb.gov.br).',
    category: 'instituicoes',
    scope: 'brasil',
  },
  {
    key: 'copom-1996',
    year: 1996,
    label: 'Criação do Copom',
    explanation:
      'O Comitê de Política Monetária passou a reunir a diretoria do Banco Central para definir, de forma periódica, a taxa básica de juros.',
    source: 'Banco Central do Brasil, Copom: histórico (bcb.gov.br/controleinflacao).',
    category: 'instituicoes',
    scope: 'brasil',
  },
  {
    key: 'privatizacao-vale-1997',
    year: 1997,
    label: 'Privatização da Companhia Vale do Rio Doce',
    explanation:
      'A mineradora estatal foi vendida em leilão. A empresa privada virou uma das maiores da bolsa brasileira.',
    source:
      'BNDES, Programa Nacional de Desestatização (bndes.gov.br); B3, histórico de listagem da Vale.',
    category: 'bolsa-e-acoes',
    scope: 'brasil',
  },
  {
    key: 'crise-asiatica-1997',
    year: 1997,
    label: 'Crise asiática',
    explanation:
      'Começou na Tailândia e fez investidores fugirem de países emergentes. O Brasil elevou os juros com força para segurar o real.',
    source: 'Banco Central do Brasil, Relatório Anual 1997; FMI, "The Asian crisis" (imf.org).',
    category: 'crises-e-choques',
    scope: 'fora',
  },
  {
    key: 'crise-russia-1998',
    year: 1998,
    label: 'Crise da Rússia',
    explanation:
      'A moratória russa fechou o crédito para emergentes. O Brasil perdeu dezenas de bilhões de dólares em reservas em poucas semanas.',
    source: 'Banco Central do Brasil, Relatório Anual 1998.',
    category: 'crises-e-choques',
    scope: 'fora',
  },
  {
    key: 'telebras-1998',
    year: 1998,
    label: 'Privatização do Sistema Telebras',
    explanation:
      'A telefonia estatal foi dividida e vendida em leilão, em uma das maiores privatizações do país, e o número de linhas cresceu muito.',
    source: 'BNDES, Programa Nacional de Desestatização (bndes.gov.br).',
    category: 'economia-geral',
    scope: 'brasil',
  },
  {
    key: 'cambio-flutuante-1999',
    year: 1999,
    label: 'Fim da banda cambial: o real passa a flutuar',
    explanation:
      'O Banco Central parou de sustentar o dólar dentro de limites. A moeda se desvalorizou forte e o câmbio passou a variar com o mercado.',
    source: 'Banco Central do Brasil, "10 anos de câmbio flutuante" (bcb.gov.br).',
    category: 'planos-e-moeda',
    scope: 'brasil',
  },
  {
    key: 'metas-inflacao-1999',
    year: 1999,
    label: 'Adoção do regime de metas de inflação',
    explanation:
      'O Decreto 3.088 fixou que o Banco Central persegue uma meta de inflação definida pelo CMN, e a Selic virou seu principal instrumento.',
    source: 'Decreto nº 3.088, de 21/06/1999 (planalto.gov.br).',
    category: 'juros-e-inflacao',
    scope: 'brasil',
  },
  {
    key: 'lrf-2000',
    year: 2000,
    label: 'Lei de Responsabilidade Fiscal',
    explanation:
      'A Lei Complementar 101 impôs limites de gasto com pessoal e de endividamento para União, estados e municípios.',
    source: 'Lei Complementar nº 101, de 04/05/2000 (planalto.gov.br).',
    category: 'economia-geral',
    scope: 'brasil',
  },
  {
    key: 'novo-mercado-2000',
    year: 2000,
    label: 'Lançamento do Novo Mercado',
    explanation:
      'A Bovespa criou um segmento para empresas que aceitam regras extras de governança, como só ter ações ordinárias.',
    source: 'B3, Novo Mercado: histórico e regulamento (b3.com.br).',
    category: 'bolsa-e-acoes',
    scope: 'brasil',
  },
  {
    key: 'bolha-pontocom-2000',
    year: 2000,
    label: 'Estouro da bolha das empresas de internet',
    explanation:
      'As ações de tecnologia despencaram nos EUA e arrastaram bolsas pelo mundo, inclusive a brasileira.',
    source: 'Nasdaq, histórico do índice Nasdaq Composite (nasdaq.com).',
    category: 'crises-e-choques',
    scope: 'fora',
  },
  {
    key: 'china-omc-2001',
    year: 2001,
    label: 'China entra na OMC',
    explanation:
      'A entrada impulsionou o comércio mundial e a demanda chinesa por soja, minério e petróleo, o que turbinou as exportações do Brasil.',
    source: 'Organização Mundial do Comércio, "China and the WTO" (wto.org).',
    category: 'economia-geral',
    scope: 'fora',
  },
  {
    key: 'tesouro-direto-2002',
    year: 2002,
    label: 'Lançamento do Tesouro Direto',
    explanation:
      'O Tesouro Nacional abriu a venda de títulos públicos pela internet para pessoas físicas, com valores pequenos.',
    source: 'Tesouro Nacional, "Tesouro Direto: história" (tesourodireto.com.br).',
    category: 'produtos-e-regras',
    scope: 'brasil',
  },
  {
    key: 'isencao-lci-lca-2004',
    year: 2004,
    label: 'Isenção de IR para LCI e LCA de pessoas físicas',
    explanation:
      'A Lei 11.033 isentou do imposto de renda os rendimentos de LCI e LCA para pessoas físicas, o que tornou esses títulos populares.',
    source: 'Lei nº 11.033, de 21/12/2004, art. 3º, III (planalto.gov.br).',
    category: 'produtos-e-regras',
    scope: 'brasil',
  },
  {
    key: 'lei-falencias-2005',
    year: 2005,
    label: 'Lei de Recuperação de Empresas e Falências',
    explanation:
      'A Lei 11.101 criou a recuperação judicial, que dá à empresa em crise um prazo para renegociar dívidas sem fechar as portas.',
    source: 'Lei nº 11.101, de 09/02/2005 (planalto.gov.br).',
    category: 'produtos-e-regras',
    scope: 'brasil',
  },
  {
    key: 'fim-divida-fmi-2005',
    year: 2005,
    label: 'Brasil quita a dívida com o FMI',
    explanation:
      'O país pagou antecipadamente o que devia ao Fundo, num momento de reservas altas e exportações em alta.',
    source: 'Banco Central do Brasil, Relatório Anual 2005.',
    category: 'instituicoes',
    scope: 'brasil',
  },
  {
    key: 'pre-sal-2007',
    year: 2007,
    label: 'Petrobras anuncia a descoberta do campo de Tupi, no pré-sal',
    explanation:
      'A descoberta de petróleo em camadas abaixo do sal marinho mudou as expectativas sobre o futuro da produção brasileira.',
    source: 'Petrobras, comunicado ao mercado de 08/11/2007 (petrobras.com.br).',
    category: 'bolsa-e-acoes',
    scope: 'brasil',
  },
  {
    key: 'ipo-bovespa-2007',
    year: 2007,
    label: 'Abertura de capital da Bovespa',
    explanation:
      'A bolsa deixou de ser uma associação de corretoras e passou a ter ações próprias negociadas por investidores.',
    source: 'B3, Nossa história (b3.com.br).',
    category: 'bolsa-e-acoes',
    scope: 'brasil',
  },
  {
    key: 'grau-de-investimento-2008',
    year: 2008,
    label: 'Brasil recebe o grau de investimento',
    explanation:
      'A Standard & Poor\'s deu ao país nota de "bom pagador", o que atraiu investidores que só aplicam em países com essa classificação.',
    source:
      "Standard & Poor's, comunicado de 30/04/2008; Banco Central do Brasil, Relatório de Inflação.",
    category: 'risco-e-analise',
    scope: 'brasil',
  },
  {
    key: 'bmf-bovespa-2008',
    year: 2008,
    label: 'Fusão da BM&F com a Bovespa',
    explanation:
      'A bolsa de ações e a bolsa de derivativos e mercadorias se uniram e formaram a BM&FBovespa.',
    source: 'B3, Nossa história (b3.com.br).',
    category: 'bolsa-e-acoes',
    scope: 'brasil',
  },
  {
    key: 'lehman-2008',
    year: 2008,
    label: 'Quebra do banco Lehman Brothers',
    explanation:
      'A falência provocou pânico global. Investidores estrangeiros retiraram dinheiro da bolsa brasileira e o dólar disparou no Brasil.',
    source:
      'Federal Reserve History, "The Great Recession and its aftermath" (federalreservehistory.org).',
    category: 'crises-e-choques',
    scope: 'fora',
  },
  {
    key: 'poupanca-2012',
    year: 2012,
    label: 'Poupança ganha nova regra quando a Selic é baixa',
    explanation:
      'Com a Selic em 8,5% ao ano ou menos, os novos depósitos passaram a render 70% da Selic mais a TR, para a poupança não bater os títulos públicos.',
    source:
      'Lei nº 12.703, de 07/08/2012, conversão da Medida Provisória nº 567 (planalto.gov.br).',
    category: 'produtos-e-regras',
    scope: 'brasil',
  },
  {
    key: 'swap-cambial-2013',
    year: 2013,
    label: 'Banco Central lança o programa de swaps cambiais',
    explanation:
      'O sinal de que o banco central americano reduziria estímulos desvalorizou moedas emergentes. O BC passou a vender proteção contra a alta do dólar.',
    source: 'Banco Central do Brasil, Comunicado de 22/08/2013 (bcb.gov.br).',
    category: 'juros-e-inflacao',
    scope: 'brasil',
  },
  {
    key: 'perda-grau-investimento-2015',
    year: 2015,
    label: 'Brasil perde o grau de investimento',
    explanation:
      "A Standard & Poor's rebaixou a nota do país para o nível especulativo, o que afasta fundos que só podem comprar títulos de países com grau de investimento.",
    source: "Standard & Poor's, comunicado de 09/09/2015.",
    category: 'risco-e-analise',
    scope: 'brasil',
  },
  {
    key: 'teto-de-gastos-2016',
    year: 2016,
    label: 'Emenda do teto de gastos',
    explanation:
      'A Emenda Constitucional 95 limitou o crescimento da despesa federal à inflação do ano anterior, por vários anos.',
    source: 'Emenda Constitucional nº 95, de 15/12/2016 (planalto.gov.br).',
    category: 'economia-geral',
    scope: 'brasil',
  },
  {
    key: 'brexit-2016',
    year: 2016,
    label: 'Reino Unido decide sair da União Europeia',
    explanation:
      'O resultado surpreendeu o mercado: a libra caiu, os investidores buscaram o dólar e o real também se desvalorizou naquele dia.',
    source: 'Bank of England, "The economics of Brexit" (bankofengland.co.uk).',
    category: 'crises-e-choques',
    scope: 'fora',
  },
  {
    key: 'joesley-day-2017',
    year: 2017,
    label: 'Joesley Day',
    explanation:
      'A divulgação de gravações de uma delação fez o Ibovespa cair quase 9% e acionou o circuit breaker, a primeira vez desde 2008.',
    source: 'B3, Circuit breaker (b3.com.br); cobertura de fechamento do pregão de 18/05/2017.',
    category: 'crises-e-choques',
    scope: 'brasil',
  },
  {
    key: 'b3-2017',
    year: 2017,
    label: 'Nasce a B3',
    explanation:
      'A BM&FBovespa se uniu à Cetip, que registrava títulos de renda fixa, e a nova bolsa recebeu o nome B3, de Brasil, Bolsa, Balcão.',
    source: 'B3, Nossa história (b3.com.br).',
    category: 'instituicoes',
    scope: 'brasil',
  },
  {
    key: 'guerra-comercial-2018',
    year: 2018,
    label: 'Guerra comercial entre EUA e China',
    explanation:
      'A China passou a taxar a soja americana e comprou mais soja do Brasil, o que elevou as exportações brasileiras do grão.',
    source: 'USTR, Section 301 investigation; Ministério da Agricultura, exportações de soja.',
    category: 'crises-e-choques',
    scope: 'fora',
  },
  {
    key: 'greve-caminhoneiros-2018',
    year: 2018,
    label: 'Greve dos caminhoneiros',
    explanation:
      'A paralisação travou o transporte de cargas por dias, causou desabastecimento e pesou na atividade e na inflação daquele ano.',
    source: 'IBGE, Contas Nacionais Trimestrais, 2º trimestre de 2018.',
    category: 'crises-e-choques',
    scope: 'brasil',
  },
  {
    key: 'ibovespa-100-mil-2019',
    year: 2019,
    label: 'Ibovespa fecha acima de 100 mil pontos pela primeira vez',
    explanation:
      'O índice cruzou a marca histórica com a expectativa pela reforma da Previdência e pela queda dos juros.',
    source: 'B3, histórico do Ibovespa, fechamento de 19/03/2019 (b3.com.br).',
    category: 'bolsa-e-acoes',
    scope: 'brasil',
  },
  {
    key: 'reforma-previdencia-2019',
    year: 2019,
    label: 'Reforma da Previdência',
    explanation:
      'A Emenda Constitucional 103 mudou as regras de aposentadoria, com idade mínima, para reduzir o ritmo de crescimento da despesa.',
    source: 'Emenda Constitucional nº 103, de 12/11/2019 (planalto.gov.br).',
    category: 'economia-geral',
    scope: 'brasil',
  },
  {
    key: 'circuit-breaker-covid-2020',
    year: 2020,
    label: 'Ibovespa despenca quase 15% em um dia, com dois circuit breakers',
    explanation:
      'O pânico da pandemia derrubou as bolsas do mundo. Em 12 de março, a B3 interrompeu o pregão duas vezes no mesmo dia.',
    source: 'B3, Circuit breaker (b3.com.br); fechamento do Ibovespa em 12/03/2020.',
    category: 'crises-e-choques',
    scope: 'fora',
  },
  {
    key: 'petroleo-negativo-2020',
    year: 2020,
    label: 'Petróleo americano fecha com preço negativo',
    explanation:
      'Sem onde guardar o petróleo na pandemia, o contrato do WTI para o mês seguinte caiu abaixo de zero. Isso pesou nas ações de petroleiras, como a Petrobras.',
    source: 'CME Group, WTI crude oil futures, liquidação de 20/04/2020.',
    category: 'crises-e-choques',
    scope: 'fora',
  },
  {
    key: 'selic-2-2020',
    year: 2020,
    label: 'Selic cai para 2% ao ano, a menor da série',
    explanation:
      'Para amortecer o choque da pandemia, o Copom levou a taxa básica ao menor nível desde o início da série, em 1996.',
    source: 'Banco Central do Brasil, Copom, Comunicado de 05/08/2020 (bcb.gov.br).',
    category: 'juros-e-inflacao',
    scope: 'brasil',
  },
  {
    key: 'pix-2020',
    year: 2020,
    label: 'Lançamento do Pix',
    explanation:
      'O Banco Central lançou o sistema de pagamentos instantâneos, que funciona 24 horas por dia e com custo baixo ou nulo para quem paga.',
    source: 'Banco Central do Brasil, Pix (bcb.gov.br/estabilidadefinanceira/pix).',
    category: 'instituicoes',
    scope: 'brasil',
  },
  {
    key: 'selic-sobe-2021',
    year: 2021,
    label: 'Começa um ciclo de alta da Selic depois da mínima',
    explanation:
      'Com a inflação em alta, o Copom subiu a taxa de 2,00% para 2,75% ao ano e continuou subindo nas reuniões seguintes.',
    source: 'Banco Central do Brasil, Copom, Comunicado de 17/03/2021 (bcb.gov.br).',
    category: 'juros-e-inflacao',
    scope: 'brasil',
  },
  {
    key: 'guerra-ucrania-2022',
    year: 2022,
    label: 'Rússia invade a Ucrânia',
    explanation:
      'O conflito encareceu petróleo, trigo e fertilizantes. O Brasil importa muitos fertilizantes, e a alta de preços pesou na inflação.',
    source: 'IBGE, IPCA 2022; Banco Central do Brasil, Relatório de Inflação, março de 2022.',
    category: 'crises-e-choques',
    scope: 'fora',
  },
  {
    key: 'selic-13-75-2022',
    year: 2022,
    label: 'Selic chega a 13,75% ao ano',
    explanation:
      'O Copom concluiu um ciclo de altas para combater a inflação e levou a taxa a 13,75% ao ano, onde ficou por mais de um ano.',
    source: 'Banco Central do Brasil, Copom, Comunicado de agosto de 2022 (bcb.gov.br).',
    category: 'juros-e-inflacao',
    scope: 'brasil',
  },
  {
    key: 'americanas-2023',
    year: 2023,
    label: 'Americanas revela inconsistências contábeis',
    explanation:
      'A varejista divulgou inconsistências de bilhões de reais, as ações despencaram e a empresa pediu recuperação judicial dias depois.',
    source: 'Americanas S.A., Fato Relevante de 11/01/2023 (cvm.gov.br, sistema Empresas.NET).',
    category: 'bolsa-e-acoes',
    scope: 'brasil',
  },
  {
    key: 'arcabouco-fiscal-2023',
    year: 2023,
    label: 'Novo arcabouço fiscal',
    explanation:
      'A Lei Complementar 200 trocou o teto de gastos por regras que ligam o crescimento da despesa à evolução da receita.',
    source: 'Lei Complementar nº 200, de 30/08/2023 (planalto.gov.br).',
    category: 'economia-geral',
    scope: 'brasil',
  },
  {
    key: 'reforma-tributaria-2023',
    year: 2023,
    label: 'Promulgada a reforma tributária sobre o consumo',
    explanation:
      'A Emenda Constitucional 132 previu a substituição de vários impostos sobre consumo por um modelo de imposto sobre valor agregado, em transição por anos.',
    source: 'Emenda Constitucional nº 132, de 20/12/2023 (planalto.gov.br).',
    category: 'produtos-e-regras',
    scope: 'brasil',
  },
  {
    key: 'selic-15-2025',
    year: 2025,
    label: 'Selic sobe para 15% ao ano, o maior nível em quase vinte anos',
    explanation:
      'Com a inflação acima da meta, o Copom elevou a taxa de 14,75% para 15% ao ano, patamar que não se via desde 2006.',
    source: 'Banco Central do Brasil, Copom, Comunicado de 18/06/2025 (bcb.gov.br).',
    category: 'juros-e-inflacao',
    scope: 'brasil',
  },
  {
    key: 'isencao-ir-2025',
    year: 2025,
    label: 'Lei amplia a isenção do imposto de renda até R$ 5 mil',
    explanation:
      'A Lei 15.270 isentou quem recebe até R$ 5 mil por mês, a partir de 2026, e criou um imposto mínimo para rendas muito altas.',
    source: 'Lei nº 15.270, de 26/11/2025 (planalto.gov.br).',
    category: 'produtos-e-regras',
    scope: 'brasil',
  },
]
