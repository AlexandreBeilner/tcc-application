import type { LessonBlocks } from '../modules/lessons/domain/widgets/lessonBlocks'

// Lições de proventos e de FIIs reescritas (RC.5.11 e RC.5.13). Fatos:
// `b3-data-com-ex` (glossário da B3, lido), `dividendo-obrigatorio` (metade do
// lucro se o estatuto for omisso), `jcp-definicao` e `jcp-aliquota`,
// `dividendos-retencao-lei-15270`, `fii-distribuicao-minima`,
// `fii-isencao-rendimentos` e `acoes-isencao-20-mil`. A alíquota do ganho de
// capital de FII (`fii-ganho-capital`) segue como trecho de busca (a página do
// Planalto não abriu), então a lição diz que o ganho é tributado sem citar o
// número. A diferença da plataforma (calendário por empresa, sem imposto
// retido, sem JCP) fica nos blocos "Na plataforma".

export const BLOCKS_2_7_6: LessonBlocks = {
  schemaVersion: 1,
  phases: {
    scenario: [
      {
        type: 'text',
        markup:
          'O {{dividendo}} é a parte do lucro que a empresa paga em dinheiro aos acionistas. O quanto ela distribui é o {{payout}}. Se o estatuto não disser outra coisa, a lei manda distribuir metade do lucro líquido ajustado.',
      },
      {
        type: 'text',
        markup:
          'Quem recebe não é quem tem a ação no dia do pagamento. Dois dias decidem: a {{data com}} e a {{data ex}}.',
      },
    ],
    microDecision: [
      {
        type: 'text',
        markup:
          'A empresa anunciou um provento. Você compra a ação no dia da data ex, um dia depois da data com. Você recebe esse provento?',
      },
    ],
    revelation: [
      {
        type: 'text',
        markup:
          'Não recebe. A data com é o último dia em que comprar ainda dá o direito. A partir da data ex, que vem no dia seguinte, a ação negocia sem ele.',
      },
      {
        type: 'widget',
        id: 'linha-do-tempo',
        widget: 'dividend-timeline',
        props: {},
        caption: 'Escolha comprar ou vender e o dia. Veja quem recebe.',
      },
      {
        type: 'check',
        id: 'vende-na-data-ex',
        kind: 'single',
        prompt: 'Você já tinha a ação na data com e vende na data ex. Recebe o provento?',
        options: ['Sim', 'Não'],
        answer: 0,
        explanation:
          'O direito é de quem tinha a ação no fim da data com. Vender depois disso não tira o direito.',
      },
      {
        type: 'text',
        markup:
          'Na data ex o preço da ação costuma cair mais ou menos o valor do provento. O dinheiro que sai da empresa deixa de estar no preço. Receber provento não é ganho extra: é parte do valor da empresa indo para o seu bolso.',
      },
      {
        type: 'check',
        id: 'preco-na-data-ex',
        kind: 'true_false',
        prompt: 'Na data ex, o preço da ação costuma cair em torno do valor do provento.',
        answer: true,
        explanation: 'O provento sai do caixa da empresa, e o preço passa a refletir isso.',
      },
      {
        type: 'text',
        markup:
          'O {{JCP}} é outra forma de a empresa pagar o acionista, calculada sobre o patrimônio líquido. Para a empresa, ele pode reduzir o imposto que ela paga. Dividendos e JCP juntos são os proventos.',
      },
      {
        type: 'text',
        markup:
          'O imposto muda. O dividendo só tem retenção se o total pago por uma mesma empresa a você passar de um limite no mês. O JCP tem 17,5% retidos na fonte.',
      },
      {
        type: 'widget',
        id: 'liquido-do-provento',
        widget: 'dividend-net-calculator',
        props: {},
        caption: 'Troque entre dividendo e JCP e veja o líquido.',
      },
      {
        type: 'check',
        id: 'jcp-liquido',
        kind: 'single',
        prompt:
          'Você recebe R$ 1.000 de JCP. Com 17,5% retidos na fonte, quanto cai na sua conta, em reais?',
        options: ['R$ 175', 'R$ 825', 'R$ 850', 'R$ 1.000'],
        answer: 1,
        explanation: '17,5% de 1.000 são 175. Sobram 825.',
      },
      {
        type: 'check',
        id: 'dividendo-abaixo-do-limite',
        kind: 'single',
        prompt:
          'Suponha que a retenção de 10% só valha quando uma mesma empresa paga mais de R$ 50 mil no mês a você. Você recebe R$ 1.000 de dividendos de uma empresa no mês. Quanto é retido?',
        options: ['Nada, o total do mês está abaixo do limite', '10%', '17,5%'],
        answer: 0,
        explanation:
          'A retenção só vale quando o total do mês, da mesma empresa para você, passa do limite.',
      },
      {
        type: 'more',
        id: 'mais-frequencia-do-provento',
        title: 'De quanto em quanto tempo o provento cai',
        blocks: [
          {
            type: 'text',
            markup:
              'Cada empresa escolhe a frequência: trimestral, semestral ou anual. Por isso o provento não cai todo mês, e não dá para tratá-lo como um salário.',
          },
        ],
      },
      {
        type: 'check',
        id: 'dividendo-e-jcp',
        kind: 'true_false',
        prompt: 'Dividendo e JCP são a mesma coisa, com nomes diferentes.',
        answer: false,
        explanation:
          'O JCP é calculado sobre o patrimônio líquido e tem imposto retido na fonte. O dividendo tem outra regra.',
      },
      {
        type: 'widget',
        id: 'nota-proventos',
        widget: 'platform-note',
        props: {
          brazil:
            'Cada empresa define a frequência do provento, e o JCP existe, com imposto retido na fonte.',
          here: 'Cada empresa tem uma frequência (trimestral, semestral ou anual) e distribui metade do lucro. A data com, a data ex e o pagamento caem em dias úteis, o valor entra direto no saldo, sem retenção, e não há JCP.',
          why: 'Assim você vê vários proventos em pouco tempo e aprende o calendário sem a complicação do imposto.',
        },
      },
    ],
  },
}

export const BLOCKS_2_10: LessonBlocks = {
  schemaVersion: 1,
  phases: {
    scenario: [
      {
        type: 'text',
        markup:
          'Um {{FII}} reúne o dinheiro de muitos investidores, os cotistas, para aplicar no mercado imobiliário. Você compra cotas na bolsa, como compra uma ação.',
      },
      {
        type: 'text',
        markup:
          'O FII de tijolo é dono de imóveis e vive do aluguel. O FII de papel investe em títulos de dívida ligados a imóveis, como os CRI, e vive dos juros que recebe.',
      },
    ],
    microDecision: [
      {
        type: 'text',
        markup:
          'A vacância é a parte dos imóveis sem inquilino. Faz sentido olhar a vacância de um FII de papel?',
      },
    ],
    revelation: [
      {
        type: 'text',
        markup:
          'Não faz. Vacância só existe onde há imóvel vago. O FII de papel é lido pelo que os devedores pagam e pelo indexador da carteira, como o CDI ou o IPCA.',
      },
      {
        type: 'check',
        id: 'tipo-do-fii',
        kind: 'single',
        prompt: 'Um FII é dono de shoppings e galpões e recebe aluguel. Que tipo é?',
        options: ['Tijolo', 'Papel'],
        answer: 0,
        explanation:
          'Dono de imóveis que rendem aluguel é FII de tijolo. O de papel compra títulos de dívida.',
      },
      {
        type: 'text',
        markup:
          'O FII distribui rendimentos aos cotistas, em geral todo mês. A lei exige distribuir pelo menos 95% do lucro apurado em regime de caixa, com balanço semestral. Pagar todo mês é prática de mercado. No FII o nome é rendimento, ou provento. Dividendo é o termo das ações.',
      },
      {
        type: 'widget',
        id: 'calendario-fii',
        widget: 'fii-monthly-calendar',
        props: {},
        caption:
          'Mude o dia útil do pagamento e escolha um mês para ver data com, data ex e pagamento.',
      },
      {
        type: 'check',
        id: 'dy-do-fii',
        kind: 'single',
        prompt:
          'Um FII paga R$ 1,00 por cota todo mês, e a cota custa R$ 100. Qual é o Dividend Yield anual, em %?',
        options: ['1%', '8,3%', '12%', '100%'],
        answer: 2,
        explanation: '12 pagamentos de R$ 1,00 são R$ 12,00 em um ano. 12 dividido por 100 dá 12%.',
      },
      {
        type: 'text',
        markup:
          'O {{P/VP}} compara o preço da cota com o patrimônio por cota. Abaixo de 1, a cota custa menos que o patrimônio do fundo. Pode ser oportunidade, ou sinal de problema nos imóveis ou nos devedores.',
      },
      {
        type: 'check',
        id: 'pvp-do-fii',
        kind: 'single',
        prompt: 'Um FII tem P/VP de 0,8. O que isso diz?',
        options: [
          'A cota custa 20% menos que o patrimônio por cota',
          'A cota custa 20% mais que o patrimônio por cota',
          'O fundo rende 20% ao ano',
        ],
        answer: 0,
        explanation:
          'P/VP de 0,8 é preço igual a 80% do patrimônio por cota. Pode ser desconto, ou o mercado vendo um problema.',
      },
      {
        type: 'text',
        markup:
          'Para pessoa física, o rendimento do FII é isento de IR quando o fundo tem pelo menos 100 cotistas, as cotas são negociadas em bolsa e você tem menos de 10% delas. Já o ganho ao vender a cota é tributado. E a isenção de vendas no mês vale só para ações, não para FII.',
      },
      {
        type: 'check',
        id: 'venda-de-cotas',
        kind: 'true_false',
        prompt:
          'Você vendeu R$ 15.000 em cotas de FII, com lucro, no mês. O ganho é isento, como nas ações.',
        answer: false,
        explanation:
          'A isenção de vendas no mês vale para ações. O ganho na venda de cotas de FII é tributado.',
      },
      {
        type: 'check',
        id: 'selic-e-fii',
        kind: 'single',
        prompt: 'A Selic sobe bastante. O que costuma acontecer com o preço das cotas de FII?',
        options: [
          'Tende a cair, porque a renda fixa passa a competir pelo dinheiro',
          'Tende a subir, porque os aluguéis sobem na hora',
          'Não muda nada',
        ],
        answer: 0,
        explanation:
          'Com a renda fixa pagando mais, o rendimento do FII fica menos atraente, e o preço da cota costuma ceder.',
      },
      {
        type: 'widget',
        id: 'nota-fii',
        widget: 'platform-note',
        props: {
          brazil:
            'Cada fundo paga na sua data: a data com costuma ficar no fim do mês e o pagamento cai em geral entre o 5º e o 15º dia útil do mês seguinte.',
          here: 'Todo FII paga todo mês, com data ex no 1º dia útil do mês seguinte e pagamento num dia útil entre o 5º e o 15º, que muda de fundo para fundo. O valor entra direto no saldo.',
          why: 'Assim você vê vários rendimentos em pouco tempo, sem a complicação do imposto.',
        },
      },
    ],
  },
}
