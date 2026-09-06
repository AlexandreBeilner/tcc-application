import { randomUUID } from 'node:crypto'
import { createDb } from './client'
import { lessons } from './schema'
import type { MicroDecisionType } from '../modules/lessons/domain/lesson'

interface LessonSeed {
  code: string
  trackNumber: number
  trackName: string
  sortOrder: number
  title: string
  centralConcept: string
  // Conteúdo pedagógico real por passo (tarefa 7.0.2) — string vazia/
  // 'reflection' pra lição ainda não autorada (autoria é a 7.1), não é
  // placeholder: é literalmente o default da migration 0010.
  scenarioText: string
  microDecisionPrompt: string
  microDecisionType: MicroDecisionType
  microDecisionAssetTicker: string | null
  revelationText: string
  unlocksDescription: string | null
  unlocksKeys: string[]
  unlocksAssetTicker: string | null
}

// Currículo (tarefa 7.1, spec seção 5.1) — 33 lições no total, autoradas
// bloco a bloco (7.1.1 a 7.1.6). `onConflictDoUpdate` abaixo garante que
// completar um bloco novo também *atualiza* o conteúdo de lições já
// seedadas em sessões anteriores (ex: 0.1–0.5/1.1 vinham só com
// `centralConcept`/`unlocksDescription` da 5.6), não só insere as que
// faltam. `1.2` (Tesouro Selic) foi a exceção deliberada da tarefa 7.0.2:
// conteúdo pedagógico completo, escrito pra provar o pipeline
// schema→API→tela (scenarioText/microDecisionPrompt/revelationText reais +
// unlocksAssetTicker/"Comprar agora") ponta a ponta antes da autoria em
// massa — mantido aqui como está.
const LESSON_SEEDS: LessonSeed[] = [
  {
    code: '0.1',
    trackNumber: 0,
    trackName: 'Trilha 0: Fundamentos',
    sortOrder: 1,
    title: 'O que é investir',
    centralConcept: 'Investir vs poupar; capital trabalhando para você',
    scenarioText:
      'Você recebe R$1.000 de bônus. Duas opções: deixar parado na conta corrente até precisar, ou aplicar ' +
      'esse dinheiro em algo que devolve mais do que você colocou, com o tempo. A diferença entre guardar e ' +
      'investir é justamente essa: guardar preserva o valor nominal; investir coloca esse capital pra ' +
      'trabalhar, gerando um retorno que se soma a ele.',
    microDecisionPrompt:
      'Antes de continuar, pense: se você tivesse esse R$1.000 de bônus agora, deixaria parado ou aplicaria ' +
      'em algo que rende? O que te faria escolher um ou outro?',
    microDecisionType: 'reflection',
    microDecisionAssetTicker: null,
    revelationText:
      'Investir é ceder o uso do seu capital, hoje, a alguém (governo, banco, empresa) em troca de uma ' +
      'remuneração por esse tempo e esse risco. Nesta plataforma, cada trilha que você completa desbloqueia ' +
      'uma forma real de fazer isso: renda fixa primeiro (Trilha 1), mais previsível; depois renda variável ' +
      '(Trilha 2), com risco e potencial de retorno maiores. Completar esta lição libera seu Portfólio de ' +
      'verdade, com R$10.000 de capital inicial pra você aplicar o que vai aprender.',
    unlocksDescription: 'Acesso ao Portfólio',
    unlocksKeys: ['portfolio'],
    unlocksAssetTicker: null,
  },
  {
    code: '0.2',
    trackNumber: 0,
    trackName: 'Trilha 0: Fundamentos',
    sortOrder: 2,
    title: 'Juros simples vs compostos',
    centralConcept: 'Crescimento linear vs exponencial (TCC cap. 2.1.1)',
    scenarioText:
      'R$1.000 aplicados a 10% ao ano, por 20 anos: quanto isso vira depende de uma escolha que parece só ' +
      'técnica, mas muda tudo: o dinheiro rende sempre sobre o capital original (juros simples) ou sobre o ' +
      'saldo já com os juros anteriores embutidos (juros compostos)?',
    microDecisionPrompt:
      'Use a calculadora abaixo com o mesmo capital e o mesmo aporte mensal, alternando entre os modos ' +
      'Simples e Composto, e compare o total ao final do período antes de continuar.',
    microDecisionType: 'growth_calculator',
    microDecisionAssetTicker: null,
    revelationText:
      'No regime simples, o montante cresce de forma linear: M = C × (1 + i × n). No composto, cada período ' +
      'rende sobre o saldo já capitalizado: M = C × (1 + i)ⁿ. No curto prazo a diferença é pequena; em ' +
      'horizontes longos ela explode. É a mesma taxa produzindo curvas completamente diferentes. É por isso ' +
      'que todo investimento real (Tesouro, CDB, ações) trabalha no regime composto, e por isso quanto mais ' +
      'cedo você começa, maior o efeito.',
    unlocksDescription: 'Calculadora Financeira',
    unlocksKeys: ['calculator'],
    unlocksAssetTicker: null,
  },
  {
    code: '0.3',
    trackNumber: 0,
    trackName: 'Trilha 0: Fundamentos',
    sortOrder: 3,
    title: 'Inflação e poder de compra',
    centralConcept: 'Por que R$100 hoje ≠ R$100 amanhã',
    scenarioText:
      'Hoje, R$100 compram um certo cesto de compras. Daqui a um ano, com a inflação corroendo os preços, ' +
      'esse mesmo cesto custa mais, e os mesmos R$100 já não compram tudo o que compravam antes.',
    microDecisionPrompt:
      'Se a inflação de um ano for 5%, quanto vai custar, no ano que vem, algo que custa R$100 hoje?',
    microDecisionType: 'reflection',
    microDecisionAssetTicker: null,
    revelationText:
      'R$105: o valor nominal do seu dinheiro continua sendo R$100, mas o poder de compra desse dinheiro ' +
      'caiu. Por isso todo retorno de investimento precisa ser lido junto com a inflação do período: um ' +
      'retorno nominal positivo pode, na prática, significar perda de poder de compra se a inflação foi ' +
      'maior. Esse é o conceito que a próxima lição formaliza como rendimento real.',
    unlocksDescription: null,
    unlocksKeys: [],
    unlocksAssetTicker: null,
  },
  {
    code: '0.4',
    trackNumber: 0,
    trackName: 'Trilha 0: Fundamentos',
    sortOrder: 4,
    title: 'Rendimento nominal vs real',
    centralConcept: 'Descontar a inflação do retorno',
    scenarioText:
      'Um CDB rendeu 8% em um ano, parece um bom retorno. Mas nesse mesmo ano a inflação (IPCA) foi de 6%. ' +
      'Quanto sobrou de fato desse 8%, depois de descontar a inflação?',
    microDecisionPrompt:
      'Rendimento real é, aproximadamente, rendimento nominal menos inflação. Nesse exemplo (8% nominal, 6% ' +
      'de inflação), o rendimento real fica perto de quanto?',
    microDecisionType: 'reflection',
    microDecisionAssetTicker: null,
    revelationText:
      'Perto de 2%. A aproximação nominal − inflação já dá uma boa noção, mas a conta exata (equação de ' +
      'Fisher) é (1 + nominal) / (1 + inflação) − 1 = (1,08 / 1,06) − 1 ≈ 1,89%, sempre um pouco menor que a ' +
      'aproximação simples. Quanto maior a inflação do período, maior essa diferença. Todo indicador de ' +
      'investimento nesta plataforma é nominal; comparar dois produtos exige olhar a mesma inflação pros dois.',
    unlocksDescription: null,
    unlocksKeys: [],
    unlocksAssetTicker: null,
  },
  {
    code: '0.5',
    trackNumber: 0,
    trackName: 'Trilha 0: Fundamentos',
    sortOrder: 5,
    title: 'Por que a poupança geralmente perde',
    centralConcept: 'Comparação direta poupança vs Selic/CDI',
    scenarioText:
      'A poupança é o investimento mais popular do Brasil, mas quase sempre perde da Selic (e do CDI, que a ' +
      'acompanha de perto). A regra da poupança é fixa: com a Selic acima de 8,5% ao ano, ela rende 0,5% ao ' +
      'mês + TR; abaixo disso, rende 70% da Selic + TR.',
    microDecisionPrompt:
      'Com a Selic simulada nesta plataforma rodando acima de 8,5% ao ano, a poupança rende 0,5% ao mês, ' +
      'cerca de 6,17% ao ano em juros compostos. Isso é maior, menor ou igual ao que rende um Tesouro Selic, ' +
      'que acompanha ~100% da Selic?',
    microDecisionType: 'reflection',
    microDecisionAssetTicker: null,
    revelationText:
      'Menor: sempre que a Selic está acima de 8,5% a.a. (o cenário mais comum), a poupança rende uma ' +
      'fração fixa (0,5% a.m.) que fica abaixo dos 100% da Selic que o Tesouro Selic paga. É por isso que a ' +
      'poupança "geralmente perde": ela não acompanha a taxa básica de juros, só uma regra fixa desenhada ' +
      'pra ficar sempre um pouco atrás dela. A partir de agora, a Trilha 1 (Renda Fixa) está liberada. É lá ' +
      'que você vai aplicar de verdade os produtos que substituem a poupança.',
    unlocksDescription: 'Acesso à Trilha 1 (Renda Fixa)',
    // Chave vazia de propósito: o acesso à Trilha 1 já funciona via
    // sortOrder (5.6), não é uma chave de unlocksKeys — ver vocabulário
    // fixo da 7.0.1 (só feature/produto, não lição/trilha).
    unlocksKeys: [],
    unlocksAssetTicker: null,
  },
  {
    code: '1.1',
    trackNumber: 1,
    trackName: 'Trilha 1: Renda Fixa',
    sortOrder: 6,
    title: 'O que é renda fixa',
    centralConcept: 'Emprestar dinheiro a um emissor',
    scenarioText:
      'Imagine emprestar R$1.000 a um amigo, sabendo desde o início a taxa e o prazo em que ele ' +
      'devolve o dinheiro, com juros. É exatamente essa lógica que sustenta toda a renda fixa: o ' +
      'investidor empresta dinheiro a um emissor (governo, banco ou empresa) e recebe de volta o ' +
      'capital mais uma remuneração, seguindo uma regra combinada no momento da aplicação.',
    microDecisionPrompt:
      '"Renda fixa" não significa necessariamente "taxa fixa". Pense: um título cuja remuneração ' +
      'acompanha a Selic todo dia, sem taxa travada na compra, ainda é considerado renda fixa?',
    microDecisionType: 'reflection',
    microDecisionAssetTicker: null,
    revelationText:
      'Sim. O nome "renda fixa" se refere à regra de remuneração ser conhecida com antecedência ' +
      '(pós-fixada, acompanhando um indexador como a Selic ou o CDI, ou prefixada, com taxa ' +
      'travada na compra), não ao valor final recebido ser fixo. É essa regra combinada de ' +
      'antemão que diferencia a renda fixa da renda variável (Trilha 2), onde o retorno depende ' +
      'do preço de mercado do ativo e não é conhecido com antecedência. Ao longo desta trilha ' +
      'você vai conhecer os três emissores possíveis (governo via Tesouro Direto, bancos via ' +
      'CDB/LCI/LCA, empresas via CRI/CRA) e a taxa real de cada produto.',
    unlocksDescription: 'Tesouro Selic',
    // `asset:tesouro_selic` pertence de fato à lição 1.2 (spec 5.1, ver
    // backlog 7.0.1). 1.1 é só conceitual, unlocksDescription acima é
    // decorativo.
    unlocksKeys: [],
    unlocksAssetTicker: null,
  },
  {
    code: '1.2',
    trackNumber: 1,
    trackName: 'Trilha 1: Renda Fixa',
    sortOrder: 7,
    title: 'Tesouro Selic',
    centralConcept: 'Emprestar dinheiro ao governo, com liquidez diária e risco de crédito mínimo',
    scenarioText:
      'Você tem R$1.000 parados e quer emprestar esse dinheiro para o Tesouro Nacional, ' +
      'recebendo de volta o valor corrigido pela taxa Selic todo dia útil. É exatamente isso ' +
      'que o Tesouro Selic (LFT) faz: um título público pós-fixado, o mais líquido e o mais ' +
      'indicado para reserva de emergência.',
    microDecisionPrompt:
      'Antes de ver o preço de hoje, pense: se a Selic sobe, o que acontece com o preço ' +
      'unitário do Tesouro Selic: ele sobe, cai ou fica igual?',
    microDecisionType: 'reflection',
    microDecisionAssetTicker: null,
    revelationText:
      'O preço unitário do Tesouro Selic sobe (quase) todo dia útil, acompanhando de perto a ' +
      'taxa Selic, diferente do Tesouro Prefixado/IPCA+, que sofre marcação a mercado negativa ' +
      'com mais frequência. É por isso que a spec do TCC (cap. 3) o trata como o "porto seguro" ' +
      'da renda fixa: baixíssima volatilidade, resgate diário sem perda relevante de valor.',
    unlocksDescription: 'Compra real de Tesouro Selic (LFT2029) no Mercado',
    unlocksKeys: ['asset:tesouro_selic'],
    // Ticker canônico real do catálogo (engine/cmd/seed/main.go, tarefa 3.9)
    // — usado pelo CTA "Comprar agora" do passo Desbloqueio.
    unlocksAssetTicker: 'LFT2029',
  },
  {
    code: '1.3',
    trackNumber: 1,
    trackName: 'Trilha 1: Renda Fixa',
    sortOrder: 8,
    title: 'CDB e o CDI',
    centralConcept: 'Remuneração bancária atrelada ao CDI, com garantia do FGC',
    scenarioText:
      'Um banco precisa captar dinheiro pra emprestar a outros clientes, e paga por isso: o CDB ' +
      '(Certificado de Depósito Bancário) é você emprestando dinheiro ao banco em troca de uma ' +
      'remuneração, geralmente um percentual do CDI (taxa que acompanha de perto a Selic). O CDB ' +
      'Banco Invest 2027 (CDB2027), por exemplo, paga 12,00% ao ano.',
    microDecisionPrompt:
      'Diferente do Tesouro Selic (risco de crédito do governo, o mais baixo que existe), o CDB ' +
      'tem risco de crédito do banco emissor. O que protege o investidor se esse banco quebrar?',
    microDecisionType: 'reflection',
    microDecisionAssetTicker: null,
    revelationText:
      'O FGC (Fundo Garantidor de Créditos) cobre CDB, LCI e LCA em até R$250.000,00 por CPF e ' +
      'por instituição financeira, mesmo que o banco emissor quebre. É essa garantia que torna o ' +
      'CDB praticamente tão seguro quanto o Tesouro Direto até esse limite, permitindo que bancos ' +
      'menores paguem taxas mais altas (mais do CDI) que os grandes bancos pra atrair o mesmo ' +
      'investidor. Completar esta lição libera a compra real do CDB2027 no Mercado.',
    unlocksDescription: 'Compra real de CDB (CDB2027) no Mercado',
    unlocksKeys: ['asset:cdb'],
    unlocksAssetTicker: 'CDB2027',
  },
  {
    code: '1.4',
    trackNumber: 1,
    trackName: 'Trilha 1: Renda Fixa',
    sortOrder: 9,
    title: 'Tributação regressiva de IR',
    centralConcept: 'Tabela regressiva de Imposto de Renda: quanto mais tempo, menor a alíquota',
    scenarioText:
      'Um investimento em CDB rendeu R$1.000 de lucro. Antes de cair na conta, uma parte desse ' +
      'lucro vai pro Imposto de Renda, e a alíquota depende de quanto tempo o dinheiro ficou ' +
      'aplicado, contado em dias corridos desde a aplicação até o resgate.',
    microDecisionPrompt:
      'Resgatando esse CDB com 90 dias corridos de aplicação, a alíquota de IR é maior ou menor ' +
      'do que resgatando o mesmo CDB com 800 dias corridos de aplicação?',
    microDecisionType: 'reflection',
    microDecisionAssetTicker: null,
    revelationText:
      'Maior. A tabela regressiva (Lei 11.033/2004) cobra 22,5% até 180 dias corridos, 20% de ' +
      '181 a 360 dias, 17,5% de 361 a 720 dias e 15% acima de 720 dias. Quanto mais tempo o ' +
      'dinheiro fica aplicado, menor a mordida do IR. O imposto incide só sobre o lucro, nunca ' +
      'sobre o capital aplicado, e essa tabela vale pra todo produto de renda fixa tributado ' +
      '(Tesouro Direto e CDB); LCI, LCA, CRI e CRA são isentos e nunca pagam essa alíquota, como ' +
      'você vai ver nas próximas lições.',
    unlocksDescription: null,
    unlocksKeys: [],
    unlocksAssetTicker: null,
  },
  {
    code: '1.5',
    trackNumber: 1,
    trackName: 'Trilha 1: Renda Fixa',
    sortOrder: 10,
    title: 'LCI e LCA',
    centralConcept: 'Isenção de IR, comparação de retorno líquido entre produtos',
    scenarioText:
      'LCI (Letra de Crédito Imobiliário) e LCA (Letra de Crédito do Agronegócio) financiam, ' +
      'respectivamente, o setor imobiliário e o agronegócio, e têm garantia do FGC igual ao CDB. ' +
      'A diferença que mais chama atenção: o LCI Banco Invest 2026 (LCI2026) paga 9,50% ao ano, ' +
      'abaixo dos 12,00% do CDB2027 (lição anterior). Isso quer dizer que o CDB2027 é sempre a ' +
      'escolha melhor?',
    microDecisionPrompt:
      'LCI e LCA são isentos de Imposto de Renda; o CDB não. Resgatando os dois com só 60 dias ' +
      'corridos de aplicação (alíquota de 22,5% sobre o CDB, lição 1.4), qual rende mais líquido: ' +
      'o LCI a 9,50% isento ou o CDB a 12,00% com IR?',
    microDecisionType: 'reflection',
    microDecisionAssetTicker: null,
    revelationText:
      'O LCI2026 rende mais líquido nesse prazo curto. Pra comparar de forma justa, calcule a ' +
      'taxa bruta equivalente que o CDB precisaria pagar pra empatar com um produto isento: taxa ' +
      'isenta dividida por (1 menos a alíquota). Com 22,5% de IR (até 180 dias), o LCI2026 ' +
      'equivale a um CDB bruto de 9,50% ÷ 0,775 ≈ 12,26% ao ano, acima dos 12,00% do CDB2027: o ' +
      'LCI vence. Mas com 720 dias corridos ou mais, a alíquota cai pra 15%, e o mesmo cálculo dá ' +
      '9,50% ÷ 0,85 ≈ 11,18%, abaixo dos 12,00% do CDB2027: agora o CDB vence. A resposta certa ' +
      'depende do prazo que você pretende manter o dinheiro aplicado, não só da taxa anunciada.',
    unlocksDescription: 'Compra real de LCI (LCI2026) e LCA (LCA2026) no Mercado',
    unlocksKeys: ['asset:lci', 'asset:lca'],
    unlocksAssetTicker: 'LCI2026',
  },
  {
    code: '1.6',
    trackNumber: 1,
    trackName: 'Trilha 1: Renda Fixa',
    sortOrder: 11,
    title: 'Tesouro Prefixado',
    centralConcept: 'Deságio: preço menor que o valor de face, taxa travada na compra',
    scenarioText:
      'O Tesouro Prefixado 2027 (LTN2027) promete pagar R$1.000,00 no vencimento, mas você não ' +
      'paga R$1.000,00 por ele hoje: você paga menos, e a diferença (o deságio) é a fonte da sua ' +
      'rentabilidade. A taxa contratada na compra fica travada até o vencimento, 11,75% ao ano ' +
      'nesse título.',
    microDecisionPrompt:
      'Supondo que faltem exatamente 504 dias úteis (2 anos) até o vencimento, o preço de compra ' +
      'do LTN2027 hoje deveria ficar acima ou abaixo de R$1.000,00?',
    microDecisionType: 'reflection',
    microDecisionAssetTicker: null,
    revelationText:
      'Abaixo. A fórmula de deságio é Preço = Valor Nominal ÷ (1 + Taxa)^(DU/252): com taxa de ' +
      '11,75% ao ano e 504 dias úteis (dois anos) restantes, Preço = 1.000 ÷ (1,1175)² ≈ ' +
      'R$800,76. Você paga R$800,76 hoje e recebe R$1.000,00 no vencimento, uma diferença de ' +
      'R$199,24 que é exatamente a sua rentabilidade contratada. Diferente do Tesouro Selic, essa ' +
      'taxa fica travada: se a Selic subir ou cair depois da compra, o valor recebido no ' +
      'vencimento não muda, mas o preço de venda antes do vencimento sim, como a próxima lição ' +
      'mostra.',
    unlocksDescription: 'Compra real de Tesouro Prefixado (LTN2027) no Mercado',
    unlocksKeys: ['asset:tesouro_prefixado'],
    unlocksAssetTicker: 'LTN2027',
  },
  {
    code: '1.7',
    trackNumber: 1,
    trackName: 'Trilha 1: Renda Fixa',
    sortOrder: 12,
    title: 'Marcação a mercado',
    centralConcept: 'Risco de vender um título prefixado antes do vencimento',
    scenarioText:
      'Você comprou o LTN2027 (lição anterior) travado a 11,75% ao ano, mas um imprevisto te ' +
      'obriga a resgatar antes do vencimento. Nesse meio tempo, o Copom (simulado nesta ' +
      'plataforma a cada 21 dias reais) subiu a taxa de juros de mercado pra 14% ao ano. O preço ' +
      'de venda do seu título hoje muda por causa disso, mesmo sem nada ter mudado no seu ' +
      'contrato original.',
    microDecisionPrompt:
      'Se a taxa de mercado subiu (de 11,75% pra 14%) desde a sua compra, o preço de revenda do ' +
      'seu título hoje fica acima ou abaixo do que renderia até esse dia na taxa contratada?',
    microDecisionType: 'reflection',
    microDecisionAssetTicker: null,
    revelationText:
      'Abaixo: o preço de qualquer prefixado é recalculado todo dia útil pela mesma fórmula de ' +
      'deságio, só que com a taxa de mercado vigente no lugar da taxa contratada. Taxa de mercado ' +
      'maior gera um preço menor (o denominador da fórmula cresce), então vender antes do ' +
      'vencimento numa alta de juros realiza um retorno pior do que o contratado. O oposto também ' +
      'vale: se a taxa de mercado tivesse caído, o preço subiria e a venda antecipada renderia ' +
      'mais do que o contratado, um ganho extraordinário. Segurar até o vencimento sempre paga ' +
      'exatamente a taxa contratada; vender antes expõe você a esse risco de marcação a mercado, ' +
      'pra cima ou pra baixo. Você pode simular esse cenário sem nenhum risco real no ativo de ' +
      'prática (Sandbox) disponível no Mercado.',
    unlocksDescription: null,
    unlocksKeys: [],
    unlocksAssetTicker: null,
  },
  {
    code: '1.8',
    trackNumber: 1,
    trackName: 'Trilha 1: Renda Fixa',
    sortOrder: 13,
    title: 'Tesouro IPCA+',
    centralConcept: 'Proteção contra inflação: rendimento real garantido acima do IPCA',
    scenarioText:
      'O Tesouro IPCA+ 2035 (NTNB2035) promete um retorno real de 6,00% ao ano, isto é, 6,00% ' +
      'acima da inflação, o que quer que ela seja no período. Isso é possível porque o Valor ' +
      'Nominal Atualizado (VNA) do título é corrigido mês a mês pelo IPCA simulado, e só depois ' +
      'disso a taxa de 6,00% incide sobre esse valor já atualizado.',
    microDecisionPrompt:
      'Se a inflação simulada nesta plataforma rodar mais alta que o previsto ao longo dos anos ' +
      'até o vencimento, o valor final recebido no NTNB2035 aumenta, diminui ou fica igual?',
    microDecisionType: 'reflection',
    microDecisionAssetTicker: null,
    revelationText:
      'Aumenta. Diferente do Tesouro Prefixado (lição 1.6), cujo valor final é sempre R$1.000,00 ' +
      'fixo, o Tesouro IPCA+ tem seu Valor Nominal corrigido mensalmente pela inflação acumulada: ' +
      'quanto maior o IPCA no período, maior o VNA no vencimento, e os 6,00% ao ano incidem sobre ' +
      'esse valor já corrigido, não sobre o valor original. É a lição 0.4 (rendimento nominal vs ' +
      'real) aplicada na prática: aqui o rendimento real já vem garantido por contrato, em vez de ' +
      'precisar ser calculado depois de descontar a inflação.',
    unlocksDescription: 'Compra real de Tesouro IPCA+ (NTNB2035) no Mercado',
    unlocksKeys: ['asset:tesouro_ipca'],
    unlocksAssetTicker: 'NTNB2035',
  },
  {
    code: '1.9',
    trackNumber: 1,
    trackName: 'Trilha 1: Renda Fixa',
    sortOrder: 14,
    title: 'CRI e CRA',
    centralConcept: 'Risco de crédito privado sem FGC, compensado por maior remuneração',
    scenarioText:
      'CRI (Certificado de Recebíveis Imobiliários) e CRA (Certificado de Recebíveis do ' +
      'Agronegócio) são emitidos por securitizadoras, empresas privadas que compram recebíveis ' +
      '(dívidas de terceiros) e os transformam em título negociável. O CRI Securitizadora X 2028 ' +
      '(CRI2028) paga 11,00% ao ano, com classificação de risco AA; o CRA Securitizadora X 2028 ' +
      '(CRA2028) paga 10,50% ao ano, com classificação A.',
    microDecisionPrompt:
      'CDB, LCI e LCA têm garantia do FGC até R$250.000,00 se o emissor quebrar. CRI e CRA, ' +
      'emitidos por uma securitizadora e não por um banco, têm essa mesma garantia?',
    microDecisionType: 'reflection',
    microDecisionAssetTicker: null,
    revelationText:
      'Não. CRI e CRA não têm cobertura do FGC, então o risco de crédito recai inteiramente ' +
      'sobre a capacidade de pagamento da securitizadora emissora, e é por isso que pagam mais ' +
      '(11,00% e 10,50% ao ano, acima da maioria dos CDBs) e trazem uma classificação de risco de ' +
      'crédito (AA pro CRI2028, A pro CRA2028) pro investidor avaliar antes de comprar. Igual ao ' +
      'LCI e LCA, ambos são isentos de Imposto de Renda. Completar esta lição libera a compra ' +
      'real de CRI e CRA e conclui a Trilha 1: a Trilha 2 (Renda Variável) já abre na sequência.',
    unlocksDescription: 'Compra real de CRI/CRA no Mercado, acesso à Trilha 2 (Renda Variável)',
    unlocksKeys: ['asset:cri', 'asset:cra'],
    unlocksAssetTicker: 'CRI2028',
  },
  {
    code: '2.1',
    trackNumber: 2,
    trackName: 'Trilha 2: Renda Variável',
    sortOrder: 15,
    title: 'O que é uma ação',
    centralConcept: 'Comprar uma ação é se tornar sócio de uma empresa',
    scenarioText:
      'Comprar uma ação da Mineradora Vale do Rio (VALR3) não é emprestar dinheiro a ela, como você fez a ' +
      'trilha inteira com Tesouro, CDB e CRI. É comprar uma fração da empresa: você passa a ser sócio, dono ' +
      'de uma parte proporcional do que ela vale e do que ela lucra, junto com todos os outros acionistas.',
    microDecisionPrompt:
      'Na renda fixa (Trilhas 0 e 1), a taxa contratada na compra já diz quanto você vai receber. Comprando ' +
      'uma ação, esse retorno já é conhecido de antemão, do mesmo jeito?',
    microDecisionType: 'reflection',
    microDecisionAssetTicker: null,
    revelationText:
      'Não. Como sócio, seu retorno depende do desempenho da empresa e do preço que o mercado está disposto ' +
      'a pagar pela ação a cada momento: você pode ganhar com a valorização do preço e com dividendos ' +
      '(parte do lucro distribuída aos sócios), mas também pode perder se o preço cair, sem nenhuma garantia ' +
      'de capital ou prazo de vencimento como na renda fixa. É essa incerteza, junto do potencial de retorno ' +
      'maior, que dá nome à renda variável.',
    unlocksDescription: null,
    unlocksKeys: [],
    unlocksAssetTicker: null,
  },
  {
    code: '2.2',
    trackNumber: 2,
    trackName: 'Trilha 2: Renda Variável',
    sortOrder: 16,
    title: 'IPO',
    centralConcept: 'Como uma empresa vai à bolsa',
    scenarioText:
      'Antes de você poder comprar VALR3 ou BNDD4 no Mercado, cada uma dessas empresas precisou abrir seu ' +
      'capital: deixar de ser propriedade de um grupo fechado de donos e passar a vender fatias de si mesma ' +
      'ao público em geral, pela primeira vez, num IPO (Initial Public Offering, oferta pública inicial).',
    microDecisionPrompt:
      'No dia do IPO, a empresa vende ações novas e recebe o dinheiro dessa venda direto no caixa dela. ' +
      'Quando você compra essa mesma ação meses depois, de outro investidor, esse dinheiro também vai para ' +
      'o caixa da empresa?',
    microDecisionType: 'reflection',
    microDecisionAssetTicker: null,
    revelationText:
      'Não. O IPO acontece no mercado primário: a empresa emite ações novas e capitaliza o caixa dela com o ' +
      'dinheiro dos investidores. Depois disso, toda negociação acontece no mercado secundário, entre ' +
      'investidores, sem passar um centavo pro caixa da empresa; é esse mercado secundário que o Mercado ao ' +
      'vivo desta plataforma simula, com o preço se formando a cada negociação, como você vai ver na lição ' +
      'de oferta e demanda.',
    unlocksDescription: null,
    unlocksKeys: [],
    unlocksAssetTicker: null,
  },
  {
    code: '2.3',
    trackNumber: 2,
    trackName: 'Trilha 2: Renda Variável',
    sortOrder: 17,
    title: 'Nomenclatura de tickers',
    centralConcept: 'Final 3 (ON), final 4 (PN), final 11 (units/FII)',
    scenarioText:
      'VALR3 e BNDD4 parecem códigos aleatórios, mas seguem uma convenção: quatro letras identificando o ' +
      'emissor, seguidas de um número que diz que tipo de ação (ou cota) é essa. Reparando nos dois ' +
      'tickers, VALR3 termina em 3 e BNDD4 termina em 4.',
    microDecisionPrompt:
      'VALR3 (Mineradora Vale do Rio) dá direito a voto nas decisões da empresa; BNDD4 (Banco Nordeste ' +
      'Digital) geralmente tem prioridade no recebimento de dividendos, mas sem voto. Qual delas você acha ' +
      'que é a ação ordinária (ON) e qual é a preferencial (PN)?',
    microDecisionType: 'reflection',
    microDecisionAssetTicker: null,
    revelationText:
      'VALR3 (final 3) é ordinária (ON), com direito a voto; BNDD4 (final 4) é preferencial (PN), sem voto ' +
      'mas com prioridade em dividendos e no recebimento de capital numa eventual liquidação da empresa. Já ' +
      'o final 11, como em SINT11 (o ETF que você vai conhecer na lição 2.9), identifica cotas de fundos ou ' +
      'units, uma convenção que também vale pros FIIs da lição 2.10. Completar esta lição libera sua ' +
      'primeira operação real de ações no Mercado.',
    unlocksDescription: 'Primeira compra real de ações (VALR3) no Mercado',
    unlocksKeys: ['asset:acao'],
    unlocksAssetTicker: 'VALR3',
  },
  {
    code: '2.4',
    trackNumber: 2,
    trackName: 'Trilha 2: Renda Variável',
    sortOrder: 18,
    title: 'Lendo notícias de mercado',
    centralConcept: 'Como interpretar um evento macro e decidir',
    scenarioText:
      'Agora que você já pode comprar ações de verdade, o preço delas pode se mover por causa de eventos ' +
      'que não têm nada a ver com você: uma notícia sobre a Selic, um evento específico do setor de ' +
      'mineração ou bancário, algo que muda de uma vez as perspectivas de uma empresa ou de um grupo delas.',
    microDecisionPrompt:
      'Uma notícia dizendo "quebra de safra afeta o Agronegócio" chega no feed. Se você tem ações de uma ' +
      'mineradora (VALR3) e de um banco (BNDD4), essa notícia deveria pesar do mesmo jeito na sua decisão ' +
      'sobre as duas?',
    microDecisionType: 'reflection',
    microDecisionAssetTicker: null,
    revelationText:
      'Não necessariamente: o feed de notícias reporta eventos macro, alguns afetam o mercado inteiro (uma ' +
      'mudança na Selic), outros miram um setor específico (como Agronegócio), sem impactar diretamente uma ' +
      'mineradora ou um banco. Ler cada notícia significa identificar quem ela afeta antes de reagir. Por ' +
      'isso esta lição vem logo depois de você já poder operar de verdade (lição 2.3): a partir de agora, ' +
      'esses eventos passam a valer pra você. Completar esta lição libera o painel de notícias.',
    unlocksDescription: 'Painel de notícias/feed de eventos',
    unlocksKeys: ['news_feed'],
    unlocksAssetTicker: null,
  },
  {
    code: '2.5',
    trackNumber: 2,
    trackName: 'Trilha 2: Renda Variável',
    sortOrder: 19,
    title: 'Oferta e demanda',
    centralConcept: 'Formação de preço no livro de ofertas (TCC cap. 2.3.3)',
    scenarioText:
      'O preço de VALR3 que você vê no Mercado não é definido por ninguém em particular: ele nasce do livro ' +
      'de ofertas (order book), uma lista de ordens de compra (pedindo o preço mais alto que estão dispostos ' +
      'a pagar) e de venda (pedindo o preço mais baixo que estão dispostos a aceitar) pra esse ativo.',
    microDecisionPrompt:
      'Se chegam muito mais ordens de compra do que de venda pra VALR3, todas dispostas a pagar cada vez ' +
      'mais caro pra conseguir comprar, o preço de VALR3 tende a subir, cair ou ficar igual?',
    microDecisionType: 'reflection',
    microDecisionAssetTicker: null,
    revelationText:
      'Tende a subir: o motor de pareamento organiza as ofertas de compra da mais alta pra mais baixa e as ' +
      'de venda da mais baixa pra mais alta, e cada negociação executa no preço de quem já estava no livro ' +
      '(a ordem passiva). Com mais compradores dispostos a pagar mais do que vendedores dispostos a vender, ' +
      'as ofertas de venda mais baratas se esgotam primeiro, e os próximos negócios só fecham em preços mais ' +
      'altos, empurrando o preço pra cima; excesso de venda faz o caminho inverso. É esse mecanismo, e não ' +
      'uma decisão de alguém, que forma o preço em tempo real de toda ação, ETF e FII desta plataforma. A ' +
      'partir da próxima lição, você vai aprender a ler os indicadores fundamentalistas que ajudam a decidir ' +
      'se um preço formado assim está caro ou barato.',
    unlocksDescription: null,
    unlocksKeys: [],
    unlocksAssetTicker: null,
  },
]

// Idempotente: DATABASE_URL=... npm run db:seed:lessons
async function main() {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    console.error('defina DATABASE_URL antes de rodar o seed')
    process.exit(1)
  }

  const db = createDb(databaseUrl)
  for (const seed of LESSON_SEEDS) {
    // `onConflictDoUpdate` (não só `onConflictDoNothing`): a autoria de
    // conteúdo por bloco (7.1.1–7.1.6) precisa *atualizar* lições já
    // seedadas em sessões anteriores com o conteúdo pedagógico novo, não só
    // inserir as que ainda não existem — decisão da introdução da 7.1.
    // `code`/`id` nunca mudam num conflito, o restante do seed sim.
    const [row] = await db
      .insert(lessons)
      .values({ id: randomUUID(), ...seed })
      .onConflictDoUpdate({
        target: lessons.code,
        set: {
          trackNumber: seed.trackNumber,
          trackName: seed.trackName,
          sortOrder: seed.sortOrder,
          title: seed.title,
          centralConcept: seed.centralConcept,
          scenarioText: seed.scenarioText,
          microDecisionPrompt: seed.microDecisionPrompt,
          microDecisionType: seed.microDecisionType,
          microDecisionAssetTicker: seed.microDecisionAssetTicker,
          revelationText: seed.revelationText,
          unlocksDescription: seed.unlocksDescription,
          unlocksKeys: seed.unlocksKeys,
          unlocksAssetTicker: seed.unlocksAssetTicker,
        },
      })
      .returning()
    console.log(row ? `lição ${seed.code} criada/atualizada` : `lição ${seed.code} sem alteração`)
  }
  process.exit(0)
}

main().catch((err) => {
  console.error('erro ao rodar seed de lições:', err)
  process.exit(1)
})
