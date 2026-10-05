// Catálogo estático (tarefas C.1 do backlog de engajamento e RC.3.5 do de
// revisão): dado fixo em código, não tabela de banco. A chave é o texto exato
// usado entre chaves duplas no conteúdo, ex. `{{FGC}}`. `definition` é a frase
// curta do popover; `example` só aparece na página de glossário;
// `originLesson` é o código da lição que ensina o termo (ausente enquanto a
// lição que vai defini-lo não existe, ver RC.4.1/RC.4.2). Texto de aprendizado
// segue `.claude/diretrizes-redacao-licoes.md` (sem mecânica da plataforma).
export interface GlossaryEntry {
    definition: string
    example?: string
    originLesson?: string
}

export const glossary: Record<string, GlossaryEntry> = {
    FGC: {
        definition:
            'Fundo Garantidor de Créditos: cobre CDB, LCI e LCA em até R$250.000,00 por CPF e por instituição financeira, mesmo que o emissor quebre.',
        originLesson: '1.5',
    },
    'marcação a mercado': {
        definition:
            'Recálculo diário do preço de um título prefixado pela taxa de mercado vigente, que pode ficar acima ou abaixo do que a taxa contratada renderia até aquele dia.',
        originLesson: '1.9',
    },
    deságio: {
        definition:
            'Diferença entre o valor de face de um título prefixado e o preço menor que você paga por ele hoje; é essa diferença que forma a rentabilidade contratada.',
        example: 'Um título de face R$1.000,00 comprado por R$900,00 tem deságio de R$100,00.',
        originLesson: '1.8',
    },
    'taxa bruta equivalente': {
        definition:
            'Taxa que um produto tributado precisaria pagar pra empatar, líquido de IR, com um produto isento: taxa isenta dividida por (1 menos a alíquota).',
        example: 'Uma LCI isenta de 9% ao ano equivale a um CDB tributado a 15% de IR pagando 9 / 0,85, cerca de 10,59% ao ano.',
        originLesson: '1.7',
    },
    EBIT: { definition: 'Lucro operacional da empresa, antes de descontar juros e impostos.', originLesson: '2.7.2' },
    'Dividend Yield': {
        definition: 'Soma dos dividendos pagos por ação ou cota nos últimos 12 meses, dividida pelo preço atual.',
        example: 'R$3,00 de dividendos em 12 meses sobre uma ação de R$50,00 dá Dividend Yield de 6%.',
        originLesson: '2.7.6',
    },
    Selic: {
        definition:
            'Taxa básica de juros da economia brasileira. O Copom, do Banco Central, define a meta, e a Selic efetiva é a média das operações de um dia com títulos públicos. Serve de referência para a renda fixa e o crédito.',
        originLesson: '0.5',
    },
    CDI: {
        definition: 'Taxa média dos empréstimos entre bancos por um dia. Anda colada na Selic e é o benchmark da maior parte dos CDBs.',
        example: 'Um CDB que paga 100% do CDI rende o mesmo que a taxa CDI do período.',
        originLesson: '0.5',
    },
    TR: {
        definition:
            'Taxa Referencial: calculada pelo Banco Central a partir dos juros dos títulos públicos prefixados. Fica perto de zero quando os juros estão baixos e sobe com eles. Entra na poupança e em financiamentos.',
        originLesson: '0.5',
    },
    IPCA: {
        definition: 'Índice oficial de inflação do Brasil, medido pelo IBGE. Mostra quanto os preços subiram em um período.',
        originLesson: '0.3',
    },
    ticker: {
        definition: 'Código de negociação de um ativo na bolsa, formado por letras e número.',
        example: 'No ticker VALR3, as letras identificam a empresa e o número, o tipo de papel.',
        originLesson: '2.1',
    },
    'ON e PN': {
        definition:
            'Ações ordinárias (ON, terminam em 3) dão direito a voto. Preferenciais (PN, terminam em 4) podem ter preferência no recebimento de dividendos e, em geral, não votam.',
        originLesson: '2.3',
    },
    'ação ordinária': {
        definition: 'Ação ON, com ticker terminado em 3. Dá direito a voto nas decisões da empresa.',
        originLesson: '2.3',
    },
    'ação preferencial': {
        definition: 'Ação PN, com ticker terminado em 4. Pode ter preferência no dividendo e, em geral, não dá direito a voto.',
        originLesson: '2.3',
    },
    IPO: {
        definition: 'Oferta pública inicial: a primeira vez que uma empresa oferece ações ao público e passa a ser de capital aberto.',
        originLesson: '2.2',
    },
    'oferta primária': {
        definition: 'Oferta de ações novas, emitidas pela empresa. O dinheiro entra no caixa dela.',
        originLesson: '2.2',
    },
    'oferta secundária': {
        definition: 'Oferta de ações que já existiam, vendidas por sócios. O dinheiro vai para quem vende, e não para a empresa.',
        originLesson: '2.2',
    },
    bookbuilding: {
        definition: 'Processo que forma o preço de uma oferta: investidores dizem quantas ações querem e o preço máximo que aceitam.',
        originLesson: '2.2',
    },
    'mercado primário': {
        definition: 'Onde as empresas vendem ações novas ao público pela primeira vez e captam recursos para o próprio caixa.',
        originLesson: '2.2',
    },
    'mercado secundário': {
        definition:
            'Onde os investidores compram e vendem entre si ações que já existem. O dinheiro vai para quem vende, e não para a empresa.',
        originLesson: '2.2',
    },
    'valor de face': {
        definition: 'Valor que o título paga no vencimento, também chamado de valor nominal.',
        example: 'Um título prefixado de face R$1.000,00 devolve R$1.000,00 no vencimento.',
        originLesson: '1.8',
    },
    VNA: {
        definition: 'Valor Nominal Atualizado: o valor de face de um título já corrigido pelo indexador, como o IPCA, até hoje.',
        originLesson: '1.11',
    },
    alavancagem: {
        definition: 'Uso de dívida para financiar a operação. Aumenta o retorno quando tudo vai bem e amplia o prejuízo quando não vai.',
        originLesson: '2.7.5',
    },
    payout: {
        definition: 'Parte do lucro da empresa distribuída aos acionistas como dividendos.',
        example: 'Lucro de R$100 milhões e R$40 milhões distribuídos dão payout de 40%.',
        originLesson: '2.8',
    },
    JCP: {
        definition: 'Juros sobre Capital Próprio: forma de a empresa remunerar o acionista, com imposto retido na fonte.',
        originLesson: '2.8',
    },
    'ITR e DFP': {
        definition: 'Demonstrações financeiras que a empresa de capital aberto publica: o ITR é trimestral e a DFP é anual.',
        originLesson: '2.7.1',
    },
    'valor de mercado': {
        definition: 'Preço da ação multiplicado pelo número de ações da empresa: quanto o mercado diz que ela vale hoje.',
        example: '10 milhões de ações a R$20,00 dão valor de mercado de R$200 milhões.',
        originLesson: '2.1',
    },
    NAV: {
        definition: 'Valor patrimonial por cota de um fundo ou ETF: o valor dos ativos da carteira dividido pelo número de cotas.',
        originLesson: '2.10',
    },
    ágio: {
        definition: 'Quando o preço de negociação fica acima do valor de referência. O contrário é o deságio.',
        originLesson: '2.11',
    },
    spread: {
        definition: 'Diferença entre dois preços ou taxas. Na bolsa, é a distância entre a melhor oferta de compra e a de venda.',
        originLesson: '2.5',
    },
    liquidez: {
        definition: 'Facilidade de transformar um ativo em dinheiro rapidamente, sem precisar vender com desconto.',
        originLesson: '1.3',
    },
    'ordem a mercado': {
        definition: 'Ordem para comprar ou vender já, ao preço que estiver sendo praticado no mercado naquele momento.',
        example: 'Uma compra a mercado de 500 ações pode passar por mais de um nível de preço do livro de ofertas.',
        originLesson: '2.5',
    },
    'ordem limite': {
        definition: 'Ordem que só executa no preço que você definir ou melhor. Se ninguém aceita esse preço, ela espera na fila.',
        example: 'Uma compra limite a R$ 9,50 nunca paga mais que R$ 9,50 por ação.',
        originLesson: '2.5',
    },
    duration: {
        definition: 'Prazo médio ponderado em que o título devolve o dinheiro. Quanto maior, mais o preço oscila quando os juros mudam.',
        originLesson: '1.9',
    },
    'conglomerado financeiro': {
        definition: 'Grupo de instituições do mesmo controlador. A garantia do FGC vale por conglomerado, não por banco do grupo.',
        originLesson: '1.12',
    },
    securitizadora: {
        definition: 'Empresa que compra recebíveis e emite títulos, como CRI e CRA, lastreados neles para vender a investidores.',
        originLesson: '1.12',
    },
    indexador: {
        definition: 'Índice ou taxa que corrige a rentabilidade de um título, como o CDI, a Selic ou o IPCA.',
        originLesson: '1.1',
    },
    prefixado: {
        definition: 'Título cuja taxa é conhecida no momento da compra, antes de saber o que acontecerá com os juros.',
        originLesson: '1.8',
    },
    'pós-fixado': {
        definition: 'Título cuja rentabilidade acompanha um indicador, como o CDI ou a Selic, e só é conhecida no fim.',
        originLesson: '1.2',
    },
    carência: {
        definition: 'Período em que o dinheiro aplicado não pode ser resgatado.',
        originLesson: '1.7',
    },
    rating: {
        definition: 'Nota de uma agência de classificação sobre a capacidade de o emissor pagar suas dívidas.',
        originLesson: '1.12',
    },
    'juros compostos': {
        definition: 'Juros calculados sobre o capital mais os juros já acumulados, o famoso juros sobre juros.',
        example: 'R$1.000,00 a 10% ao ano viram R$1.210,00 em dois anos, e não R$1.200,00.',
        originLesson: '0.2',
    },
    inflação: {
        definition: 'Aumento geral dos preços ao longo do tempo, que reduz o que o mesmo dinheiro compra.',
        originLesson: '0.3',
    },
    'rendimento real': {
        definition: 'Rendimento depois de descontar a inflação do período. É o ganho de poder de compra.',
        example: 'Rendimento de 10% com inflação de 4% dá rendimento real de cerca de 5,8%.',
        originLesson: '0.4',
    },
    alíquota: {
        definition: 'Percentual do imposto que incide sobre o rendimento.',
        originLesson: '1.6',
    },
    vencimento: {
        definition: 'Data em que o título termina e devolve o valor ao investidor.',
        originLesson: '1.1',
    },
    lastro: {
        definition: 'Direito ou crédito que garante um título. Um CRI, por exemplo, é lastreado em créditos imobiliários.',
        originLesson: '1.12',
    },
    ROE: {
        definition:
            'Retorno sobre o patrimônio: lucro líquido dividido pelo patrimônio líquido. Mede o quanto a empresa rende ao dinheiro dos sócios.',
        originLesson: '2.7.3',
    },
    'P/L': {
        definition: 'Preço da ação dividido pelo lucro por ação. Indica quantos anos de lucro o preço atual representa.',
        originLesson: '2.7.4',
    },
    'P/VP': {
        definition: 'Preço da ação dividido pelo patrimônio líquido por ação. Abaixo de 1, o mercado paga menos que o patrimônio contábil.',
        originLesson: '2.7.4',
    },
    'data com': {
        definition: 'Último dia em que comprar a ação ainda garante o direito ao provento anunciado.',
        originLesson: '2.8',
    },
    'data ex': {
        definition: 'Primeiro dia em que a ação é negociada sem o direito ao provento. O preço costuma cair o valor do dividendo.',
        originLesson: '2.8',
    },
    ETF: {
        definition: 'Fundo de índice negociado em bolsa como uma ação, que reproduz a carteira de um índice de referência.',
        originLesson: '2.10',
    },
    FII: {
        definition:
            'Fundo de investimento imobiliário: reúne dinheiro de cotistas para investir em imóveis ou títulos imobiliários e distribui rendimentos.',
        originLesson: '2.11',
    },
    dividendo: {
        definition: 'Parte do lucro que a empresa paga em dinheiro aos acionistas.',
        originLesson: '2.8',
    },
    diversificação: {
        definition: 'Dividir o dinheiro entre ativos diferentes para que o problema de um não derrube toda a carteira.',
        originLesson: '3.1',
    },
    volatilidade: {
        definition: 'Intensidade das oscilações do preço de um ativo. Quanto maior, mais incerto o resultado no curto prazo.',
        originLesson: '3.1',
    },
}
