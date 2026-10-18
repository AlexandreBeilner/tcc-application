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
        kind: 'single',
        prompt: 'Você ganha R$ 5.000 e gasta R$ 4.250 no mês. Quanto da renda sobra, em %?',
        options: ['15%', '17,6%', '75%', '85%'],
        answer: 0,
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

// Lição "Dívida: os juros do outro lado" (RC.4.5). Fatos: `rotativo-limite-lei-14690`
// (juros e encargos do rotativo não passam do valor original) e `bcb-taxas-medias-credito-pf`
// (rotativo perto de 15% e cheque especial perto de 7% ao mês em 2026). Não cita o teto do
// consignado nem programa de renegociação, que mudam. Como é trilha paralela, define juros
// compostos e taxa ao mês dentro do próprio texto.

export const BLOCKS_DIVIDA: LessonBlocks = {
  schemaVersion: 1,
  phases: {
    scenario: [
      {
        type: 'text',
        markup:
          'Os {{juros compostos}} que fazem um investimento crescer trabalham contra você quando é você quem deve. A dívida cresce sobre um saldo que já inclui os juros dos meses anteriores.',
      },
      {
        type: 'text',
        markup:
          'Preste atenção na unidade: o banco anuncia a taxa ao mês. Juros de 8% ao mês não são 96% ao ano, são cerca de 152%, porque cada mês incide sobre o anterior.',
      },
      {
        type: 'check',
        id: 'taxa-mensal-anual',
        kind: 'single',
        prompt: 'Uma dívida cobra 8% de juros ao mês. Quanto isso dá ao ano?',
        options: ['96%, que é 8% vezes 12', 'Cerca de 152%', '8%'],
        answer: 1,
        explanation:
          'Com juros compostos, 1,08 elevado a 12 dá cerca de 2,52: a dívida mais que dobra, um aumento de uns 152%.',
      },
    ],
    microDecision: [
      {
        type: 'text',
        markup:
          'Você usa R$ 1.000 do cheque especial a juros de 8% ao mês e não paga nada por 12 meses. A dívida chega perto de quanto?',
      },
    ],
    revelation: [
      {
        type: 'text',
        markup:
          'Perto de R$ 2.520. Em um ano a dívida mais que dobra, porque os juros de cada mês incidem também sobre os juros dos meses anteriores.',
      },
      {
        type: 'widget',
        id: 'simulador-de-divida',
        widget: 'debt-snowball',
        props: {},
        caption:
          'Mude a dívida, os juros e o pagamento mensal. Pagar pouco faz a dívida durar anos, ou nunca acabar.',
      },
      {
        type: 'check',
        id: 'chute-divida-12-meses',
        kind: 'estimate',
        prompt:
          'Chute: você deve R$ 1.000 a 15% ao mês e não paga nada. Quanto deve depois de 12 meses?',
        min: 1000,
        max: 6000,
        step: 100,
        unit: 'brl',
        answer: 5350.25,
        tolerancePct: 10,
        explanation:
          'A conta dá cerca de R$ 5.350: 15% ao mês, mês após mês, multiplica a dívida por mais de 5. No rotativo do cartão existe um freio por lei, que você vê a seguir.',
      },
      {
        type: 'text',
        markup:
          'No cartão de crédito, a fatura que você não paga por inteiro entra no {{rotativo}}, uma das taxas mais altas do mercado. Por lei, os juros e encargos do rotativo somados não passam do valor original da dívida: ela pode, no máximo, dobrar.',
      },
      {
        type: 'check',
        id: 'limite-do-rotativo',
        kind: 'single',
        prompt:
          'Você deve R$ 1.000 no rotativo. Pela lei, quanto pode ser cobrado de juros e encargos, no máximo?',
        options: ['R$ 500', 'R$ 1.000', 'Não há limite'],
        answer: 1,
        explanation:
          'Os juros e encargos totais não podem passar do valor original da dívida, então R$ 1.000 de dívida não passa de R$ 2.000.',
      },
      {
        type: 'text',
        markup:
          'O {{cheque especial}} e o crédito pessoal sem desconto em folha também são caros. O {{consignado}} costuma ser mais barato porque a parcela é descontada direto da folha de pagamento ou do benefício, e o banco corre menos risco de não receber.',
      },
      {
        type: 'more',
        id: 'mais-taxas-de-hoje',
        title: 'Quanto cobram hoje',
        blocks: [
          {
            type: 'widget',
            id: 'hoje-taxas-credito',
            widget: 'callout',
            props: {
              tone: 'info',
              title: 'Taxas de hoje',
              body:
                'Em 2026, a média do Banco Central para o rotativo do cartão ficou perto de 15% ao mês, mais de 400% ao ano, e a do cheque especial, perto de 7% ao mês. Essas taxas mudam com o tempo.',
            },
          },
        ],
      },
      {
        type: 'check',
        id: 'por-que-consignado',
        kind: 'single',
        prompt: 'Por que o consignado costuma ter juros menores?',
        options: [
          'O banco desconta a parcela direto da folha, com menos risco de calote',
          'O governo paga a diferença dos juros',
          'O prazo é sempre curto',
        ],
        answer: 0,
        explanation:
          'Quando o risco de não receber é menor, o banco cobra menos. É a mesma lógica de qualquer taxa de juros.',
      },
      {
        type: 'text',
        markup:
          'Regra prática: dívida cara primeiro, investimento depois. Se a dívida custa mais do que o investimento rende depois do imposto, quitar é o melhor retorno que você consegue.',
      },
      {
        type: 'widget',
        id: 'quitar-ou-investir',
        widget: 'pay-or-invest',
        props: {},
        caption: 'Compare os juros da dívida com o rendimento do investimento depois do imposto.',
      },
      {
        type: 'check',
        id: 'quitar-ou-investir-pergunta',
        kind: 'single',
        prompt:
          'Você deve a 5% ao mês e tem um investimento que rende cerca de 1% ao mês, depois do imposto. O que costuma compensar?',
        options: ['Investir e manter a dívida', 'Quitar a dívida', 'Tanto faz'],
        answer: 1,
        explanation:
          'A dívida custa muito mais do que o investimento rende. Quitá-la equivale a ganhar 5% ao mês sem risco.',
      },
      {
        type: 'text',
        markup:
          'Se não dá para pagar, procure o credor antes de atrasar mais. Peça taxa menor, prazo maior ou desconto para pagar à vista, e compare o custo total antes de aceitar. Órgãos como o Procon podem orientar.',
      },
      {
        type: 'check',
        id: 'pagar-o-minimo',
        kind: 'true_false',
        prompt: 'Pagar só o valor mínimo da fatura resolve a dívida: o resto desaparece.',
        answer: false,
        explanation:
          'O restante vai para o rotativo e continua rendendo juros altos. Pagar só o mínimo prolonga a dívida.',
      },
      {
        type: 'widget',
        id: 'nota-divida',
        widget: 'platform-note',
        props: {
          brazil:
            'Cartão, cheque especial e empréstimo cobram juros compostos, e quitar a dívida cara costuma vir antes de investir.',
          here: 'Na plataforma você não tem dívida: as ordens usam só o saldo da conta, sem crédito, cartão ou juros cobrados de você.',
          why: 'Assim o treino foca em investir. O custo da dívida real você vê nos simuladores desta lição.',
        },
      },
    ],
  },
}
