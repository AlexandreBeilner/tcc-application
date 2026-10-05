import type { LessonBlocks } from '../modules/lessons/domain/widgets/lessonBlocks'

// Lição nova "Como a ação é negociada: B3, corretora e ordens" (RC.4.2), antes
// da lição de oferta e demanda. Fatos: `b3-ordens-tipos`, `b3-horario-pregao`,
// `b3-ticker-sufixos` (lote e fracionário), `investidor-custos-acoes` e
// `acoes-isencao-20-mil`. O livro de ofertas do widget é de exemplo, e o texto
// diz que no mercado real há milhares de ordens.
export const BLOCKS_B3_CORRETORA_ORDENS: LessonBlocks = {
  schemaVersion: 1,
  phases: {
    scenario: [
      {
        type: 'text',
        markup:
          'Você não compra ação direto da empresa. Manda uma ordem à sua corretora, que a leva à B3, a bolsa do Brasil, onde compradores e vendedores se encontram.',
      },
      {
        type: 'check',
        id: 'quem-recebe-a-ordem',
        kind: 'single',
        prompt: 'Para comprar uma ação, a quem você envia a ordem?',
        options: ['À empresa que emitiu a ação', 'À sua corretora', 'Ao Banco Central'],
        answer: 1,
        explanation:
          'A corretora é a intermediária autorizada: ela leva a sua ordem à B3 e executa a compra por você.',
      },
      {
        type: 'text',
        markup:
          'A ordem pode ser de dois tipos. A {{ordem a mercado}} compra ou vende já, ao preço que estiver sendo praticado. A {{ordem limite}} só executa no preço que você definir, ou melhor.',
      },
    ],
    microDecision: [
      {
        type: 'text',
        markup:
          'A melhor oferta de venda é de R$ 10,05 por ação. Você manda uma ordem a mercado para comprar 500 ações. Você paga exatamente R$ 10,05 em cada uma?',
      },
    ],
    revelation: [
      {
        type: 'text',
        markup:
          'Nem sempre. O livro de ofertas tem vários níveis de preço. Se a sua ordem é maior que a quantidade do melhor preço, ela segue para os preços seguintes, e o preço médio sobe.',
      },
      {
        type: 'widget',
        id: 'livro-de-ofertas',
        widget: 'order-book',
        props: {},
        caption:
          'Compre 500 a mercado e veja o preço médio. Depois tente uma ordem limitada abaixo do mercado.',
      },
      {
        type: 'text',
        markup:
          'A diferença entre o melhor preço de compra e o melhor de venda é o {{spread}}. Quanto menor, mais barato é entrar e sair da ação.',
      },
      {
        type: 'check',
        id: 'calculo-do-spread',
        kind: 'numeric',
        prompt:
          'A melhor compra está a R$ 10,00 e a melhor venda a R$ 10,05. Qual é o spread, em reais?',
        answer: 0.05,
        tolerance: 0.001,
        unit: 'reais',
        explanation: 'R$ 10,05 menos R$ 10,00 dá R$ 0,05.',
      },
      {
        type: 'check',
        id: 'ordem-limite-abaixo',
        kind: 'single',
        prompt:
          'Você manda uma ordem limite para comprar a R$ 9,50, e a melhor venda está em R$ 10,05. O que acontece?',
        options: [
          'Executa agora, a R$ 10,05',
          'Fica na fila até alguém aceitar vender a R$ 9,50 ou menos',
          'É cancelada na hora',
        ],
        answer: 1,
        explanation:
          'A ordem limite nunca paga mais que o seu limite. Se ninguém vende naquele preço, ela espera na fila.',
      },
      {
        type: 'text',
        markup:
          'Ação com muitas ordens tem spread pequeno e é fácil de negociar: tem {{liquidez}}. Com poucas ordens, o spread é largo e vender pode custar caro.',
      },
      {
        type: 'check',
        id: 'pouca-liquidez',
        kind: 'true_false',
        prompt:
          'Uma ação com pouca liquidez costuma ter spread largo e pode ser difícil de vender.',
        answer: true,
        explanation:
          'Sem muitas ordens dos dois lados, a distância entre compra e venda cresce, e quem precisa sair aceita um preço pior.',
      },
      {
        type: 'text',
        markup:
          'As ações negociam em lotes de 100. Quantidades de 1 a 99 vão para o mercado fracionário, e o código da ação ganha um F no fim.',
      },
      {
        type: 'check',
        id: 'lote-ou-fracionario',
        kind: 'single',
        prompt: 'Você quer comprar 30 ações. Em qual mercado a ordem vai?',
        options: ['Lote padrão', 'Fracionário'],
        answer: 1,
        explanation: 'O lote padrão é de 100 ações. De 1 a 99, a compra é no mercado fracionário.',
      },
      {
        type: 'text',
        markup:
          'O pregão funciona em dias úteis, em horário definido pela B3, com uma fase de leilão antes de abrir e outra no fechamento.',
      },
      {
        type: 'text',
        markup:
          'Investir em ações tem custos. A corretagem é combinada livremente com a corretora, e muitas nem cobram. A B3 cobra emolumentos e taxa de liquidação, e há a custódia.',
      },
      {
        type: 'text',
        markup:
          'Vender com lucro paga imposto de renda, mas quem vende até R$ 20 mil em ações no mês tem o ganho isento. A regra vale para ações, não para ETF nem FII.',
      },
      {
        type: 'check',
        id: 'isencao-vinte-mil',
        kind: 'single',
        prompt:
          'Em um mês, você vendeu R$ 15.000 em ações com lucro. O ganho paga imposto de renda?',
        options: [
          'Sim, todo lucro paga',
          'Não, está dentro da isenção de R$ 20 mil no mês',
          'Só se vender em lote padrão',
        ],
        answer: 1,
        explanation:
          'O total vendido no mês, R$ 15.000, está abaixo de R$ 20 mil, então o ganho é isento.',
      },
      {
        type: 'widget',
        id: 'nota-b3-corretora',
        widget: 'platform-note',
        props: {
          brazil:
            'Você opera por uma corretora, e a B3 reúne milhares de ordens ao mesmo tempo, em horário de pregão.',
          here: 'Na plataforma você envia a ordem direto ao livro de ofertas, sem corretora, com dinheiro de treino.',
          why: 'Assim você vê o efeito de uma ordem sobre o preço sem abrir conta numa corretora real.',
        },
      },
    ],
  },
}
