import type { LessonBlocks } from '../modules/lessons/domain/widgets/lessonBlocks'

// Conteúdo visual das lições 0.1 a 0.4 (RC.5.1), no contrato `blocks`. A meta
// de inflação vem do fato `meta-inflacao` de
// `modules/lessons/domain/regulatoryFacts.ts` (Resolução CMN 5.141, verificado
// em 2026-10-04). Nenhum outro número regulatório é afirmado aqui.

export const BLOCKS_0_1: LessonBlocks = {
  schemaVersion: 1,
  phases: {
    scenario: [
      {
        type: 'text',
        markup:
          'Você recebe R$ 1.000 de bônus. Pode deixar o dinheiro parado na conta corrente ou aplicá-lo em algo que renda.' +
          '\n\n' +
          'Guardar mantém o número na conta. Mas com a {{inflação}}, o dinheiro parado compra um pouco menos a cada ano.',
      },
      {
        type: 'check',
        id: 'parado-um-ano',
        kind: 'single',
        prompt: 'Dinheiro parado por um ano, com a inflação positiva, passa a comprar:',
        options: ['O mesmo de antes', 'Menos que antes', 'Mais que antes'],
        answer: 1,
        explanation:
          'O valor na conta é o mesmo, mas os preços subiram. Por isso o poder de compra caiu.',
      },
    ],
    microDecision: [
      {
        type: 'text',
        markup:
          'Antes de continuar, pense: com esses R$ 1.000 em mãos, você deixaria parado ou aplicaria? O que te faria escolher um ou outro?',
      },
      {
        type: 'poll',
        id: 'enquete-bonus',
        prompt: 'Com R$ 1.000 de bônus, o que você faria?',
        options: ['Deixaria na conta', 'Poria na poupança', 'Investiria', 'Gastaria'],
        closing: 'Não existe resposta certa aqui. A seguir: o que investir quer dizer de verdade.',
      },
    ],
    revelation: [
      {
        type: 'text',
        markup:
          'Investir é abrir mão do dinheiro hoje esperando ter mais dele depois. Isso pode acontecer de duas formas: por empréstimo ou por sociedade.' +
          '\n\n' +
          'No empréstimo, você empresta ao governo ou a um banco e recebe juros. Na sociedade, você se torna sócio de uma empresa e divide o resultado dela.',
      },
      {
        type: 'check',
        id: 'comprar-acao',
        kind: 'single',
        prompt: 'Comprar uma ação de uma empresa é:',
        options: [
          'Emprestar dinheiro à empresa',
          'Tornar-se sócio de uma pequena parte dela',
          'Guardar dinheiro com garantia do governo',
        ],
        answer: 1,
        explanation: 'A ação é uma fração da empresa. Quem a compra vira sócio, e não credor.',
      },
      {
        type: 'check',
        id: 'todo-investimento-juros',
        kind: 'true_false',
        prompt: 'Todo investimento paga juros.',
        answer: false,
        explanation:
          'Quem empresta recebe juros. Quem vira sócio recebe o resultado da empresa, em dividendos e valorização da ação, e isso não é juros.',
      },
      {
        type: 'widget',
        id: 'nota-capital',
        widget: 'platform-note',
        props: {
          brazil:
            'Para investir de verdade, você abre conta em uma corretora ou banco e usa o seu próprio dinheiro.',
          here: 'Completar esta lição libera o Portfólio, com R$ 10.000 de capital inicial para você praticar.',
          why: 'Assim você treina as decisões sem arriscar o seu dinheiro.',
        },
      },
    ],
  },
}

export const BLOCKS_0_2: LessonBlocks = {
  schemaVersion: 1,
  phases: {
    scenario: [
      {
        type: 'text',
        markup:
          'R$ 1.000 aplicados a 10% ao ano, por 20 anos. Quanto isso vira?' +
          '\n\n' +
          'Depende de uma escolha que parece técnica: o rendimento vem só sobre o capital original (juros simples) ou também sobre os juros já ganhos ({{juros compostos}})?',
      },
      {
        type: 'check',
        id: 'chute-20-anos',
        kind: 'estimate',
        prompt:
          'Chute: com juros compostos, em que os juros também rendem, quanto viram os R$ 1.000 depois de 20 anos a 10% ao ano?',
        min: 1000,
        max: 10000,
        step: 100,
        unit: 'brl',
        answer: 6727.5,
        tolerancePct: 10,
        explanation:
          'Viram cerca de R$ 6.727. Com juros simples seriam R$ 3.000. Nos juros compostos os juros também rendem, e é isso que faz a conta disparar.',
      },
    ],
    microDecision: [
      {
        type: 'text',
        markup:
          'Os mesmos R$ 1.000 a 10% ao ano rendem de um jeito nos juros simples e de outro nos compostos. Mexa no prazo da calculadora e alterne entre Simples e Composto para ver quando a diferença fica grande.',
      },
      {
        type: 'widget',
        id: 'calculadora',
        widget: 'growth-calculator',
        props: { initialCapital: 1000, ratePct: 10, periodYears: 1 },
        goal: {
          text: 'Mexa no Período e ache o prazo em que os juros compostos passam do dobro dos juros simples',
          metric: 'interestRatio',
          op: 'gte',
          value: 2,
          reveal: 'Os juros sobre juros demoram para aparecer e depois disparam.',
          showMe: { periodYears: 15, ratePct: 10 },
        },
      },
    ],
    revelation: [
      {
        type: 'widget',
        id: 'conta-simples-composto',
        widget: 'formula-walkthrough',
        props: {
          intro:
            'O que você viu tem nome: juros sobre juros. R$ 1.000 a 10% ao ano, por 3 anos. A taxa é a mesma, e o resultado muda.',
          items: [
            {
              label: 'Juros simples',
              formula: 'M = C × (1 + i × n)',
              legend: 'C é o capital, i é a taxa por período e n é o número de períodos.',
              numbers: 'M = 1.000 × (1 + 0,10 × 3)',
              result: 'R$ 1.300',
            },
            {
              label: 'Juros compostos',
              formula: 'M = C × (1 + i)ⁿ',
              numbers: 'M = 1.000 × (1 + 0,10)³',
              result: 'R$ 1.331',
            },
          ],
          note: 'Em 20 anos, os mesmos R$ 1.000 viram R$ 3.000 no simples e cerca de R$ 6.727 no composto. Quanto mais cedo você começa, mais períodos de juros sobre juros trabalham a seu favor.',
        },
      },
      {
        type: 'check',
        id: 'renda-fixa-regime',
        kind: 'single',
        prompt: 'A renda fixa, como o Tesouro e o CDB, capitaliza os juros em regime:',
        options: ['Simples', 'Composto', 'Sem juros'],
        answer: 1,
        explanation:
          'A renda fixa capitaliza em regime composto. Já a ação não tem juros: o retorno dela vem do preço e dos proventos.',
      },
      {
        type: 'check',
        id: 'taxa-alta',
        kind: 'true_false',
        prompt:
          'Com taxas altas, como as do cartão de crédito, a diferença entre simples e composto aparece em poucos meses.',
        answer: true,
        explanation:
          'Quanto maior a taxa, mais rápido os juros sobre juros pesam. Por isso dívida cara cresce tão depressa.',
      },
    ],
  },
}

export const BLOCKS_0_3: LessonBlocks = {
  schemaVersion: 1,
  phases: {
    scenario: [
      {
        type: 'text',
        markup:
          'Hoje, R$ 100 compram um certo cesto de compras. Daqui a um ano, os preços sobem e o mesmo cesto custa mais. Essa alta geral dos preços é a {{inflação}}.' +
          '\n\n' +
          'No Brasil, quem mede a inflação é o IBGE, pelo {{IPCA}}. O Banco Central persegue uma meta de inflação e compara o IPCA com ela.',
      },
      {
        type: 'widget',
        id: 'hoje-meta-inflacao',
        widget: 'callout',
        props: {
          tone: 'info',
          title: 'Hoje no Brasil',
          body: 'Em 2026, a meta é de 3% ao ano, com tolerância de 1,5 ponto para mais ou para menos, ou seja, de 1,5% a 4,5%. A meta é definida pelo governo e pode mudar.',
        },
      },
    ],
    microDecision: [
      {
        type: 'text',
        markup:
          'Se a inflação de um ano for 5%, quanto vai custar, no ano que vem, algo que custa R$ 100 hoje?',
      },
    ],
    revelation: [
      {
        type: 'text',
        markup:
          'R$ 105. O dinheiro continua valendo R$ 100 no papel, mas compra menos: o poder de compra caiu.' +
          '\n\n' +
          'Por isso todo retorno precisa ser lido junto com a inflação do período. Um ganho nominal pode, na prática, ser perda de poder de compra.',
      },
      {
        type: 'check',
        id: 'chute-preco-10-anos',
        kind: 'estimate',
        prompt:
          'Chute: com inflação de 5% ao ano, sempre sobre o preço já reajustado, quanto custará em 10 anos o que hoje custa R$ 100?',
        min: 100,
        max: 250,
        step: 5,
        unit: 'brl',
        answer: 162.89,
        tolerancePct: 5,
        explanation:
          'Custará cerca de R$ 162,89. Cada ano o aumento incide sobre o preço já reajustado, então 10 anos de 5% somam 62,9%, e não 50%.',
      },
      {
        type: 'check',
        id: 'meta-inflacao',
        kind: 'true_false',
        prompt:
          'A meta de inflação é um objetivo que o Banco Central persegue, e não a inflação que já aconteceu.',
        answer: true,
        explanation:
          'A meta é o alvo. O IPCA mostra a inflação que aconteceu, e o Banco Central compara os dois para decidir o que fazer.',
      },
      { type: 'text', markup: 'Na próxima lição, esse conceito ganha nome: rendimento real.' },
    ],
  },
}

export const BLOCKS_0_4: LessonBlocks = {
  schemaVersion: 1,
  phases: {
    scenario: [
      {
        type: 'text',
        markup:
          'Uma aplicação rendeu 8% em um ano. Parece um bom retorno. Mas, nesse ano, a {{inflação}} medida pelo {{IPCA}} foi de 6%.',
      },
      {
        type: 'widget',
        id: 'rendimento-real',
        widget: 'real-return',
        props: { nominalPct: 8, inflationPct: 3, amount: 10000 },
        caption: 'Mexa nos dois controles',
        goal: {
          text: 'Aumente a Inflação até ela passar o Rendimento nominal',
          metric: 'realReturnPct',
          op: 'lt',
          value: 0,
          reveal: 'Rendeu no papel e perdeu no mercado: a inflação passou o rendimento.',
          showMe: { inflationPct: 10 },
        },
      },
    ],
    microDecision: [
      {
        type: 'text',
        markup:
          'O que você viu tem nome: rendimento real é o que sobra do rendimento nominal, o que a aplicação anuncia, depois de descontar a inflação. Com 8% nominal e 6% de inflação, o rendimento real fica perto de quanto?',
      },
    ],
    revelation: [
      {
        type: 'text',
        markup:
          'Perto de 2%. A conta aproximada é 8 − 6. A conta exata é (1,08 ÷ 1,06) − 1, cerca de 1,89%, um pouco menos.' +
          '\n\n' +
          'Quanto maior a inflação do período, maior a diferença entre as duas contas.',
      },
      {
        type: 'check',
        id: 'real-10-5',
        kind: 'single',
        prompt:
          'Um rendimento nominal de 10% com inflação de 5%. Qual o rendimento real aproximado, em %?',
        options: ['2%', '5%', '15%', '50%'],
        answer: 1,
        explanation: 'Aproximadamente 10 − 5 = 5%. A conta exata dá cerca de 4,76%.',
      },
      {
        type: 'text',
        markup:
          'E ainda tem o imposto: o IR incide sobre o ganho nominal, então o ganho real depois do imposto é menor ainda.',
      },
      {
        type: 'check',
        id: 'nominal-positivo',
        kind: 'true_false',
        prompt: 'Um rendimento nominal positivo sempre garante ganho de poder de compra.',
        answer: false,
        explanation:
          'Se a inflação for maior que o rendimento, o dinheiro rende no papel, mas compra menos.',
      },
      {
        type: 'widget',
        id: 'nota-nominal',
        widget: 'platform-note',
        props: {
          brazil:
            'Bancos e Tesouro anunciam as taxas de forma nominal, e você desconta a inflação por conta própria.',
          here: 'Os retornos mostrados no Mercado e no Portfólio também são nominais.',
          why: 'Assim os números batem com os que você veria em uma corretora.',
        },
      },
    ],
  },
}
