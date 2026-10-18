// "O que ficou" (LJ.1.5): de 2 a 3 frases por lição, mostradas na tela final. Cada item é o que a
// pessoa diria a um amigo, não um tópico de apostila. Chave = `stableKey` da lição (imutável).
// Só repete o que a própria lição já ensina: nenhum número regulatório novo entra aqui
// (diretrizes-redacao-licoes.md §5). Limites e regras de forma: `lessonBlocksSchema`.
export const LESSON_SUMMARIES: Record<string, string[]> = {
  '0.1': [
    'Investir é abrir mão do dinheiro hoje esperando ter mais depois.',
    'Dá para emprestar e receber juros, ou virar sócio e dividir o resultado.',
    'Dinheiro parado perde poder de compra com a inflação.',
  ],
  '0.2': [
    'Juros compostos são juros sobre juros, e o tempo faz a bola de neve crescer.',
    'Quanto maior a taxa, mais rápido o efeito, para investir e para dever.',
    'Ação não tem juros: o retorno vem do preço e dos proventos.',
  ],
  '0.3': [
    'Os mesmos R$ 100 compram menos com o tempo, porque os preços sobem.',
    'Todo retorno precisa ser lido junto com a inflação do período.',
    'A meta é o alvo, o IPCA mostra o que aconteceu.',
  ],
  '0.4': [
    'Rendimento real é o que sobra do nominal depois de descontar a inflação.',
    'A conta exata é (1 + nominal) ÷ (1 + inflação) − 1, um pouco abaixo da subtração.',
    'Se a inflação passa o rendimento, o dinheiro cresce no papel e compra menos.',
  ],
  'juros-selic-cdi-tr': [
    'A Selic é a taxa básica, e o CDI anda colado nela.',
    'O que importa para o bolso é o juro real: a Selic menos a inflação.',
    'A TR acompanha os juros dos títulos públicos e entra na poupança.',
  ],
  '0.5': [
    'Com a Selic alta, a poupança paga só uma fração do Tesouro Selic.',
    'A poupança não paga imposto de renda, e por isso, com juros baixos, os dois ficam perto.',
    'Compare sempre pelo que sobra depois do imposto e do prazo.',
  ],
  '1.1': [
    'Na renda fixa você empresta dinheiro a um emissor: governo, banco ou empresa.',
    'O que é fixo é a regra de remuneração, não o valor final.',
    'Na renda variável o retorno depende do preço de mercado.',
  ],
  '1.2': [
    'O Tesouro Selic empresta ao governo e rende todo dia útil.',
    'A Selic só muda a velocidade da subida, o preço quase não oscila.',
    'Resgate é em dia útil, não é instantâneo.',
  ],
  'reserva-emergencia': [
    'A reserva de emergência cobre de 3 a 6 meses do seu custo essencial.',
    'Ela precisa de liquidez e baixo risco, e render menos é o preço disso.',
    'Usou a reserva? Reponha antes de investir em outras coisas.',
  ],
  '1.3': [
    'O Copom sobe a Selic quando a inflação foge da meta para cima.',
    'Juros altos esfriam o consumo e puxam a inflação para baixo.',
    'Selic em alta favorece o pós-fixado e pesa no prefixado já comprado.',
  ],
  '1.4': [
    'CDB é um empréstimo ao banco, pago como percentual do CDI.',
    'O FGC protege até um limite por CPF e por conglomerado, não por banco.',
    'Banco menor paga mais porque o risco é maior.',
  ],
  '1.5': [
    'Quanto mais tempo o dinheiro fica aplicado, menor o imposto de renda.',
    'A alíquota cai de 22,5% para 15% conforme o prazo.',
    'Resgatar antes de 30 dias ainda tem IOF.',
  ],
  '1.6': [
    'LCI e LCA são isentas de imposto de renda para pessoa física.',
    'A taxa bruta equivalente mostra quanto um CDB precisaria pagar para empatar.',
    'Quem vence depende do prazo, não só da taxa anunciada.',
  ],
  '1.7': [
    'O Tesouro Prefixado trava a taxa na compra.',
    'Você paga menos hoje e recebe o valor cheio no vencimento.',
    'Travar a taxa é uma aposta: se a Selic subir, você perde a corrida.',
  ],
  '1.8': [
    'Taxa sobe, preço do título cai, como numa gangorra.',
    'Prazo longo oscila mais, e isso é a duration.',
    'A queda só vira perda se você vender antes do vencimento.',
  ],
  '1.9': [
    'O IPCA mede a inflação e é a referência da meta.',
    'Taxas mensais se compõem, não se somam.',
    'O que cresce menos que o IPCA perde poder de compra.',
  ],
  '1.10': [
    'O Tesouro IPCA+ paga a inflação mais uma taxa real fixa.',
    'O imposto incide sobre todo o ganho, inclusive a parte que só repõe a inflação.',
    'Antes do vencimento o preço oscila, e prazo longo oscila mais.',
  ],
  '1.11': [
    'CRI e CRA não têm FGC: o risco é de quem deve.',
    'O rating vai de AAA, o menor risco, até D, calote.',
    'Pagam mais, mas têm pouca liquidez e não servem para a reserva.',
  ],
  '2.1': [
    'Comprar uma ação é virar sócio de uma empresa.',
    'O ganho vem da valorização e dos dividendos, e nenhum é garantido.',
    'O máximo que você perde é o que investiu.',
  ],
  '2.3': [
    'As quatro letras do ticker dizem a empresa, o número final diz a classe.',
    'Final 3 é ordinária, 4 é preferencial, 11 é fundo ou ETF.',
    'O F no fim indica o mercado fracionário.',
  ],
  '2.2': [
    'No IPO a empresa vende ações ao público pela primeira vez.',
    'Oferta primária paga a empresa, a secundária paga o sócio que vende.',
    'Depois do IPO, quem negocia entre si faz o mercado secundário.',
  ],
  'b3-corretora-ordens': [
    'Você compra pela corretora, e a B3 é onde os negócios acontecem.',
    'Ordem limite nunca paga mais que o seu limite.',
    'Spread pequeno e muitas ordens significam liquidez.',
  ],
  '2.5': [
    'O preço sobe quando há mais gente querendo comprar do que vender.',
    'Notícia mexe no preço porque muda quem quer comprar e quem quer vender.',
    'Preço não é o mesmo que valor.',
  ],
  '2.4': [
    'O preço já embute o que o mercado espera, o que move é a surpresa.',
    'Pergunte quem a notícia afeta, por qual caminho e se já era esperada.',
    'Promessa de ganho garantido é sinal de alerta.',
  ],
  '2.6.1': [
    'Patrimônio líquido é o que a empresa tem menos o que deve.',
    'Valor de mercado é o preço da ação vezes o número de ações.',
    'Dívida bruta e caixa sozinhos não dizem se a empresa está endividada.',
  ],
  '2.6.2': [
    'Margem é quanto de cada real vendido sobra como lucro.',
    'Quem vende mais nem sempre sobra mais.',
    'Compare margens dentro do mesmo setor e ao longo do tempo.',
  ],
  '2.6.5': [
    'Dívida líquida é a dívida bruta menos o caixa.',
    'Dívida líquida ÷ EBIT dá quantos anos de resultado para quitá-la.',
    'Em banco essa conta não se aplica.',
  ],
  '2.6.3': [
    'ROE mostra quanto lucro a empresa gera sobre o capital dos sócios.',
    'ROE alto pode vir de endividamento, e o risco sobe junto.',
    'Compare o ROE entre empresas do mesmo setor.',
  ],
  '2.6.4': [
    'P/L diz quantos anos de lucro o preço da ação representa.',
    'P/VP compara o preço com o patrimônio por ação.',
    'Nenhum dos dois diz sozinho se a ação está cara ou barata.',
  ],
  '2.7': [
    'Só recebe o provento quem tinha a ação até a data com.',
    'Na data ex o preço costuma cair o valor do provento.',
    'Dividendo e JCP têm regras de imposto diferentes.',
  ],
  '2.6.6': [
    'Dividend Yield é quanto a ação pagou de proventos em relação ao preço.',
    'Yield alto pode ser empresa que paga bem ou ação que caiu.',
    'Ele olha para trás e não garante nada.',
  ],
  '2.8': [
    'Setores cíclicos sentem mais a economia, os defensivos seguram parte da queda.',
    'Juro alto pesa mais em quem tem lucro distante ou dívida cara.',
    'Misturar setores reduz o risco da carteira.',
  ],
  '2.9': [
    'O ETF é uma cesta de ativos comprada de uma vez.',
    'O efeito de cada ativo é o peso dele vezes a queda.',
    'O preço gira em torno do NAV, e o participante autorizado o traz de volta.',
  ],
  '2.10': [
    'FII de tijolo tem imóveis, FII de papel tem títulos de dívida.',
    'O rendimento sai em geral todo mês e o ganho na venda da cota é tributado.',
    'P/VP abaixo de 1 pode ser desconto ou sinal de problema.',
  ],
  'custos-de-investir': [
    'Uma taxa pequena, todos os anos, come uma fatia grande do saldo final.',
    'Em fundos há taxa de administração, de gestão e de performance.',
    'Custo é a parte do retorno que você controla.',
  ],
  'imposto-renda-variavel': [
    'Vendas de ações no mês até o limite de isenção não pagam imposto.',
    'Passou do limite, todo o lucro do mês é tributado e você paga o DARF.',
    'Prejuízo abate lucro futuro, mas só do mesmo tipo.',
  ],
  '3.1': [
    'Diversificar faz o problema de uma empresa pesar pouco no total.',
    'Espalhe entre classes, setores e emissores, não só entre empresas.',
    'Ela não elimina o risco de mercado, que atinge tudo junto.',
  ],
  '3.2': [
    'Seu perfil depende do prazo, do objetivo e da reserva, não só da coragem.',
    'Quem precisa do dinheiro logo pode ser forçado a vender na baixa.',
    'Mais risco só abre a chance de retorno maior, não a garante.',
  ],
  '3.3': [
    'Compare produtos pelo que sobra no bolso depois do imposto.',
    'A taxa bruta equivalente permite comparar produto isento com tributado.',
    'Olhe também prazo, liquidez, emissor e FGC.',
  ],
  'vieses-e-emocao': [
    'Medo e pressa fazem vender o que ganha e segurar o que perde.',
    'O preço que você pagou não entra na conta do mercado.',
    'Regras criadas antes do susto protegem você de si mesmo.',
  ],
  '3.4': [
    'Juros em alta derrubam o prefixado e favorecem o pós-fixado.',
    'Ações e FIIs reagem de jeitos diferentes, sem regra fixa.',
    'Uma carteira mista não depende de um só cenário.',
  ],
  'orcamento-para-onde-vai': [
    'O que limita seu aporte é a sobra do mês, não a renda.',
    'Despesas fixas, variáveis e sazonais: não esqueça as que vêm de vez em quando.',
    'Pague-se primeiro: separe o aporte assim que o salário cair.',
  ],
  'divida-os-juros-do-outro-lado': [
    'Juros compostos também trabalham contra quem deve.',
    'Rotativo e cheque especial estão entre os créditos mais caros.',
    'Dívida cara primeiro, investimento depois.',
  ],
}
