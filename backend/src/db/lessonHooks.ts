// Ganchos de abertura (LJ.5.8): o primeiro cartão de cada lição que abria com definição passa a abrir
// com pergunta, situação ou contraste, e a definição segue no mesmo cartão. `old` é o primeiro parágrafo
// como estava no seed antigo (usado pelo script aditivo `applyLessonHooks.ts` para achar o texto no banco,
// que o seed não sobrescreve, N.23); `next` é o texto de hoje, o mesmo que está no seed. Lição que não está
// aqui já abria com situação, pergunta ou número e não mudou. Termos continuam definidos antes do uso.
export interface LessonHook {
  code: string
  old: string
  next: string
}

export const LESSON_HOOKS: LessonHook[] = [
  {
    code: '0.5',
    old: 'Toda aplicação de renda fixa e todo empréstimo têm um ponto de partida: o preço do dinheiro. No Brasil, essa referência é a {{Selic}}, a taxa básica de juros.',
    next: 'Por que um empréstimo custa tanto e uma aplicação rende tão pouco? Os dois partem do mesmo número: o preço do dinheiro. No Brasil, essa referência é a {{Selic}}, a taxa básica de juros.',
  },
  {
    code: '0.6',
    old: 'A poupança é o investimento mais popular do Brasil: o dinheiro fica à mão, e o rendimento cai uma vez por mês, no aniversário do depósito.',
    next: 'Seu dinheiro rende na poupança, mas rende mais que a inflação? Depende. Ela é o investimento mais popular do Brasil: o dinheiro fica à mão, e o rendimento cai uma vez por mês, no aniversário do depósito.',
  },
  {
    code: '1.3',
    old: 'Antes de investir para ganhar, vem o seguro contra o imprevisto: a reserva de emergência. É o dinheiro para um conserto, um problema de saúde ou uma perda de renda, sem precisar se endividar.',
    next: 'Se o seu salário atrasasse dois meses, o que você faria? Antes de investir para ganhar, vem o seguro contra o imprevisto: a reserva de emergência. É o dinheiro para um conserto, um problema de saúde ou uma perda de renda, sem precisar se endividar.',
  },
  {
    code: '1.5',
    old: 'O CDB (Certificado de Depósito Bancário) é um empréstimo que você faz ao banco. Em troca, ele devolve o dinheiro com juros.',
    next: 'Quem pede dinheiro emprestado ao banco paga juros. E quando é o banco que pede o seu? O CDB (Certificado de Depósito Bancário) é isso: um empréstimo que você faz ao banco, que devolve o dinheiro com juros.',
  },
  {
    code: '1.6',
    old: 'Um CDB rendeu R$ 1.000 de lucro. Antes de chegar à sua conta, uma parte vai para o Imposto de Renda (IR).',
    next: 'Dois amigos aplicaram o mesmo valor no mesmo CDB. Um pagou 22,5% de Imposto de Renda (IR) sobre o lucro, o outro pagou 15%. O que um fez diferente do outro?',
  },
  {
    code: '1.7',
    old: 'LCI (Letra de Crédito Imobiliário) e LCA (Letra de Crédito do Agronegócio) financiam o setor imobiliário e o agronegócio. Têm a cobertura do {{FGC}}, como o CDB.',
    next: 'Por que uma aplicação que rende menos no papel pode render mais no seu bolso? Parte da resposta está nas letras de crédito: LCI (Letra de Crédito Imobiliário) e LCA (Letra de Crédito do Agronegócio) financiam o setor imobiliário e o agronegócio, e têm a cobertura do {{FGC}}, como o CDB.',
  },
  {
    code: '1.8',
    old: 'O governo também vende títulos com a taxa travada na compra: o Tesouro Prefixado, nome técnico LTN. Ele promete pagar R$ 1.000 por título no vencimento, sem pagar nada no meio do caminho.',
    next: 'E se você pudesse travar hoje quanto vai receber daqui a alguns anos, sem surpresa? O governo vende títulos assim: o Tesouro Prefixado, nome técnico LTN. Ele promete pagar R$ 1.000 por título no vencimento, sem pagar nada no meio do caminho.',
  },
  {
    code: '1.10',
    old: 'O {{IPCA}} é o termômetro oficial da inflação no Brasil. Todo mês, o IBGE mede quanto custa uma cesta de bens e serviços, de comida a transporte, consumida por famílias urbanas com renda de 1 a 40 salários mínimos.',
    next: 'Quanto o seu carrinho de compras ficou mais caro neste ano? Quem responde é o {{IPCA}}, o termômetro oficial da inflação no Brasil. Todo mês, o IBGE mede quanto custa uma cesta de bens e serviços, de comida a transporte, consumida por famílias urbanas com renda de 1 a 40 salários mínimos.',
  },
  {
    code: '1.11',
    old: 'O Tesouro IPCA+ paga a inflação mais uma taxa fixa, por exemplo IPCA + 6% ao ano. A parte da inflação corrige o valor do título, e a parte fixa é o seu ganho acima da inflação.',
    next: 'E se o seu investimento acompanhasse a inflação sozinho, para você nunca perder poder de compra? É o Tesouro IPCA+: paga a inflação mais uma taxa fixa, por exemplo IPCA + 6% ao ano. A parte da inflação corrige o valor do título, e a parte fixa é o seu ganho acima da inflação.',
  },
  {
    code: '2.1',
    old: 'Uma ação é uma fração do capital de uma empresa. Quem compra ações vira sócio: não empresta dinheiro, como na renda fixa, e passa a dividir o resultado do negócio.',
    next: 'Você toparia ser dono de um pedacinho de uma empresa grande? É o que uma ação oferece: uma fração do capital da empresa. Quem compra ações vira sócio: não empresta dinheiro, como na renda fixa, e passa a dividir o resultado do negócio.',
  },
  {
    code: '2.2',
    old: 'Todo ticker tem quatro letras, que lembram o nome da empresa, e um número que diz o tipo da ação. A empresa escolhe as letras. O número segue um padrão da B3.',
    next: 'Dois códigos quase iguais na tela, um terminado em 3 e outro em 4. O que o número final está dizendo? Todo ticker tem quatro letras, que lembram o nome da empresa, e um número que diz o tipo da ação. A empresa escolhe as letras. O número segue um padrão da B3.',
  },
  {
    code: '2.3',
    old: 'Para ter ações na bolsa, a empresa precisa abrir o capital. O {{IPO}}, a oferta pública inicial, é a primeira vez que ela oferece ações ao público.',
    next: 'Um dia, uma empresa que era só dos fundadores passa a ter milhares de sócios. Como isso acontece? Ela abre o capital, e o {{IPO}}, a oferta pública inicial, é a primeira vez que ela oferece ações ao público.',
  },
  {
    code: '2.5',
    old: 'O preço de uma ação não é decidido pela empresa nem por você. É o preço do último negócio, aquele em que um comprador e um vendedor se acertaram.',
    next: 'Quem decide o preço de uma ação? Nem a empresa, nem você. É o preço do último negócio, aquele em que um comprador e um vendedor se acertaram.',
  },
  {
    code: '2.6',
    old: 'O preço de uma ação reage a notícias. Algumas atingem a economia inteira, como uma decisão sobre a Selic. Outras atingem só um setor, o grupo de empresas do mesmo ramo, como a quebra de uma safra.',
    next: 'Uma decisão sobre a Selic abala a bolsa inteira. A quebra de uma safra abala só algumas empresas. O preço de uma ação reage a notícias: umas atingem a economia inteira, outras só um setor, o grupo de empresas do mesmo ramo.',
  },
  {
    code: '2.7.1',
    old: 'Empresa de capital aberto presta contas ao mercado: publica o {{ITR e DFP}}, com os resultados de cada trimestre e do ano. É dali que saem os números que você vai aprender a ler.',
    next: 'Todo trimestre, uma empresa de capital aberto abre as contas para qualquer pessoa ver. Ela publica o {{ITR e DFP}}, com os resultados de cada trimestre e do ano. É dali que saem os números que você vai aprender a ler.',
  },
  {
    code: '2.7.5',
    old: 'O preço de uma ação sozinho não diz se ela está cara. R$ 20 pode ser muito para quem lucra pouco por ação e pouco para quem lucra muito.',
    next: 'Uma ação de R$ 10 pode estar mais cara que uma de R$ 100. Como? O preço sozinho não diz se ela está cara: R$ 20 pode ser muito para quem lucra pouco por ação e pouco para quem lucra muito.',
  },
  {
    code: '2.7.6',
    old: 'O {{dividendo}} é a parte do lucro que a empresa paga em dinheiro aos acionistas. O quanto ela distribui é o {{payout}}. Se o estatuto não disser outra coisa, a lei manda distribuir metade do lucro líquido ajustado.',
    next: 'A empresa lucrou, e o sócio recebe dinheiro na conta sem vender nada. É o {{dividendo}}: a parte do lucro que a empresa paga em dinheiro aos acionistas. O quanto ela distribui é o {{payout}}. Se o estatuto não disser outra coisa, a lei manda distribuir metade do lucro líquido ajustado.',
  },
  {
    code: '2.7.7',
    old: 'Além de se valorizar, uma ação pode pagar parte do lucro aos sócios em dinheiro, os dividendos. O {{Dividend Yield}} resume quanto isso representa frente ao preço.',
    next: 'Duas ações custam R$ 10. Uma paga R$ 1 por ano em dividendos, a outra paga R$ 0,10. Qual rende mais como renda? O {{Dividend Yield}} resume quanto os dividendos representam frente ao preço.',
  },
  {
    code: '2.8',
    old: 'Empresas se agrupam em setores, como mineração, bancos, varejo, energia e tecnologia. Cada setor reage de um jeito à economia e aos juros.',
    next: 'Quando a economia esfria, algumas empresas sentem logo e outras quase não notam. Por quê? Empresas se agrupam em setores, como mineração, bancos, varejo, energia e tecnologia, e cada setor reage de um jeito à economia e aos juros.',
  },
  {
    code: '2.9',
    old: 'Um {{ETF}} é um fundo que reproduz um índice e é negociado na bolsa como uma ação. Com uma cota, você tem uma fatia de uma cesta inteira de ativos.',
    next: 'Dá para ter um pedacinho de várias empresas com uma única compra? Dá, com um {{ETF}}: um fundo que reproduz um índice e é negociado na bolsa como uma ação. Com uma cota, você tem uma fatia de uma cesta inteira de ativos.',
  },
  {
    code: '2.10',
    old: 'Um {{FII}} reúne o dinheiro de muitos investidores, os cotistas, para aplicar no mercado imobiliário. Você compra cotas na bolsa, como compra uma ação.',
    next: 'Dá para receber renda de imóveis sem comprar um imóvel inteiro? Dá, com um {{FII}}, que reúne o dinheiro de muitos investidores, os cotistas, para aplicar no mercado imobiliário. Você compra cotas na bolsa, como compra uma ação.',
  },
  {
    code: '2.12',
    old: 'Ganhar vendendo uma ação ou uma cota pode gerar imposto. Quanto, depende de três coisas: o que você vendeu, se comprou e vendeu no mesmo dia e quanto vendeu no mês.',
    next: 'Você vendeu uma ação com lucro. A Receita quer uma parte? Depende de três coisas: o que você vendeu, se comprou e vendeu no mesmo dia e quanto vendeu no mês.',
  },
  {
    code: '3.4',
    old: 'Conhecer produtos e contas não basta. Na hora do susto, a emoção decide mais rápido que a razão, e os atalhos da mente nos levam a erros previsíveis, os vieses.',
    next: 'Você vende uma ação na baixa e ela sobe 40% no mês seguinte. Quanto isso dói, de 0 a 10? Conhecer produtos e contas não basta: na hora do susto, a emoção decide mais rápido que a razão, e os atalhos da mente nos levam a erros previsíveis, os vieses.',
  },
  {
    code: 'F.1',
    old: 'Investir começa pela sobra: o que resta da sua renda depois de pagar o mês. Sem saber quanto sobra, não dá para decidir quanto aplicar.',
    next: 'O salário entra, o mês passa e, no fim, sobra quanto? Investir começa pela sobra: o que resta da sua renda depois de pagar o mês. Sem saber quanto sobra, não dá para decidir quanto aplicar.',
  },
  {
    code: 'F.2',
    old: 'Os {{juros compostos}} que fazem um investimento crescer trabalham contra você quando é você quem deve. A dívida cresce sobre um saldo que já inclui os juros dos meses anteriores.',
    next: 'O mesmo efeito que faz R$ 1.000 crescerem num investimento faz uma dívida de R$ 1.000 virar bola de neve. Os {{juros compostos}} trabalham contra você quando é você quem deve: a dívida cresce sobre um saldo que já inclui os juros dos meses anteriores.',
  },
]
