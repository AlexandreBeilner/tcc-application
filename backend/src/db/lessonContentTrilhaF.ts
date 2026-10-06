import type { LessonBlocks } from '../modules/lessons/domain/widgets/lessonBlocks'

// Trilha F "Finanças do dia a dia" (RC.4.4, decisão D13): trilha paralela, aberta em
// qualquer ordem e sem desbloqueio de ativo. Por poder ser aberta antes de qualquer outra,
// as lições daqui não usam termo que outra lição apresenta sem defini-lo no próprio texto.
// Fato `orcamento-bcb-caderno` (despesas fixas, variáveis e sazonais, superávit, pague-se
// primeiro). A regra 50/30/20 não consta do Caderno do Banco Central e é rotulada como
// regra de bolso popular. Os números dos exemplos são didáticos.

export const BLOCKS_ORCAMENTO: LessonBlocks = {
  schemaVersion: 1,
  phases: {
    scenario: [
      {
        type: 'text',
        markup:
          'Investir começa pela sobra: o que resta da sua renda depois de pagar o mês. Sem saber quanto sobra, não dá para decidir quanto aplicar.',
      },
      {
        type: 'text',
        markup:
          'O {{orçamento}} é a conta simples de quanto entra e quanto sai. O objetivo básico é gastar menos do que se recebe, e a sobra é o que dá para poupar ou investir.',
      },
      {
        type: 'check',
        id: 'conta-de-luz',
        kind: 'single',
        prompt: 'A conta de luz muda conforme o consumo de um mês para o outro. Ela é uma despesa:',
        options: ['Fixa', 'Variável', 'Sazonal'],
        answer: 1,
        explanation:
          'Despesa variável é a que muda de um mês para o outro, como luz e água. Fixa quase não muda, como o aluguel.',
      },
    ],
    microDecision: [
      {
        type: 'text',
        markup:
          'Sua renda líquida é de R$ 4.000 por mês e você gasta R$ 3.400 com moradia, comida, transporte, lazer e outras contas. Quanto sobra para poupar ou investir?',
      },
    ],
    revelation: [
      {
        type: 'text',
        markup:
          'R$ 600, ou 15% da renda. É essa sobra, e não a renda, que limita quanto você consegue aportar todo mês.',
      },
      {
        type: 'widget',
        id: 'monte-seu-orcamento',
        widget: 'budget-split',
        props: {},
        caption:
          'Mexa nas categorias e veja a sobra mudar. Se passar da renda, o orçamento fecha no vermelho.',
      },
      {
        type: 'text',
        markup:
          'As despesas se dividem em três tipos. As fixas quase não mudam, como o aluguel. As variáveis mudam conforme o consumo, como a luz. As sazonais vêm de tempos em tempos, como IPVA, seguro e matrícula escolar.',
      },
      {
        type: 'check',
        id: 'despesa-sazonal',
        kind: 'single',
        prompt: 'O IPVA é pago uma vez por ano. Ele é uma despesa:',
        options: ['Fixa', 'Variável', 'Sazonal'],
        answer: 2,
        explanation:
          'Despesa sazonal vem de tempos em tempos, como imposto anual, seguro e matrícula. Esquecê-la desmonta o orçamento do mês em que chega.',
      },
      {
        type: 'check',
        id: 'sobra-em-porcentagem',
        kind: 'numeric',
        prompt: 'Você ganha R$ 5.000 e gasta R$ 4.250 no mês. Quanto da renda sobra, em %?',
        answer: 15,
        tolerance: 0.1,
        unit: '%',
        explanation: 'Sobram R$ 750, que são 15% de R$ 5.000.',
      },
      {
        type: 'text',
        markup:
          'Uma regra de bolso popular é a 50/30/20: 50% da renda para necessidades, 30% para desejos e 20% para poupar e quitar dívidas. Serve de ponto de partida, não de lei, e cada pessoa ajusta ao seu caso.',
      },
      {
        type: 'check',
        id: 'regra-50-30-20',
        kind: 'true_false',
        prompt: 'A regra 50/30/20 é uma norma oficial que todo orçamento precisa seguir.',
        answer: false,
        explanation:
          'É uma regra de bolso popular, um ponto de partida. O que importa é gastar menos do que se recebe.',
      },
      {
        type: 'text',
        markup:
          'E quando separar o que vai poupar? "Pague-se primeiro": assim que o salário cair, separe o aporte, de preferência com transferência automática. Se esperar sobrar no fim do mês, quase nunca sobra.',
      },
      {
        type: 'check',
        id: 'pague-se-primeiro',
        kind: 'single',
        prompt: 'Qual é o melhor momento para separar o dinheiro que você vai poupar?',
        options: [
          'No fim do mês, com o que sobrar',
          'Assim que o salário cair',
          'Só quando houver um objetivo grande',
        ],
        answer: 1,
        explanation:
          'Separar primeiro transforma poupar em hábito. Deixar para o fim faz o gasto ocupar todo o espaço.',
      },
      {
        type: 'text',
        markup:
          'Anote os gastos por alguns meses. Quem enxerga para onde o dinheiro vai descobre a sobra que já existia.',
      },
      {
        type: 'widget',
        id: 'nota-orcamento',
        widget: 'platform-note',
        props: {
          brazil:
            'Você monta o orçamento com o seu dinheiro de verdade e decide quanto aportar todo mês.',
          here: 'A plataforma não vê as suas contas. O mercado ao vivo começa com R$ 10.000,00 de capital de treino, definido pela plataforma e não pelo seu orçamento.',
          why: 'Assim você treina a decisão de investir sem expor o seu dinheiro. A sobra do seu orçamento é o que diz quanto aportar na vida real.',
        },
      },
    ],
  },
}
