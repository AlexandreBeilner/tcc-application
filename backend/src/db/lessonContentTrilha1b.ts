import type { LessonBlocks } from '../modules/lessons/domain/widgets/lessonBlocks'

// Conteúdo visual das lições 1.1 e 1.2 (RC.5.3), no contrato `blocks`. Os fatos
// (IR, IOF, custódia, liquidação do resgate) vêm de
// `modules/lessons/domain/regulatoryFacts.ts`.

export const BLOCKS_1_1: LessonBlocks = {
  schemaVersion: 1,
  phases: {
    scenario: [
      {
        type: 'text',
        markup:
          'Imagine emprestar R$ 1.000 a um amigo, combinando desde o início a taxa e o prazo de devolução.' +
          '\n\n' +
          'Na renda fixa é assim: você empresta dinheiro a um emissor (governo, banco ou empresa) e a regra de remuneração é conhecida na hora da aplicação.',
      },
      {
        type: 'text',
        markup:
          'Há três tipos de regra. {{prefixado}}: a taxa fica travada na compra. {{pós-fixado}}: acompanha um {{indexador}}, como a Selic ou o CDI. Híbrido: uma parte fixa mais a inflação.',
      },
      {
        type: 'check',
        id: 'tipo-hibrido',
        kind: 'single',
        prompt: 'Um título paga 6% ao ano mais o IPCA. Que tipo de regra é essa?',
        options: ['Prefixada', 'Pós-fixada, só a Selic', 'Híbrida'],
        answer: 2,
        explanation:
          'Tem uma parte fixa (6%) e uma parte que acompanha a inflação (IPCA). Por isso é híbrida.',
      },
    ],
    microDecision: [
      {
        type: 'text',
        markup:
          '"Renda fixa" não significa necessariamente "taxa fixa". Pense: um título cuja remuneração acompanha a Selic todo dia, sem taxa travada na compra, ainda é considerado renda fixa?',
      },
    ],
    revelation: [
      {
        type: 'text',
        markup:
          'Sim. O que é fixo é a regra, conhecida de antemão, e não o valor final recebido.' +
          '\n\n' +
          'Na renda variável, que vem na Trilha 2, o retorno depende do preço de mercado e não é conhecido com antecedência.',
      },
      {
        type: 'check',
        id: 'valor-final',
        kind: 'true_false',
        prompt: 'Renda fixa significa que o valor final recebido é sempre conhecido de antemão.',
        answer: false,
        explanation:
          'Conhecida de antemão é a regra de remuneração. Num título pós-fixado, o valor final depende de como o indexador se comporta.',
      },
      {
        type: 'text',
        markup:
          'Nesta trilha você vai ver os três emissores: governo (Tesouro Direto), bancos (CDB, LCI e LCA) e empresas (CRI e CRA). No fim, vai saber onde guardar uma reserva de emergência, o dinheiro para imprevistos.',
      },
    ],
  },
}

export const BLOCKS_1_2: LessonBlocks = {
  schemaVersion: 1,
  phases: {
    scenario: [
      {
        type: 'text',
        markup:
          'Você tem R$ 1.000 e empresta ao Tesouro Nacional, que devolve o valor corrigido pela Selic a cada dia útil.' +
          '\n\n' +
          'É o Tesouro Selic (também chamado LFT): um título público pós-fixado, de alta {{liquidez}} e baixa oscilação de preço.',
      },
      {
        type: 'check',
        id: 'devedor-tesouro-selic',
        kind: 'single',
        prompt: 'No Tesouro Selic, quem deve o dinheiro a você?',
        options: ['Um banco', 'O governo federal', 'Uma empresa'],
        answer: 1,
        explanation: 'O Tesouro Nacional emite o título: o devedor é o governo federal.',
      },
    ],
    microDecision: [
      {
        type: 'text',
        markup:
          'Se a Selic sobe, o que acontece com o que o Tesouro Selic rende por dia: rende mais, menos ou igual?',
      },
    ],
    revelation: [
      {
        type: 'text',
        markup:
          'Rende mais por dia. O valor do título (o preço unitário) sobe todo dia útil, com a Selic alta ou baixa. A Selic só muda a velocidade da subida.',
      },
      {
        type: 'check',
        id: 'pu-selic-sobe',
        kind: 'true_false',
        prompt: 'Quando a Selic sobe, o preço unitário do Tesouro Selic cai.',
        answer: false,
        explanation:
          'O preço do Tesouro Selic oscila pouco e continua subindo dia a dia. Quem sofre quedas de preço com a alta de juros são os prefixados e os híbridos (lição de marcação a mercado).',
      },
      {
        type: 'text',
        markup:
          'Tem custos. O imposto de renda segue a tabela regressiva (de 22,5% a 15% sobre o ganho) e há IOF se resgatar antes de 30 dias. A B3 cobra uma taxa anual de custódia, mas no Tesouro Selic ela não incide sobre os primeiros reais investidos.',
      },
      {
        type: 'widget',
        id: 'hoje-custodia-b3',
        widget: 'callout',
        props: {
          tone: 'info',
          title: 'Valores de hoje',
          body:
            'A B3 cobra 0,20% ao ano de custódia sobre o Tesouro Direto. No Tesouro Selic, não cobra nada sobre os primeiros R$ 10 mil. Esses valores podem mudar.',
        },
      },
      {
        type: 'check',
        id: 'custodia-selic',
        kind: 'single',
        prompt:
          'No Tesouro Selic, a B3 não cobra custódia sobre os primeiros R$ 10 mil. Você tem R$ 8.000 nele. Quanto paga de custódia por ano?',
        options: ['R$ 0', 'R$ 16', 'R$ 80', 'R$ 160'],
        answer: 0,
        explanation:
          'Todo o seu valor está dentro da parte isenta, então a custódia é zero.',
      },
      {
        type: 'text',
        markup:
          'O resgate é só em dia útil: o dinheiro cai no mesmo dia ou no dia útil seguinte, conforme o horário do pedido. Não é instantâneo.',
      },
      {
        type: 'widget',
        id: 'nota-tesouro-selic',
        widget: 'platform-note',
        props: {
          brazil: 'O Tesouro Selic rende a Selic em vigor, definida pelo Copom.',
          here: 'O Tesouro Selic do Mercado acompanha a Selic da plataforma, que muda nas reuniões do Copom simulado.',
          why: 'Assim você vê o efeito de uma decisão de juros sem esperar o calendário real.',
        },
      },
      { type: 'text', markup: 'Completar esta lição libera a compra do Tesouro Selic no Mercado.' },
    ],
  },
}

// Lição 1.3 (RC.5.4): o que o Copom olha ao decidir a Selic. A definição de
// Selic, Copom e as 8 reuniões vem da lição anterior de juros; aqui entram a
// meta de inflação (fato `meta-inflacao`) e a ligação entre inflação, Selic e
// renda fixa. A regra interna do motor vai só para o bloco "Na plataforma".
export const BLOCKS_1_3: LessonBlocks = {
  schemaVersion: 1,
  phases: {
    scenario: [
      {
        type: 'text',
        markup:
          'Você já viu que o Tesouro Selic rende a Selic e que o Copom define a meta dela. Mas o que o Copom olha para decidir?' +
          '\n\n' +
          'A pergunta central é: a inflação está dentro da meta? A meta é um número com tolerância para cima e para baixo, definido pelo governo e medido pelo {{IPCA}} em 12 meses. Ela pode mudar com o tempo.',
      },
      {
        type: 'check',
        id: 'intervalo-meta',
        kind: 'single',
        prompt:
          'Com meta de 3% e tolerância de 1,5 ponto, qual é o intervalo aceito para a inflação?',
        options: ['De 3% a 4,5%', 'De 1,5% a 4,5%', 'De 0% a 3%'],
        answer: 1,
        explanation:
          '3% menos 1,5 ponto dá 1,5%, e 3% mais 1,5 ponto dá 4,5%. A tolerância vale para os dois lados.',
      },
    ],
    microDecision: [
      {
        type: 'text',
        markup:
          'O IPCA em 12 meses está em 6%, acima do teto da meta. Numa reunião, o Copom tende a elevar, reduzir ou manter a Selic?',
      },
    ],
    revelation: [
      {
        type: 'text',
        markup:
          'Elevar. Juros mais altos encarecem o crédito, esfriam o consumo e puxam a inflação para baixo. Se a inflação estiver abaixo da meta, a pressão é no sentido contrário.',
      },
      {
        type: 'widget',
        id: 'gangorra-inflacao-selic',
        widget: 'inflation-selic-seesaw',
        props: { inflationPct: 6 },
        caption: 'Mova a inflação e veja para onde a Selic tende a ir.',
      },
      {
        type: 'check',
        id: 'inflacao-dentro-da-meta',
        kind: 'single',
        prompt:
          'Com meta de 3% e tolerância de 1,5 ponto, a inflação em 12 meses está em 3,5%. O que o Copom tende a fazer com a Selic?',
        options: ['Elevar com urgência', 'Manter, sem urgência', 'Reduzir com urgência'],
        answer: 1,
        explanation:
          '3,5% está dentro do intervalo de 1,5% a 4,5%, então não há pressão forte para mexer nos juros.',
      },
      {
        type: 'text',
        markup:
          'Na prática o Copom não aplica uma fórmula. Ele olha também as expectativas de inflação, a atividade econômica e o cenário externo.',
      },
      {
        type: 'text',
        markup:
          'Quando a Selic sobe, o Tesouro Selic passa a render mais logo nos dias seguintes. Um título prefixado já comprado segue com a taxa antiga e perde valor de mercado, tema que aparece adiante na trilha.',
      },
      {
        type: 'check',
        id: 'selic-subiu',
        kind: 'single',
        prompt: 'A Selic subiu. Qual aplicação passa a render mais quase de imediato?',
        options: [
          'Um título prefixado já comprado',
          'O Tesouro Selic',
          'Nenhuma, o rendimento só muda no vencimento',
        ],
        answer: 1,
        explanation:
          'O Tesouro Selic é pós-fixado: acompanha a Selic. O prefixado já comprado tem a taxa travada.',
      },
      {
        type: 'widget',
        id: 'nota-copom-reacao',
        widget: 'platform-note',
        props: {
          brazil:
            'O Copom se reúne 8 vezes por ano, cerca de 45 dias entre uma e outra, e decide olhando expectativas e cenário, sem fórmula.',
          here: 'O Copom da plataforma decide a cada 45 dias simulados, com uma regra simplificada que reage ao IPCA acumulado e ao nível da Selic.',
          why: 'A plataforma precisa de um modelo para gerar as decisões. É uma simplificação do que o comitê real faz.',
        },
      },
    ],
  },
}

// Lição nova "Reserva de emergência: quanto e onde" (RC.4.6), logo depois do
// Tesouro Selic: cumpre a promessa das lições 1.1 e 1.2. O critério de onde
// guardar vem do fato `reserva-emergencia-bcb`; o número de meses é regra de
// bolso, rotulada assim no texto e no widget, porque o Caderno do Banco Central
// não fixa um prazo.
export const BLOCKS_RESERVA: LessonBlocks = {
  schemaVersion: 1,
  phases: {
    scenario: [
      {
        type: 'text',
        markup:
          'Antes de investir para ganhar, vem o seguro contra o imprevisto: a reserva de emergência. É o dinheiro para um conserto, um problema de saúde ou uma perda de renda, sem precisar se endividar.',
      },
      {
        type: 'check',
        id: 'funcao-reserva',
        kind: 'single',
        prompt: 'Para que serve a reserva de emergência?',
        options: [
          'Render o máximo possível',
          'Cobrir imprevistos sem se endividar',
          'Comprar ações quando elas caem',
        ],
        answer: 1,
        explanation:
          'A reserva é um seguro. O objetivo é o dinheiro estar disponível quando o imprevisto chegar, não render mais.',
      },
      {
        type: 'text',
        markup:
          'Quanto guardar? Uma regra de bolso comum: de 3 a 6 meses do seu custo de vida essencial, e de 6 a 12 meses se a renda for variável. A conta é sobre o que você gasta, não sobre o que você ganha.',
      },
      {
        type: 'widget',
        id: 'calculadora-reserva',
        widget: 'emergency-fund-calculator',
        props: { monthlyCost: 3000, incomeType: 'stable', monthlyContribution: 500 },
        caption: 'Troque os valores pelos seus.',
      },
    ],
    microDecision: [
      {
        type: 'text',
        markup:
          'Seu custo de vida essencial é de R$ 3.000 por mês e sua renda é estável. Qual valor é uma meta razoável de reserva?',
      },
    ],
    revelation: [
      {
        type: 'text',
        markup:
          'De R$ 9.000 a R$ 18.000, que são de 3 a 6 meses do custo essencial. R$ 3.000 cobre só um mês, e R$ 60.000 é mais do que a regra pede.',
      },
      {
        type: 'text',
        markup:
          'Onde guardar? O Banco Central orienta uma aplicação de alta {{liquidez}} e baixo risco: o dinheiro precisa estar lá, sem perda e disponível rápido.',
      },
      {
        type: 'widget',
        id: 'onde-guardar',
        widget: 'where-to-keep',
        props: {},
        caption: 'Marque cada produto e veja o motivo.',
      },
      {
        type: 'check',
        id: 'erro-comum-reserva',
        kind: 'single',
        prompt: 'Qual é um erro comum ao guardar a reserva?',
        options: [
          'Aplicar num produto com {{carência}} ou que pode cair de preço',
          'Aplicar no Tesouro Selic',
          'Aplicar num CDB com liquidez diária',
        ],
        answer: 0,
        explanation:
          'Com carência o dinheiro fica preso, e com preço oscilando você pode vender no prejuízo justo na hora do aperto.',
      },
      {
        type: 'check',
        id: 'trocar-por-acoes',
        kind: 'true_false',
        prompt: 'Se a reserva rende pouco, vale trocá-la por ações para render mais.',
        answer: false,
        explanation:
          'A função da reserva é a segurança. Render menos é o preço de ter o dinheiro disponível e sem risco de perda.',
      },
      {
        type: 'text',
        markup: 'Usou a reserva? Reponha antes de voltar a investir em outras coisas.',
      },
      {
        type: 'widget',
        id: 'nota-reserva',
        widget: 'platform-note',
        props: {
          brazil:
            'A reserva é sua, numa aplicação que você escolhe e contrata no banco ou na corretora.',
          here: 'O dinheiro da plataforma é de treino e não é a sua reserva real.',
          why: 'A plataforma ensina a escolher o produto. A reserva de verdade deve ficar numa aplicação sua.',
        },
      },
    ],
  },
}

// Lição 1.7, Tesouro Prefixado (RC.5.6). Preço, deságio e conta líquida vêm do
// widget `bond-price-calculator`; 11,75% é taxa de exemplo, dita assim no
// texto. Fatos: `tesouro-prefixado-regras`, `tesouro-custodia-b3`,
// `ir-renda-fixa-regressivo`.
export const BLOCKS_1_7: LessonBlocks = {
  schemaVersion: 1,
  phases: {
    scenario: [
      {
        type: 'text',
        markup:
          'O governo também vende títulos com a taxa travada na compra: o Tesouro Prefixado, nome técnico LTN. Ele promete pagar R$ 1.000 por título no vencimento, sem pagar nada no meio do caminho.',
      },
      {
        type: 'text',
        markup:
          'Esses R$ 1.000 são o {{valor de face}} do título. Os juros não vêm em parcelas: estão na diferença entre o que você paga hoje e o que recebe no fim.',
      },
      {
        type: 'check',
        id: 'taxa-travada',
        kind: 'single',
        prompt:
          'Você comprou um prefixado a 11,75% ao ano e, depois, a Selic subiu. O que acontece com a taxa do seu título?',
        options: [
          'Sobe junto com a Selic',
          'Continua em 11,75% até o vencimento',
          'Cai, para compensar',
        ],
        answer: 1,
        explanation:
          'Prefixado quer dizer taxa travada na compra. Ela só muda de verdade para quem vende antes do vencimento, assunto da próxima lição.',
      },
    ],
    microDecision: [
      {
        type: 'text',
        markup:
          'Um título promete R$ 1.000 daqui a 2 anos, com taxa de 11,75% ao ano (taxa de exemplo). Hoje, o preço dele deve ser maior, menor ou igual a R$ 1.000?',
      },
    ],
    revelation: [
      {
        type: 'text',
        markup:
          'Menor. O governo vende com {{deságio}}: o juro já está dentro do preço. Você paga menos hoje e recebe os R$ 1.000 no vencimento.',
      },
      {
        type: 'widget',
        id: 'preco-prefixado',
        widget: 'bond-price-calculator',
        props: { ratePct: 11.75, years: 2, amount: 10000 },
        caption: 'Mexa na taxa e no prazo e veja o preço de cada título.',
      },
      {
        type: 'check',
        id: 'preco-um-ano',
        kind: 'single',
        prompt:
          'Com taxa de 10% ao ano e prazo de 1 ano, quanto custa um título que paga R$ 1.000?',
        options: ['R$ 900,00', 'R$ 909,09', 'R$ 1.000,00', 'R$ 1.100,00'],
        answer: 1,
        explanation:
          'R$ 1.000 divididos por 1,10 dão R$ 909,09. O deságio de R$ 90,91 é o juro de um ano.',
      },
      {
        type: 'check',
        id: 'prazo-maior-preco',
        kind: 'single',
        prompt: 'Com a mesma taxa, se o prazo até o vencimento aumenta, o preço de hoje:',
        options: ['Sobe', 'Cai', 'Fica igual'],
        answer: 1,
        explanation:
          'Quanto mais tempo os juros têm para correr, maior o deságio e menor o preço de hoje.',
      },
      {
        type: 'text',
        markup:
          'O ganho que a conta mostra primeiro é bruto. Sobre ele pagam-se o imposto de renda, pela tabela regressiva, e a custódia da B3. O widget já mostra o líquido.',
      },
      {
        type: 'text',
        markup:
          'No app do Tesouro Direto você vai ver "Tesouro Prefixado" e também "Tesouro Prefixado com Juros Semestrais", que paga juros a cada semestre. Os dois vencem em 1º de janeiro. Aqui estudamos o sem juros semestrais.',
      },
      {
        type: 'check',
        id: 'prefixado-garante-selic',
        kind: 'true_false',
        prompt: 'O Tesouro Prefixado garante que você nunca vai ganhar menos que a Selic.',
        answer: false,
        explanation:
          'Travar a taxa é uma aposta. Se a Selic subir depois, quem travou fica com uma taxa menor que a nova Selic.',
      },
      {
        type: 'widget',
        id: 'nota-tesouro-prefixado',
        widget: 'platform-note',
        props: {
          brazil:
            'A taxa e o preço do Tesouro Prefixado mudam todo dia útil, e cada título vence em 1º de janeiro.',
          here: 'O Tesouro Prefixado do Mercado tem taxa e vencimento definidos pelo catálogo da plataforma.',
          why: 'Assim os números do exemplo ficam estáveis para você praticar.',
        },
      },
      {
        type: 'text',
        markup: 'Completar esta lição libera a compra do Tesouro Prefixado no Mercado.',
      },
    ],
  },
}

// Lição 1.8, Marcação a mercado (RC.5.6). A gangorra (`mtm-seesaw`) mostra taxa
// x preço, prazo e tipo de título. A taxa de mercado do título não é a Selic, e
// o preço antecipa expectativas. Fato: `tesouro-resgate-preco-mercado`.
export const BLOCKS_1_8: LessonBlocks = {
  schemaVersion: 1,
  phases: {
    scenario: [
      {
        type: 'text',
        markup:
          'Você comprou um prefixado a 11,75% ao ano e precisa do dinheiro antes do vencimento. O Tesouro recompra o título, mas pelo preço de mercado do dia, e não pelos R$ 1.000.',
      },
      {
        type: 'check',
        id: 'valor-resgate-antecipado',
        kind: 'single',
        prompt: 'Você vende um prefixado antes do vencimento. Quanto o Tesouro paga?',
        options: [
          'R$ 1.000 por título',
          'O preço do dia, que pode ser maior ou menor',
          'O que você pagou, sem juros',
        ],
        answer: 1,
        explanation:
          'O Tesouro recompra pelo valor de mercado do dia. Os R$ 1.000 só chegam a quem segura até o vencimento.',
      },
      {
        type: 'text',
        markup:
          'Esse preço do dia vem da taxa que o mercado exige hoje para aquele vencimento. Ela não é a Selic: depende também da expectativa de juros, da inflação e do risco do país. Recalcular o preço todo dia é a {{marcação a mercado}}.',
      },
    ],
    microDecision: [
      {
        type: 'text',
        markup:
          'Desde a sua compra, a taxa de mercado para esse vencimento subiu de 11,75% para 14% ao ano. O preço de revenda do seu título fica acima ou abaixo do que ele valia?',
      },
    ],
    revelation: [
      {
        type: 'text',
        markup:
          'Abaixo. Quem compra hoje consegue 14%, então ninguém paga o mesmo preço por um título que rende só 11,75%. Taxa sobe, preço cai.',
      },
      {
        type: 'widget',
        id: 'gangorra-marcacao',
        widget: 'mtm-seesaw',
        props: { contractRatePct: 11.75, yearsToMaturity: 2, indexer: 'prefixed' },
        caption: 'Mova a taxa de mercado e o prazo. O que acontece com o preço?',
      },
      {
        type: 'check',
        id: 'preco-a-14',
        kind: 'single',
        prompt:
          'Faltam 2 anos. Com a taxa de mercado em 14% ao ano, quanto vale hoje um título que paga R$ 1.000?',
        options: ['R$ 740,00', 'R$ 769,47', 'R$ 781,25', 'R$ 877,19'],
        answer: 1,
        explanation:
          'R$ 1.000 divididos por 1,14 ao quadrado dão R$ 769,47, cerca de 3,9% abaixo dos R$ 800,76 da compra.',
      },
      {
        type: 'text',
        markup:
          'O prazo importa. Quanto mais longe o vencimento, mais o preço se mexe com a mesma mudança de taxa. Essa sensibilidade é a {{duration}} do título.',
      },
      {
        type: 'check',
        id: 'prazo-longo-oscila-mais',
        kind: 'single',
        prompt:
          'Dois prefixados, mesma taxa, vencimentos em 1 e em 10 anos. Os juros sobem 2 pontos. Qual cai mais?',
        options: ['O de 1 ano', 'O de 10 anos', 'Caem igual'],
        answer: 1,
        explanation:
          'Os juros do prazo longo ficam mais tempo descontados à taxa nova, então o preço dele reage mais.',
      },
      {
        type: 'text',
        markup:
          'Isso vale também para o IPCA+, que oscila com a taxa real de mercado. O Tesouro Selic quase não se mexe, porque o próprio rendimento acompanha a Selic todo dia.',
      },
      {
        type: 'check',
        id: 'menos-afetado',
        kind: 'single',
        prompt: 'Os juros de mercado sobem. Qual título tem o preço menos afetado?',
        options: ['Prefixado de 10 anos', 'IPCA+ de 20 anos', 'Tesouro Selic'],
        answer: 2,
        explanation:
          'O Tesouro Selic reprecifica com a Selic todo dia, então quase não há queda de preço.',
      },
      {
        type: 'text',
        markup:
          'A queda de preço só vira perda se você vender. Segurando até o vencimento, recebe o combinado. E, se a taxa cai, vender antes dá ganho.',
      },
      {
        type: 'check',
        id: 'segurar-ate-o-fim',
        kind: 'true_false',
        prompt:
          'Se você segurar o prefixado até o vencimento, a oscilação do preço no meio do caminho muda o valor que você recebe.',
        answer: false,
        explanation:
          'No vencimento o título paga o valor de face. A oscilação só importa para quem vende antes.',
      },
      {
        type: 'check',
        id: 'copom-antecipado',
        kind: 'true_false',
        prompt: 'Os prefixados só caem depois que o Copom eleva a Selic.',
        answer: false,
        explanation:
          'O mercado antecipa a decisão. Muitas vezes o preço já caiu antes da reunião, porque a expectativa de juros subiu.',
      },
      {
        type: 'widget',
        id: 'nota-marcacao',
        widget: 'platform-note',
        props: {
          brazil:
            'Os preços dos títulos são recalculados todo dia útil, e a taxa de mercado reage a expectativas, inflação e cenário fiscal.',
          here: 'Na plataforma, a taxa de mercado reage às decisões do Copom da plataforma e a eventos do jogo.',
          why: 'Assim você vê o efeito de uma alta de juros sobre o preço sem esperar o calendário real.',
        },
      },
    ],
  },
}

// Lição 1.9, O que é o IPCA (RC.5.7). Abrangência e meta vêm dos fatos
// `ipca-abrangencia` e `meta-inflacao`. Sem número de inflação do dia: só
// exemplos hipotéticos. O IPCA simulado vai para o bloco "Na plataforma".
export const BLOCKS_1_9: LessonBlocks = {
  schemaVersion: 1,
  phases: {
    scenario: [
      {
        type: 'text',
        markup:
          'O {{IPCA}} é o termômetro oficial da inflação no Brasil. Todo mês, o IBGE mede quanto custa uma cesta de bens e serviços, de comida a transporte, consumida por famílias urbanas com renda de 1 a 40 salários mínimos.',
      },
      {
        type: 'check',
        id: 'quem-calcula-ipca',
        kind: 'single',
        prompt: 'Quem calcula o IPCA?',
        options: ['O Banco Central', 'O IBGE', 'O Tesouro Nacional'],
        answer: 1,
        explanation:
          'O IBGE calcula o IPCA. O Banco Central usa esse índice como referência da meta de inflação.',
      },
    ],
    microDecision: [
      {
        type: 'text',
        markup:
          'A inflação foi de 1% em janeiro e de 1% em fevereiro. No acumulado dos dois meses, deu menos de 2%, mais de 2% ou exatamente 2%?',
      },
    ],
    revelation: [
      {
        type: 'widget',
        id: 'conta-acumulado',
        widget: 'formula-walkthrough',
        props: {
          intro: 'Um pouco mais: 2,01%. Cada mês incide sobre preços já reajustados, como nos juros compostos.',
          items: [
            {
              label: 'Inflação acumulada',
              formula: '(1 + m1) × (1 + m2) × ... × (1 + m12) − 1',
              legend: 'm é a inflação de cada mês.',
              numbers: '(1 + 0,01) × (1 + 0,01) − 1 = 1,0201 − 1',
              result: '2,01%',
            },
          ],
        },
      },
      {
        type: 'check',
        id: 'acumulado-doze-meses',
        kind: 'single',
        prompt: 'A inflação foi de 0,5% ao mês durante 12 meses. Quanto deu o acumulado, em %?',
        options: ['0,5%', '6%', '6,17%', '6,5%'],
        answer: 2,
        explanation:
          '1,005 elevado a 12 dá 1,0617. A soma simples daria 6%, e a diferença vem da composição.',
      },
      {
        type: 'text',
        markup:
          'Compara-se a meta de inflação, com a tolerância para cima e para baixo, com o IPCA acumulado em 12 meses.',
      },
      {
        type: 'check',
        id: 'ipca-fora-da-meta',
        kind: 'single',
        prompt:
          'Com meta de 3% e tolerância de 1,5 ponto, o IPCA em 12 meses está em 4,8%. Ele está dentro do intervalo da meta?',
        options: ['Sim, está perto de 3%', 'Não, passou do teto de 4,5%'],
        answer: 1,
        explanation:
          'O teto é 3% mais 1,5 ponto, ou seja, 4,5%. Com 4,8% a inflação está acima do intervalo.',
      },
      {
        type: 'text',
        markup:
          'Para quem investe, o IPCA mostra se o dinheiro ganhou ou perdeu poder de compra: o que cresce menos que a inflação perde.',
      },
      {
        type: 'widget',
        id: 'rendimento-real-ipca',
        widget: 'real-return',
        props: { nominalPct: 4, inflationPct: 5, amount: 10000 },
        caption: 'Mexa no rendimento e na inflação e veja o poder de compra.',
      },
      {
        type: 'check',
        id: 'salario-ipca',
        kind: 'single',
        prompt: 'Seu salário subiu 4% e o IPCA do período foi de 5%. O seu poder de compra:',
        options: ['Subiu', 'Caiu', 'Ficou igual'],
        answer: 1,
        explanation: 'Os preços subiram mais que o salário, então cada real compra menos.',
      },
      {
        type: 'widget',
        id: 'nota-ipca',
        widget: 'platform-note',
        props: {
          brazil:
            'O IPCA do IBGE varia com as estações, com choques de preço e com o que aconteceu nos meses anteriores.',
          here: 'Na plataforma, o IPCA é simulado: oscila em torno de uma meta, sem depender do mês anterior.',
          why: 'É um modelo simples, para a Selic e os títulos terem uma inflação com que reagir sem exigir anos de histórico.',
        },
      },
    ],
  },
}

// Lição 1.10, Tesouro IPCA+ (RC.5.7). VNA e defasagem: fato `tesouro-vna-ipca`
// (a regra em deflação não foi confirmada e não é afirmada). As taxas são de
// exemplo. O simulador e a inflação de equilíbrio fazem as contas.
export const BLOCKS_1_10: LessonBlocks = {
  schemaVersion: 1,
  phases: {
    scenario: [
      {
        type: 'text',
        markup:
          'O Tesouro IPCA+ paga a inflação mais uma taxa fixa, por exemplo IPCA + 6% ao ano. A parte da inflação corrige o valor do título, e a parte fixa é o seu ganho acima da inflação.',
      },
      {
        type: 'text',
        markup:
          'Esse valor corrigido é o {{VNA}}, o Valor Nominal Atualizado. Ele começou em R$ 1.000 em julho de 2000 e anda com o IPCA. Por isso o IPCA+ não paga R$ 1.000 no vencimento: paga o VNA já corrigido.',
      },
      {
        type: 'check',
        id: 'o-que-ipca-corrige',
        kind: 'single',
        prompt: 'No Tesouro IPCA+, o que o IPCA corrige?',
        options: ['A taxa fixa', 'O valor do título, o VNA', 'O imposto de renda'],
        answer: 1,
        explanation:
          'O IPCA atualiza o VNA. A taxa fixa incide depois, sobre esse valor já corrigido.',
      },
    ],
    microDecision: [
      {
        type: 'text',
        markup:
          'Se a inflação ao longo dos anos até o vencimento for maior do que o previsto, o valor final do Tesouro IPCA+ diminui, aumenta ou fica igual?',
      },
    ],
    revelation: [
      {
        type: 'text',
        markup:
          'Aumenta. Mais inflação corrige o VNA para cima, e a taxa fixa incide sobre o valor já corrigido. É a proteção contra perder poder de compra.',
      },
      {
        type: 'widget',
        id: 'conta-ipca-mais',
        widget: 'formula-walkthrough',
        props: {
          intro: 'Os dois efeitos se multiplicam. Com IPCA de 5% e taxa de 6% ao ano, o retorno do ano é de 11,3%, e não 11%.',
          items: [
            {
              label: 'Retorno do Tesouro IPCA+',
              formula: '(1 + IPCA) × (1 + taxa) − 1',
              numbers: '(1 + 0,05) × (1 + 0,06) − 1 = 1,113 − 1',
              result: '11,3%',
            },
          ],
        },
      },
      {
        type: 'widget',
        id: 'simulador-ipca-mais',
        widget: 'ipca-plus-simulator',
        props: { amount: 10000, realRatePct: 6, years: 5, ipcaPct: 5 },
        caption: 'Mude a inflação e o prazo e veja de onde vem o valor final.',
      },
      {
        type: 'check',
        id: 'valor-final-ipca-mais',
        kind: 'single',
        prompt:
          'Você aplica R$ 10.000 por 2 anos, com IPCA de 4% ao ano e taxa de 6%. Quanto vale no fim, antes do imposto?',
        options: ['R$ 11.236,00', 'R$ 12.000,00', 'R$ 12.100,00', 'R$ 12.152,86'],
        answer: 3,
        explanation:
          'São R$ 10.000 vezes 1,04 ao quadrado vezes 1,06 ao quadrado, ou seja, R$ 12.152,86.',
      },
      {
        type: 'text',
        markup:
          'O imposto de renda incide sobre todo o ganho nominal, inclusive a parte que só repõe a inflação. Por isso o ganho real depois do imposto é menor que a taxa anunciada.',
      },
      {
        type: 'check',
        id: 'ir-ipca-mais',
        kind: 'single',
        prompt: 'No Tesouro IPCA+, o imposto de renda incide sobre:',
        options: ['Só os juros reais', 'Todo o ganho nominal', 'Só a correção do IPCA'],
        answer: 1,
        explanation:
          'O ganho nominal inclui a correção pela inflação e os juros reais, e o imposto incide sobre os dois.',
      },
      {
        type: 'text',
        markup:
          'A taxa real só é garantida no vencimento. Antes disso, o preço oscila com a taxa real de mercado, como na marcação a mercado, e os prazos longos oscilam mais.',
      },
      {
        type: 'check',
        id: 'ipca-mais-sem-risco-de-preco',
        kind: 'true_false',
        prompt: 'O Tesouro IPCA+ não tem risco de preço em nenhuma data de resgate.',
        answer: false,
        explanation:
          'Vendendo antes do vencimento, você recebe o preço de mercado do dia, que pode estar abaixo do que você pagou.',
      },
      {
        type: 'text',
        markup:
          'Prefixado ou IPCA+? Depende da inflação que você espera. O ponto de empate é a inflação de equilíbrio.',
      },
      {
        type: 'widget',
        id: 'inflacao-de-equilibrio',
        widget: 'breakeven-inflation',
        props: { prefixedPct: 12.5, realPct: 7.5, expectedInflationPct: 5 },
        caption: 'Taxas de exemplo. Com elas, qual rende mais para a inflação que você espera?',
      },
      {
        type: 'check',
        id: 'prefixado-ou-ipca-mais',
        kind: 'single',
        prompt:
          'Com taxas de exemplo, prefixado de 13% e IPCA+ de 7%: a inflação de equilíbrio é cerca de 5,6%. Você espera 7%. Qual rende mais?',
        options: ['O prefixado', 'O IPCA+', 'Empatam'],
        answer: 1,
        explanation:
          'Se a inflação ficar acima de 5,6%, a correção do IPCA+ supera a taxa travada do prefixado.',
      },
      {
        type: 'widget',
        id: 'nota-ipca-mais',
        widget: 'platform-note',
        props: {
          brazil:
            'O VNA é corrigido pelo IPCA do IBGE, que sai com defasagem, e as taxas dos títulos mudam todo dia.',
          here: 'Na plataforma, o Tesouro IPCA+ é corrigido pelo IPCA simulado, e a taxa vem do catálogo.',
          why: 'Assim o efeito da inflação aparece sem esperar meses de divulgação.',
        },
      },
      { type: 'text', markup: 'Completar esta lição libera a compra do Tesouro IPCA+ no Mercado.' },
    ],
  },
}

// Lição 1.11, CRI e CRA (RC.5.7). O risco está nos devedores e o patrimônio é
// separado (fato `securitizacao-patrimonio-separado`); sem FGC (`fgc-produtos`);
// isenção só para pessoa física (`lci-lca-isencao-pf`). Não serve de reserva de
// emergência. A escala de rating é convenção das agências.
export const BLOCKS_1_11: LessonBlocks = {
  schemaVersion: 1,
  phases: {
    scenario: [
      {
        type: 'text',
        markup:
          'Uma construtora vende imóveis a prazo e tem parcelas a receber, os recebíveis. Uma {{securitizadora}} compra esses recebíveis e emite títulos para investidores: os CRI (Certificado de Recebíveis Imobiliários). No agronegócio, são os CRA.',
      },
      {
        type: 'check',
        id: 'quem-deve-no-cri',
        kind: 'single',
        prompt: 'Num CRI, quem deve o dinheiro que paga o investidor?',
        options: ['A securitizadora', 'Quem deve as parcelas dos recebíveis', 'O Tesouro Nacional'],
        answer: 1,
        explanation:
          'O dinheiro vem das parcelas pagas pelos devedores. A securitizadora é o veículo que organiza a emissão.',
      },
    ],
    microDecision: [
      {
        type: 'text',
        markup:
          'CDB, LCI e LCA têm a garantia do {{FGC}}. CRI e CRA, emitidos por uma securitizadora e não por um banco, têm a mesma garantia?',
      },
    ],
    revelation: [
      {
        type: 'text',
        markup:
          'Não. CRI e CRA ficam fora do FGC. O risco é o de quem deve: se os devedores atrasam as parcelas, quem sente é o investidor.',
      },
      {
        type: 'text',
        markup:
          'A securitizadora não é o ponto fraco. Pela lei, os recebíveis ficam num patrimônio separado, que não responde pelas dívidas dela, e nas ofertas públicas um agente fiduciário defende os investidores.',
      },
      {
        type: 'check',
        id: 'securitizadora-quebra',
        kind: 'true_false',
        prompt:
          'Se a securitizadora quebrar, os recebíveis que lastreiam o CRI vão para os credores dela.',
        answer: false,
        explanation:
          'Os recebíveis formam um patrimônio separado, usado só para pagar os investidores daquela emissão.',
      },
      {
        type: 'text',
        markup:
          'Para medir o risco dos devedores existe o {{rating}}: uma nota dada por agências de classificação de risco, de AAA, o menor risco, até D, calote.',
      },
      {
        type: 'widget',
        id: 'regua-rating',
        widget: 'rating-ruler',
        props: { highlight: 'AA' },
        caption: 'Toque nas notas. Onde termina o grau de investimento?',
      },
      {
        type: 'check',
        id: 'nota-especulativa',
        kind: 'single',
        prompt: 'Qual destas notas já é grau especulativo?',
        options: ['AA', 'BBB', 'BB'],
        answer: 2,
        explanation:
          'O grau de investimento vai de AAA até BBB. A partir de BB, o título é especulativo.',
      },
      {
        type: 'text',
        markup:
          'CRI e CRA costumam pagar mais por terem risco e pouca liquidez. Parte do prêmio é a isenção de imposto de renda para pessoa física, então compare sempre pela taxa bruta equivalente.',
      },
      {
        type: 'widget',
        id: 'taxa-equivalente-cri',
        widget: 'equivalent-rate',
        props: { exemptRatePct: 11, cdbRatePct: 12, daysPresets: [720, 360] },
        caption: 'Taxas de exemplo. Um CRI isento de 11% equivale a quanto de um CDB tributado?',
      },
      {
        type: 'check',
        id: 'taxa-bruta-cri',
        kind: 'single',
        prompt:
          'Um CRI isento paga 11% ao ano (taxa de exemplo). Com imposto de 15%, qual taxa bruta um CDB precisa pagar para empatar?',
        options: ['9,35%', '12,65%', '12,94%', '26%'],
        answer: 2,
        explanation: '11 dividido por 0,85 dá 12,94%. É a taxa bruta equivalente.',
      },
      {
        type: 'text',
        markup:
          'Os vencimentos costumam ser longos, e vender antes pode custar deságio ou nem achar comprador. Por isso CRI e CRA servem para metas além da reserva de emergência, nunca para ela.',
      },
      {
        type: 'check',
        id: 'cri-reserva',
        kind: 'single',
        prompt: 'Um CRI de 8 anos serve como reserva de emergência?',
        options: ['Sim, porque rende mais', 'Não, tem pouca liquidez e risco de crédito'],
        answer: 1,
        explanation:
          'A reserva precisa de alta liquidez e baixo risco, e o CRI não oferece nenhuma das duas coisas.',
      },
      {
        type: 'widget',
        id: 'nota-cri-cra',
        widget: 'platform-note',
        props: {
          brazil:
            'Cada emissão tem a sua nota de rating, dada por agências que têm escalas próprias e que revisam a nota com o tempo.',
          here: 'O CRI2028 e o CRA2028 do Mercado são títulos de exemplo de uma securitizadora fictícia, com taxa e nota do catálogo.',
          why: 'Assim você pratica a escolha entre retorno e risco sem depender de uma emissão real.',
        },
      },
      {
        type: 'text',
        markup: 'Completar esta lição libera a compra de CRI e CRA no Mercado e abre a Trilha 2.',
      },
    ],
  },
}
