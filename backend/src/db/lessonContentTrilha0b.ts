import type { LessonBlocks } from '../modules/lessons/domain/widgets/lessonBlocks'

// Conteúdo visual da lição nova "Juros, Selic, CDI e TR" (RC.4.1), no contrato
// `blocks`. Fatos de `modules/lessons/domain/regulatoryFacts.ts`
// (`selic-definicao`, `cdi-taxa-di`, `tr-metodologia`, `tr-historico-zero`,
// `copom-reunioes`, `meta-inflacao`, verificados em 2026-10-04). Nenhum valor
// de taxa vigente aparece no texto: o gráfico mostra a série e os números dos
// exemplos são hipotéticos.

export const BLOCKS_JUROS_SELIC_CDI_TR: LessonBlocks = {
  schemaVersion: 1,
  phases: {
    scenario: [
      {
        type: 'text',
        markup:
          'Toda aplicação de renda fixa e todo empréstimo têm um ponto de partida: o preço do dinheiro. No Brasil, essa referência é a {{Selic}}, a taxa básica de juros.' +
          '\n\n' +
          'Quem define a meta da Selic é o Copom, comitê do Banco Central. Ele se reúne 8 vezes por ano, e a meta vale até a próxima reunião.',
      },
      {
        type: 'check',
        id: 'quem-define-selic',
        kind: 'single',
        prompt: 'Quem define a meta da Selic?',
        options: [
          'O Copom, do Banco Central',
          'O Tesouro Nacional',
          'A B3',
          'Cada banco, por conta própria',
        ],
        answer: 0,
        explanation:
          'O Copom decide a meta da Selic nas suas reuniões. Tesouro e B3 usam essa taxa como referência, mas não a definem.',
      },
    ],
    microDecision: [
      {
        type: 'text',
        markup:
          'O Copom sobe a Selic de 10% para 12% ao ano. O que tende a acontecer com o rendimento de um CDB que paga 100% do {{CDI}}?',
      },
    ],
    revelation: [
      {
        type: 'text',
        markup:
          'Sobe junto. O CDI é a taxa média dos empréstimos de um dia entre bancos, e anda colado na Selic. Um CDB de 100% do CDI rende exatamente a taxa do CDI do período.',
      },
      {
        type: 'text',
        markup:
          'Há duas Selics. A meta é a decisão do Copom. A Selic efetiva é a média das operações de um dia entre bancos e governo com títulos públicos, e fica bem perto da meta.',
      },
      {
        type: 'check',
        id: 'cdi-110',
        kind: 'single',
        prompt:
          'Um CDB paga 110% do CDI. Se o CDI do período for 1%, quanto o CDB rende no período, em %?',
        options: ['0,11%', '1%', '1,1%', '11%'],
        answer: 2,
        explanation: '110% de 1% é 1,1%. O percentual do CDI multiplica a taxa do período.',
      },
      {
        type: 'text',
        markup:
          'Juros altos pagam mais a quem aplica, mas encarecem o crédito. O que importa para o seu bolso é o juro real: a Selic menos a inflação medida pelo {{IPCA}}.',
      },
      {
        type: 'widget',
        id: 'juro-real',
        widget: 'real-return',
        props: { nominalPct: 12, inflationPct: 5, amount: 10000 },
        caption: 'Exemplo hipotético: juro de 12% e inflação de 5%',
      },
      {
        type: 'check',
        id: 'juro-real-negativo',
        kind: 'true_false',
        prompt:
          'Com a Selic em 10% e a inflação em 12%, quem aplica a 100% do CDI perde poder de compra.',
        answer: true,
        explanation:
          'O rendimento nominal de 10% fica abaixo da inflação de 12%: o saldo cresce, mas compra menos. O juro real é negativo.',
      },
      {
        type: 'text',
        markup:
          'A {{TR}}, a Taxa Referencial, é calculada pelo Banco Central a partir dos juros dos títulos públicos prefixados. Ficou zerada por anos, quando os juros estavam baixos, e volta a ser positiva quando eles sobem.',
      },
      {
        type: 'check',
        id: 'tr-sempre-zero',
        kind: 'true_false',
        prompt: 'A TR é sempre zero.',
        answer: false,
        explanation:
          'A TR acompanha os juros dos títulos públicos. Com juros baixos ela chegou a ficar zerada, mas com juros altos fica positiva. Ela entra no cálculo da poupança e de financiamentos.',
      },
      {
        type: 'widget',
        id: 'selic-ipca-serie',
        widget: 'selic-ipca-chart',
        props: { windowDays: 365 },
        caption: 'Selic e inflação, com a faixa da meta de 3%, tolerância de 1,5 ponto',
      },
      {
        type: 'widget',
        id: 'nota-copom',
        widget: 'platform-note',
        props: {
          brazil:
            'O Copom decide a meta da Selic em 8 reuniões por ano, e o IBGE divulga o IPCA todo mês.',
          here: 'O Copom da plataforma decide a cada 45 dias simulados, e a Selic e o IPCA do gráfico são gerados pela simulação.',
          why: 'Assim você vê o efeito de uma decisão de juros em poucos dias, sem esperar meses.',
        },
      },
    ],
  },
}

// Lição da poupança (RC.5.2, `code` 0.6). Regra de rendimento e saldo anterior a
// 2012 do fato `poupanca-regra` (Lei 12.703/2012, texto lido de novo em
// 2026-10-04); isenção de IR do fato `poupanca-isencao-ir-pf` (Receita Federal).
// Os números dos exemplos (Selic de 14%, TR de 0,15% ao mês) são hipotéticos.
export const BLOCKS_POUPANCA: LessonBlocks = {
  schemaVersion: 1,
  phases: {
    scenario: [
      {
        type: 'text',
        markup:
          'A poupança é o investimento mais popular do Brasil: o dinheiro fica à mão, e o rendimento cai uma vez por mês, no aniversário do depósito.',
      },
      {
        type: 'text',
        markup:
          'A regra de rendimento depende da meta da {{Selic}}. Acima de 8,5% ao ano, ela rende 0,5% ao mês mais a {{TR}}. Com a meta em 8,5% ou menos, rende 70% da meta ao ano, mais a TR.',
      },
      {
        type: 'check',
        id: 'regra-selic-10',
        kind: 'single',
        prompt: 'Com a meta da Selic em 10% ao ano, qual regra a poupança usa?',
        options: ['0,5% ao mês mais a TR', '70% da Selic mais a TR', 'Só a TR', '100% da Selic'],
        answer: 0,
        explanation:
          '10% está acima de 8,5%, então vale a regra de 0,5% ao mês mais a TR. A regra de 70% da meta só entra quando a meta fica em 8,5% ou menos.',
      },
    ],
    microDecision: [
      {
        type: 'text',
        markup:
          'Considere uma Selic de 14% ao ano (um exemplo) e uma TR de 0,15% ao mês. Em 1 ano, a poupança rende mais, menos ou igual ao Tesouro Selic, já descontado o imposto de renda do Tesouro?',
      },
    ],
    revelation: [
      {
        type: 'text',
        markup:
          'Menos. Com a Selic alta, a poupança paga uma fração do que o Tesouro Selic rende, mesmo depois de ele pagar imposto de renda.',
      },
      {
        type: 'widget',
        id: 'poupanca-vs-tesouro',
        widget: 'savings-vs-selic',
        props: { selicPct: 14, trMonthlyPct: 0.15, amount: 10000, months: 12 },
        caption: 'Mexa na Selic, na TR e no prazo e compare',
      },
      {
        type: 'check',
        id: 'regra-selic-7',
        kind: 'single',
        prompt: 'Com a meta da Selic em 7% ao ano, qual regra a poupança usa?',
        options: [
          '0,5% ao mês mais a TR',
          '70% da meta ao ano mais a TR',
          'Só a TR',
          '100% da meta',
        ],
        answer: 1,
        explanation:
          '7% está abaixo de 8,5%, então vale a regra de 70% da meta ao ano, mais a TR. Foi o que você viu no widget ao baixar a Selic.',
      },
      {
        type: 'text',
        markup:
          'A poupança não paga imposto de renda para pessoa física. O Tesouro Selic paga, e a alíquota cai com o prazo. Por isso, com juros baixos, a diferença entre os dois se aproxima.',
      },
      {
        type: 'check',
        id: 'isenta-sempre-vence',
        kind: 'true_false',
        prompt:
          'Por ser isenta de imposto de renda, a poupança sempre rende mais, líquida, que uma renda fixa tributada.',
        answer: false,
        explanation:
          'Depende da Selic e do prazo. Com juros altos, o Tesouro Selic rende mais mesmo pagando imposto. Com juros baixos, os dois ficam próximos.',
      },
      {
        type: 'widget',
        id: 'poupanca-real',
        widget: 'real-return',
        props: { nominalPct: 8, inflationPct: 5, amount: 10000 },
        caption: 'Exemplo hipotético: poupança a 8% ao ano com inflação de 5%',
      },
      {
        type: 'text',
        markup:
          'Quem depositou até 3 de maio de 2012 mantém a regra antiga nesse saldo: TR mais 0,5% ao mês, qualquer que seja a Selic.',
      },
      {
        type: 'widget',
        id: 'nota-poupanca',
        widget: 'platform-note',
        props: {
          brazil: 'A poupança existe em qualquer banco, e a regra de rendimento é a da lei.',
          here: 'A poupança não é um produto da plataforma. O Tesouro Selic é o ponto de comparação.',
          why: 'Assim você compara, com o mesmo dinheiro, o que a poupança rende e o que a renda fixa rende.',
        },
      },
    ],
  },
}
