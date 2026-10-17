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
        kind: 'single',
        prompt:
          'A melhor compra está a R$ 10,00 e a melhor venda a R$ 10,05. Qual é o spread, em reais?',
        options: ['R$ 0,05', 'R$ 0,50', 'R$ 10,00', 'R$ 20,05'],
        answer: 0,
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

// Lições 2.1 a 2.5 reescritas (RC.5.9). Fatos: `acao-responsabilidade-limitada`,
// `b3-ipo-ofertas`, `b3-ticker-estrutura`, `b3-ticker-sufixos` (F e lote) e
// `dividendo-obrigatorio` (só a ideia de que o dividendo é lucro distribuído,
// sem número). As empresas são as do catálogo da plataforma (VALR3, BNDD3,
// BNDD4); a diferença para o mercado real fica no bloco "Na plataforma".

export const BLOCKS_2_1: LessonBlocks = {
  schemaVersion: 1,
  phases: {
    scenario: [
      {
        type: 'text',
        markup:
          'Uma ação é uma fração do capital de uma empresa. Quem compra ações vira sócio: não empresta dinheiro, como na renda fixa, e passa a dividir o resultado do negócio.',
      },
      {
        type: 'text',
        markup:
          'Empresas de capital aberto têm as ações negociadas na bolsa de valores. Cada ação tem um código, o {{ticker}}, como VALR3, da Mineradora Vale do Rio.',
      },
      {
        type: 'check',
        id: 'o-que-voce-compra',
        kind: 'single',
        prompt: 'Quando você compra uma ação de uma empresa, você:',
        options: ['Empresta dinheiro a ela', 'Vira sócio dela', 'Compra uma dívida dela'],
        answer: 1,
        explanation:
          'A ação é uma fração do capital da empresa. O acionista é sócio, e não credor, como quem compra um CDB ou um título.',
      },
    ],
    microDecision: [
      {
        type: 'text',
        markup:
          'A empresa lucrou R$ 1 milhão no ano e você tem 1% das ações. Você recebe R$ 10 mil?',
      },
    ],
    revelation: [
      {
        type: 'text',
        markup:
          'Só se a empresa distribuir. O lucro pode ficar no negócio, para crescer. A parte que vai aos sócios são os dividendos, e o resto vira expectativa de valorização.',
      },
      {
        type: 'widget',
        id: 'seja-socio',
        widget: 'ownership-calculator',
        props: { price: 20, totalShares: 1000000, yourShares: 100, profit: 5000000, payoutPct: 30 },
        caption:
          'Mude as ações, o lucro e a parte distribuída. Veja a sua fatia, o valor de mercado e o dividendo.',
      },
      {
        type: 'text',
        markup:
          'Sua fatia é o número de ações que você tem dividido pelo total. O preço da ação vezes o total de ações é o {{valor de mercado}}: quanto o mercado diz que a empresa vale.',
      },
      {
        type: 'check',
        id: 'sua-fatia',
        kind: 'single',
        prompt:
          'A empresa tem 1 milhão de ações e você compra 10 mil. Que percentual dela você tem?',
        options: ['0,01%', '0,1%', '1%', '10%'],
        answer: 2,
        explanation: '10 mil dividido por 1 milhão dá 0,01, ou seja, 1% da empresa.',
      },
      {
        type: 'text',
        markup:
          'O ganho vem de duas fontes: a valorização do preço e os dividendos. Nenhuma é garantida, e o preço oscila todos os dias. Por isso a ação é renda variável.',
      },
      {
        type: 'check',
        id: 'o-que-nao-e-da-acao',
        kind: 'single',
        prompt: 'Qual destas NÃO é uma característica da ação?',
        options: [
          'O preço pode subir ou cair',
          'Rendimento garantido na hora da compra',
          'Pode pagar dividendos',
        ],
        answer: 1,
        explanation:
          'Na ação o retorno depende do resultado da empresa e do preço de mercado. A taxa conhecida na compra é característica da renda fixa prefixada.',
      },
      {
        type: 'check',
        id: 'responsabilidade-limitada',
        kind: 'true_false',
        prompt:
          'Se a empresa quebrar, o acionista precisa pagar as dívidas dela com o próprio patrimônio.',
        answer: false,
        explanation:
          'A lei limita a responsabilidade do acionista ao preço das ações que ele comprou. Ele pode perder o que investiu, mas não responde pelas dívidas com outros bens.',
      },
      {
        type: 'widget',
        id: 'nota-acao',
        widget: 'platform-note',
        props: {
          brazil:
            'Na B3, a bolsa do Brasil, são negociadas ações de empresas reais, com preços e quantidades de verdade.',
          here: 'Na plataforma as empresas são fictícias, como a Mineradora Vale do Rio (VALR3), e o dinheiro é de treino.',
          why: 'Assim você pratica sem arriscar dinheiro de verdade.',
        },
      },
    ],
  },
}

export const BLOCKS_2_2: LessonBlocks = {
  schemaVersion: 1,
  phases: {
    scenario: [
      {
        type: 'text',
        markup:
          'Para ter ações na bolsa, a empresa precisa abrir o capital. O {{IPO}}, a oferta pública inicial, é a primeira vez que ela oferece ações ao público.',
      },
      {
        type: 'check',
        id: 'o-que-e-ipo',
        kind: 'single',
        prompt: 'Qual destas situações é um IPO?',
        options: [
          'Um investidor vende ações a outro na bolsa',
          'A empresa oferece ações ao público pela primeira vez',
          'O governo emite um título de renda fixa',
        ],
        answer: 1,
        explanation:
          'IPO é a primeira oferta pública de ações de uma empresa. Depois dela a empresa passa a ser de capital aberto.',
      },
      {
        type: 'text',
        markup:
          'As ações do IPO podem ser novas, emitidas pela empresa, ou já existentes, de sócios que querem vender, como os fundadores. A oferta também pode misturar as duas.',
      },
    ],
    microDecision: [
      {
        type: 'text',
        markup: 'Num IPO, todo o dinheiro pago pelas ações vai para o caixa da empresa?',
      },
    ],
    revelation: [
      {
        type: 'text',
        markup:
          'Só o das ações novas. Na {{oferta primária}} o dinheiro entra na empresa. Na {{oferta secundária}} ele vai para os sócios que vendem as ações que já tinham.',
      },
      {
        type: 'check',
        id: 'caixa-da-oferta-primaria',
        kind: 'single',
        prompt:
          'Uma oferta vende 10 milhões de ações novas a R$ 20 cada. Quanto entra no caixa da empresa, em milhões de reais?',
        options: ['R$ 2 milhões', 'R$ 20 milhões', 'R$ 200 milhões', 'R$ 2.000 milhões'],
        answer: 2,
        explanation:
          '10 milhões de ações vezes R$ 20 dá R$ 200 milhões, todos para a empresa, porque as ações são novas.',
      },
      {
        type: 'text',
        markup:
          'O preço sai do {{bookbuilding}}: investidores dizem quantas ações querem e o preço máximo que aceitam. O preço de corte é o maior que ainda cobre toda a oferta.',
      },
      {
        type: 'widget',
        id: 'simulador-ipo',
        widget: 'bookbuilding-simulator',
        props: { offeredShares: 1000000, primaryPct: 60, existingShares: 4000000 },
        caption:
          'Mude as ações ofertadas e a parte primária. Veja o preço de corte, o caixa da empresa e o que vai aos sócios.',
      },
      {
        type: 'check',
        id: 'oferta-so-secundaria',
        kind: 'true_false',
        prompt: 'Numa oferta só secundária, o dinheiro entra no caixa da empresa.',
        answer: false,
        explanation:
          'Na oferta secundária as ações já existiam. Quem recebe o dinheiro é o sócio que vendeu, e a empresa não arrecada nada.',
      },
      {
        type: 'text',
        markup:
          'Depois do IPO, quem compra e vende entre si faz o {{mercado secundário}}, e o dinheiro não vai para a empresa. A venda de ações novas é o {{mercado primário}}.',
      },
      {
        type: 'check',
        id: 'dinheiro-no-secundario',
        kind: 'single',
        prompt:
          'Você compra uma ação na bolsa, meses depois do IPO. O dinheiro vai principalmente para:',
        options: ['O caixa da empresa', 'O investidor que vendeu a ação', 'O Banco Central'],
        answer: 1,
        explanation:
          'No mercado secundário a ação já existe e muda de dono. Quem recebe é o investidor que vendeu, descontados os custos da operação.',
      },
      {
        type: 'text',
        markup:
          'Uma empresa já listada pode voltar a vender ações novas depois, na oferta subsequente, o follow-on. É outra volta ao mercado primário.',
      },
      {
        type: 'widget',
        id: 'nota-ipo',
        widget: 'platform-note',
        props: {
          brazil:
            'No Brasil, o IPO envolve bancos de investimento, documentos regulatórios e um prospecto com os riscos da empresa.',
          here: 'Na plataforma as empresas já nascem listadas, e você negocia no mercado secundário, entre investidores.',
          why: 'Assim a prática fica no dia a dia da bolsa, sem esperar a abertura de capital de uma empresa.',
        },
      },
    ],
  },
}

export const BLOCKS_2_3: LessonBlocks = {
  schemaVersion: 1,
  phases: {
    scenario: [
      {
        type: 'text',
        markup:
          'Todo ticker tem quatro letras, que lembram o nome da empresa, e um número que diz o tipo da ação. A empresa escolhe as letras. O número segue um padrão da B3.',
      },
      {
        type: 'text',
        markup:
          'Final 3 é {{ação ordinária}} (ON), que dá direito a voto. Final 4 é {{ação preferencial}} (PN), que pode ter preferência no dividendo e, em geral, não vota.',
      },
      {
        type: 'check',
        id: 'ticker-ordinaria',
        kind: 'single',
        prompt: 'Qual destes tickers é de uma ação ordinária?',
        options: ['BNDD4', 'BNDD3', 'BNDD11'],
        answer: 1,
        explanation:
          'O final 3 marca a ação ordinária. O 4 é preferencial, e o 11 não é de ação simples.',
      },
    ],
    microDecision: [
      {
        type: 'text',
        markup:
          'O Banco Nordeste Digital tem dois tickers: BNDD3 e BNDD4. Você quer ter voto nas decisões do banco. Qual escolhe?',
      },
    ],
    revelation: [
      {
        type: 'text',
        markup:
          'BNDD3, a ordinária. As duas são do mesmo banco e só mudam os direitos: ticker diferente não é empresa diferente.',
      },
      {
        type: 'check',
        id: 'duas-empresas',
        kind: 'true_false',
        prompt: 'BNDD3 e BNDD4 são de empresas diferentes.',
        answer: false,
        explanation:
          'As quatro letras identificam a empresa. O número final só diz a classe da ação.',
      },
      {
        type: 'text',
        markup:
          'O final 11 não é de ação simples: pode ser fundo ou ETF. O F no fim, como em VALR3F, indica o mercado fracionário, de 1 a 99 ações. Os finais 32 a 35 são de BDRs, recibos de ações de empresas estrangeiras.',
      },
      {
        type: 'widget',
        id: 'decodificador',
        widget: 'ticker-decoder',
        props: {},
        caption: 'Escolha o que cada código é e veja a regra depois da resposta.',
      },
      {
        type: 'check',
        id: 'final-onze',
        kind: 'single',
        prompt: 'O que costuma ser um ticker terminado em 11, como SINT11?',
        options: ['Uma ação ordinária', 'Um fundo ou ETF', 'Uma ação preferencial'],
        answer: 1,
        explanation: 'O final 11 abrange fundos e ETFs. As ações simples terminam em 3 ou em 4.',
      },
      {
        type: 'check',
        id: 'ticker-fracionario',
        kind: 'single',
        prompt: 'O que indica a letra F no fim de um ticker, como VALR3F?',
        options: [
          'Que é um fundo imobiliário',
          'Que é o mercado fracionário, de 1 a 99 ações',
          'Que é uma empresa estrangeira',
        ],
        answer: 1,
        explanation:
          'O F marca o mercado fracionário. O lote padrão é de 100 ações, e quantidades menores vão para ele.',
      },
      {
        type: 'widget',
        id: 'nota-ticker',
        widget: 'platform-note',
        props: {
          brazil:
            'Na B3, cada empresa real escolhe as letras do seu ticker, e o número final segue o padrão do tipo de ativo.',
          here: 'Na plataforma os tickers são de empresas fictícias, como VALR3 e BNDD4, e o catálogo tem ações, ETFs e FIIs.',
          why: 'Assim você aprende a ler o código sem depender de empresas reais.',
        },
      },
    ],
  },
}

export const BLOCKS_2_4: LessonBlocks = {
  schemaVersion: 1,
  phases: {
    scenario: [
      {
        type: 'text',
        markup:
          'O preço de uma ação reage a notícias. Algumas atingem a economia inteira, como uma decisão sobre a Selic. Outras atingem só um setor, o grupo de empresas do mesmo ramo, como a quebra de uma safra.',
      },
      {
        type: 'check',
        id: 'noticia-da-selic',
        kind: 'single',
        prompt: 'Uma decisão do Banco Central sobre a Selic é uma notícia:',
        options: [
          'Só de um setor',
          'Da economia inteira, que chega com força diferente a cada setor',
          'Sem efeito sobre ações',
        ],
        answer: 1,
        explanation:
          'A Selic muda o custo do crédito e o retorno da renda fixa, e isso alcança todas as empresas. Quem tem mais dívida, por exemplo, sente mais.',
      },
    ],
    microDecision: [
      {
        type: 'text',
        markup:
          'Uma empresa divulga lucro de R$ 1,00 por ação. O mercado esperava R$ 1,20. O preço tende a:',
      },
    ],
    revelation: [
      {
        type: 'text',
        markup:
          'Cair. O preço já embute o que o mercado espera. O que move é a surpresa: lucro abaixo do esperado decepciona, mesmo sendo lucro.',
      },
      {
        type: 'widget',
        id: 'triagem-manchetes',
        widget: 'headline-triage',
        props: {},
        caption: 'Leia as quatro manchetes de exemplo e escolha a melhor resposta.',
      },
      {
        type: 'text',
        markup:
          'Antes de reagir a uma notícia, pergunte: quem ela afeta, por qual caminho (receita, custo ou juros) e se o mercado já esperava por ela.',
      },
      {
        type: 'check',
        id: 'noticia-boa-sobe',
        kind: 'true_false',
        prompt: 'Se a notícia é boa, o preço da ação sempre sobe.',
        answer: false,
        explanation:
          'Se a notícia já era esperada, ela já está no preço. E uma boa notícia menor que a esperada pode derrubar a ação.',
      },
      {
        type: 'check',
        id: 'fonte-confiavel',
        kind: 'single',
        prompt: 'Qual é a fonte mais confiável sobre uma empresa?',
        options: [
          'Uma postagem em rede social',
          'O que a própria empresa divulga oficialmente ao mercado',
          'Uma mensagem de grupo com uma dica',
        ],
        answer: 1,
        explanation:
          'A informação oficial vem da empresa. Promessa de ganho garantido ou de ação que vai dobrar é sinal de alerta.',
      },
      {
        type: 'widget',
        id: 'nota-noticias',
        widget: 'platform-note',
        props: {
          brazil:
            'No Brasil, as notícias vêm das empresas, do Banco Central, do IBGE, de portais e de redes sociais, e cada uma chega ao preço de um jeito.',
          here: 'Na plataforma as notícias são eventos de exemplo, mostrados na área de Notícias, e eles mexem nos preços dentro do jogo.',
          why: 'Assim você treina a ler uma notícia e decidir antes de o preço se ajustar.',
        },
      },
    ],
  },
}

export const BLOCKS_2_5: LessonBlocks = {
  schemaVersion: 1,
  phases: {
    scenario: [
      {
        type: 'text',
        markup:
          'O preço de uma ação não é decidido pela empresa nem por você. É o preço do último negócio, aquele em que um comprador e um vendedor se acertaram.',
      },
      {
        type: 'check',
        id: 'quem-define-o-preco',
        kind: 'single',
        prompt: 'Quem define o preço de uma ação negociada na bolsa?',
        options: [
          'A empresa que a emitiu',
          'O encontro entre quem compra e quem vende',
          'O Banco Central',
        ],
        answer: 1,
        explanation:
          'A empresa emite a ação, mas o preço vem dos negócios entre compradores e vendedores, que mudam o tempo todo.',
      },
    ],
    microDecision: [
      {
        type: 'text',
        markup:
          'Chegam muito mais ordens de compra do que de venda, e os compradores aceitam pagar cada vez mais. O preço da ação tende a:',
      },
    ],
    revelation: [
      {
        type: 'text',
        markup:
          'Subir. As ofertas de venda mais baratas acabam primeiro, e quem ainda quer comprar paga mais. O último negócio sobe junto. Com mais vendedores, ocorre o contrário.',
      },
      {
        type: 'widget',
        id: 'livro-oferta-demanda',
        widget: 'order-book',
        props: {},
        caption:
          'Use "Chega onda de compradores" e depois "Chega onda de vendedores". Veja o último negócio e o spread mudarem.',
      },
      {
        type: 'check',
        id: 'sobe-sem-noticia',
        kind: 'single',
        prompt: 'Uma ação sobe 5% em um dia, sem notícia nenhuma. O que pode ter acontecido?',
        options: [
          'Chegaram mais compradores do que vendedores',
          'A empresa decidiu o novo preço',
          'O Banco Central ajustou o preço',
        ],
        answer: 0,
        explanation:
          'Sem notícia, o preço ainda se mexe quando o equilíbrio entre quem quer comprar e quem quer vender muda.',
      },
      {
        type: 'text',
        markup:
          'Uma notícia boa atrai compradores, e uma ruim atrai vendedores. É por esse caminho que ela chega ao preço.',
      },
      {
        type: 'check',
        id: 'excesso-de-vendedores',
        kind: 'true_false',
        prompt: 'Quando há mais vendedores do que compradores, o preço tende a cair.',
        answer: true,
        explanation:
          'Os vendedores aceitam preços menores para fechar negócio, e os negócios seguintes saem mais baratos.',
      },
      {
        type: 'text',
        markup:
          'Preço não é o mesmo que valor. Ele mostra o que o mercado paga hoje, e não diz sozinho se a ação está cara ou barata. Os indicadores da empresa ajudam nisso, e vêm nas próximas lições.',
      },
      {
        type: 'widget',
        id: 'nota-oferta-demanda',
        widget: 'platform-note',
        props: {
          brazil:
            'Na B3, muitos investidores, instituições e robôs enviam ordens o tempo todo, e o preço nasce desses negócios.',
          here: 'Na plataforma o preço também nasce dos negócios, mas as ordens vêm de você, de outros usuários e de robôs de liquidez.',
          why: 'Assim o livro sempre tem ofertas dos dois lados para você negociar.',
        },
      },
    ],
  },
}
