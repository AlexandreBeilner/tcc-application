import type { DailyCategory } from './categories'
import type { ContentScope } from '../domain/content'

// Palavras-resposta do Termo (cartão `word`). A primeira posição é como aparece na revelação (com
// acento); a forma normalizada (`answer`) sai de `normalizeWord`. As definições seguem a linha dos
// cartões das lições: uma frase curta, sem termo que ela mesma não explique. Marcador `fora` só para
// o que é de fora do Brasil (o resto é ensinado no contexto brasileiro). O seed recusa palavra que
// não esteja na lista aceita (VERO ou extras).
export interface WordSeed {
  display: string
  definition: string
  category: DailyCategory
  scope: ContentScope
}

type Entry = readonly [display: string, definition: string]

function group(category: DailyCategory, entries: readonly Entry[], scope: ContentScope = 'brasil') {
  return entries.map(([display, definition]): WordSeed => ({
    display,
    definition,
    category,
    scope,
  }))
}

const JUROS_E_INFLACAO: readonly Entry[] = [
  [
    'JUROS',
    'Preço do dinheiro no tempo: o que se paga para usar dinheiro emprestado ou o que se recebe por emprestá-lo.',
  ],
  ['SELIC', 'Taxa básica de juros da economia brasileira, definida pelo Copom a cada reunião.'],
  [
    'IPCA',
    'Índice oficial de inflação do Brasil, calculado pelo IBGE, que mede a variação de preços para as famílias.',
  ],
  [
    'INPC',
    'Índice de preços do IBGE focado em famílias com renda de até cinco salários mínimos, base do reajuste de vários benefícios.',
  ],
  ['IGPM', 'Índice geral de preços da FGV, muito usado em reajustes de aluguéis e contratos.'],
  ['COPOM', 'Comitê do Banco Central que se reúne periodicamente para definir a meta da Selic.'],
  [
    'TAXA',
    'Percentual aplicado sobre um valor em determinado período, como a de juros de um empréstimo.',
  ],
  [
    'META',
    'No regime de metas, é o valor de inflação que o Banco Central deve perseguir, fixado pelo Conselho Monetário Nacional.',
  ],
  ['INFLAÇÃO', 'Alta generalizada e contínua dos preços, que faz o mesmo dinheiro comprar menos.'],
  ['DEFLAÇÃO', 'Queda generalizada e contínua dos preços, o contrário da inflação.'],
  [
    'REAJUSTE',
    'Atualização de um valor, como aluguel ou salário, para repor a perda causada pela inflação.',
  ],
  [
    'INDEXADOR',
    'Referência, como o CDI ou o IPCA, à qual a remuneração de um investimento ou o custo de uma dívida está atrelada.',
  ],
  [
    'PREFIXADO',
    'Título cuja taxa de juros é combinada na compra, de modo que se sabe quanto ele rende até o vencimento.',
  ],
  [
    'SPREAD',
    'Diferença entre a taxa que o banco cobra num empréstimo e a que paga para captar dinheiro.',
  ],
  [
    'COMPOSTO',
    'Tipo de juros calculado sobre o capital mais os juros já acumulados, o famoso juros sobre juros.',
  ],
  [
    'SIMPLES',
    'Tipo de juros calculado sempre sobre o valor inicial, sem incidir sobre juros anteriores.',
  ],
  ['CAPITAL', 'Quantia inicial investida ou emprestada, sobre a qual os juros são calculados.'],
  [
    'PREÇOS',
    'Valores cobrados por bens e serviços; a variação média deles é o que a inflação mede.',
  ],
  [
    'CESTA',
    'Conjunto de bens e serviços que os índices de inflação acompanham para medir a variação de preços.',
  ],
  ['TETO', 'Limite máximo, como o da meta de inflação ou o do valor que a lei permite gastar.'],
  ['PISO', 'Limite mínimo, como o do salário de uma categoria.'],
  [
    'CARÊNCIA',
    'Prazo durante o qual o dinheiro aplicado não pode ser resgatado ou a dívida ainda não precisa ser paga.',
  ],
  ['CORREÇÃO', 'Atualização de um valor por um índice, como o IPCA, para acompanhar a inflação.'],
  [
    'ÍNDICE',
    'Número que resume a variação de um conjunto de preços ou de ativos, como o IPCA e o Ibovespa.',
  ],
  ['SÉRIE', 'Sequência de valores ao longo do tempo, como a série histórica da taxa Selic.'],
  ['REAL', 'Rendimento descontada a inflação; é o que sobra de ganho de poder de compra.'],
  ['NOMINAL', 'Valor sem descontar a inflação, como a taxa que aparece no contrato.'],
  [
    'CURVA',
    'Gráfico que liga as taxas de juros a prazos diferentes, usado para ver o que o mercado espera.',
  ],
  ['PRAZO', 'Tempo até o vencimento de um título ou de uma dívida.'],
]

const PLANOS_E_MOEDA: readonly Entry[] = [
  ['MOEDA', 'Meio de troca aceito em um país para pagar bens, serviços e dívidas, como o real.'],
  ['CÂMBIO', 'Troca de uma moeda por outra; também o preço de uma moeda em relação à outra.'],
  ['DÓLAR', 'Moeda dos Estados Unidos, a mais usada no comércio e nas reservas internacionais.'],
  ['EURO', 'Moeda comum de vários países da União Europeia.'],
  [
    'OURO',
    'Metal precioso usado há séculos como reserva de valor e, no passado, como lastro de moedas.',
  ],
  ['CRUZADO', 'Moeda brasileira criada pelo Plano Cruzado, em 1986.'],
  ['CRUZEIRO', 'Nome de moeda brasileira que circulou em diferentes períodos do século XX.'],
  ['PARIDADE', 'Relação de equivalência entre o valor de duas moedas.'],
  ['COTAÇÃO', 'Preço de um ativo ou de uma moeda em determinado momento.'],
  [
    'SWAP',
    'Contrato em que duas partes trocam entre si o resultado de dois indicadores, como juros e câmbio.',
  ],
  [
    'HEDGE',
    'Proteção contra variações de preço ou de câmbio, feita com operações que compensam o risco.',
  ],
  ['ESPÉCIE', 'Dinheiro em cédulas e moedas, em vez de transferência ou cartão.'],
  [
    'BANDA',
    'Faixa de valores dentro da qual o governo tenta manter o câmbio, como no regime adotado após o Plano Real.',
  ],
  [
    'FLUTUAR',
    'No câmbio, variar livremente conforme a oferta e a procura, sem faixa fixada pelo governo.',
  ],
  ['LASTRO', 'Garantia ou ativo real que sustenta um título, uma moeda ou uma operação.'],
  [
    'RESERVAS',
    'Dólares e outros ativos em moeda forte que o Banco Central mantém para dar segurança ao país.',
  ],
  ['CONVERTER', 'Trocar um valor de uma moeda por outro valor em moeda diferente.'],
  ['REMESSA', 'Envio de dinheiro de uma pessoa ou empresa para outro país.'],
  ['EXPORTAR', 'Vender bens e serviços para outros países, o que traz moeda estrangeira.'],
  ['IMPORTAR', 'Comprar bens e serviços de outros países, o que exige moeda estrangeira.'],
  ['TARIFA', 'Imposto cobrado sobre produtos importados; também o preço cobrado por um serviço.'],
  ['CÉDULA', 'Dinheiro em papel, emitido pelo Banco Central.'],
  ['CUNHAR', 'Fabricar moedas metálicas, tarefa da Casa da Moeda.'],
]

const INSTITUICOES: readonly Entry[] = [
  [
    'BANCO',
    'Instituição financeira que recebe depósitos, concede crédito e presta serviços como pagamentos.',
  ],
  ['BOLSA', 'Ambiente organizado onde se compram e vendem ações e outros valores mobiliários.'],
  [
    'TESOURO',
    'Órgão do governo federal que administra a dívida pública e emite os títulos do Tesouro Direto.',
  ],
  [
    'CORRETORA',
    'Instituição que faz a ponte entre o investidor e a bolsa, executando as ordens de compra e venda.',
  ],
  ['CUSTÓDIA', 'Guarda dos ativos do investidor, como ações e títulos, em registro em seu nome.'],
  [
    'CETIP',
    'Antiga central que registrava títulos de renda fixa; se fundiu à BM&FBovespa e formou a B3.',
  ],
  [
    'BNDES',
    'Banco do governo federal que financia investimentos de longo prazo de empresas e projetos.',
  ],
  [
    'ANBIMA',
    'Associação que reúne bancos e gestoras e define regras de autorregulação do mercado de capitais.',
  ],
  [
    'GESTORA',
    'Empresa que decide onde investir o dinheiro de um fundo e responde por essas escolhas.',
  ],
  [
    'AUDITORIA',
    'Exame independente das contas de uma empresa, para atestar se o balanço reflete a realidade.',
  ],
  [
    'REGULADOR',
    'Órgão que cria e fiscaliza as regras de um setor, como a CVM no mercado de capitais.',
  ],
  [
    'CONSELHO',
    'Colegiado que toma decisões de um órgão ou de uma empresa, como o Conselho Monetário Nacional.',
  ],
  [
    'CAIXA',
    'Valor disponível de imediato numa empresa ou numa conta; também banco público federal.',
  ],
  ['CRÉDITO', 'Dinheiro colocado à disposição de alguém para pagar depois, normalmente com juros.'],
  ['SEGURO', 'Contrato que protege contra um prejuízo mediante o pagamento de um prêmio.'],
  [
    'FUNDO',
    'Reunião de dinheiro de vários investidores, gerida por profissional, para aplicar em conjunto.',
  ],
  [
    'DIRETORIA',
    'Grupo de executivos que administra uma empresa ou um órgão, como o Banco Central.',
  ],
  [
    'MERCADO',
    'Conjunto de compradores e vendedores que negociam um bem ou um ativo e formam seu preço.',
  ],
  [
    'EMISSOR',
    'Quem lança um título ou uma ação no mercado, como o governo, um banco ou uma empresa.',
  ],
]

const PRODUTOS_E_REGRAS: readonly Entry[] = [
  [
    'POUPANÇA',
    'Aplicação tradicional dos bancos, com rendimento definido em lei e isenta de imposto de renda para pessoa física.',
  ],
  [
    'DEBÊNTURE',
    'Título de dívida emitido por empresa para captar dinheiro do mercado e que paga juros a quem o compra.',
  ],
  [
    'TÍTULO',
    'Papel que representa um direito de crédito, como os emitidos pelo governo, por bancos e por empresas.',
  ],
  ['LETRA', 'Tipo de título de crédito, como a letra financeira ou a letra de câmbio.'],
  ['COTA', 'Fração de um fundo; quem a compra se torna dono de uma parte do patrimônio dele.'],
  [
    'CDBS',
    'Certificados de depósito bancário: o investidor empresta dinheiro ao banco e recebe juros por isso.',
  ],
  [
    'LCIS',
    'Letras de crédito imobiliário: títulos de bancos ligados ao financiamento de imóveis, isentos de imposto de renda para pessoa física.',
  ],
  [
    'LCAS',
    'Letras de crédito do agronegócio: títulos de bancos ligados ao financiamento do campo, isentos de imposto de renda para pessoa física.',
  ],
  [
    'PGBL',
    'Plano de previdência privada cujas contribuições podem ser deduzidas do imposto de renda até um limite.',
  ],
  ['VGBL', 'Plano de previdência privada cujo imposto incide só sobre os rendimentos, no resgate.'],
  [
    'CONSÓRCIO',
    'Grupo de pessoas que se junta para formar uma poupança comum e comprar um bem por sorteio ou lance.',
  ],
  [
    'FINANCIAR',
    'Comprar um bem pagando em parcelas, com juros, a uma instituição que adianta o valor.',
  ],
  [
    'CARTÃO',
    'Meio de pagamento que permite comprar agora e pagar depois (crédito) ou debitar da conta na hora.',
  ],
  ['PARCELA', 'Cada pagamento de uma dívida dividida em vários vencimentos.'],
  ['RESGATE', 'Retirada do dinheiro aplicado em um investimento.'],
  ['APLICAR', 'Colocar dinheiro em um investimento para que ele renda.'],
  ['APORTE', 'Quantia que o investidor adiciona a uma aplicação.'],
  ['SAQUE', 'Retirada de dinheiro de uma conta.'],
  ['IMPOSTO', 'Valor que a lei obriga a pagar ao governo, como o imposto de renda.'],
  ['ALÍQUOTA', 'Percentual aplicado sobre uma base para calcular um imposto.'],
  ['TRIBUTO', 'Nome geral para o que o governo cobra por lei: impostos, taxas e contribuições.'],
  ['ISENÇÃO', 'Situação em que a lei dispensa o pagamento de um imposto.'],
  ['ISENTO', 'Que não paga determinado imposto, como a LCI para pessoa física.'],
  [
    'DARF',
    'Documento usado para pagar tributos federais, como o imposto sobre ganho de capital em ações.',
  ],
  [
    'FGTS',
    'Fundo de Garantia do Tempo de Serviço: depósito mensal feito pelo empregador em conta do trabalhador.',
  ],
  ['GARANTIA', 'Bem ou proteção que assegura o pagamento de uma dívida.'],
  ['CUPOM', 'Pagamento periódico de juros de um título, antes do vencimento.'],
  ['CARTEIRA', 'Conjunto dos investimentos de uma pessoa ou de um fundo.'],
  ['SALDO', 'Valor disponível em uma conta ou aplicação em determinado momento.'],
  ['EXTRATO', 'Documento que lista as movimentações e o saldo de uma conta ou aplicação.'],
  ['RETIRADA', 'Saída de dinheiro de uma conta ou aplicação.'],
  ['DESCONTO', 'Redução no preço de algo; num título, o preço pago abaixo do valor de face.'],
  ['BOLETO', 'Documento de cobrança com código de barras usado para pagar contas e compras.'],
  [
    'CHEQUE',
    'Ordem de pagamento dada a um banco para transferir dinheiro da conta de quem a emite.',
  ],
  ['ANUIDADE', 'Valor cobrado a cada ano por um cartão de crédito ou serviço.'],
  ['COBRANÇA', 'Pedido de pagamento de uma dívida ou de um serviço.'],
  ['HIPOTECA', 'Garantia de dívida em que um imóvel é dado como segurança do pagamento.'],
  [
    'AVAL',
    'Garantia dada por uma pessoa que se compromete a pagar a dívida de outra se ela não pagar.',
  ],
  ['FIADOR', 'Pessoa que se responsabiliza por pagar a dívida de outra se ela deixar de pagar.'],
  ['DÍVIDA', 'Valor que uma pessoa, empresa ou governo deve a outro.'],
  ['MULTA', 'Valor cobrado por atraso ou descumprimento de uma regra do contrato.'],
  ['CONTRATO', 'Acordo escrito entre partes, com direitos e deveres de cada uma.'],
]

const BOLSA_E_ACOES: readonly Entry[] = [
  ['AÇÕES', 'Pedaços de uma empresa vendidos na bolsa; quem as compra se torna sócio dela.'],
  ['AÇÃO', 'Parcela do capital de uma empresa, negociada na bolsa.'],
  ['LOTE', 'Quantidade padrão de ações negociada de uma vez; na bolsa brasileira, 100 ações.'],
  ['PREGÃO', 'Período em que a bolsa funciona e as ordens de compra e venda são executadas.'],
  ['DIVIDENDO', 'Parte do lucro que a empresa distribui aos acionistas.'],
  [
    'PROVENTOS',
    'Valores que a empresa paga ao acionista, como dividendos e juros sobre capital próprio.',
  ],
  [
    'BÔNUS',
    'Ações novas entregues aos acionistas, sem custo, quando a empresa incorpora reservas ao capital.',
  ],
  [
    'SPLIT',
    'Desdobramento de ações, que multiplica a quantidade e reduz o preço de cada uma sem mudar o valor total.',
  ],
  ['ORDEM', 'Instrução que o investidor dá à corretora para comprar ou vender um ativo.'],
  ['VENDA', 'Operação em que se entrega um ativo em troca de dinheiro.'],
  ['LUCRO', 'O que sobra da receita da empresa depois de descontar custos, despesas e impostos.'],
  ['PREJUÍZO', 'Resultado negativo: as despesas e custos foram maiores que a receita.'],
  [
    'BALANÇO',
    'Demonstração das contas de uma empresa, com seus bens, dívidas e patrimônio em uma data.',
  ],
  ['PAPEL', 'Forma de se referir a um ativo negociado na bolsa, como uma ação.'],
  ['TICKER', 'Código de letras e números que identifica um ativo na bolsa, como PETR4.'],
  [
    'IBOVESPA',
    'Principal índice da bolsa brasileira, formado por uma carteira teórica das ações mais negociadas.',
  ],
  ['OFERTA', 'Quantidade de um bem que os vendedores aceitam vender a determinado preço.'],
  ['DEMANDA', 'Quantidade de um bem que os compradores querem adquirir a determinado preço.'],
  ['LEILÃO', 'Venda em que o bem vai a quem oferece o maior preço, como o de títulos do Tesouro.'],
  ['ABERTURA', 'Início do pregão ou da negociação de um papel no dia.'],
  ['GRÁFICO', 'Representação visual da variação de preço de um ativo ao longo do tempo.'],
  ['TENDÊNCIA', 'Direção predominante do preço de um ativo, de alta ou de baixa, por um período.'],
  [
    'SUPORTE',
    'Nível de preço abaixo do qual, historicamente, o papel tem tido dificuldade de cair.',
  ],
  ['VOLUME', 'Quantidade de ações ou valor financeiro negociado em um período.'],
  [
    'ANALISTA',
    'Profissional que estuda empresas e mercados para recomendar ou avaliar investimentos.',
  ],
  ['ATIVO', 'Bem ou direito que tem valor e pode render, como ação, título ou imóvel.'],
  [
    'OPÇÃO',
    'Contrato que dá o direito, mas não a obrigação, de comprar ou vender um ativo a um preço fixado.',
  ],
  [
    'FUTURO',
    'Contrato de compra ou venda de um ativo por preço combinado hoje, para entrega ou liquidação em data futura.',
  ],
  [
    'TERMO',
    'Contrato de compra ou venda de um ativo a preço fixado, com liquidação em data futura combinada.',
  ],
  [
    'BOLHA',
    'Alta de preços descolada do valor real do ativo, que tende a terminar em queda forte.',
  ],
  ['BOVESPA', 'Antiga bolsa de valores de São Paulo, que depois formou a B3.'],
  ['NASDAQ', 'Bolsa americana conhecida por empresas de tecnologia.'],
  ['EMISSÃO', 'Lançamento de ações ou títulos novos no mercado para captar dinheiro.'],
  ['LISTAGEM', 'Admissão de uma empresa para ter suas ações negociadas na bolsa.'],
  ['SÓCIO', 'Pessoa dona de parte de uma empresa, como quem tem ações dela.'],
  [
    'CONTROLE',
    'Poder de comandar uma empresa, normalmente de quem tem a maioria das ações com voto.',
  ],
  ['SETOR', 'Grupo de empresas que atuam em atividades parecidas, como bancos ou varejo.'],
  ['RALI', 'Sequência de altas fortes e seguidas nos preços do mercado.'],
  ['BAIXISTA', 'Investidor que espera queda de preços e aposta nela.'],
  ['ALTISTA', 'Investidor que espera alta de preços e aposta nela.'],
  ['GANHO', 'Valor obtido com a venda de um ativo por preço maior que o da compra.'],
]

const RISCO_E_ANALISE: readonly Entry[] = [
  [
    'RISCO',
    'Chance de o resultado de um investimento ser diferente do esperado, inclusive de perder dinheiro.',
  ],
  ['RETORNO', 'Ganho ou perda de um investimento, normalmente em percentual do valor aplicado.'],
  ['PERDA', 'Valor que se deixa de ter quando um investimento perde valor.'],
  ['BETA', 'Medida de quanto o preço de uma ação costuma oscilar em relação ao mercado.'],
  [
    'DESVIO',
    'Medida de quanto os resultados se afastam da média, usada para medir a oscilação de um investimento.',
  ],
  [
    'MÉDIA',
    'Valor que resume um conjunto de números, obtido somando-os e dividindo pela quantidade.',
  ],
  ['CENÁRIO', 'Hipótese sobre como a economia ou o mercado pode se comportar no futuro.'],
  ['CICLO', 'Sequência de fases de alta e de baixa que se repete na economia ou em um setor.'],
  ['CRISE', 'Período de forte queda na atividade econômica ou nos mercados.'],
  [
    'RECESSÃO',
    'Queda da atividade econômica por pelo menos dois trimestres seguidos, com menos produção e emprego.',
  ],
  [
    'RATING',
    'Nota dada por uma agência de classificação à capacidade de um país ou empresa de pagar suas dívidas.',
  ],
  [
    'GRAU',
    'Nível de uma classificação, como o grau de investimento dado a países considerados bons pagadores.',
  ],
  ['CALOTE', 'Falta de pagamento de uma dívida no prazo.'],
  ['DEFAULT', 'Termo em inglês para o não pagamento de uma dívida.'],
  [
    'PERFIL',
    'Conjunto de características que mostra quanto risco uma pessoa aceita correr ao investir.',
  ],
  [
    'MODERADO',
    'Perfil de investidor que aceita um pouco de risco em busca de retorno um pouco maior.',
  ],
  ['ARROJADO', 'Perfil de investidor que aceita correr risco maior para tentar retornos maiores.'],
  ['AGRESSIVO', 'Perfil de investidor que aceita grande oscilação em busca de retornos altos.'],
  ['PRUDENTE', 'Que evita riscos e prefere investimentos mais seguros, mesmo com retorno menor.'],
  [
    'RESERVA',
    'Dinheiro guardado para imprevistos, mantido em investimento seguro e de fácil resgate.',
  ],
  [
    'MARGEM',
    'Parte do que se vende que vira lucro; também a quantia dada como garantia em certas operações.',
  ],
  [
    'VALOR',
    'Quanto algo vale; no mercado, pode ser o preço de venda ou o quanto o ativo realmente vale.',
  ],
  [
    'JUSTO',
    'Diz-se do preço que reflete o verdadeiro valor de um ativo, na visão de quem o avalia.',
  ],
  ['LUCRATIVO', 'Que dá lucro, isto é, que rende mais do que custa.'],
  [
    'MÚLTIPLO',
    'Indicador que compara o preço de uma empresa com um resultado dela, como o preço sobre o lucro.',
  ],
  ['INDICADOR', 'Número que resume um aspecto de uma empresa ou da economia e ajuda a avaliá-la.'],
  ['AVERSÃO', 'Desagrado com o risco ou com a perda, que leva a evitar certas decisões.'],
  ['VIÉS', 'Tendência de pensamento que leva a erros de decisão, como a aversão à perda.'],
  ['MEDO', 'Emoção que, em excesso, leva investidores a vender na pior hora.'],
  ['PÂNICO', 'Medo coletivo que leva muitas pessoas a vender ao mesmo tempo e derruba os preços.'],
  ['EUFORIA', 'Otimismo exagerado, que leva a pagar caro demais por ativos.'],
  ['MANADA', 'Comportamento de seguir a maioria do mercado sem analisar por conta própria.'],
  ['SOLVENTE', 'Que tem recursos suficientes para pagar suas dívidas.'],
  ['LIQUIDEZ', 'Facilidade de transformar um ativo em dinheiro rapidamente, sem perder valor.'],
  ['EXPOSIÇÃO', 'Quanto da carteira está sujeito a um risco específico.'],
  ['PROJEÇÃO', 'Estimativa do que deve acontecer no futuro, com base em dados e hipóteses.'],
]

const ECONOMIA_GERAL: readonly Entry[] = [
  [
    'PRODUTO',
    'Bem ou serviço que resulta de uma atividade econômica; no PIB, tudo o que se produz no país.',
  ],
  [
    'RENDA',
    'Dinheiro que uma pessoa ou empresa recebe em um período, de salário, aluguel ou investimentos.',
  ],
  ['EMPREGO', 'Ocupação remunerada; o nível de emprego é um indicador da força da economia.'],
  ['SALÁRIO', 'Pagamento regular que o trabalhador recebe do empregador em troca do trabalho.'],
  ['CONSUMO', 'Gasto de famílias com bens e serviços, a maior parte do que a economia produz.'],
  ['ESCASSEZ', 'Situação em que os recursos disponíveis são menores que o desejo de usá-los.'],
  ['COMÉRCIO', 'Atividade de comprar e vender bens e serviços, dentro do país ou entre países.'],
  ['BALANÇA', 'Registro do que o país vende e compra de outros, como a balança comercial.'],
  ['SUPERÁVIT', 'Resultado positivo: o que entrou foi maior do que o que saiu.'],
  ['DÉFICIT', 'Resultado negativo: o que saiu foi maior do que o que entrou.'],
  [
    'ORÇAMENTO',
    'Plano que estima as receitas e define os gastos de uma pessoa, empresa ou governo.',
  ],
  ['GASTO', 'Dinheiro que se usa para comprar bens e serviços.'],
  [
    'RECEITA',
    'Dinheiro que entra, como o que uma empresa arrecada com vendas ou o governo com impostos.',
  ],
  ['SUBSÍDIO', 'Ajuda financeira do governo para reduzir o custo de um produto ou atividade.'],
  ['PRODUÇÃO', 'Tudo o que é fabricado ou realizado pela economia em um período.'],
  ['SAFRA', 'Colheita de um ano agrícola, que influencia as exportações e os preços de alimentos.'],
  [
    'MINÉRIO',
    'Rocha de onde se extrai metal; o minério de ferro é um dos maiores itens da exportação brasileira.',
  ],
  [
    'PETRÓLEO',
    'Combustível fóssil que, depois de refinado, vira gasolina, diesel e outros produtos.',
  ],
  ['SOJA', 'Grão que é um dos principais produtos de exportação do Brasil.'],
  ['CAFÉ', 'Produto agrícola que moveu a economia brasileira por mais de um século.'],
  [
    'AÇÚCAR',
    'Produto agrícola que o Brasil exporta em grande quantidade, produzido a partir da cana.',
  ],
  ['INDÚSTRIA', 'Setor que transforma matérias-primas em produtos fabricados.'],
  [
    'SERVIÇOS',
    'Setor que vende atividades, como comércio, bancos e saúde, e é o maior da economia brasileira.',
  ],
  ['ATIVIDADE', 'Nível de produção e de negócios da economia em um período.'],
  [
    'ECONOMIA',
    'Estudo de como as pessoas e os países usam recursos limitados para atender suas necessidades.',
  ],
  ['RIQUEZA', 'Conjunto de bens e dinheiro que uma pessoa ou um país possui.'],
  [
    'MONOPÓLIO',
    'Situação em que uma só empresa domina a oferta de um produto e pode controlar o preço.',
  ],
  [
    'CARTEL',
    'Acordo entre empresas concorrentes para combinar preços ou dividir mercados, o que é proibido.',
  ],
  ['ESTATAL', 'Empresa controlada pelo governo.'],
  [
    'CONCESSÃO',
    'Autorização do governo para uma empresa explorar um serviço público, como rodovia ou aeroporto.',
  ],
  ['TRABALHO', 'Esforço humano aplicado à produção de bens e serviços.'],
  [
    'COMMODITY',
    'Produto básico negociado em escala mundial, como petróleo, soja e minério de ferro.',
  ],
  ['EXCEDENTE', 'Parte que sobra além do necessário.'],
  ['INVESTIR', 'Aplicar recursos hoje esperando obter retorno no futuro.'],
  ['POUPAR', 'Guardar parte da renda em vez de gastá-la.'],
  ['FATURA', 'Documento que lista o que se deve por compras, como a do cartão de crédito.'],
  ['MORATÓRIA', 'Suspensão do pagamento de uma dívida por decisão de quem deve.'],
  ['BREXIT', 'Saída do Reino Unido da União Europeia, decidida em plebiscito em 2016.'],
  ['INSUMO', 'Matéria-prima ou serviço usado para produzir outro bem.'],
  ['ESTOQUE', 'Mercadorias guardadas por uma empresa à espera de venda.'],
  [
    'LOGÍSTICA',
    'Organização do transporte e do armazenamento de produtos, do produtor ao consumidor.',
  ],
  ['TRIGO', 'Cereal base do pão, que o Brasil importa em boa parte.'],
  ['MILHO', 'Cereal importante para ração animal, etanol e exportação do agronegócio brasileiro.'],
  [
    'ENERGIA',
    'Insumo essencial para a produção; o preço dela pesa na inflação e nos custos das empresas.',
  ],
]

const MAIS_TERMOS: readonly [DailyCategory, readonly Entry[]][] = [
  [
    'produtos-e-regras',
    [
      [
        'ÁGIO',
        'Quando se paga mais que o valor de referência; num fundo ou título, o preço acima do valor justo.',
      ],
      [
        'DESÁGIO',
        'Diferença para menos entre o valor de face de um título e o preço pago por ele.',
      ],
      [
        'PRÊMIO',
        'Valor pago por um seguro ou por uma opção; também recompensa por assumir mais risco.',
      ],
      [
        'BALCÃO',
        'Mercado em que as negociações acontecem fora da bolsa, direto entre as partes e registradas em sistema.',
      ],
      ['DEPÓSITO', 'Dinheiro entregue a um banco para ser guardado e movimentado pelo cliente.'],
      ['CONTA', 'Registro bancário onde ficam o saldo e as movimentações de um cliente.'],
      ['DEVEDOR', 'Quem deve dinheiro a outra pessoa ou instituição.'],
      ['CREDOR', 'Quem tem a receber de outra pessoa ou instituição.'],
      ['AMORTIZAR', 'Pagar parte da dívida, reduzindo o saldo devedor.'],
      ['PRESTAÇÃO', 'Cada parcela paga de uma compra financiada ou de um empréstimo.'],
      ['ENTRADA', 'Parte do valor paga no ato da compra de um bem financiado.'],
      ['OBRIGAÇÃO', 'Dever de pagar ou de cumprir algo previsto em contrato.'],
      ['USURA', 'Cobrança de juros abusivos num empréstimo.'],
      ['TRIBUTAR', 'Cobrar imposto sobre uma renda, um bem ou uma operação.'],
      ['ARRECADAR', 'Receber dinheiro, como o governo faz com os impostos.'],
    ],
  ],
  [
    'bolsa-e-acoes',
    [
      ['ACIONISTA', 'Pessoa ou empresa dona de ações de uma companhia.'],
      ['EMPRESA', 'Organização que produz bens ou serviços para vender e obter lucro.'],
      ['FUSÃO', 'União de duas empresas em uma só.'],
      ['CISÃO', 'Divisão de uma empresa em duas ou mais.'],
      ['AQUISIÇÃO', 'Compra de uma empresa ou de parte dela por outra.'],
      [
        'FALÊNCIA',
        'Situação em que a empresa não consegue pagar suas dívidas e seus bens são usados para pagar os credores.',
      ],
      ['DILUIÇÃO', 'Perda de participação do acionista quando a empresa emite novas ações.'],
      ['COMPRADOR', 'Quem adquire um bem ou um ativo.'],
      ['VENDEDOR', 'Quem oferece um bem ou um ativo à venda.'],
      ['SOCIEDADE', 'União de pessoas para exercer atividade em conjunto e dividir resultados.'],
      ['TRIMESTRE', 'Período de três meses, usado nos balanços das empresas de capital aberto.'],
      ['SEMESTRE', 'Período de seis meses.'],
      ['DESPESA', 'Gasto necessário para manter a empresa funcionando.'],
      ['FLUXO', 'Movimento de dinheiro que entra e sai de uma empresa ou de um mercado.'],
      ['PASSIVO', 'Conjunto das dívidas e obrigações de uma empresa.'],
      [
        'EBITDA',
        'Lucro operacional antes de juros, impostos, depreciação e amortização, usado para comparar empresas.',
      ],
      ['PAYOUT', 'Parte do lucro de uma empresa que é paga como dividendo aos acionistas.'],
      [
        'ALAVANCAR',
        'Usar dívida para ampliar o investimento e tentar aumentar o ganho, mas também o risco.',
      ],
      ['ORDINÁRIA', 'Tipo de ação que dá direito a voto nas assembleias da empresa.'],
    ],
  ],
  [
    'risco-e-analise',
    [
      [
        'BENCHMARK',
        'Referência usada para comparar o resultado de um investimento, como o CDI ou o Ibovespa.',
      ],
      ['POUPADOR', 'Quem guarda parte do que ganha em vez de gastar tudo.'],
    ],
  ],
  [
    'commodities-e-setores',
    [
      ['BARRIL', 'Unidade de volume usada para o petróleo, equivalente a cerca de 159 litros.'],
      ['ETANOL', 'Álcool combustível, produzido no Brasil sobretudo a partir da cana-de-açúcar.'],
      [
        'DIESEL',
        'Combustível derivado do petróleo usado por caminhões e ônibus, cujo preço pesa no frete.',
      ],
      [
        'GASOLINA',
        'Combustível derivado do petróleo usado em carros, cujo preço pesa na inflação.',
      ],
    ],
  ],
  [
    'cambio-e-setor-externo',
    [
      [
        'DIVISAS',
        'Moedas estrangeiras que entram ou saem de um país, como os dólares das exportações.',
      ],
    ],
  ],
  [
    'eventos-globais',
    [
      [
        'CHOQUE',
        'Mudança brusca e inesperada, como na oferta ou no preço de um produto, que abala a economia.',
      ],
      ['EMBARGO', 'Proibição oficial de comprar ou vender de um país, usada como sanção.'],
    ],
  ],
  [
    'crises-e-choques',
    [
      [
        'QUEBRA',
        'Falência de empresa ou banco que não paga o que deve. Também se diz da perda de uma safra.',
      ],
      ['GREVE', 'Paralisação coletiva do trabalho que pode afetar a produção e o abastecimento.'],
    ],
  ],
  [
    'politica-fiscal',
    [
      [
        'LICITAÇÃO',
        'Processo público pelo qual o governo escolhe quem vai lhe vender produtos ou prestar serviços.',
      ],
      ['REFORMA', 'Mudança nas regras de um sistema, como a tributária ou a da Previdência.'],
    ],
  ],
]

const ALL: WordSeed[] = [
  ...group('juros-e-inflacao', JUROS_E_INFLACAO),
  ...group('planos-e-moeda', PLANOS_E_MOEDA),
  ...group('instituicoes', INSTITUICOES),
  ...group('produtos-e-regras', PRODUTOS_E_REGRAS),
  ...group('bolsa-e-acoes', BOLSA_E_ACOES),
  ...group('risco-e-analise', RISCO_E_ANALISE),
  ...group('economia-geral', ECONOMIA_GERAL),
  ...MAIS_TERMOS.flatMap(([category, entries]) => group(category, entries)),
]

const FORA = new Set(['EURO', 'NASDAQ', 'BREXIT', 'ÓLEO'])

export const WORD_SEEDS: readonly WordSeed[] = ALL.map((w) =>
  FORA.has(w.display) ? { ...w, scope: 'fora' as const } : w,
)
