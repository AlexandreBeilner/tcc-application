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
          'Todo trimestre, uma empresa de capital aberto abre as contas para qualquer pessoa ver. Ela publica o {{ITR e DFP}}, com os resultados de cada trimestre e do ano. É dali que saem os números que você vai aprender a ler.',
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
        props: { costsPct: 85 },
        caption:
          'Mude custos, despesas, juros e imposto e veja a receita virar lucro. Embaixo, o que a empresa tem é igual ao que deve mais o patrimônio líquido.',
        goal: {
          text: 'Deixe o lucro líquido positivo mexendo só nos custos',
          metric: 'netIncome',
          op: 'gt',
          value: 0,
          reveal:
            'Cada real de custo a menos sobe o lucro em todos os degraus da conta, até o lucro líquido. Com custos altos, a receita é toda consumida antes de chegar ao fim.',
          showMe: { costsPct: 60 },
        },
      },
      {
        type: 'check',
        id: 'ordem-do-resultado',
        kind: 'order',
        prompt:
          'Coloque as linhas do resultado na ordem em que a conta desce, da receita ao que sobra.',
        items: [
          'Receita líquida (o que a empresa vendeu)',
          'Lucro bruto (depois dos custos)',
          'EBIT (lucro da operação, antes de juros e imposto)',
          'Lucro líquido (o que sobra no fim)',
        ],
        answer: [0, 1, 2, 3],
        lowLabel: 'Começa aqui',
        highLabel: 'Termina aqui',
        explanation:
          'Da receita saem os custos (lucro bruto), depois as despesas da operação (EBIT) e, por fim, juros e imposto (lucro líquido). Por isso o EBIT, em geral, é maior que o lucro líquido.',
      },
      {
        type: 'check',
        id: 'patrimonio-liquido-conta',
        kind: 'single',
        prompt:
          'Uma empresa tem R$ 900 milhões em bens e direitos e deve R$ 600 milhões. Qual é o patrimônio líquido, em milhões de reais?',
        options: ['R$ 300 milhões', 'R$ 600 milhões', 'R$ 900 milhões', 'R$ 1.500 milhões'],
        answer: 0,
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
          brazil:
            'As empresas publicam o ITR a cada trimestre e a DFP uma vez por ano, e você lê tudo na CVM.',
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
        caption:
          'Edite receita e lucros das duas empresas e veja quem converte melhor em cada etapa.',
      },
      {
        type: 'check',
        id: 'margem-ebit-conta',
        kind: 'single',
        prompt:
          'Uma empresa vende R$ 800 milhões e tem EBIT de R$ 120 milhões. Qual é a margem EBIT, em %?',
        options: ['6,7%', '15%', '85%', '150%'],
        answer: 1,
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
        kind: 'single',
        prompt:
          'Dívida bruta de R$ 800 milhões, caixa de R$ 300 milhões e EBIT de R$ 250 milhões. Quantos anos de EBIT cabem na dívida líquida?',
        options: ['1,2 ano', '2 anos', '3,2 anos', '4,2 anos'],
        answer: 1,
        explanation:
          'A dívida líquida é 800 menos 300, ou 500. Dividido pelo EBIT de 250, dá 2 anos.',
      },
      {
        type: 'check',
        id: 'divida-e-so-aproximacao',
        kind: 'true_false',
        prompt:
          'Dívida líquida sobre EBIT diz exatamente em quantos anos a empresa quita a dívida.',
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
        props: { netIncome: 50 },
        caption:
          'O ROE é margem vezes giro vezes alavancagem. Mude a dívida e veja o ROE subir junto com o risco.',
        goal: {
          text: 'Leve o ROE acima da Selic de referência sem mexer na Selic',
          metric: 'roeMinusSelicPp',
          op: 'gt',
          value: 0,
          reveal:
            'O lucro não mudou: o ROE subiu porque a dívida encolheu o patrimônio dos sócios. Um ROE acima da Selic parece bom, mas o risco subiu junto.',
          showMe: { equity: 400 },
        },
      },
      {
        type: 'check',
        id: 'roe-conta',
        kind: 'single',
        prompt:
          'Lucro líquido de R$ 60 milhões e patrimônio líquido de R$ 400 milhões. Qual é o ROE, em %?',
        options: ['6,7%', '15%', '60%', '150%'],
        answer: 1,
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
        explanation:
          'Com menos patrimônio o ROE sobe, mas a dívida a mais deixa a empresa mais exposta se o lucro cair.',
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
          'Uma ação de R$ 10 pode estar mais cara que uma de R$ 100. Como? O preço sozinho não diz se ela está cara: R$ 20 pode ser muito para quem lucra pouco por ação e pouco para quem lucra muito.',
      },
      {
        type: 'text',
        markup:
          'Primeiro, leve tudo para a base "por ação": {{LPA}}, o lucro líquido dividido pelo número de ações, e {{VPA}}, o patrimônio líquido dividido pelo número de ações.',
      },
      {
        type: 'text',
        markup: 'O {{P/L}} compara o preço com o LPA, e o {{P/VP}} compara o preço com o VPA.',
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
        kind: 'single',
        prompt: 'A ação custa R$ 24 e o lucro por ação é de R$ 2. Qual é o P/L?',
        options: ['0,08 vez', '12 vezes', '26 vezes', '48 vezes'],
        answer: 1,
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
        explanation:
          'Com lucro negativo, o P/L fica negativo e não diz quantos anos de lucro o preço representa.',
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
        caption:
          'Os indicadores atuais de VALR3, calculados com o relatório mais recente da empresa.',
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
          'Duas ações custam R$ 10. Uma paga R$ 1 por ano em dividendos, a outra paga R$ 0,10. Qual rende mais como renda? O {{Dividend Yield}} resume quanto os dividendos representam frente ao preço.',
      },
      {
        type: 'text',
        markup:
          'É a soma dos dividendos pagos por ação nos últimos 12 meses dividida pelo preço atual.',
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
        kind: 'single',
        prompt:
          'Uma ação paga R$ 3,00 de dividendos em 12 meses e custa R$ 50,00. Qual é o Dividend Yield, em %?',
        options: ['0,6%', '6%', '16,7%', '60%'],
        answer: 1,
        explanation: '3 dividido por 50 dá 0,06, ou 6%.',
      },
      {
        type: 'check',
        id: 'dy-alto-por-queda',
        kind: 'single',
        prompt:
          'O Dividend Yield de uma ação saltou de 6% para 12%, sem que o dividendo pago tenha mudado. O que explica?',
        options: [
          'O preço da ação caiu pela metade',
          'A empresa dobrou o lucro',
          'O imposto diminuiu',
        ],
        answer: 0,
        explanation:
          'Com o dividendo igual, o yield só dobra se o preço cair pela metade. Olhe o preço e o histórico de pagamentos, nunca o número sozinho.',
      },
      {
        type: 'check',
        id: 'pergunta-de-cada-indicador',
        kind: 'match',
        prompt: 'Ligue cada indicador à pergunta que ele responde.',
        left: ['P/L', 'ROE', 'Margem líquida', 'Dívida líquida sobre EBIT', 'Dividend Yield'],
        right: [
          'Quanto o mercado paga por cada real de lucro?',
          'Quanto os sócios ganham por cada real que é deles?',
          'Quanto de cada real vendido vira lucro?',
          'Em quantos anos de operação a dívida seria quitada?',
          'Quanto a ação paga de dividendos frente ao preço?',
        ],
        answer: [0, 1, 2, 3, 4],
        explanation:
          'Cada indicador responde a uma pergunta diferente. Todos olham para trás: o Dividend Yield, por exemplo, não garante o dividendo do próximo ano.',
      },
      {
        type: 'text',
        markup:
          'O Dividend Yield é bruto, sem imposto. Dividendos acima de um limite no mês, pagos por uma mesma empresa a uma pessoa física, têm parte retida na fonte. O {{JCP}} tem 17,5% retidos.',
      },
      {
        type: 'check',
        id: 'retencao-dividendos',
        kind: 'true_false',
        prompt:
          'Se a retenção de 10% só vale acima de R$ 50 mil no mês, de uma mesma empresa, quem recebe R$ 1.000 de dividendos num mês sofre retenção.',
        answer: false,
        explanation:
          'A retenção só vale acima do limite do mês, da mesma empresa para a mesma pessoa. Abaixo disso, não há retenção sobre o dividendo.',
      },
      {
        type: 'widget',
        id: 'indicadores-dy-valr3',
        widget: 'live-indicator',
        props: { ticker: 'VALR3' },
        caption:
          'O Dividend Yield atual de VALR3 e os outros indicadores, com o relatório mais recente.',
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
          'Quando a economia esfria, algumas empresas sentem logo e outras quase não notam. Por quê? Empresas se agrupam em setores, como mineração, bancos, varejo, energia e tecnologia, e cada setor reage de um jeito à economia e aos juros.',
      },
      {
        type: 'text',
        markup:
          'Um setor {{cíclico}} vende mais quando a economia vai bem e sofre quando ela esfria, como o varejo. Um setor {{defensivo}} vende parecido em qualquer fase, como a energia.',
      },
      {
        type: 'check',
        id: 'ciclico-ou-defensivo',
        kind: 'categorize',
        prompt: 'Cada setor é cíclico ou defensivo?',
        groups: ['Cíclico', 'Defensivo'],
        items: [
          'Distribuição de energia',
          'Construção de imóveis',
          'Moda de luxo',
          'Saneamento básico',
          'Venda de carros novos',
        ],
        answer: [1, 0, 0, 1, 0],
        explanation:
          'Energia e água se consomem em qualquer fase da economia. Imóveis, luxo e carros novos são os primeiros cortes quando o orçamento aperta.',
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
        prompt:
          'A economia desacelera. Como tende a ir uma carteira só de setores cíclicos, comparada a uma mista?',
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
          brazil:
            'Cada setor reage de um jeito ao ciclo da economia e aos juros, e a intensidade varia a cada momento.',
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
          'Dá para ter um pedacinho de várias empresas com uma única compra? Dá, com um {{ETF}}: um fundo que reproduz um índice e é negociado na bolsa como uma ação. Com uma cota, você tem uma fatia de uma cesta inteira de ativos.',
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
        kind: 'single',
        prompt:
          'Um ativo de peso 25% cai 10% e o resto da cesta fica parado. Quanto cai o ETF, em %?',
        options: ['2,5%', '10%', '25%', '35%'],
        answer: 0,
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
        explanation:
          'Quando o preço foge do NAV, criar ou resgatar cotas dá lucro a ele e traz o preço de volta.',
      },
      {
        type: 'text',
        markup:
          'Os dividendos da cesta podem ser reinvestidos ou distribuídos aos cotistas, conforme o regulamento. O ETF cobra uma taxa de administração, que reduz o valor da cota aos poucos.',
      },
      {
        type: 'text',
        markup:
          'Vender com lucro paga imposto de renda, e o ETF não tem a isenção de vendas no mês, que vale só para ações.',
      },
      {
        type: 'check',
        id: 'etf-sem-isencao',
        kind: 'single',
        prompt: 'Você vendeu R$ 15.000 em cotas de ETF, com lucro, num mês. O ganho é isento?',
        options: [
          'Sim, como nas ações',
          'Não, a isenção do mês vale só para ações',
          'Só se o ETF distribuir dividendos',
        ],
        answer: 1,
        explanation: 'A isenção de vendas no mês vale para ações, não para ETF nem FII.',
      },
      {
        type: 'widget',
        id: 'nota-etf',
        widget: 'platform-note',
        props: {
          brazil:
            'O ETF segue um índice público, e participantes autorizados reais criam e resgatam cotas.',
          here: 'Os índices são fictícios, com cestas de ações e FIIs do catálogo, e a criação e o resgate de cotas são automáticos.',
          why: 'Assim você vê o ETF funcionar sem depender de um índice real.',
        },
      },
    ],
  },
}

// Lição nova "O que custa investir" (RC.4.8), no fim da Trilha 2. Fatos:
// `fundos-taxas-definicoes` (administração, gestão e performance),
// `tesouro-custodia-b3` (0,20% ao ano) e `investidor-custos-acoes` (sem número
// de corretagem, que muda). O retorno de 10% ao ano do exemplo é didático.

export const BLOCKS_CUSTOS: LessonBlocks = {
  schemaVersion: 1,
  phases: {
    scenario: [
      {
        type: 'text',
        markup:
          'Todo investimento tem custo, e boa parte dele é cobrada em silêncio, direto do que você ganha. Pequenas taxas, repetidas por anos, viram uma diferença grande.',
      },
      {
        type: 'text',
        markup:
          'Em ações há corretagem, custódia, emolumentos e taxa de liquidação, e muitas corretoras nem cobram corretagem. Em fundos e ETFs há a taxa de administração, cobrada todo ano sobre o patrimônio.',
      },
      {
        type: 'check',
        id: 'onde-aparece-a-taxa',
        kind: 'single',
        prompt: 'Como a taxa de administração de um ETF aparece na sua conta?',
        options: [
          'Como um débito separado todo mês',
          'Descontada do valor da cota, sem lançamento',
          'Só quando você vende',
        ],
        answer: 1,
        explanation:
          'A taxa é paga pelo fundo e reduz o valor da cota aos poucos. Você não vê um débito, só um retorno menor.',
      },
    ],
    microDecision: [
      {
        type: 'text',
        markup:
          'Dois produtos rendem 10% ao ano antes das taxas. O A não cobra taxa e o B cobra 2% ao ano. Depois de 20 anos, o saldo do B é quanto do saldo do A?',
      },
    ],
    revelation: [
      {
        type: 'text',
        markup:
          'Perto de 70%. A taxa leva cerca de 30% do saldo final em 20 anos, e mais de um terço do ganho, porque ela corrói o retorno todo ano e os juros seguintes incidem sobre o que sobrou.',
      },
      {
        type: 'check',
        id: 'chute-taxa-30-anos',
        kind: 'estimate',
        prompt:
          'R$ 10.000 a 10% ao ano por 30 anos viram cerca de R$ 174 mil. Chute: quanto uma taxa de 2% ao ano leva desse saldo?',
        min: 0,
        max: 150000,
        step: 1000,
        unit: 'brl',
        answer: 73867.45,
        tolerancePct: 10,
        explanation:
          'A taxa leva cerca de R$ 74 mil: o saldo cai de R$ 174,5 mil para R$ 100,6 mil. Parece só 2% ao ano, mas ela corrói o retorno todo ano, por 30 anos.',
      },
      {
        type: 'widget',
        id: 'efeito-da-taxa',
        widget: 'fee-drag',
        props: { years: 30, feeBPct: 0.1 },
        caption:
          'Mude as taxas, o retorno e o prazo e veja a diferença entre os dois produtos crescer.',
        goal: {
          text: 'Com 30 anos de prazo, ache a taxa do produto B que já leva R$ 10 mil do saldo',
          metric: 'differenceBRL',
          op: 'gte',
          value: 10000,
          reveal:
            'Uma taxa que parece pequena já leva mais de R$ 10 mil em 30 anos: ela corrói o retorno todo ano, e os juros seguintes incidem sobre o que sobrou.',
          showMe: { feeBPct: 0.3 },
        },
      },
      {
        type: 'text',
        markup:
          'Em fundos há três taxas diferentes. A de administração remunera o administrador. A de gestão remunera o gestor pela escolha dos investimentos. A de performance é um prêmio cobrado só se o fundo superar um indicador de referência.',
      },
      {
        type: 'check',
        id: 'taxa-de-performance',
        kind: 'single',
        prompt: 'Qual taxa só é cobrada se o fundo superar o indicador de referência?',
        options: ['Administração', 'Gestão', 'Performance'],
        answer: 2,
        explanation:
          'A taxa de performance é um prêmio ao gestor por render mais que a referência. As outras duas são cobradas sempre.',
      },
      {
        type: 'text',
        markup:
          'O {{spread}} também é custo: você compra pelo preço de venda e vende pelo de compra, e a diferença fica com o mercado. No Tesouro Direto, a B3 cobra uma custódia anual sobre o valor dos títulos.',
      },
      {
        type: 'check',
        id: 'custodia-do-tesouro',
        kind: 'single',
        prompt:
          'Você tem R$ 20.000 em um Tesouro Prefixado, e a custódia da B3 é de 0,20% ao ano. Quanto paga de custódia por ano, em reais?',
        options: ['R$ 0', 'R$ 20', 'R$ 40', 'R$ 400'],
        answer: 2,
        explanation:
          '0,20% de R$ 20.000 dá R$ 40 por ano. O Tesouro Selic tem isenção sobre uma parte pequena do valor, mas não é o caso aqui.',
      },
      {
        type: 'check',
        id: 'corretagem-zero',
        kind: 'true_false',
        prompt: 'Corretagem zero significa investir sem nenhum custo.',
        answer: false,
        explanation:
          'Ainda há custódia, emolumentos, taxa de liquidação, taxa de administração em fundos e o spread.',
      },
      {
        type: 'text',
        markup:
          'Custo é a parte do retorno que você controla. Compare as taxas antes de escolher, e lembre que ele pesa mais quanto maior o prazo.',
      },
      {
        type: 'widget',
        id: 'nota-custos',
        widget: 'platform-note',
        props: {
          brazil:
            'Você paga corretagem, custódia e taxas de fundos, que variam por corretora e produto.',
          here: 'Os ETFs cobram uma taxa de administração, descontada do fundo. Suas ordens não pagam corretagem nem custódia.',
          why: 'Assim o treino foca no efeito da taxa de administração, sem tabelas de tarifa de cada corretora.',
        },
      },
    ],
  },
}

// Lição nova "Imposto em renda variável" (RC.4.7), depois de "O que custa investir".
// Fatos: `renda-variavel-aliquotas` (15%, 20%, dedo-duro, DARF, compensação, declaração),
// `acoes-isencao-20-mil` e `dividendos-retencao-lei-15270`. Os números dos exemplos são
// didáticos. A plataforma não cobra imposto sobre renda variável (só renda fixa).

export const BLOCKS_IMPOSTO: LessonBlocks = {
  schemaVersion: 1,
  phases: {
    scenario: [
      {
        type: 'text',
        markup:
          'Você vendeu uma ação com lucro. A Receita quer uma parte? Depende de três coisas: o que você vendeu, se comprou e vendeu no mesmo dia e quanto vendeu no mês.',
      },
      {
        type: 'text',
        markup:
          'Quem compra e vende em dias diferentes faz {{swing trade}}: paga 15% sobre o lucro. Quem compra e vende no mesmo dia faz {{day trade}}: paga 20%.',
      },
      {
        type: 'check',
        id: 'tipo-de-operacao',
        kind: 'single',
        prompt:
          'Você comprou uma ação na segunda e vendeu na quarta, com lucro. Qual é a operação?',
        options: ['Day trade', 'Swing trade', 'Nenhuma das duas'],
        answer: 1,
        explanation:
          'Day trade é só quando a compra e a venda acontecem no mesmo dia. Em dias diferentes, é swing trade.',
      },
    ],
    microDecision: [
      {
        type: 'text',
        markup:
          'Você vendeu R$ 15.000 em ações no mês, com R$ 2.000 de lucro, comprando e vendendo em dias diferentes. Quanto de imposto você paga sobre esses R$ 2.000?',
      },
    ],
    revelation: [
      {
        type: 'text',
        markup:
          'Nada. Quem vende até o limite de isenção do mês em ações tem o ganho isento, e o que conta é o valor vendido, não o lucro. Day trade não entra nessa isenção.',
      },
      {
        type: 'widget',
        id: 'calculadora-de-imposto',
        widget: 'equity-tax-calculator',
        props: {},
        caption: 'Troque o tipo de operação, o ativo e os valores e veja o imposto e o DARF.',
      },
      {
        type: 'check',
        id: 'isento-ou-tributado',
        kind: 'categorize',
        prompt:
          'Vale a regra: vendas de até R$ 20 mil em ações no mês, em dias diferentes, têm o lucro isento. Cada venda abaixo, com lucro, é isenta ou paga imposto?',
        groups: ['Isento', 'Paga imposto'],
        items: [
          'Vender R$ 15.000 em ações no mês',
          'Vender R$ 30.000 em ações no mês',
          'Vender R$ 15.000 em cotas de ETF',
          'Vender R$ 12.000 em ações, em dois dias diferentes',
          'Comprar e vender a mesma ação no mesmo dia',
        ],
        answer: [0, 1, 1, 0, 1],
        explanation:
          'A isenção vale só para ações, até o limite do mês e fora do day trade. Acima do limite, ETF e day trade pagam imposto sobre o lucro.',
      },
      {
        type: 'text',
        markup:
          'Passou do limite? Todo o lucro do mês é tributado, não só o que passou do limite. Você mesmo apura e paga o imposto em {{DARF}}, até o último dia útil do mês seguinte à venda.',
      },
      {
        type: 'check',
        id: 'imposto-acima-do-limite',
        kind: 'single',
        prompt:
          'Você vendeu R$ 30.000 em ações no mês, acima do limite de isenção, com lucro de R$ 4.000, em operações de swing trade com alíquota de 15%. Quanto paga de imposto, em reais?',
        options: ['R$ 0', 'R$ 600', 'R$ 800', 'R$ 4.500'],
        answer: 1,
        explanation: 'Passou do limite, então não há isenção: 15% de R$ 4.000 dá R$ 600.',
      },
      {
        type: 'text',
        markup:
          'Prejuízo não se perde. Ele abate lucros futuros, mas só do mesmo tipo: prejuízo de swing trade não compensa lucro de day trade, e o contrário também vale.',
      },
      {
        type: 'check',
        id: 'compensar-prejuizo',
        kind: 'single',
        prompt:
          'No mês passado você teve R$ 1.000 de prejuízo em swing trade. Neste mês, R$ 4.000 de lucro, também em swing trade, com vendas de R$ 30.000. Qual é a base do imposto, em reais?',
        options: ['R$ 1.000', 'R$ 3.000', 'R$ 4.000', 'R$ 5.000'],
        answer: 1,
        explanation:
          'O prejuízo abate o lucro: R$ 4.000 menos R$ 1.000 dá R$ 3.000, e o imposto é de 15% disso.',
      },
      {
        type: 'widget',
        id: 'arvore-de-imposto',
        widget: 'tax-decision-tree',
        props: {},
        caption: 'Responda as perguntas e veja como a venda é tributada.',
      },
      {
        type: 'more',
        id: 'mais-dedo-duro',
        title: 'O que a corretora retém na venda',
        blocks: [
          {
            type: 'text',
            markup:
              'A corretora retém um pouco na venda, o {{dedo-duro}}: 0,005% do valor vendido no swing trade e 1% no day trade. Ele avisa a Receita e abate do imposto que você deve.',
          },
        ],
      },
      {
        type: 'check',
        id: 'declarar-isento',
        kind: 'true_false',
        prompt: 'Se o ganho foi isento, não precisa declarar nada no imposto de renda.',
        answer: false,
        explanation:
          'Você declara as ações que tem em Bens e Direitos, e o ganho isento em Rendimentos Isentos.',
      },
      {
        type: 'text',
        markup:
          'Os dividendos das ações também têm regra própria: a empresa retém parte do imposto quando paga muito a uma mesma pessoa no mês. Abaixo desse limite, não há retenção.',
      },
      {
        type: 'more',
        id: 'mais-valores-de-hoje',
        title: 'Os limites em vigor',
        blocks: [
          {
            type: 'widget',
            id: 'hoje-isencao-dividendos',
            widget: 'callout',
            props: {
              tone: 'info',
              title: 'Valores de hoje',
              body: 'A isenção vale para vendas de até R$ 20 mil em ações no mês. Nos dividendos, desde 2026 a empresa retém 10% quando paga mais de R$ 50 mil no mês a uma mesma pessoa. Esses valores são definidos em lei e podem mudar.',
            },
          },
        ],
      },
      {
        type: 'check',
        id: 'dividendo-limite',
        kind: 'true_false',
        prompt:
          'Se a regra retém 10% só quando uma mesma empresa paga mais de R$ 50 mil no mês a você, todo dividendo de ação tem imposto retido.',
        answer: false,
        explanation:
          'A retenção só vale acima do limite do mês. Abaixo dele, o dividendo chega inteiro.',
      },
      {
        type: 'text',
        markup:
          'Imposto é um custo que você controla pouco, mas pode planejar: saber a regra evita surpresa e multa de atraso.',
      },
      {
        type: 'widget',
        id: 'nota-imposto',
        widget: 'platform-note',
        props: {
          brazil:
            'Você apura o imposto de cada mês, paga o DARF e declara as operações no imposto de renda.',
          here: 'As compras e vendas de ações, FIIs e ETFs não geram imposto, DARF nem declaração.',
          why: 'Assim você foca em entender a regra, e na vida real o cálculo fica por sua conta, com a calculadora desta lição.',
        },
      },
    ],
  },
}
