import type { LessonBlocks } from '../modules/lessons/domain/widgets/lessonBlocks'

// Conteúdo visual das lições 1.4 a 1.6 (RC.5.5), no contrato `blocks`
// (RC.3.1 a RC.3.4a). Os fatos (FGC, IR, IOF, prazo mínimo de LCI) vêm de
// `modules/lessons/domain/regulatoryFacts.ts`; as taxas dos widgets são um
// exemplo didático declarado (CDI a 10% ao ano, CDB a 110% e LCI a 90% do CDI,
// mesmas proporções do catálogo), nunca a taxa viva do Mercado.

const DIDACTIC_RATES =
  'Exemplo com o CDI a 10% ao ano: o CDB paga 110% (11% ao ano) e a LCI, 90% (9% ao ano).'

export const BLOCKS_1_4: LessonBlocks = {
  schemaVersion: 1,
  phases: {
    scenario: [
      {
        type: 'text',
        markup:
          'O CDB (Certificado de Depósito Bancário) é um empréstimo que você faz ao banco. Em troca, ele devolve o dinheiro com juros.' +
          '\n\n' +
          'A remuneração costuma ser um percentual do {{CDI}}. 100% do CDI rende o mesmo que o CDI; 110% rende um pouco mais.',
      },
      {
        type: 'check',
        id: 'cdb-110-cdi',
        kind: 'single',
        prompt: 'Um CDB paga 110% do CDI. Ele rende:',
        options: ['Menos que o CDI', 'Mais que o CDI', 'O mesmo que o CDI'],
        answer: 1,
        explanation:
          '110% do CDI é mais que 100% do CDI, então o CDB rende mais que a taxa de referência.',
      },
      {
        type: 'text',
        markup:
          'Quem empresta ao banco corre um risco: o banco não conseguir pagar. É o risco de crédito do emissor.',
      },
    ],
    microDecision: [
      {
        type: 'text',
        markup: 'Se o banco emissor do seu CDB quebrar, o que protege o seu dinheiro?',
      },
    ],
    revelation: [
      {
        type: 'text',
        markup:
          'O {{FGC}} protege até um limite por CPF, por {{conglomerado financeiro}}, e há ainda um teto total por CPF a cada 4 anos.',
      },
      {
        type: 'widget',
        id: 'hoje-fgc',
        widget: 'callout',
        props: {
          tone: 'info',
          title: 'Valores de hoje',
          body:
            'O FGC protege até R$ 250 mil por CPF e por conglomerado financeiro, e o teto total é de R$ 1 milhão por CPF a cada 4 anos. Esses valores são definidos por regra e podem mudar.',
        },
      },
      {
        type: 'check',
        id: 'fgc-limite',
        kind: 'single',
        prompt:
          'Você tem CDBs em dois bancos do mesmo conglomerado financeiro. O limite do FGC vale:',
        options: ['Separado para cada banco', 'Uma vez só para o conglomerado inteiro', 'Não existe limite'],
        answer: 1,
        explanation:
          'O limite vale por CPF e por conglomerado financeiro, não por banco. Dois bancos do mesmo conglomerado dividem a mesma cobertura.',
      },
      {
        type: 'widget',
        id: 'barra-fgc',
        widget: 'fgc-coverage-bar',
        props: { amountPerInstitution: 200000, institutions: 2, sameConglomerate: true },
        caption: 'Mude os valores e veja o que o FGC cobre e o que fica de fora.',
      },
      {
        type: 'text',
        markup:
          'O FGC cobre depósitos e títulos como CDB, LCI e LCA, e entra se o banco for liquidado pelo Banco Central. Títulos públicos ficam fora.',
      },
      {
        type: 'check',
        id: 'fgc-tesouro',
        kind: 'true_false',
        prompt: 'O FGC cobre os títulos do Tesouro Direto.',
        answer: false,
        explanation:
          'Títulos públicos não são cobertos pelo FGC: o devedor é o próprio governo, não um banco.',
      },
      {
        type: 'text',
        markup:
          'Bancos menores costumam pagar mais do CDI para atrair investidores. Esse prêmio paga pelo risco maior, e o FGC limita a perda, não a elimina.',
      },
      {
        type: 'widget',
        id: 'nota-cdb',
        widget: 'platform-note',
        props: {
          brazil:
            'Cada banco define quanto do CDI o seu CDB paga, e o percentual muda com o banco e o prazo.',
          here: 'O CDB2027 do Mercado é de um banco fictício e paga 110% do CDI.',
          why: 'Assim você pratica com um produto que existe no Mercado, sem depender de um banco real.',
        },
      },
    ],
  },
}

export const BLOCKS_1_5: LessonBlocks = {
  schemaVersion: 1,
  phases: {
    scenario: [
      {
        type: 'text',
        markup:
          'Um CDB rendeu R$ 1.000 de lucro. Antes de chegar à sua conta, uma parte vai para o Imposto de Renda (IR).' +
          '\n\n' +
          'O IR é retido na fonte: o banco desconta e paga por você, e não sobra nada para pagar depois.' +
          '\n\n' +
          'O percentual, a {{alíquota}}, depende do tempo de aplicação, em dias corridos. E o IR incide só sobre o lucro, nunca sobre o dinheiro que você aplicou.',
      },
      {
        type: 'widget',
        id: 'tabela-ir',
        widget: 'ir-regressive-table',
        props: { grossYield: 1000, initialDays: 90 },
        caption: 'Mova o prazo e veja a alíquota mudar.',
      },
      {
        type: 'check',
        id: 'ir-90-dias',
        kind: 'single',
        prompt: 'Com 90 dias de aplicação, qual é a alíquota de IR?',
        options: ['15%', '22,5%', '17,5%'],
        answer: 1,
        explanation: 'Até 180 dias a alíquota é de 22,5%, a mais alta da tabela.',
      },
    ],
    microDecision: [
      {
        type: 'text',
        markup:
          'Resgatando com 90 dias de aplicação, a alíquota de IR é maior ou menor do que resgatando o mesmo CDB com 800 dias?',
      },
    ],
    revelation: [
      {
        type: 'text',
        markup:
          'Maior: 22,5% aos 90 dias contra 15% aos 800. Quanto mais tempo o dinheiro fica aplicado, menor a mordida do IR.',
      },
      {
        type: 'text',
        markup:
          'A tabela vale para títulos como o Tesouro Direto e o CDB. Algumas letras, como a LCI e a LCA, são isentas para pessoa física. Você vê isso na próxima lição.',
      },
      {
        type: 'check',
        id: 'ir-valor',
        kind: 'single',
        prompt: 'Um CDB rendeu R$ 1.000 em 400 dias. Quantos reais de IR são retidos?',
        options: ['R$ 150', 'R$ 175', 'R$ 225', 'R$ 1.175'],
        answer: 1,
        explanation: 'Com 400 dias a alíquota é de 17,5%, e 17,5% de R$ 1.000 são R$ 175.',
      },
      {
        type: 'text',
        markup:
          'Resgatar antes de 30 dias tem ainda o IOF: ele leva 96% do rendimento no primeiro dia e cai até 0% no 30º dia.',
      },
      {
        type: 'check',
        id: 'iof-prazo',
        kind: 'true_false',
        prompt: 'O IOF só pesa em resgates feitos em menos de 30 dias.',
        answer: true,
        explanation:
          'A cobrança vai de 96% do rendimento no primeiro dia até zero no 30º, e depois disso só resta o IR.',
      },
    ],
  },
}

export const BLOCKS_1_6: LessonBlocks = {
  schemaVersion: 1,
  phases: {
    scenario: [
      {
        type: 'text',
        markup:
          'LCI (Letra de Crédito Imobiliário) e LCA (Letra de Crédito do Agronegócio) financiam o setor imobiliário e o agronegócio. Têm a cobertura do {{FGC}}, como o CDB.' +
          '\n\n' +
          'Para pessoa física, o rendimento delas é isento de IR. O do CDB paga IR.',
      },
      {
        type: 'check',
        id: 'lci-taxa-menor',
        kind: 'true_false',
        prompt: 'Uma LCI que anuncia taxa menor que a de um CDB nunca compensa.',
        answer: false,
        explanation:
          'Sem IR, uma taxa menor pode render mais líquido. Depende do prazo, e é isso que você vai testar.',
      },
      {
        type: 'text',
        markup:
          'Há uma {{carência}}: por regra do Conselho Monetário Nacional, uma LCI não pode vencer antes de 6 meses. A LCA também tem prazo mínimo.',
      },
    ],
    microDecision: [
      {
        type: 'text',
        markup:
          'Depois dos 6 meses de prazo mínimo (cerca de 180 dias, IR de 22,5% no CDB), qual rende mais líquido? Teste os prazos no widget antes de responder.',
      },
      {
        type: 'widget',
        id: 'taxa-equivalente',
        widget: 'equivalent-rate',
        props: { exemptRatePct: 9, cdbRatePct: 11, daysPresets: [180, 800] },
        caption: DIDACTIC_RATES,
      },
    ],
    revelation: [
      {
        type: 'text',
        markup:
          'Com 22,5% de IR, a LCI de 9% equivale a um CDB que pagasse cerca de 11,6%, a {{taxa bruta equivalente}}. O CDB paga 11%: a LCI vence.' +
          '\n\n' +
          'Acima de 720 dias o IR cai para 15%, e o equivalente cai para cerca de 10,6%. Aí o CDB de 11% vence.',
      },
      {
        type: 'widget',
        id: 'comparador',
        widget: 'product-comparator',
        props: {
          products: [
            {
              name: 'CDB (110% do CDI)',
              annualRatePct: 11,
              taxExempt: false,
              liquidity: 'Varia por produto',
              fgc: 'Sim',
            },
            {
              name: 'LCI (90% do CDI)',
              annualRatePct: 9,
              taxExempt: true,
              liquidity: 'Prazo mínimo de 6 meses',
              fgc: 'Sim',
            },
          ],
          amount: 10000,
          days: 180,
        },
        caption: `${DIDACTIC_RATES} Mude o prazo e veja o vencedor virar.`,
      },
      {
        type: 'check',
        id: 'ir-800-dias',
        kind: 'single',
        prompt: 'Com 800 dias de aplicação, qual alíquota de IR vale para o CDB?',
        options: ['17,5%', '20%', '15%'],
        answer: 2,
        explanation: 'Acima de 720 dias a alíquota é de 15%, a menor da tabela.',
      },
      {
        type: 'check',
        id: 'taxa-equivalente-calc',
        kind: 'single',
        prompt:
          'Uma LCI isenta paga 8,5% ao ano e o IR do CDB é de 15%. Qual a taxa bruta equivalente, em %?',
        options: ['7,2%', '9,8%', '10%', '12,75%'],
        answer: 2,
        explanation:
          'A taxa isenta dividida por (1 menos 0,15): 8,5 ÷ 0,85 = 10%. Um CDB precisaria pagar 10% para empatar.',
      },
      {
        type: 'text',
        markup:
          'A resposta certa depende do prazo que você pretende manter o dinheiro aplicado, não só da taxa anunciada.',
      },
      {
        type: 'widget',
        id: 'nota-lci',
        widget: 'platform-note',
        props: {
          brazil:
            'CDB e LCI pagam taxas que mudam por banco e por prazo, e o mercado as anuncia em percentual do CDI.',
          here: 'Os produtos do Mercado são de bancos fictícios, com taxas fixas de 110% do CDI no CDB e 90% na LCI.',
          why: 'Assim todos comparam os mesmos produtos e você vê o efeito do IR e do prazo.',
        },
      },
    ],
  },
}
