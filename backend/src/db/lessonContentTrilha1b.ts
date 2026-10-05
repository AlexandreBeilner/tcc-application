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
          'É o Tesouro Selic (também chamado LFT): um título público pós-fixado, de alta liquidez e baixa oscilação de preço.',
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
          'Tem custos. O imposto de renda segue a tabela regressiva (de 22,5% a 15% sobre o ganho) e há IOF se resgatar antes de 30 dias. A B3 cobra 0,20% ao ano de custódia, mas no Tesouro Selic não cobra nada sobre os primeiros R$ 10 mil.',
      },
      {
        type: 'check',
        id: 'custodia-selic',
        kind: 'numeric',
        prompt: 'Você tem R$ 8.000 no Tesouro Selic. Quanto paga de custódia da B3 por ano?',
        answer: 0,
        tolerance: 0,
        unit: 'reais',
        explanation:
          'No Tesouro Selic a custódia só incide sobre o que passa de R$ 10 mil por CPF. Com R$ 8.000, é zero.',
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
