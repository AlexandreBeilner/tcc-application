import type { LessonBlocks } from '../modules/lessons/domain/widgets/lessonBlocks'

// Trilha 3 reescrita como planejamento (RC.5.8, decisão D12). Fatos de
// `modules/lessons/domain/regulatoryFacts.ts`: `fgc-limite-por-cpf` (R$ 250 mil
// por CPF e por instituição ou conglomerado), `suitability-cvm30` (o perfil é
// do investidor e vem de questionário da corretora; os nomes das categorias são
// de cada instituição), `ir-renda-fixa-regressivo` (22,5% até 180 dias) e
// `lci-lca-prazo-minimo` (6 meses). Nenhum caso real de empresa é citado: o
// exemplo da Americanas não foi aberto em fonte primária (validacao-licoes.md).
// Taxas, retornos e quedas dos widgets são ilustrativos e dizem isso na tela.

const DIDACTIC_RATES = 'Taxas de exemplo, com CDI de 10% ao ano.'

export const BLOCKS_3_1: LessonBlocks = {
  schemaVersion: 1,
  phases: {
    scenario: [
      {
        type: 'text',
        markup:
          'Você tem R$ 10.000 e dois planos: pôr tudo numa única empresa ou dividir entre empresas de setores diferentes, renda fixa e um fundo imobiliário.',
      },
      {
        type: 'text',
        markup:
          'Empresas dão problema: uma fraude contábil, uma barragem que rompe, uma safra perdida. Quando o problema é só da empresa, ele é o {{risco específico}}.',
      },
    ],
    microDecision: [
      {
        type: 'text',
        markup:
          'A ação de uma empresa cai 50% depois de um escândalo. Ela vale 20% da sua carteira. Quanto a carteira inteira perde por causa dela?',
      },
    ],
    revelation: [
      {
        type: 'text',
        markup:
          'Perde 10%: o peso da empresa (20%) vezes a queda (50%). Com tudo nela, a perda seria de 50%. Diversificar é isto: o problema de uma empresa pesa pouco no total.',
      },
      {
        type: 'check',
        id: 'perda-ponderada',
        kind: 'single',
        prompt:
          'Uma ação com 25% da carteira cai 40%. Quanto a carteira perde por causa dela, em %?',
        options: ['10%', '15%', '25%', '40%'],
        answer: 0,
        explanation: 'Peso vezes queda: 25% de 40% dá 10% da carteira.',
      },
      {
        type: 'widget',
        id: 'pesos-da-carteira',
        widget: 'allocation-donut',
        props: { profile: 'conservative', amount: 10000 },
        caption: 'Mude os pesos e veja quanto cada classe pesa num ano ruim. Valores ilustrativos.',
        goal: {
          text: 'Mexa nos controles de cada classe e monte uma carteira em que nenhuma fatia chegue a 40% e a soma feche em 100%',
          metric: 'maxSharePct',
          op: 'lt',
          value: 40,
          reveal:
            'Quando nenhuma fatia domina, o problema de uma classe pesa pouco no total. Diversificar é espalhar o dinheiro para que nenhuma parte decida sozinha o resultado.',
          showMe: { postFixedPct: 35, longerFixedPct: 30, fiiPct: 15, stocksPct: 20 },
        },
      },
      {
        type: 'text',
        markup:
          'A diversificação não elimina tudo. Numa crise, o {{risco de mercado}} derruba muitos ativos ao mesmo tempo, e não há como se esconder dele só trocando de empresa.',
      },
      {
        type: 'check',
        id: 'risco-que-sobra',
        kind: 'single',
        prompt: 'Qual risco a diversificação NÃO elimina?',
        options: [
          'Fraude numa empresa',
          'Queda geral do mercado numa crise',
          'Uma barragem rompida numa mineradora',
        ],
        answer: 1,
        explanation:
          'Fraude e barragem são problemas de uma empresa, que o peso pequeno dilui. A queda geral atinge quase todos juntos.',
      },
      {
        type: 'text',
        markup:
          'Diversificar é espalhar de verdade: entre classes (renda fixa, ações, fundos imobiliários), setores e emissores. Cinco empresas do mesmo setor sobem e caem juntas.',
      },
      {
        type: 'check',
        id: 'cinco-bancos',
        kind: 'single',
        prompt: 'Você compra ações de cinco bancos. Isso é diversificar?',
        options: [
          'Sim, são cinco ativos diferentes',
          'Só em parte: é o mesmo setor',
          'Não, comprar vários ativos nunca ajuda',
        ],
        answer: 1,
        explanation:
          'Cinco ativos ajudam, mas bancos reagem aos mesmos juros e à mesma economia. Falta espalhar entre setores e classes.',
      },
      {
        type: 'text',
        markup:
          'Na renda fixa, diversificar é dividir entre emissores. O {{FGC}} cobre até um limite por CPF, por instituição ou conglomerado, e o que passa disso fica sem a garantia.',
      },
      {
        type: 'widget',
        id: 'cobertura-fgc',
        widget: 'fgc-coverage-bar',
        props: { amountPerInstitution: 400000, institutions: 1, sameConglomerate: false },
        caption: 'Mude o valor e o número de bancos e veja o que o FGC cobre.',
      },
      {
        type: 'check',
        id: 'fgc-excedente',
        kind: 'single',
        prompt:
          'Suponha que o limite do FGC seja de R$ 250 mil por instituição. Você põe R$ 400 mil em CDBs de um único banco. Quantos reais ficam sem a cobertura?',
        options: ['R$ 0', 'R$ 150 mil', 'R$ 250 mil', 'R$ 400 mil'],
        answer: 1,
        explanation:
          'A cobertura vai até o limite por instituição. 400 mil menos 250 mil dá 150 mil sem cobertura.',
      },
      {
        type: 'widget',
        id: 'nota-diversificacao',
        widget: 'platform-note',
        props: {
          brazil:
            'O investidor escolhe entre centenas de ativos e pode usar um ETF para diversificar de uma vez.',
          here: 'O Mercado tem poucos ativos: empresas de setores diferentes, renda fixa, FIIs e um ETF.',
          why: 'É o suficiente para montar uma carteira diversificada sem se perder no catálogo.',
        },
      },
    ],
  },
}

export const BLOCKS_3_2: LessonBlocks = {
  schemaVersion: 1,
  phases: {
    scenario: [
      {
        type: 'text',
        markup:
          'Dois amigos têm R$ 10.000. Um precisa do dinheiro em 6 meses, para a entrada de um carro. O outro só vai usá-lo daqui a 20 anos.',
      },
      {
        type: 'text',
        markup:
          'Eles devem investir do mesmo jeito? O que muda é o {{perfil do investidor}}: não é um rótulo do produto, é sobre você, seu objetivo, seu prazo e quanto de queda você aguenta.',
      },
    ],
    microDecision: [
      {
        type: 'text',
        markup:
          'Qual dos dois pode aceitar mais {{volatilidade}}, ou seja, mais sobe e desce no caminho?',
      },
    ],
    revelation: [
      {
        type: 'text',
        markup:
          'O dos 20 anos. Ele pode esperar uma queda passar. Quem precisa do dinheiro em 6 meses pode ser forçado a vender justamente na baixa.',
      },
      {
        type: 'check',
        id: 'seis-meses',
        kind: 'single',
        prompt: 'Você precisa do dinheiro em 6 meses. Qual classe combina mais?',
        options: [
          'Ações',
          'Renda fixa pós-fixada com liquidez',
          'Qualquer uma, o prazo não importa',
        ],
        answer: 1,
        explanation:
          'Com prazo curto, uma queda temporária vira perda de verdade. O pós-fixado com liquidez oscila pouco e dá acesso ao dinheiro.',
      },
      {
        type: 'text',
        markup:
          'Ao abrir conta, a corretora aplica um questionário, o suitability, sobre seus objetivos, sua situação financeira e seu conhecimento. O perfil sai dele, com nomes como conservador, moderado e arrojado.',
      },
      {
        type: 'widget',
        id: 'questionario-de-perfil',
        widget: 'risk-profile-quiz',
        props: {},
        caption: 'Responda e veja um perfil de exemplo. Cada corretora usa o próprio questionário.',
      },
      {
        type: 'text',
        markup:
          'A capacidade de risco pesa mais que a vontade: quem não tem reserva ou precisa do dinheiro logo deve ser mais cauteloso, mesmo que tolere sustos.',
      },
      {
        type: 'check',
        id: 'arrojado-tudo-em-acoes',
        kind: 'true_false',
        prompt: 'Quem tem perfil arrojado deve colocar 100% do dinheiro em ações.',
        answer: false,
        explanation:
          'O perfil também considera objetivo, prazo e reserva. Arrojado aceita mais oscilação, não fica sem diversificar.',
      },
      {
        type: 'widget',
        id: 'risco-e-retorno',
        widget: 'risk-return-scatter',
        props: { highlight: 'stocks', profile: 'moderate' },
        caption: 'Escolha um perfil e veja a região de risco que combina. Valores ilustrativos.',
      },
      {
        type: 'check',
        id: 'ordem-de-risco',
        kind: 'order',
        prompt: 'Coloque estes investimentos do menos ao mais arriscado.',
        items: ['Tesouro Selic', 'CDB de banco médio', 'FII', 'Ação de empresa pequena'],
        answer: [0, 1, 2, 3],
        lowLabel: 'Menos risco',
        highLabel: 'Mais risco',
        explanation:
          'O Tesouro Selic é dívida do governo e oscila pouco. O CDB depende do banco. FII e ação oscilam com o mercado, e a empresa pequena sofre mais. Mais risco só abre a possibilidade de retorno maior: também pode render menos, ou dar prejuízo.',
      },
      {
        type: 'text',
        markup:
          'Quem emite um título de dívida também recebe uma nota, o {{rating}}, que mede a chance de ele não pagar. É uma opinião de agências, não uma garantia.',
      },
      {
        type: 'widget',
        id: 'regua-de-rating',
        widget: 'rating-ruler',
        props: { highlight: 'AAA' },
        caption: 'Toque numa nota e leia o que ela diz sobre o risco de calote.',
      },
      {
        type: 'check',
        id: 'rating-aaa',
        kind: 'single',
        prompt: 'Um rating mais alto, como AAA, indica:',
        options: ['Retorno maior', 'Menor risco de o emissor não pagar', 'Cobertura do FGC'],
        answer: 1,
        explanation:
          'A nota mede o risco de calote do emissor. Risco menor costuma vir com retorno menor, e o FGC é outra proteção.',
      },
      {
        type: 'widget',
        id: 'nota-perfil',
        widget: 'platform-note',
        props: {
          brazil: 'O perfil é da pessoa e sai do questionário que a corretora aplica.',
          here: 'Os ativos do Mercado trazem um rótulo de risco, Conservador ou Sofisticado, que resume o quanto o preço oscila.',
          why: 'O rótulo ajuda a comparar ativos, mas não substitui o seu perfil.',
        },
      },
    ],
  },
}

export const BLOCKS_3_3: LessonBlocks = {
  schemaVersion: 1,
  phases: {
    scenario: [
      {
        type: 'text',
        markup:
          'Um banco oferece um CDB que paga 110% do CDI e uma LCI que paga 90% do CDI. O CDB paga imposto de renda sobre o ganho; a LCI, para pessoa física, não paga.',
      },
      {
        type: 'text',
        markup: `Taxa maior e isenção são coisas diferentes. Para comparar, olhe o que sobra no bolso. ${DIDACTIC_RATES}`,
      },
    ],
    microDecision: [
      {
        type: 'text',
        markup:
          'Você vai deixar R$ 10.000 aplicados por 180 dias. Qual rende mais, já descontado o imposto?',
      },
    ],
    revelation: [
      {
        type: 'text',
        markup:
          'A LCI. Até 180 dias o IR do CDB é de 22,5% sobre o ganho, a maior alíquota da tabela, e isso derruba o líquido abaixo do da LCI.',
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
        id: 'menor-aliquota',
        kind: 'single',
        prompt: 'Em qual prazo o CDB paga a menor alíquota de IR?',
        options: ['Até 180 dias', 'Acima de 720 dias', 'De 181 a 360 dias'],
        answer: 1,
        explanation:
          'A tabela é regressiva: quanto mais tempo, menor a alíquota. Acima de 720 dias ela é de 15%.',
      },
      {
        type: 'text',
        markup:
          'O atalho para comparar é a {{taxa bruta equivalente}}: quanto um CDB teria de pagar para render o mesmo que a isenta, depois do imposto.',
      },
      {
        type: 'widget',
        id: 'taxa-equivalente',
        widget: 'equivalent-rate',
        props: { exemptRatePct: 9, cdbRatePct: 11, daysPresets: [180, 720] },
        caption: DIDACTIC_RATES,
      },
      {
        type: 'check',
        id: 'taxa-equivalente-calc',
        kind: 'single',
        prompt:
          'Uma LCI isenta paga 9% ao ano e o IR do CDB é de 22,5%. Qual a taxa bruta equivalente, em %?',
        options: ['7,0%', '10,6%', '11,6%', '13,5%'],
        answer: 2,
        explanation:
          '9 ÷ (1 menos 0,225) dá cerca de 11,6%. O CDB de 11% fica abaixo disso, então perde.',
      },
      {
        type: 'text',
        markup:
          'Taxa não é tudo. Confira também o prazo mínimo e a liquidez (a LCI exige 6 meses), o emissor e a cobertura do FGC, que tem limite por CPF e instituição.',
      },
      {
        type: 'check',
        id: 'alem-da-taxa',
        kind: 'single',
        prompt: 'Além da taxa, o que você confere antes de escolher?',
        options: [
          'Prazo mínimo e liquidez, emissor e FGC',
          'Só o nome do banco',
          'Nada: a maior taxa sempre vence',
        ],
        answer: 0,
        explanation:
          'Prazo e liquidez dizem quando você pode sacar, e o emissor e o FGC dizem o quanto o dinheiro está protegido.',
      },
      {
        type: 'widget',
        id: 'nota-comparacao',
        widget: 'platform-note',
        props: {
          brazil: 'O CDI muda ao longo do tempo e cada banco anuncia a própria taxa em % do CDI.',
          here: 'Os produtos do Mercado têm taxas fixas de 110% do CDI no CDB e 90% na LCI.',
          why: 'Todos comparam os mesmos produtos, e o que decide é o prazo.',
        },
      },
    ],
  },
}

export const BLOCKS_3_4: LessonBlocks = {
  schemaVersion: 1,
  phases: {
    scenario: [
      {
        type: 'text',
        markup:
          'Sua carteira tem Tesouro Selic, ações e um fundo imobiliário. Num dia qualquer, o Banco Central sobe a Selic. Quem ganha e quem perde?',
      },
      {
        type: 'text',
        markup:
          'Cada classe reage de um jeito. Montar a carteira é decidir de antemão como você quer atravessar esse dia.',
      },
    ],
    microDecision: [
      {
        type: 'text',
        markup:
          'A Selic sobe. O que acontece com o preço de um título prefixado que você já comprou, se você quiser vendê-lo antes do vencimento?',
      },
    ],
    revelation: [
      {
        type: 'text',
        markup:
          'Ele cai. Quem compra agora recebe uma taxa maior, então o seu título, com a taxa antiga, vale menos. É a {{marcação a mercado}}.',
      },
      {
        type: 'widget',
        id: 'gangorra',
        widget: 'mtm-seesaw',
        props: { contractRatePct: 11.75, yearsToMaturity: 2, indexer: 'prefixed' },
        caption: 'Mude a taxa de mercado e veja o preço do título. Valores de exemplo.',
      },
      {
        type: 'check',
        id: 'quem-rende-mais',
        kind: 'single',
        prompt: 'Com a Selic em alta, qual passa a render mais?',
        options: [
          'Tesouro Selic',
          'Prefixado já comprado, vendido antes do prazo',
          'Nada muda em nenhum',
        ],
        answer: 0,
        explanation:
          'O Tesouro Selic acompanha a taxa, então rende mais. O prefixado fica preso à taxa antiga.',
      },
      {
        type: 'text',
        markup:
          'Ações e fundos imobiliários também reagem, cada um do seu jeito. Juros altos pesam em empresas endividadas e tornam a renda fixa mais atraente. Não há regra fixa: alguns setores, como bancos, podem até ganhar.',
      },
      {
        type: 'check',
        id: 'tesouro-selic-protege',
        kind: 'single',
        prompt: 'Uma carteira só de Tesouro Selic está protegida de quê?',
        options: ['De juros que sobem', 'De qualquer inflação, sempre', 'De todo tipo de risco'],
        answer: 0,
        explanation:
          'O preço dele não cai com a alta dos juros. O ganho acima da inflação, porém, depende de a Selic ficar acima dela.',
      },
      {
        type: 'text',
        markup:
          'Diversificar não dá proteção perfeita: em crises, ativos diferentes às vezes caem juntos. O que ajuda é ter um plano antes: objetivo, prazo, perfil e quanto vai para cada classe.',
      },
      {
        type: 'widget',
        id: 'monte-sua-carteira',
        widget: 'allocation-donut',
        props: { profile: 'moderate', amount: 10000 },
        caption: 'Monte uma carteira e veja a perda num ano ruim. Valores ilustrativos.',
      },
      {
        type: 'check',
        id: 'carteira-resiste',
        kind: 'single',
        prompt: 'Qual carteira atravessa melhor cenários bem diferentes?',
        options: [
          'Tudo numa única ação',
          'Mista, com uma parte em pós-fixado',
          'Tudo em prefixado',
        ],
        answer: 1,
        explanation:
          'A mista não depende de um só cenário. A parte pós-fixada amortece quando os juros sobem, e as ações cobrem o longo prazo.',
      },
      {
        type: 'text',
        markup:
          'Você concluiu a trilha guiada. Daqui em diante, todo o Mercado está liberado para você praticar.',
      },
      {
        type: 'widget',
        id: 'nota-pratica',
        widget: 'platform-note',
        props: {
          brazil: 'Você monta a carteira com dinheiro de verdade, e os eventos vêm do mundo real.',
          here: 'No Mercado você pratica com R$ 10.000 e eventos macro do jogo, como alta de juros e quedas de mercado.',
          why: 'Assim você testa uma carteira sem arriscar o seu dinheiro.',
        },
      },
    ],
  },
}

// Lição nova "Cabeça de investidor" (RC.4.9), antes do desafio final. Fato:
// `cvm-vieses-comportamentais` (Série CVM Comportamental, volume 1, texto lido). O
// efeito manada ficou de fora porque a página da CVM sobre ele não foi aberta.
export const BLOCKS_VIESES: LessonBlocks = {
  schemaVersion: 1,
  phases: {
    scenario: [
      {
        type: 'text',
        markup:
          'Você vende uma ação na baixa e ela sobe 40% no mês seguinte. Quanto isso dói, de 0 a 10? Conhecer produtos e contas não basta: na hora do susto, a emoção decide mais rápido que a razão, e os atalhos da mente nos levam a erros previsíveis, os vieses.',
      },
      {
        type: 'poll',
        id: 'enquete-queda-sem-noticia',
        prompt: 'Sua ação caiu 30% e não saiu notícia nenhuma. O que você faz?',
        options: ['Vendo para não perder mais', 'Seguro e espero', 'Compro mais'],
        closing:
          'Não existe resposta certa só pelo susto. A seguir: os erros que a emoção costuma causar.',
      },
      {
        type: 'text',
        markup:
          'A Comissão de Valores Mobiliários (CVM) estuda esses erros para orientar o investidor. Três deles aparecem o tempo todo.',
      },
    ],
    microDecision: [
      {
        type: 'text',
        markup:
          'Perder R$ 100 incomoda mais do que ganhar R$ 100 alegra. Isso tende a levar o investidor a fazer o quê?',
      },
    ],
    revelation: [
      {
        type: 'text',
        markup:
          'A vender cedo o que está ganhando, por medo de perder o lucro, e a segurar o que está perdendo, por não querer assumir o prejuízo. É a {{aversão à perda}}.',
      },
      {
        type: 'check',
        id: 'sinal-aversao',
        kind: 'single',
        prompt: 'Qual atitude é um sinal de aversão à perda?',
        options: [
          'Comprar mais de um ativo em queda só para recuperar o prejuízo',
          'Rever a carteira em datas marcadas',
          'Diversificar entre classes',
        ],
        answer: 0,
        explanation:
          'Reforçar uma posição perdedora pelo desejo de recuperar é a emoção falando. Rever em datas marcadas e diversificar são defesas.',
      },
      {
        type: 'text',
        markup:
          'Há também a {{ancoragem}}: prender-se ao preço que você pagou. A ação comprada a R$ 30 vale R$ 20, e você espera voltar a R$ 30, mesmo sem motivo para isso.',
      },
      {
        type: 'check',
        id: 'preco-de-compra',
        kind: 'true_false',
        prompt: 'O mercado leva em conta o preço que você pagou pela ação.',
        answer: false,
        explanation:
          'O preço só reflete o que os compradores e vendedores pensam hoje. O seu preço de compra não entra na conta.',
      },
      {
        type: 'text',
        markup:
          'O terceiro é a {{autoconfiança excessiva}}: achar que sabe mais que a média. Quem pensa assim negocia mais, paga mais custos e tende a ter retorno menor.',
      },
      {
        type: 'check',
        id: 'operar-demais',
        kind: 'single',
        prompt: 'Por que quem se acha melhor que a média costuma ter retorno menor?',
        options: [
          'Negocia mais e paga mais custos',
          'A lei limita o lucro de quem opera muito',
          'Ele nunca acerta nenhuma operação',
        ],
        answer: 0,
        explanation:
          'Cada negociação tem custo. Mais operações por confiança demais aumentam os custos e pioram o resultado.',
      },
      {
        type: 'widget',
        id: 'quiz-de-vieses',
        widget: 'behavior-bias-quiz',
        props: {},
        caption: 'Escolha sua reação em cada situação e veja o viés por trás dela.',
      },
      {
        type: 'text',
        markup:
          'A defesa é ter regras antes do susto: uma estratégia com limites de perda aceitáveis, rever a carteira em datas marcadas, conferir cotações com menos frequência e desconfiar de quem apressa você.',
      },
      {
        type: 'check',
        id: 'regra-previa',
        kind: 'single',
        prompt: 'A carteira cai 20%. Qual é a melhor primeira reação?',
        options: [
          'Vender tudo imediatamente',
          'Voltar ao plano e checar se o motivo da compra mudou',
          'Comprar o dobro para recuperar rápido',
        ],
        answer: 1,
        explanation:
          'O plano feito com a cabeça fria evita decidir no pânico. Vender tudo e dobrar a aposta são as duas formas de deixar o medo mandar.',
      },
      {
        type: 'widget',
        id: 'nota-vieses',
        widget: 'platform-note',
        props: {
          brazil: 'Os vieses aparecem com dinheiro de verdade, e o susto de uma queda é real.',
          here: 'No Mercado, eventos macro provocam quedas e altas em segundos. Dá para treinar a reação com R$ 10.000 de capital inicial.',
          why: 'Errar aqui não custa dinheiro de verdade, e você aprende a seguir o plano.',
        },
      },
    ],
  },
}
