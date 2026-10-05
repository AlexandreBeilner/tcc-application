import type { LessonBlocks } from '../modules/lessons/domain/widgets/lessonBlocks'

// Lições de "ler uma empresa" reescritas (RC.5.10): balanço, margens,
// endividamento, ROE, P/L e P/VP, Dividend Yield. Fatos: `cvm-itr-dfp-prazos`
// (só a ideia de ITR trimestral e DFP anual, sem os prazos, que seguem como
// trecho de busca), `dividendos-retencao-lei-15270` e `jcp-aliquota`. Os
// números dos widgets são de exemplo, em milhões de reais, e o texto principal
// não afirma número de empresa do catálogo. A diferença para o mercado real
// fica no bloco "Na plataforma".

export const BLOCKS_2_7_1: LessonBlocks = {
  schemaVersion: 1,
  phases: {
    scenario: [
      {
        type: 'text',
        markup:
          'Empresa de capital aberto presta contas ao mercado: publica o {{ITR e DFP}}, com os resultados de cada trimestre e do ano. É dali que saem os números que você vai aprender a ler.',
      },
      {
        type: 'text',
        markup:
          'Três contam o resultado: a {{receita líquida}} (o que a empresa vendeu), o {{EBIT}} (lucro da operação, antes de juros e imposto) e o {{lucro líquido}} (o que sobra no fim).',
      },
      {
        type: 'text',
        markup:
          'Outros três mostram a situação: o {{patrimônio líquido}} (o que a empresa tem menos o que deve), a dívida bruta e o caixa.',
      },
    ],
    microDecision: [
      {
        type: 'text',
        markup: 'O patrimônio líquido de uma empresa é o que ela vale na bolsa?',
      },
    ],
    revelation: [
      {
        type: 'text',
        markup:
          'Não. O patrimônio líquido é um valor contábil: o que a empresa tem menos o que deve, registrado no balanço. O valor na bolsa é o {{valor de mercado}}, preço da ação vezes o número de ações.',
      },
      {
        type: 'widget',
        id: 'balanco-interativo',
        widget: 'interactive-balance',
        props: {},
        caption:
          'Mude custos, despesas, juros e imposto e veja a receita virar lucro. Embaixo, o que a empresa tem é igual ao que deve mais o patrimônio líquido.',
      },
      {
        type: 'check',
        id: 'ebit-x-lucro',
        kind: 'single',
        prompt: 'Em geral, o EBIT de uma empresa é maior ou menor que o lucro líquido?',
        options: ['Maior', 'Menor', 'Sempre igual'],
        answer: 0,
        explanation:
          'O EBIT vem antes de juros e imposto, então em geral é maior. Com muita receita financeira ou crédito fiscal pode inverter, por isso a pergunta diz "em geral".',
      },
      {
        type: 'check',
        id: 'patrimonio-liquido-conta',
        kind: 'numeric',
        prompt:
          'Uma empresa tem R$ 900 milhões em bens e direitos e deve R$ 600 milhões. Qual é o patrimônio líquido, em milhões de reais?',
        answer: 300,
        tolerance: 0.5,
        unit: 'R$ milhões',
        explanation: 'O que ela tem (900) menos o que deve (600) dá 300.',
      },
      {
        type: 'check',
        id: 'caixa-nao-e-patrimonio',
        kind: 'true_false',
        prompt: 'Caixa e patrimônio líquido são a mesma coisa.',
        answer: false,
        explanation:
          'O caixa é só uma parte do que a empresa tem. O patrimônio líquido é tudo o que ela tem menos tudo o que deve.',
      },
      {
        type: 'text',
        markup:
          'Dívida bruta e caixa, sozinhos, ainda não dizem se a empresa está endividada de verdade. É a conta entre os dois que importa, e a próxima lição faz essa conta.',
      },
      {
        type: 'widget',
        id: 'nota-balanco',
        widget: 'platform-note',
        props: {
          brazil: 'As empresas publicam o ITR a cada trimestre e a DFP uma vez por ano, e você lê tudo na CVM.',
          here: 'As empresas são fictícias e o relatório sai em ciclos regulares, com os mesmos números básicos.',
          why: 'Assim você treina a leitura de resultado sem depender do calendário de empresas reais.',
        },
      },
    ],
  },
}

export const BLOCKS_2_7_2: LessonBlocks = {
  schemaVersion: 1,
  phases: {
    scenario: [
      {
        type: 'text',
        markup:
          'Duas empresas podem vender o mesmo e lucrar bem diferente. A {{margem}} mostra quanto de cada R$ 1 de receita vira lucro, em cada etapa do resultado.',
      },
      {
        type: 'text',
        markup:
          'Margem bruta, margem EBIT e margem líquida são o lucro de cada etapa dividido pela receita líquida. Quanto mais para o fim, menos sobra.',
      },
    ],
    microDecision: [
      {
        type: 'text',
        markup:
          'A empresa A vende R$ 1 bilhão e lucra R$ 50 milhões. A empresa B vende R$ 200 milhões e lucra R$ 40 milhões. Qual converte melhor a receita em lucro?',
      },
    ],
    revelation: [
      {
        type: 'text',
        markup:
          'A empresa B. Ela fica com 20% da receita como lucro líquido, e a A fica com 5%. Quem vende mais nem sempre sobra mais por real vendido.',
      },
      {
        type: 'widget',
        id: 'comparador-de-margens',
        widget: 'margin-comparator',
        props: {},
        caption: 'Edite receita e lucros das duas empresas e veja quem converte melhor em cada etapa.',
      },
      {
        type: 'check',
        id: 'margem-ebit-conta',
        kind: 'numeric',
        prompt: 'Uma empresa vende R$ 800 milhões e tem EBIT de R$ 120 milhões. Qual é a margem EBIT, em %?',
        answer: 15,
        tolerance: 0.1,
        unit: '%',
        explanation: '120 dividido por 800 dá 0,15, ou seja, 15%.',
      },
      {
        type: 'check',
        id: 'liquida-menor-que-ebit',
        kind: 'single',
        prompt: 'Em geral, por que a margem líquida é menor que a margem EBIT?',
        options: [
          'Porque ainda desconta juros e imposto',
          'Porque usa outra receita',
          'Porque soma os dividendos pagos',
        ],
        answer: 0,
        explanation:
          'O lucro líquido já descontou o que o EBIT ainda não descontou: juros e imposto. A receita, nas duas, é a mesma.',
      },
      {
        type: 'check',
        id: 'margem-entre-setores',
        kind: 'true_false',
        prompt: 'Uma margem de 30% é boa em qualquer setor.',
        answer: false,
        explanation:
          'Cada setor tem margens típicas diferentes. Margem se compara entre empresas do mesmo setor e da mesma empresa ao longo do tempo.',
      },
      {
        type: 'check',
        id: 'margem-pontual',
        kind: 'true_false',
        prompt: 'Uma margem líquida muito alta em um único ano prova que o negócio é melhor.',
        answer: false,
        explanation:
          'Um ganho pontual, como a venda de um imóvel, infla o lucro de um ano. Olhe vários períodos antes de concluir.',
      },
    ],
  },
}

export const BLOCKS_2_7_3: LessonBlocks = {
  schemaVersion: 1,
  phases: {
    scenario: [
      {
        type: 'text',
        markup:
          'Dívida alta assusta, mas sozinha não conta a história. Uma empresa com muita dívida e ainda mais caixa pode estar mais segura que outra com pouca dívida e nenhum caixa.',
      },
      {
        type: 'text',
        markup:
          'A {{dívida líquida}} é a dívida bruta menos o caixa. Dívida que financia o negócio é {{alavancagem}}: amplia os ganhos quando tudo vai bem e as perdas quando não vai.',
      },
    ],
    microDecision: [
      {
        type: 'text',
        markup:
          'Uma empresa tem dívida bruta alta, mas um caixa ainda mais alto. A dívida líquida dela é alta ou baixa?',
      },
    ],
    revelation: [
      {
        type: 'text',
        markup:
          'Baixa, e pode até ser negativa: se o caixa supera a dívida bruta, a empresa tem mais dinheiro guardado do que deve.',
      },
      {
        type: 'text',
        markup:
          'A dívida líquida dividida pelo EBIT dá uma aproximação de quantos anos de resultado da operação seriam necessários para quitar a dívida.',
      },
      {
        type: 'widget',
        id: 'termometro-de-divida',
        widget: 'debt-thermometer',
        props: {},
        caption:
          'Mude dívida, caixa e EBIT. Depois aperte o botão de choque e veja a dívida atrelada ao CDI encarecer.',
      },
      {
        type: 'check',
        id: 'divida-liquida-sobre-ebit',
        kind: 'numeric',
        prompt:
          'Dívida bruta de R$ 800 milhões, caixa de R$ 300 milhões e EBIT de R$ 250 milhões. Quantos anos de EBIT cabem na dívida líquida?',
        answer: 2,
        tolerance: 0.01,
        unit: 'anos',
        explanation: 'A dívida líquida é 800 menos 300, ou 500. Dividido pelo EBIT de 250, dá 2 anos.',
      },
      {
        type: 'check',
        id: 'divida-e-so-aproximacao',
        kind: 'true_false',
        prompt: 'Dívida líquida sobre EBIT diz exatamente em quantos anos a empresa quita a dívida.',
        answer: false,
        explanation:
          'É só uma aproximação: ignora imposto, investimento e juros, e supõe um EBIT que se repete todo ano.',
      },
      {
        type: 'check',
        id: 'selic-sobe-qual-divida',
        kind: 'single',
        prompt: 'A Selic sobe. Qual dívida de uma empresa encarece mais, de imediato?',
        options: ['A prefixada, com taxa travada', 'A atrelada ao CDI', 'As duas, igualmente'],
        answer: 1,
        explanation:
          'A dívida atrelada ao CDI acompanha a Selic e fica mais cara na hora. A prefixada só pesa quando for trocada por uma nova, a juros mais altos.',
      },
      {
        type: 'text',
        markup:
          'Em banco, captar dinheiro é a matéria-prima do negócio. Por isso a dívida líquida sobre o EBIT costuma não se aplicar a banco, e ele tem os próprios indicadores.',
      },
      {
        type: 'check',
        id: 'divida-ebit-banco',
        kind: 'true_false',
        prompt: 'Dívida líquida sobre EBIT é um bom jeito de comparar um banco com uma mineradora.',
        answer: false,
        explanation:
          'A dívida do banco é parte do negócio dele, não um peso a quitar. A comparação engana, e vale comparar banco com banco.',
      },
    ],
  },
}

export const BLOCKS_2_7_4: LessonBlocks = {
  schemaVersion: 1,
  phases: {
    scenario: [
      {
        type: 'text',
        markup:
          'Duas empresas lucram igual, mas uma precisou de muito mais capital dos sócios para chegar lá. Elas usam o dinheiro dos sócios com a mesma eficiência?',
      },
      {
        type: 'text',
        markup:
          'O {{ROE}} responde: lucro líquido dividido pelo patrimônio líquido. É quanto a empresa rende para cada real que é dos sócios.',
      },
    ],
    microDecision: [
      {
        type: 'text',
        markup:
          'Duas empresas lucram R$ 100 milhões cada. A empresa A tem patrimônio líquido de R$ 500 milhões e a B, de R$ 1 bilhão. Qual tem o ROE maior?',
      },
    ],
    revelation: [
      {
        type: 'text',
        markup:
          'A empresa A: 100 sobre 500 dá 20%, e a B tem 100 sobre 1.000, ou 10%. Para o mesmo lucro, menos capital dos sócios significa mais retorno sobre ele.',
      },
      {
        type: 'widget',
        id: 'laboratorio-de-roe',
        widget: 'roe-lab',
        props: {},
        caption:
          'O ROE é margem vezes giro vezes alavancagem. Mude a dívida e veja o ROE subir junto com o risco.',
      },
      {
        type: 'check',
        id: 'roe-conta',
        kind: 'numeric',
        prompt: 'Lucro líquido de R$ 60 milhões e patrimônio líquido de R$ 400 milhões. Qual é o ROE, em %?',
        answer: 15,
        tolerance: 0.1,
        unit: '%',
        explanation: '60 dividido por 400 dá 0,15, ou 15%.',
      },
      {
        type: 'text',
        markup:
          'ROE alto não é sempre sinal de boa gestão. Ele também sobe quando a empresa se endivida e diminui o patrimônio dos sócios, e o risco sobe junto.',
      },
      {
        type: 'check',
        id: 'roe-com-divida',
        kind: 'single',
        prompt:
          'Com o mesmo lucro, uma empresa troca patrimônio por dívida. O que acontece com o ROE e com o risco?',
        options: ['O ROE sobe e o risco sobe', 'O ROE sobe e o risco cai', 'O ROE não muda'],
        answer: 0,
        explanation: 'Com menos patrimônio o ROE sobe, mas a dívida a mais deixa a empresa mais exposta se o lucro cair.',
      },
      {
        type: 'check',
        id: 'roe-entre-setores',
        kind: 'true_false',
        prompt: 'Dá para comparar direto o ROE de um banco com o de uma mineradora.',
        answer: false,
        explanation:
          'Cada setor tem estrutura de capital e margens diferentes. O ROE compara bem empresas do mesmo setor.',
      },
    ],
  },
}

export const BLOCKS_2_7_5: LessonBlocks = {
  schemaVersion: 1,
  phases: {
    scenario: [
      {
        type: 'text',
        markup:
          'O preço de uma ação sozinho não diz se ela está cara. R$ 20 pode ser muito para quem lucra pouco por ação e pouco para quem lucra muito.',
      },
      {
        type: 'text',
        markup:
          'Primeiro, leve tudo para a base "por ação": {{LPA}}, o lucro líquido dividido pelo número de ações, e {{VPA}}, o patrimônio líquido dividido pelo número de ações.',
      },
      {
        type: 'text',
        markup:
          'O {{P/L}} compara o preço com o LPA, e o {{P/VP}} compara o preço com o VPA.',
      },
    ],
    microDecision: [
      {
        type: 'text',
        markup:
          'O preço de uma ação triplica de um dia para o outro, mas o lucro por ação continua o mesmo. O P/L sobe, desce ou fica igual?',
      },
    ],
    revelation: [
      {
        type: 'text',
        markup:
          'Sobe, e também triplica: o mercado passa a pagar três vezes mais por cada real de lucro. Por esse critério, a ação ficou mais cara.',
      },
      {
        type: 'widget',
        id: 'calculadora-de-multiplos',
        widget: 'multiples-calculator',
        props: {},
        caption: 'Mude o preço, o lucro e o patrimônio e veja LPA, VPA, P/L e P/VP se mexerem.',
      },
      {
        type: 'check',
        id: 'pl-conta',
        kind: 'numeric',
        prompt: 'A ação custa R$ 24 e o lucro por ação é de R$ 2. Qual é o P/L?',
        answer: 12,
        tolerance: 0.01,
        unit: 'vezes',
        explanation: '24 dividido por 2 dá 12: o preço equivale a 12 anos do lucro atual.',
      },
      {
        type: 'check',
        id: 'pl-baixo-e-barato',
        kind: 'single',
        prompt: 'Uma ação tem P/L de 5 e outra, de 25. O que dá para concluir só com isso?',
        options: [
          'A de P/L 5 é necessariamente a melhor compra',
          'A de P/L 25 está sempre cara',
          'Quanto se paga por real de lucro, mas não se é barata: depende de crescimento e risco',
        ],
        answer: 2,
        explanation:
          'O P/L mede o preço por real de lucro. Barata ou cara depende de quanto o lucro deve crescer e do risco, que o número sozinho não mostra.',
      },
      {
        type: 'check',
        id: 'pl-com-prejuizo',
        kind: 'true_false',
        prompt: 'Quando a empresa dá prejuízo, o P/L deixa de ter sentido.',
        answer: true,
        explanation: 'Com lucro negativo, o P/L fica negativo e não diz quantos anos de lucro o preço representa.',
      },
      {
        type: 'check',
        id: 'pvp-abaixo-de-um',
        kind: 'single',
        prompt: 'Uma ação tem P/VP abaixo de 1. O que isso quer dizer?',
        options: [
          'O mercado paga menos que o patrimônio contábil por ação',
          'A empresa está dando prejuízo',
          'A ação vai subir',
        ],
        answer: 0,
        explanation:
          'P/VP abaixo de 1 só mostra que o preço está abaixo do patrimônio contábil por ação. Pode ser oportunidade ou sinal de lucro fraco pela frente.',
      },
      {
        type: 'widget',
        id: 'indicadores-valr3',
        widget: 'live-indicator',
        props: { ticker: 'VALR3' },
        caption: 'Os indicadores atuais de VALR3, calculados com o relatório mais recente da empresa.',
      },
    ],
  },
}

export const BLOCKS_2_7_7: LessonBlocks = {
  schemaVersion: 1,
  phases: {
    scenario: [
      {
        type: 'text',
        markup:
          'Além de se valorizar, uma ação pode pagar parte do lucro aos sócios em dinheiro, os dividendos. O {{Dividend Yield}} resume quanto isso representa frente ao preço.',
      },
      {
        type: 'text',
        markup: 'É a soma dos dividendos pagos por ação nos últimos 12 meses dividida pelo preço atual.',
      },
    ],
    microDecision: [
      {
        type: 'text',
        markup:
          'O preço de uma ação dobra de um dia para o outro, mas os dividendos pagos nos últimos 12 meses continuam os mesmos. O Dividend Yield sobe, desce ou fica igual?',
      },
    ],
    revelation: [
      {
        type: 'text',
        markup:
          'Desce, e cai pela metade: o numerador não mudou e o preço dobrou. Por isso um Dividend Yield alto pode vir de uma empresa que paga bem ou de uma ação que caiu de preço.',
      },
      {
        type: 'check',
        id: 'dy-conta',
        kind: 'numeric',
        prompt: 'Uma ação paga R$ 3,00 de dividendos em 12 meses e custa R$ 50,00. Qual é o Dividend Yield, em %?',
        answer: 6,
        tolerance: 0.1,
        unit: '%',
        explanation: '3 dividido por 50 dá 0,06, ou 6%.',
      },
      {
        type: 'check',
        id: 'dy-alto-por-queda',
        kind: 'single',
        prompt: 'O Dividend Yield de uma ação saltou de 6% para 12%, sem que o dividendo pago tenha mudado. O que explica?',
        options: ['O preço da ação caiu pela metade', 'A empresa dobrou o lucro', 'O imposto diminuiu'],
        answer: 0,
        explanation:
          'Com o dividendo igual, o yield só dobra se o preço cair pela metade. Olhe o preço e o histórico de pagamentos, nunca o número sozinho.',
      },
      {
        type: 'check',
        id: 'dividendo-do-passado',
        kind: 'true_false',
        prompt: 'Quem pagou muito dividendo no ano passado vai pagar o mesmo no próximo.',
        answer: false,
        explanation: 'O dividendo depende do lucro e da decisão da empresa. O Dividend Yield olha para trás e não garante nada.',
      },
      {
        type: 'text',
        markup:
          'O Dividend Yield é bruto, sem imposto. Desde 2026, dividendos acima de R$ 50 mil no mês pagos por uma mesma empresa a uma pessoa física têm 10% retidos na fonte. O {{JCP}} tem 17,5% retidos.',
      },
      {
        type: 'check',
        id: 'retencao-dividendos',
        kind: 'true_false',
        prompt: 'Quem recebe R$ 1.000 de dividendos num mês, de uma mesma empresa, sofre retenção de 10%.',
        answer: false,
        explanation:
          'A retenção de 10% vale acima de R$ 50 mil no mês, da mesma empresa para a mesma pessoa. Abaixo disso, não há retenção sobre o dividendo.',
      },
      {
        type: 'widget',
        id: 'indicadores-dy-valr3',
        widget: 'live-indicator',
        props: { ticker: 'VALR3' },
        caption: 'O Dividend Yield atual de VALR3 e os outros indicadores, com o relatório mais recente.',
      },
    ],
  },
}

// Lições de setores e de ETFs reescritas (RC.5.12). Fatos: `acoes-isencao-20-mil`
// (a isenção de R$ 20 mil não vale para ETF). O imposto do ETF não cita
// alíquota: `etf-ir` segue como trecho de busca (texto da norma não abriu). A
// cesta do ETF do texto é de exemplo (A, B, C, D), sem os pesos do catálogo; o
// que é regra da plataforma fica no bloco "Na plataforma".

export const BLOCKS_2_8: LessonBlocks = {
  schemaVersion: 1,
  phases: {
    scenario: [
      {
        type: 'text',
        markup:
          'Empresas se agrupam em setores, como mineração, bancos, varejo, energia e tecnologia. Cada setor reage de um jeito à economia e aos juros.',
      },
      {
        type: 'text',
        markup:
          'Um setor {{cíclico}} vende mais quando a economia vai bem e sofre quando ela esfria, como o varejo. Um setor {{defensivo}} vende parecido em qualquer fase, como a energia.',
      },
      {
        type: 'check',
        id: 'setor-defensivo',
        kind: 'single',
        prompt: 'Qual destes setores é tipicamente defensivo?',
        options: ['Moda de luxo', 'Distribuição de energia', 'Venda de carros novos'],
        answer: 1,
        explanation:
          'Energia é gasta em qualquer fase da economia. Moda de luxo e carros novos são os primeiros cortes quando o orçamento aperta.',
      },
      {
        type: 'text',
        markup:
          'Juro alto pesa mais em empresa endividada e em quem só vai lucrar lá na frente, porque o dinheiro fica caro hoje e o lucro futuro vale menos.',
      },
    ],
    microDecision: [
      {
        type: 'text',
        markup:
          'A Selic sobe forte. Quem tende a sentir mais nos resultados: a mineradora VALR3, com receita em dólar e pouca dívida, ou a TechNova (TNVA3), de tecnologia, com o lucro concentrado no futuro?',
      },
    ],
    revelation: [
      {
        type: 'text',
        markup:
          'A TechNova. Quando o lucro está mais distante, juro alto o desvaloriza mais. A mineradora tem receita em dólar e pouca dívida, então sente menos.',
      },
      {
        type: 'check',
        id: 'juros-afetam-todos',
        kind: 'true_false',
        prompt: 'Numa alta de juros, todas as empresas pioram do mesmo jeito.',
        answer: false,
        explanation:
          'Depende da dívida, do setor e de quando o lucro aparece. Por isso setores reagem de formas diferentes.',
      },
      {
        type: 'check',
        id: 'carteira-so-ciclica',
        kind: 'single',
        prompt: 'A economia desacelera. Como tende a ir uma carteira só de setores cíclicos, comparada a uma mista?',
        options: ['Sofre mais que a mista', 'Sofre menos que a mista', 'Não muda'],
        answer: 0,
        explanation:
          'Setores defensivos seguram parte da queda. Diversificar entre cíclicos e defensivos reduz o risco da carteira.',
      },
      {
        type: 'widget',
        id: 'nota-setores',
        widget: 'platform-note',
        props: {
          brazil: 'Cada setor reage de um jeito ao ciclo da economia e aos juros, e a intensidade varia a cada momento.',
          here: 'A sensibilidade de cada setor à Selic é uma regra da plataforma, calibrada em empresas reais de cada setor.',
          why: 'Assim uma alta de juros muda os resultados de forma diferente por setor, e você vê o efeito na carteira.',
        },
      },
    ],
  },
}

export const BLOCKS_2_9: LessonBlocks = {
  schemaVersion: 1,
  phases: {
    scenario: [
      {
        type: 'text',
        markup:
          'Um {{ETF}} é um fundo que reproduz um índice e é negociado na bolsa como uma ação. Com uma cota, você tem uma fatia de uma cesta inteira de ativos.',
      },
      {
        type: 'text',
        markup:
          'Imagine um ETF com quatro ativos: o A pesa 40%, o B 20%, o C 25% e o D 15%. Em vez de escolher um por um, você compra a cesta toda.',
      },
    ],
    microDecision: [
      {
        type: 'text',
        markup:
          'No ETF de exemplo, o ativo A, de peso 40%, cai 20% e os outros ficam parados. Quanto cai o ETF?',
      },
    ],
    revelation: [
      {
        type: 'text',
        markup:
          'Cai 8%. O efeito é o peso vezes a queda: 40% de 20%. O resto da cesta amortece, e é essa a diversificação de uma única compra.',
      },
      {
        type: 'check',
        id: 'peso-vezes-queda',
        kind: 'numeric',
        prompt: 'Um ativo de peso 25% cai 10% e o resto da cesta fica parado. Quanto cai o ETF, em %?',
        answer: 2.5,
        tolerance: 0.05,
        unit: '%',
        explanation: '25% de 10% dá 2,5%.',
      },
      {
        type: 'text',
        markup:
          'O {{NAV}} é o valor da cesta dividido pelo número de cotas. O preço na bolsa oscila em torno dele: acima do NAV há {{ágio}}, e abaixo, desconto.',
      },
      {
        type: 'check',
        id: 'agio-ou-desconto',
        kind: 'single',
        prompt: 'A cota negocia a R$ 101 e o NAV é R$ 100. Como se chama a diferença?',
        options: ['Ágio', 'Desconto', 'Não há diferença'],
        answer: 0,
        explanation: 'Preço acima do NAV é ágio. Abaixo do NAV seria desconto.',
      },
      {
        type: 'text',
        markup:
          'Se a diferença cresce, um {{participante autorizado}} cria cotas novas, entregando a cesta, ou resgata cotas, recebendo a cesta. Isso empurra o preço de volta para o NAV.',
      },
      {
        type: 'check',
        id: 'participante-autorizado',
        kind: 'true_false',
        prompt: 'O participante autorizado ajuda o preço da cota a ficar perto do NAV.',
        answer: true,
        explanation: 'Quando o preço foge do NAV, criar ou resgatar cotas dá lucro a ele e traz o preço de volta.',
      },
      {
        type: 'text',
        markup:
          'Os dividendos da cesta podem ser reinvestidos ou distribuídos aos cotistas, conforme o regulamento. O ETF cobra uma taxa de administração, que reduz o valor da cota aos poucos.',
      },
      {
        type: 'text',
        markup:
          'Vender com lucro paga imposto de renda, e o ETF não tem a isenção de R$ 20 mil em vendas no mês, que vale só para ações.',
      },
      {
        type: 'check',
        id: 'etf-sem-isencao',
        kind: 'single',
        prompt: 'Você vendeu R$ 15.000 em cotas de ETF, com lucro, num mês. O ganho é isento?',
        options: ['Sim, como nas ações', 'Não, a isenção de R$ 20 mil vale só para ações', 'Só se o ETF distribuir dividendos'],
        answer: 1,
        explanation: 'A isenção de até R$ 20 mil em vendas no mês vale para ações, não para ETF nem FII.',
      },
      {
        type: 'widget',
        id: 'nota-etf',
        widget: 'platform-note',
        props: {
          brazil: 'O ETF segue um índice público, e participantes autorizados reais criam e resgatam cotas.',
          here: 'Os índices são fictícios, com cestas de ações e FIIs do catálogo, e a criação e o resgate de cotas são automáticos.',
          why: 'Assim você vê o ETF funcionar sem depender de um índice real.',
        },
      },
    ],
  },
}
