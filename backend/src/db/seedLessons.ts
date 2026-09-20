import { randomUUID } from 'node:crypto'
import { createDb, type Database } from './client'
import { lessons } from './schema'
import type { MicroDecisionType } from '../modules/lessons/domain/lesson'

export interface LessonSeed {
  // Chave de upsert do seed (tarefa M.6, achado 010) — atribuída uma vez e
  // nunca mais alterada, mesmo que `code` mude numa renumeração futura do
  // currículo. Hoje coincide com `code` porque é o primeiro valor atribuído
  // (snapshot do `code` vigente no momento em que a coluna nasceu); a partir
  // daqui os dois só continuam iguais por coincidência de uma lição nunca
  // ter sido renumerada.
  stableKey: string
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
  // Aposta com acerto/erro real (backlog engajamento B.1/B.4) — preenchidos
  // só nas lições elegíveis (auditoria abaixo, antes de LESSON_SEEDS). `null`
  // nos dois: widget embutido já é a interação (0.2/3.3) ou pergunta aberta
  // de propósito sem resposta certa objetiva (0.1).
  microDecisionOptions: string[] | null
  microDecisionCorrectOption: number | null
  revelationText: string
  unlocksDescription: string | null
  unlocksKeys: string[]
  unlocksAssetTicker: string | null
}

// Currículo (tarefa 7.1, spec seção 5.1) — 35 lições no total (33 originais
// + as 2 da tarefa M.5, `1.3`/`1.9` abaixo), autoradas bloco a bloco (7.1.1
// a 7.1.6, depois M.5). `onConflictDoUpdate` abaixo garante que completar um
// bloco novo também *atualiza* o conteúdo de lições já seedadas em sessões
// anteriores (ex: 0.1–0.5/1.1 vinham só com `centralConcept`/
// `unlocksDescription` da 5.6), não só insere as que faltam. `1.2` (Tesouro
// Selic) foi a exceção deliberada da tarefa 7.0.2: conteúdo pedagógico
// completo, escrito pra provar o pipeline schema→API→tela
// (scenarioText/microDecisionPrompt/revelationText reais +
// unlocksAssetTicker/"Comprar agora") ponta a ponta antes da autoria em
// massa — mantido aqui como está.
//
// Renumeração da tarefa M.5 (Trilha 1 passa de 9 para 11 lições): o `code`
// de 7 lições existentes (`1.3`–`1.9` originais) mudou pra abrir espaço pras
// 2 lições novas, deslocando o conteúdo de cada uma pro `code` seguinte
// (`1.3`→`1.4`, `1.4`→`1.5`, ..., `1.9`→`1.11`). Na época, isso causou o
// achado 010 (`.claude/pontos-em-aberto-decisao-produto.md`, resolvido pela
// tarefa M.6 logo abaixo): o upsert casava por `code`, que nunca entrava no
// `set` — então um reseed reaproveitava a linha física antiga em vez de
// criar linha nova, arrastando `user_lesson_progress` de quem já tinha
// progresso real pra um conteúdo diferente do que ele viu. A M.6 trocou a
// chave de casamento pra `stableKey` (imutável, ver campo acima) e passou a
// incluir `code` no `set` — o cenário deste parágrafo não se repete em
// nenhuma renumeração futura.
//
// Auditoria de aposta com acerto/erro real (backlog engajamento B.4): das 33
// lições originais, 3 ficaram sem opções reais (microDecisionOptions/
// microDecisionCorrectOption = null, mantêm o checkbox "já pensei" de hoje)
// e 30 ganharam. O critério de elegibilidade não é "microDecisionType =
// reflection" (como o texto original da tarefa supunha) e sim "o passo
// Micro-decisão hoje mostra o checkbox" — que também vale pras 6 lições
// `live_indicator` (2.6.1–2.6.6) e, desde a M.5, pras 2 `live_macro_indicator`
// (1.3/1.9) abaixo, já que `EMBEDDED_WIDGET_TYPES`
// (`frontend/src/pages/Lesson/index.tsx`) só cobre `growth_calculator`/
// `fixed_income_comparison`. Achado de auditoria corrigindo a suposição
// original da B.4.
//
// Fora (3, justificativa por linha):
//   0.1    — pergunta é sobre motivação pessoal ("o que te faria escolher"),
//            não fato verificável; forçar múltipla escolha destruiria o
//            propósito deliberado da pergunta aberta (citado no texto
//            original desta tarefa como o exemplo a preservar).
//   0.2    — `growth_calculator`: o widget embutido já é a interação real.
//   3.3    — `fixed_income_comparison`: mesmo motivo da 0.2.
//
// Dentro (32 — 30 originais + as 2 novas da M.5) — índice da opção correta
// entre colchetes, conferido contra o veredito de `revelationText` de cada
// lição, já nos códigos renumerados pela M.5:
//   0.3 [2] 0.4 [0] 0.5 [1] 1.1 [0] 1.2 [0] 1.3 [0] 1.4 [0] 1.5 [0] 1.6 [0]
//   1.7 [1] 1.8 [1] 1.9 [1] 1.10 [0] 1.11 [1] 2.1 [1] 2.2 [1] 2.3 [0] 2.4 [1]
//   2.5 [0] 2.6.1 [0] 2.6.2 [1] 2.6.3 [0] 2.6.4 [0] 2.6.5 [1] 2.6.6 [1]
//   2.7 [0] 2.8 [1] 2.9 [1] 2.10 [1] 3.1 [0] 3.2 [0] 3.4 [3]
// A maioria (yes/no, maior/menor, sobe/desce/igual) reaproveita literalmente
// as alternativas que o próprio `microDecisionPrompt` já enumera em texto —
// não inventa vocabulário novo. Exceções que combinam duas leituras numa
// opção só: 2.3 (ON/PN de BNDD3 e BNDD4 juntos, pergunta original já pede os
// dois), 3.4 (efeito nos fundamentos + o que acontece com o Tesouro Selic,
// desafio final da trilha sintetizando 2.8+3.2 — 4 combinações possíveis,
// só uma bate com o texto de `revelationText`).
const LESSON_SEEDS: LessonSeed[] = [
  {
    stableKey: '0.1',
    code: '0.1',
    trackNumber: 0,
    trackName: 'Trilha 0: Fundamentos',
    sortOrder: 1,
    title: 'O que é investir',
    centralConcept: 'Investir vs poupar; capital trabalhando para você',
    scenarioText:
      'Você recebe R$1.000 de bônus. Duas opções: deixar parado na conta corrente até precisar, ou aplicar ' +
      'esse dinheiro em algo que devolve mais do que você colocou, com o tempo.' +
      '\n\n' +
      'Essa é a trilha que responde, na prática, por que o destino automático desse tipo de dinheiro (a ' +
      'poupança, pra quase todo mundo) geralmente deixa valor na mesa, e deixa você pronto pra escolher ' +
      'diferente assim que ela terminar.' +
      '\n\n' +
      'A diferença entre guardar e investir é justamente essa: guardar preserva o valor nominal; investir ' +
      'coloca esse capital pra trabalhar, gerando um retorno que se soma a ele.',
    microDecisionPrompt:
      'Antes de continuar, pense: se você tivesse esse R$1.000 de bônus agora, deixaria parado ou aplicaria ' +
      'em algo que rende? O que te faria escolher um ou outro?',
    microDecisionType: 'reflection',
    microDecisionAssetTicker: null,
    microDecisionOptions: null,
    microDecisionCorrectOption: null,
    revelationText:
      'Investir é ceder o uso do seu capital, hoje, a alguém (governo, banco, empresa) em troca de uma ' +
      'remuneração por esse tempo e esse risco.' +
      '\n\n' +
      'Nesta plataforma, cada trilha que você completa desbloqueia uma forma real de fazer isso: renda fixa ' +
      'primeiro (Trilha 1), mais previsível; depois renda variável (Trilha 2), com risco e potencial de ' +
      'retorno maiores.' +
      '\n\n' +
      'Completar esta lição libera seu Portfólio de verdade, com R$10.000 de capital inicial pra você aplicar ' +
      'o que vai aprender.',
    unlocksDescription: 'Acesso ao Portfólio',
    unlocksKeys: ['portfolio'],
    unlocksAssetTicker: null,
  },
  {
    stableKey: '0.2',
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
    microDecisionOptions: null,
    microDecisionCorrectOption: null,
    revelationText:
      'No regime simples, o montante cresce de forma linear: M = C × (1 + i × n).' +
      '\n\n' +
      'No composto, cada período rende sobre o saldo já capitalizado: M = C × (1 + i)ⁿ.' +
      '\n\n' +
      'No curto prazo a diferença é pequena; em horizontes longos ela explode. É a mesma taxa produzindo ' +
      'curvas completamente diferentes.' +
      '\n\n' +
      'É por isso que todo investimento real (Tesouro, CDB, ações) trabalha no regime composto, e por isso ' +
      'quanto mais cedo você começa, maior o efeito.',
    unlocksDescription: 'Calculadora Financeira',
    unlocksKeys: ['calculator'],
    unlocksAssetTicker: null,
  },
  {
    stableKey: '0.3',
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
    microDecisionOptions: ['R$95', 'R$100', 'R$105', 'R$110'],
    microDecisionCorrectOption: 2,
    revelationText:
      'R$105: o valor nominal do seu dinheiro continua sendo R$100, mas o poder de compra desse dinheiro ' +
      'caiu.' +
      '\n\n' +
      'Por isso todo retorno de investimento precisa ser lido junto com a inflação do período: um retorno ' +
      'nominal positivo pode, na prática, significar perda de poder de compra se a inflação foi maior.' +
      '\n\n' +
      'Esse é o conceito que a próxima lição formaliza como rendimento real.',
    unlocksDescription: null,
    unlocksKeys: [],
    unlocksAssetTicker: null,
  },
  {
    stableKey: '0.4',
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
    microDecisionOptions: ['Perto de 2%', 'Exatamente 8%', 'Perto de 14%', 'Perto de 6%'],
    microDecisionCorrectOption: 0,
    revelationText:
      'Perto de 2%.' +
      '\n\n' +
      'A aproximação nominal − inflação já dá uma boa noção, mas a conta exata (equação de Fisher) é ' +
      '(1 + nominal) / (1 + inflação) − 1 = (1,08 / 1,06) − 1 ≈ 1,89%, sempre um pouco menor que a ' +
      'aproximação simples.' +
      '\n\n' +
      'Quanto maior a inflação do período, maior essa diferença. Todo indicador de investimento nesta ' +
      'plataforma é nominal; comparar dois produtos exige olhar a mesma inflação pros dois.',
    unlocksDescription: null,
    unlocksKeys: [],
    unlocksAssetTicker: null,
  },
  {
    stableKey: '0.5',
    code: '0.5',
    trackNumber: 0,
    trackName: 'Trilha 0: Fundamentos',
    sortOrder: 5,
    title: 'Por que a poupança geralmente perde',
    centralConcept: 'Comparação direta poupança vs Selic/CDI',
    scenarioText:
      'A poupança é o investimento mais popular do Brasil, mas quase sempre perde da Selic (e do CDI, que a ' +
      'acompanha de perto).' +
      '\n\n' +
      'A regra da poupança é fixa: com a Selic acima de 8,5% ao ano, ela rende 0,5% ao mês + TR; abaixo ' +
      'disso, rende 70% da Selic + TR.',
    microDecisionPrompt:
      'Com a Selic simulada nesta plataforma rodando acima de 8,5% ao ano, a poupança rende 0,5% ao mês, ' +
      'cerca de 6,17% ao ano em juros compostos.' +
      '\n\n' +
      'Isso é maior, menor ou igual ao que rende um Tesouro Selic, que acompanha ~100% da Selic?',
    microDecisionType: 'reflection',
    microDecisionAssetTicker: null,
    microDecisionOptions: ['Maior', 'Menor', 'Igual'],
    microDecisionCorrectOption: 1,
    revelationText:
      'Menor: sempre que a Selic está acima de 8,5% a.a. (o cenário mais comum), a poupança rende uma ' +
      'fração fixa (0,5% a.m.) que fica abaixo dos 100% da Selic que o Tesouro Selic paga.' +
      '\n\n' +
      'É por isso que a poupança "geralmente perde": ela não acompanha a taxa básica de juros, só uma regra ' +
      'fixa desenhada pra ficar sempre um pouco atrás dela.' +
      '\n\n' +
      'A partir de agora, a Trilha 1 (Renda Fixa) está liberada. É lá que você vai aplicar de verdade os ' +
      'produtos que substituem a poupança.',
    unlocksDescription:
      'Confirmação de que a poupança perde da Selic, e acesso à Trilha 1 (Renda Fixa)',
    // Chave vazia de propósito: o acesso à Trilha 1 já funciona via
    // sortOrder (5.6), não é uma chave de unlocksKeys — ver vocabulário
    // fixo da 7.0.1 (só feature/produto, não lição/trilha).
    unlocksKeys: [],
    unlocksAssetTicker: null,
  },
  {
    stableKey: '1.1',
    code: '1.1',
    trackNumber: 1,
    trackName: 'Trilha 1: Renda Fixa',
    sortOrder: 6,
    title: 'O que é renda fixa',
    centralConcept: 'Emprestar dinheiro a um emissor',
    scenarioText:
      'Imagine emprestar R$1.000 a um amigo, sabendo desde o início a taxa e o prazo em que ele ' +
      'devolve o dinheiro, com juros.' +
      '\n\n' +
      'É exatamente essa lógica que sustenta toda a renda fixa: o investidor empresta dinheiro a um ' +
      'emissor (governo, banco ou empresa) e recebe de volta o capital mais uma remuneração, ' +
      'seguindo uma regra combinada no momento da aplicação.' +
      '\n\n' +
      'É a ferramenta certa pra um objetivo bem concreto.' +
      '\n\n' +
      'Ao longo desta trilha, você vai montar uma reserva de emergência de verdade (o dinheiro que ' +
      'precisa estar seguro e disponível antes de qualquer imprevisto, o mesmo tipo de bônus da ' +
      'lição 0.1, agora com destino definido) e vai sair dela sabendo em qual produto colocá-la.',
    microDecisionPrompt:
      '"Renda fixa" não significa necessariamente "taxa fixa". Pense: um título cuja remuneração ' +
      'acompanha a Selic todo dia, sem taxa travada na compra, ainda é considerado renda fixa?',
    microDecisionType: 'reflection',
    microDecisionAssetTicker: null,
    microDecisionOptions: ['Sim', 'Não'],
    microDecisionCorrectOption: 0,
    revelationText:
      'Sim. O nome "renda fixa" se refere à regra de remuneração ser conhecida com antecedência ' +
      '(pós-fixada, acompanhando um indexador como a Selic ou o CDI, ou prefixada, com taxa ' +
      'travada na compra), não ao valor final recebido ser fixo.' +
      '\n\n' +
      'É essa regra combinada de antemão que diferencia a renda fixa da renda variável (Trilha 2), ' +
      'onde o retorno depende do preço de mercado do ativo e não é conhecido com antecedência.' +
      '\n\n' +
      'Ao longo desta trilha você vai conhecer os três emissores possíveis (governo via Tesouro ' +
      'Direto, bancos via CDB/LCI/LCA, empresas via CRI/CRA) e a taxa real de cada produto.',
    unlocksDescription: 'Tesouro Selic',
    // `asset:tesouro_selic` pertence de fato à lição 1.2 (spec 5.1, ver
    // backlog 7.0.1). 1.1 é só conceitual, unlocksDescription acima é
    // decorativo.
    unlocksKeys: [],
    unlocksAssetTicker: null,
  },
  {
    stableKey: '1.2',
    code: '1.2',
    trackNumber: 1,
    trackName: 'Trilha 1: Renda Fixa',
    sortOrder: 7,
    title: 'Tesouro Selic',
    centralConcept: 'Emprestar dinheiro ao governo, com liquidez diária e risco de crédito mínimo',
    scenarioText:
      'Você tem R$1.000 parados e quer emprestar esse dinheiro para o Tesouro Nacional, ' +
      'recebendo de volta o valor corrigido pela taxa Selic todo dia útil.' +
      '\n\n' +
      'É exatamente isso que o Tesouro Selic (LFT) faz: um título público pós-fixado, o mais ' +
      'líquido e o mais indicado para reserva de emergência.',
    microDecisionPrompt:
      'Antes de ver o preço de hoje, pense: se a Selic sobe, o que acontece com o preço ' +
      'unitário do Tesouro Selic: ele sobe, cai ou fica igual?',
    microDecisionType: 'reflection',
    microDecisionAssetTicker: null,
    microDecisionOptions: ['Sobe', 'Cai', 'Fica igual'],
    microDecisionCorrectOption: 0,
    revelationText:
      'O preço unitário do Tesouro Selic sobe (quase) todo dia útil, acompanhando de perto a ' +
      'taxa Selic, diferente do Tesouro Prefixado/IPCA+, que sofre {{marcação a mercado}} negativa ' +
      'com mais frequência.' +
      '\n\n' +
      'É por isso que a spec do TCC (cap. 3) o trata como o "porto seguro" da renda fixa: ' +
      'baixíssima volatilidade, resgate diário sem perda relevante de valor.',
    unlocksDescription: 'Compra real de Tesouro Selic (LFT2029) no Mercado',
    unlocksKeys: ['asset:tesouro_selic'],
    // Ticker canônico real do catálogo (engine/cmd/seed/main.go, tarefa 3.9)
    // — usado pelo CTA "Comprar agora" do passo Desbloqueio.
    unlocksAssetTicker: 'LFT2029',
  },
  {
    stableKey: '1.3',
    code: '1.3',
    trackNumber: 1,
    trackName: 'Trilha 1: Renda Fixa',
    sortOrder: 8,
    title: 'Como a Selic é formada',
    centralConcept: 'Reunião periódica do Copom reagindo ao desvio do IPCA frente à meta',
    scenarioText:
      'A lição anterior mostrou que o Tesouro Selic rende acompanhando a taxa Selic, mas essa taxa não ' +
      'sai do nada: ela é decidida periodicamente pelo Copom (Comitê de Política Monetária do Banco ' +
      'Central), reunido a cada 21 dias simulados nesta plataforma.' +
      '\n\n' +
      'Em cada reunião, a taxa não muda de qualquer jeito: ela reage principalmente a uma pergunta — a ' +
      'inflação (IPCA) está rodando acima ou abaixo da meta?',
    microDecisionPrompt:
      'Se o IPCA acumulado em 12 meses estiver rodando acima da meta numa reunião do Copom simulado, ' +
      'você espera que a Selic suba, desça ou fique igual nessa reunião?',
    microDecisionType: 'live_macro_indicator',
    microDecisionAssetTicker: null,
    microDecisionOptions: ['Sobe', 'Desce', 'Fica igual'],
    microDecisionCorrectOption: 0,
    revelationText:
      'Sobe. A regra de reação simulada (uma versão simplificada da regra de Taylor) soma três forças: ' +
      'uma reversão à taxa neutra de longo prazo, um termo proporcional ao desvio do IPCA acumulado ' +
      'frente à meta, e um ruído aleatório pequeno.' +
      '\n\n' +
      'Quanto mais a inflação passa da meta, maior a pressão pra subir a taxa; abaixo da meta, a pressão ' +
      'vai na direção contrária.' +
      '\n\n' +
      'O resultado é sempre arredondado pro múltiplo mais próximo de 0,25 ponto percentual (o mesmo passo ' +
      'do Copom real, nunca uma casa decimal solta), e a Selic simulada nunca fica negativa.' +
      '\n\n' +
      'É por isso que a taxa fica parada entre uma reunião e outra: ela só muda nesses dias específicos, ' +
      'não dia a dia. Veja abaixo o valor atual da Selic simulada e em quantos dias sai a próxima decisão.',
    unlocksDescription: null,
    unlocksKeys: [],
    unlocksAssetTicker: null,
  },
  {
    stableKey: '1.4',
    code: '1.4',
    trackNumber: 1,
    trackName: 'Trilha 1: Renda Fixa',
    sortOrder: 9,
    title: 'CDB e o CDI',
    centralConcept: 'Remuneração bancária atrelada ao CDI, com garantia do FGC',
    scenarioText:
      'Um banco precisa captar dinheiro pra emprestar a outros clientes, e paga por isso: o CDB ' +
      '(Certificado de Depósito Bancário) é você emprestando dinheiro ao banco em troca de uma ' +
      'remuneração, geralmente um percentual do CDI (taxa que acompanha de perto a Selic).' +
      '\n\n' +
      'O CDB Banco Invest 2027 (CDB2027), por exemplo, paga 12,00% ao ano.',
    microDecisionPrompt:
      'Diferente do Tesouro Selic (risco de crédito do governo, o mais baixo que existe), o CDB ' +
      'tem risco de crédito do banco emissor. O que protege o investidor se esse banco quebrar?',
    microDecisionType: 'reflection',
    microDecisionAssetTicker: null,
    microDecisionOptions: [
      'O FGC (Fundo Garantidor de Créditos)',
      'O Banco Central devolve o valor automaticamente',
      'Nada, o investidor perde todo o valor investido',
    ],
    microDecisionCorrectOption: 0,
    revelationText:
      'O {{FGC}} cobre CDB, LCI e LCA em até R$250.000,00 por CPF e ' +
      'por instituição financeira, mesmo que o banco emissor quebre.' +
      '\n\n' +
      'É essa garantia que torna o CDB praticamente tão seguro quanto o Tesouro Direto até esse ' +
      'limite, permitindo que bancos menores paguem taxas mais altas (mais do CDI) que os grandes ' +
      'bancos pra atrair o mesmo investidor.' +
      '\n\n' +
      'Completar esta lição libera a compra real do CDB2027 no Mercado.',
    unlocksDescription: 'Compra real de CDB (CDB2027) no Mercado',
    unlocksKeys: ['asset:cdb'],
    unlocksAssetTicker: 'CDB2027',
  },
  {
    stableKey: '1.5',
    code: '1.5',
    trackNumber: 1,
    trackName: 'Trilha 1: Renda Fixa',
    sortOrder: 10,
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
    microDecisionOptions: ['Maior', 'Menor'],
    microDecisionCorrectOption: 0,
    revelationText:
      'Maior. A tabela regressiva (Lei 11.033/2004) cobra 22,5% até 180 dias corridos, 20% de ' +
      '181 a 360 dias, 17,5% de 361 a 720 dias e 15% acima de 720 dias.' +
      '\n\n' +
      'Quanto mais tempo o dinheiro fica aplicado, menor a mordida do IR.' +
      '\n\n' +
      'O imposto incide só sobre o lucro, nunca sobre o capital aplicado, e essa tabela vale pra ' +
      'todo produto de renda fixa tributado (Tesouro Direto e CDB); LCI, LCA, CRI e CRA são ' +
      'isentos e nunca pagam essa alíquota, como você vai ver nas próximas lições.',
    unlocksDescription: null,
    unlocksKeys: [],
    unlocksAssetTicker: null,
  },
  {
    stableKey: '1.6',
    code: '1.6',
    trackNumber: 1,
    trackName: 'Trilha 1: Renda Fixa',
    sortOrder: 11,
    title: 'LCI e LCA',
    centralConcept: 'Isenção de IR, comparação de retorno líquido entre produtos',
    scenarioText:
      'LCI (Letra de Crédito Imobiliário) e LCA (Letra de Crédito do Agronegócio) financiam, ' +
      'respectivamente, o setor imobiliário e o agronegócio, e têm garantia do {{FGC}} igual ao CDB.' +
      '\n\n' +
      'A diferença que mais chama atenção: o LCI Banco Invest 2026 (LCI2026) paga 9,50% ao ano, ' +
      'abaixo dos 12,00% do CDB2027 (lição anterior).' +
      '\n\n' +
      'Isso quer dizer que o CDB2027 é sempre a escolha melhor?',
    microDecisionPrompt:
      'LCI e LCA são isentos de Imposto de Renda; o CDB não.' +
      '\n\n' +
      'Resgatando os dois com só 60 dias corridos de aplicação (alíquota de 22,5% sobre o CDB, ' +
      'lição 1.5), qual rende mais líquido: o LCI a 9,50% isento ou o CDB a 12,00% com IR?',
    microDecisionType: 'reflection',
    microDecisionAssetTicker: null,
    // Modelo de referência da tarefa A.2 (5 cartões, mesmo do exemplo
    // "lição 1.5" em proposta-engajamento-licoes.md §2) — texto idêntico
    // ao original, só reordenado em cartões: pergunta certa (régua) →
    // resgate curto → resgate longo → conclusão. Cartões 3 e 4 (os
    // vereditos numéricos) marcados com `[revelar] ` pra tarefa A.3
    // (revelação progressiva) — mesmos 2 cartões citados na descrição da
    // A.3 como exemplo de "resultado calculado" a esconder até o toque.
    microDecisionOptions: ['O LCI2026 (isento)', 'O CDB2027 (com IR)'],
    microDecisionCorrectOption: 0,
    revelationText:
      'O LCI2026 rende mais líquido nesse prazo curto.' +
      '\n\n' +
      'Pra comparar de forma justa, calcule a {{taxa bruta equivalente}} que o CDB precisaria pagar ' +
      'pra empatar com um produto isento: taxa isenta dividida por (1 menos a alíquota).' +
      '\n\n' +
      '[revelar] Com 22,5% de IR (até 180 dias), o LCI2026 equivale a um CDB bruto de 9,50% ÷ ' +
      '0,775 ≈ 12,26% ao ano, acima dos 12,00% do CDB2027: o LCI vence.' +
      '\n\n' +
      '[revelar] Mas com 720 dias corridos ou mais, a alíquota cai pra 15%, e o mesmo cálculo dá ' +
      '9,50% ÷ 0,85 ≈ 11,18%, abaixo dos 12,00% do CDB2027: agora o CDB vence.' +
      '\n\n' +
      'A resposta certa depende do prazo que você pretende manter o dinheiro aplicado, não só da ' +
      'taxa anunciada.',
    unlocksDescription: 'Compra real de LCI (LCI2026) e LCA (LCA2026) no Mercado',
    unlocksKeys: ['asset:lci', 'asset:lca'],
    unlocksAssetTicker: 'LCI2026',
  },
  {
    stableKey: '1.7',
    code: '1.7',
    trackNumber: 1,
    trackName: 'Trilha 1: Renda Fixa',
    sortOrder: 12,
    title: 'Tesouro Prefixado',
    centralConcept: 'Deságio: preço menor que o valor de face, taxa travada na compra',
    scenarioText:
      'O Tesouro Prefixado 2027 (LTN2027) promete pagar R$1.000,00 no vencimento, mas você não ' +
      'paga R$1.000,00 por ele hoje: você paga menos, e a diferença (o deságio) é a fonte da sua ' +
      'rentabilidade.' +
      '\n\n' +
      'A taxa contratada na compra fica travada até o vencimento, 11,75% ao ano nesse título.',
    microDecisionPrompt:
      'Supondo que faltem exatamente 504 dias úteis (2 anos) até o vencimento, o preço de compra ' +
      'do LTN2027 hoje deveria ficar acima ou abaixo de R$1.000,00?',
    microDecisionType: 'reflection',
    microDecisionAssetTicker: null,
    microDecisionOptions: ['Acima de R$1.000,00', 'Abaixo de R$1.000,00'],
    microDecisionCorrectOption: 1,
    revelationText:
      'Abaixo. A fórmula de deságio é Preço = Valor Nominal ÷ (1 + Taxa)^(DU/252): com taxa de ' +
      '11,75% ao ano e 504 dias úteis (dois anos) restantes, Preço = 1.000 ÷ (1,1175)² ≈ R$800,76.' +
      '\n\n' +
      'Você paga R$800,76 hoje e recebe R$1.000,00 no vencimento, uma diferença de R$199,24 que é ' +
      'exatamente a sua rentabilidade contratada.' +
      '\n\n' +
      'Diferente do Tesouro Selic, essa taxa fica travada: se a Selic subir ou cair depois da ' +
      'compra, o valor recebido no vencimento não muda, mas o preço de venda antes do vencimento ' +
      'sim, como a próxima lição mostra.',
    unlocksDescription: 'Compra real de Tesouro Prefixado (LTN2027) no Mercado',
    unlocksKeys: ['asset:tesouro_prefixado'],
    unlocksAssetTicker: 'LTN2027',
  },
  {
    stableKey: '1.8',
    code: '1.8',
    trackNumber: 1,
    trackName: 'Trilha 1: Renda Fixa',
    sortOrder: 13,
    title: 'Marcação a mercado',
    centralConcept: 'Risco de vender um título prefixado antes do vencimento',
    scenarioText:
      'Você comprou o LTN2027 (lição anterior) travado a 11,75% ao ano, mas um imprevisto te ' +
      'obriga a resgatar antes do vencimento.' +
      '\n\n' +
      'Nesse meio tempo, o Copom (simulado nesta plataforma a cada 21 dias reais) subiu a taxa de ' +
      'juros de mercado pra 14% ao ano.' +
      '\n\n' +
      'O preço de venda do seu título hoje muda por causa disso, mesmo sem nada ter mudado no seu ' +
      'contrato original.',
    microDecisionPrompt:
      'Se a taxa de mercado subiu (de 11,75% pra 14%) desde a sua compra, o preço de revenda do ' +
      'seu título hoje fica acima ou abaixo do que renderia até esse dia na taxa contratada?',
    microDecisionType: 'reflection',
    microDecisionAssetTicker: null,
    microDecisionOptions: ['Acima', 'Abaixo'],
    microDecisionCorrectOption: 1,
    revelationText:
      'Abaixo: o preço de qualquer prefixado é recalculado todo dia útil pela mesma fórmula de ' +
      '{{deságio}}, só que com a taxa de mercado vigente no lugar da taxa contratada.' +
      '\n\n' +
      'Taxa de mercado maior gera um preço menor (o denominador da fórmula cresce), então vender ' +
      'antes do vencimento numa alta de juros realiza um retorno pior do que o contratado.' +
      '\n\n' +
      'O oposto também vale: se a taxa de mercado tivesse caído, o preço subiria e a venda ' +
      'antecipada renderia mais do que o contratado, um ganho extraordinário.' +
      '\n\n' +
      'Segurar até o vencimento sempre paga exatamente a taxa contratada; vender antes expõe você ' +
      'a esse risco de marcação a mercado, pra cima ou pra baixo. Você pode simular esse cenário ' +
      'sem nenhum risco real no ativo de prática (Sandbox) disponível no Mercado.',
    unlocksDescription: null,
    unlocksKeys: [],
    unlocksAssetTicker: null,
  },
  {
    stableKey: '1.9',
    code: '1.9',
    trackNumber: 1,
    trackName: 'Trilha 1: Renda Fixa',
    sortOrder: 14,
    title: 'O que é o IPCA',
    centralConcept: 'Índice de preços ao consumidor (IBGE), referência da meta de inflação',
    scenarioText:
      'O IPCA (Índice de Preços ao Consumidor Amplo) é calculado todo mês pelo IBGE a partir do preço de ' +
      'uma cesta de bens e serviços representativa do consumo das famílias brasileiras: é o termômetro ' +
      'oficial da inflação no Brasil e a referência que o Banco Central usa pra decidir a Selic (lição 1.3).' +
      '\n\n' +
      'Nesta plataforma, o IPCA mensal simulado varia pouco em torno de uma meta, mês a mês, sem depender ' +
      'do valor do mês anterior.',
    microDecisionPrompt:
      'O IPCA acumulado em 12 meses (o número que costuma aparecer no noticiário) é a soma simples dos 12 ' +
      'valores mensais, ou o produto composto deles, um mês sobre o outro?',
    microDecisionType: 'live_macro_indicator',
    microDecisionAssetTicker: null,
    microDecisionOptions: [
      'Soma simples dos 12 valores mensais',
      'Produto composto, mês sobre mês',
    ],
    microDecisionCorrectOption: 1,
    revelationText:
      'Produto composto: acumulado 12m = (1 + IPCA₁) × (1 + IPCA₂) × ... × (1 + IPCA₁₂) − 1, a mesma lógica ' +
      'de juros compostos da lição 0.2, aplicada a uma sequência de taxas mensais em vez de uma taxa só.' +
      '\n\n' +
      'É esse acumulado, comparado com a meta composta pelo mesmo número de meses, que alimenta duas coisas ' +
      'nesta plataforma: a reação da Selic simulada a cada reunião do Copom (lição 1.3) e a correção do ' +
      'Valor Nominal Atualizado do Tesouro IPCA+ (próxima lição).' +
      '\n\n' +
      'Veja abaixo o IPCA mensal e o acumulado em 12 meses simulados até agora.',
    unlocksDescription: null,
    unlocksKeys: [],
    unlocksAssetTicker: null,
  },
  {
    stableKey: '1.10',
    code: '1.10',
    trackNumber: 1,
    trackName: 'Trilha 1: Renda Fixa',
    sortOrder: 15,
    title: 'Tesouro IPCA+',
    centralConcept: 'Proteção contra inflação: rendimento real garantido acima do IPCA',
    scenarioText:
      'O Tesouro IPCA+ 2035 (NTNB2035) promete um retorno real de 6,00% ao ano, isto é, 6,00% ' +
      'acima da inflação, o que quer que ela seja no período.' +
      '\n\n' +
      'Isso é possível porque o Valor Nominal Atualizado (VNA) do título é corrigido mês a mês ' +
      'pelo IPCA simulado (lição anterior), e só depois disso a taxa de 6,00% incide sobre esse valor já ' +
      'atualizado.',
    microDecisionPrompt:
      'Se a inflação simulada nesta plataforma rodar mais alta que o previsto ao longo dos anos ' +
      'até o vencimento, o valor final recebido no NTNB2035 aumenta, diminui ou fica igual?',
    microDecisionType: 'reflection',
    microDecisionAssetTicker: null,
    microDecisionOptions: ['Aumenta', 'Diminui', 'Fica igual'],
    microDecisionCorrectOption: 0,
    revelationText:
      'Aumenta. Diferente do Tesouro Prefixado (lição 1.7), cujo valor final é sempre R$1.000,00 ' +
      'fixo, o Tesouro IPCA+ tem seu Valor Nominal corrigido mensalmente pela inflação acumulada.' +
      '\n\n' +
      'Quanto maior o IPCA no período, maior o VNA no vencimento, e os 6,00% ao ano incidem sobre ' +
      'esse valor já corrigido, não sobre o valor original.' +
      '\n\n' +
      'É a lição 0.4 (rendimento nominal vs real) aplicada na prática: aqui o rendimento real já ' +
      'vem garantido por contrato, em vez de precisar ser calculado depois de descontar a ' +
      'inflação.',
    unlocksDescription: 'Compra real de Tesouro IPCA+ (NTNB2035) no Mercado',
    unlocksKeys: ['asset:tesouro_ipca'],
    unlocksAssetTicker: 'NTNB2035',
  },
  {
    stableKey: '1.11',
    code: '1.11',
    trackNumber: 1,
    trackName: 'Trilha 1: Renda Fixa',
    sortOrder: 16,
    title: 'CRI e CRA',
    centralConcept: 'Risco de crédito privado sem FGC, compensado por maior remuneração',
    scenarioText:
      'CRI (Certificado de Recebíveis Imobiliários) e CRA (Certificado de Recebíveis do ' +
      'Agronegócio) são emitidos por securitizadoras, empresas privadas que compram recebíveis ' +
      '(dívidas de terceiros) e os transformam em título negociável.' +
      '\n\n' +
      'O CRI Securitizadora X 2028 (CRI2028) paga 11,00% ao ano, com classificação de risco AA; o ' +
      'CRA Securitizadora X 2028 (CRA2028) paga 10,50% ao ano, com classificação A.',
    microDecisionPrompt:
      'CDB, LCI e LCA têm garantia do {{FGC}} até R$250.000,00 se o emissor quebrar.' +
      '\n\n' +
      'CRI e CRA, emitidos por uma securitizadora e não por um banco, têm essa mesma garantia?',
    microDecisionType: 'reflection',
    microDecisionAssetTicker: null,
    microDecisionOptions: ['Sim', 'Não'],
    microDecisionCorrectOption: 1,
    revelationText:
      'Não. CRI e CRA não têm cobertura do {{FGC}}, então o risco de crédito recai inteiramente ' +
      'sobre a capacidade de pagamento da securitizadora emissora.' +
      '\n\n' +
      'É por isso que pagam mais (11,00% e 10,50% ao ano, acima da maioria dos CDBs) e trazem uma ' +
      'classificação de risco de crédito (AA pro CRI2028, A pro CRA2028) pro investidor avaliar ' +
      'antes de comprar.' +
      '\n\n' +
      'Igual ao LCI e LCA, ambos são isentos de Imposto de Renda. Completar esta lição libera a ' +
      'compra real de CRI e CRA e conclui a Trilha 1: a Trilha 2 (Renda Variável) já abre na ' +
      'sequência.',
    unlocksDescription:
      'Sua reserva de emergência com todas as opções na mesa (Tesouro Selic, CDB/LCI/LCA, CRI/CRA), ' +
      'compra real de CRI/CRA no Mercado, acesso à Trilha 2 (Renda Variável)',
    unlocksKeys: ['asset:cri', 'asset:cra'],
    unlocksAssetTicker: 'CRI2028',
  },
  {
    stableKey: '2.1',
    code: '2.1',
    trackNumber: 2,
    trackName: 'Trilha 2: Renda Variável',
    sortOrder: 17,
    title: 'O que é uma ação',
    centralConcept: 'Comprar uma ação é se tornar sócio de uma empresa',
    scenarioText:
      'Comprar uma ação da Mineradora Vale do Rio (VALR3) não é emprestar dinheiro a ela, como você fez a ' +
      'trilha inteira com Tesouro, CDB e CRI.' +
      '\n\n' +
      'É comprar uma fração da empresa: você passa a ser sócio, dono de uma parte proporcional do que ela ' +
      'vale e do que ela lucra, junto com todos os outros acionistas.' +
      '\n\n' +
      'Com a reserva de emergência da Trilha 1 já resolvida, esta trilha é sobre o resto do patrimônio: ' +
      'quanto vale aceitar essa incerteza em troca de um potencial de retorno maior, e onde exatamente.',
    microDecisionPrompt:
      'Na renda fixa (Trilhas 0 e 1), a taxa contratada na compra já diz quanto você vai receber. Comprando ' +
      'uma ação, esse retorno já é conhecido de antemão, do mesmo jeito?',
    microDecisionType: 'reflection',
    microDecisionAssetTicker: null,
    microDecisionOptions: ['Sim', 'Não'],
    microDecisionCorrectOption: 1,
    revelationText:
      'Não. Como sócio, seu retorno depende do desempenho da empresa e do preço que o mercado está disposto ' +
      'a pagar pela ação a cada momento.' +
      '\n\n' +
      'Você pode ganhar com a valorização do preço e com dividendos (parte do lucro distribuída aos ' +
      'sócios), mas também pode perder se o preço cair, sem nenhuma garantia de capital ou prazo de ' +
      'vencimento como na renda fixa.' +
      '\n\n' +
      'É essa incerteza, junto do potencial de retorno maior, que dá nome à renda variável.',
    unlocksDescription: null,
    unlocksKeys: [],
    unlocksAssetTicker: null,
  },
  {
    stableKey: '2.2',
    code: '2.2',
    trackNumber: 2,
    trackName: 'Trilha 2: Renda Variável',
    sortOrder: 18,
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
    microDecisionOptions: ['Sim', 'Não'],
    microDecisionCorrectOption: 1,
    revelationText:
      'Não. O IPO acontece no mercado primário: a empresa emite ações novas e capitaliza o caixa dela com o ' +
      'dinheiro dos investidores.' +
      '\n\n' +
      'Depois disso, toda negociação acontece no mercado secundário, entre investidores, sem passar um ' +
      'centavo pro caixa da empresa; é esse mercado secundário que o Mercado ao vivo desta plataforma ' +
      'simula, com o preço se formando a cada negociação, como você vai ver na lição de oferta e demanda.',
    unlocksDescription: null,
    unlocksKeys: [],
    unlocksAssetTicker: null,
  },
  {
    stableKey: '2.3',
    code: '2.3',
    trackNumber: 2,
    trackName: 'Trilha 2: Renda Variável',
    sortOrder: 19,
    title: 'Nomenclatura de tickers',
    centralConcept:
      'Final 3 (ON) e final 4 (PN) da mesma empresa; final 11 pode ser ETF, FII ou unit',
    scenarioText:
      'BNDD3 e BNDD4 parecem códigos aleatórios, mas seguem uma convenção: quatro letras identificando o ' +
      'emissor, seguidas de um número que diz que tipo de ação é essa.' +
      '\n\n' +
      'As duas são do mesmo emissor, o Banco Nordeste Digital: BNDD3 termina em 3, BNDD4 termina em 4.',
    microDecisionPrompt:
      'BNDD3 dá direito a voto nas decisões do Banco Nordeste Digital; BNDD4 geralmente tem prioridade no ' +
      'recebimento de dividendos, mas sem voto.' +
      '\n\n' +
      'Qual delas você acha que é a ação ordinária (ON) e qual é a preferencial (PN)?',
    microDecisionType: 'reflection',
    microDecisionAssetTicker: null,
    microDecisionOptions: [
      'BNDD3 é ON (com voto), BNDD4 é PN (sem voto)',
      'BNDD3 é PN (sem voto), BNDD4 é ON (com voto)',
    ],
    microDecisionCorrectOption: 0,
    revelationText:
      'BNDD3 (final 3) é ordinária (ON), com direito a voto; BNDD4 (final 4) é preferencial (PN), sem voto ' +
      'mas com prioridade em dividendos e no recebimento de capital numa eventual liquidação da empresa. ' +
      'Repare que as duas são do mesmo emissor, o Banco Nordeste Digital: um ticker por classe de ação, não ' +
      'duas empresas diferentes.' +
      '\n\n' +
      'Já o final 11 não é exclusivo de um tipo de ativo: identifica cotas de fundos, como o ETF SINT11 (lição ' +
      '2.9) e os FIIs da lição 2.10, mas no mercado real também identifica units, que empacotam a ON e a PN da ' +
      'mesma empresa numa cota só (ex: SANB11 na B3 de verdade). O que diferencia os três não é o número final, ' +
      'que os três compartilham, é o tipo de instrumento por trás do ticker. Esta plataforma não tem unit ' +
      'negociável no catálogo, só ETF e FII terminam em 11 aqui.' +
      '\n\n' +
      'Completar esta lição libera sua primeira operação real de ações no Mercado.',
    unlocksDescription: 'Primeira compra real de ações (VALR3) no Mercado',
    unlocksKeys: ['asset:acao'],
    unlocksAssetTicker: 'VALR3',
  },
  {
    stableKey: '2.4',
    code: '2.4',
    trackNumber: 2,
    trackName: 'Trilha 2: Renda Variável',
    sortOrder: 20,
    title: 'Lendo notícias de mercado',
    centralConcept: 'Como interpretar um evento macro e decidir',
    scenarioText:
      'Agora que você já pode comprar ações de verdade, o preço delas pode se mover por causa de eventos ' +
      'que não têm nada a ver com você.' +
      '\n\n' +
      'Uma notícia sobre a Selic, um evento específico do setor de mineração ou bancário, algo que muda de ' +
      'uma vez as perspectivas de uma empresa ou de um grupo delas.',
    microDecisionPrompt:
      'Uma notícia dizendo "quebra de safra afeta o Agronegócio" chega no feed.' +
      '\n\n' +
      'Se você tem ações de uma mineradora (VALR3, {{ref:2.1}}) e de um banco (BNDD4, {{ref:2.3}}), essa ' +
      'notícia deveria pesar do mesmo jeito na sua decisão sobre as duas?',
    microDecisionType: 'reflection',
    microDecisionAssetTicker: null,
    microDecisionOptions: ['Sim, do mesmo jeito', 'Não, depende de quem o evento afeta'],
    microDecisionCorrectOption: 1,
    revelationText:
      'Não necessariamente: o feed de notícias reporta eventos macro, alguns afetam o mercado inteiro (uma ' +
      'mudança na Selic), outros miram um setor específico (como Agronegócio), sem impactar diretamente uma ' +
      'mineradora ou um banco.' +
      '\n\n' +
      'Ler cada notícia significa identificar quem ela afeta antes de reagir. Por isso esta lição vem logo ' +
      'depois de você já poder operar de verdade (lição 2.3): a partir de agora, esses eventos passam a ' +
      'valer pra você.' +
      '\n\n' +
      'Completar esta lição libera o painel de notícias.',
    unlocksDescription: 'Painel de notícias/feed de eventos',
    unlocksKeys: ['news_feed'],
    unlocksAssetTicker: null,
  },
  {
    stableKey: '2.5',
    code: '2.5',
    trackNumber: 2,
    trackName: 'Trilha 2: Renda Variável',
    sortOrder: 21,
    title: 'Oferta e demanda',
    centralConcept: 'Formação de preço no livro de ofertas (TCC cap. 2.3.3)',
    scenarioText:
      'O preço de VALR3 que você vê no Mercado não é definido por ninguém em particular.' +
      '\n\n' +
      'Ele nasce do livro de ofertas (order book), uma lista de ordens de compra (pedindo o preço mais alto ' +
      'que estão dispostos a pagar) e de venda (pedindo o preço mais baixo que estão dispostos a aceitar) ' +
      'pra esse ativo.',
    microDecisionPrompt:
      'Se chegam muito mais ordens de compra do que de venda pra VALR3, todas dispostas a pagar cada vez ' +
      'mais caro pra conseguir comprar, o preço de VALR3 tende a subir, cair ou ficar igual?',
    microDecisionType: 'reflection',
    microDecisionAssetTicker: null,
    microDecisionOptions: ['Tende a subir', 'Tende a cair', 'Fica igual'],
    microDecisionCorrectOption: 0,
    revelationText:
      'Tende a subir: o motor de pareamento organiza as ofertas de compra da mais alta pra mais baixa e as ' +
      'de venda da mais baixa pra mais alta, e cada negociação executa no preço de quem já estava no livro ' +
      '(a ordem passiva).' +
      '\n\n' +
      'Com mais compradores dispostos a pagar mais do que vendedores dispostos a vender, as ofertas de ' +
      'venda mais baratas se esgotam primeiro, e os próximos negócios só fecham em preços mais altos, ' +
      'empurrando o preço pra cima; excesso de venda faz o caminho inverso.' +
      '\n\n' +
      'É esse mecanismo, e não uma decisão de alguém, que forma o preço em tempo real de toda ação, ETF e ' +
      'FII desta plataforma.' +
      '\n\n' +
      'A partir da próxima lição, você vai aprender a ler os indicadores fundamentalistas que ajudam a ' +
      'decidir se um preço formado assim está caro ou barato.',
    unlocksDescription: null,
    unlocksKeys: [],
    unlocksAssetTicker: null,
  },
  {
    stableKey: '2.6.1',
    code: '2.6.1',
    trackNumber: 2,
    trackName: 'Trilha 2: Renda Variável',
    sortOrder: 22,
    title: 'Lendo um balanço',
    centralConcept:
      'Peças básicas: Receita, EBIT, Lucro Líquido, Patrimônio Líquido, Dívida Bruta, Caixa',
    scenarioText:
      'Por trás de VALR3 existe uma empresa de verdade, a Mineradora Vale do Rio, e o motor de simulação ' +
      'gera um relatório financeiro dela a cada ciclo, com seis números.' +
      '\n\n' +
      'Receita Líquida (o que ela faturou), EBIT (lucro operacional, antes de juros e impostos), Lucro ' +
      'Líquido (o que sobra depois de tudo), Patrimônio Líquido (o que a empresa vale, descontadas as ' +
      'dívidas), Dívida Bruta e Caixa.',
    microDecisionPrompt:
      'Entre EBIT e Lucro Líquido, um deles é calculado primeiro, antes de descontar juros e impostos. Você ' +
      'acha que esse é sempre maior ou sempre menor que o Lucro Líquido final?',
    microDecisionType: 'live_indicator',
    microDecisionAssetTicker: 'VALR3',
    microDecisionOptions: ['Maior', 'Menor'],
    microDecisionCorrectOption: 0,
    revelationText:
      'EBIT vem primeiro e costuma ser maior que o Lucro Líquido, já que ainda falta descontar juros da ' +
      'dívida e impostos antes de chegar ao resultado final.' +
      '\n\n' +
      'Patrimônio Líquido não é caixa: é a diferença entre tudo que a empresa tem e tudo que ela deve, ' +
      'acumulada ao longo do tempo.' +
      '\n\n' +
      'Dívida Bruta e Caixa, sozinhos, ainda não dizem se a empresa está endividada de verdade: isso só ' +
      'aparece juntando os dois, na lição 2.6.5.' +
      '\n\n' +
      'Esses seis números são a base de todo indicador que você vai calcular daqui pra frente; veja abaixo ' +
      'o painel calculado ao vivo pra VALR3 a partir do relatório mais recente dela.',
    unlocksDescription: null,
    unlocksKeys: [],
    unlocksAssetTicker: null,
  },
  {
    stableKey: '2.6.2',
    code: '2.6.2',
    trackNumber: 2,
    trackName: 'Trilha 2: Renda Variável',
    sortOrder: 23,
    title: 'Margens de rentabilidade',
    centralConcept: 'O que é EBIT na prática, diferença para lucro líquido',
    scenarioText:
      'Duas empresas podem faturar o mesmo e sobrar valores bem diferentes no fim: o que importa não é só ' +
      'quanto a Mineradora Vale do Rio (VALR3) fatura, mas que fração desse faturamento ela mantém como ' +
      'lucro, em cada etapa do resultado.' +
      '\n\n' +
      'É isso que uma margem mede: um lucro dividido pela receita que o gerou.',
    microDecisionPrompt:
      'Margem EBIT usa o lucro operacional (antes de juros e impostos); Margem Líquida usa o que sobra no ' +
      'fim, depois de tudo descontado. Pra VALR3, você espera que a Margem Líquida seja maior ou menor que a ' +
      'Margem EBIT?',
    microDecisionType: 'live_indicator',
    microDecisionAssetTicker: 'VALR3',
    microDecisionOptions: ['Maior', 'Menor'],
    microDecisionCorrectOption: 1,
    revelationText:
      'Margem EBIT = EBIT / Receita Líquida; Margem Líquida = Lucro Líquido / Receita Líquida.' +
      '\n\n' +
      'Como o Lucro Líquido já descontou juros e impostos que o EBIT ainda não descontou, a Margem Líquida ' +
      'costuma ser menor que a Margem EBIT.' +
      '\n\n' +
      'A diferença entre as duas mostra quanto do resultado operacional a empresa perde pra dívida e ' +
      'impostos antes de chegar ao lucro final.' +
      '\n\n' +
      'Veja abaixo as duas margens calculadas ao vivo pra VALR3, a partir do relatório mais recente.',
    unlocksDescription: null,
    unlocksKeys: [],
    unlocksAssetTicker: null,
  },
  {
    stableKey: '2.6.3',
    code: '2.6.3',
    trackNumber: 2,
    trackName: 'Trilha 2: Renda Variável',
    sortOrder: 24,
    title: 'Retorno sobre patrimônio (ROE)',
    centralConcept: 'Quão bem a empresa usa o capital dos sócios',
    scenarioText:
      'Imagine duas empresas com o mesmo Lucro Líquido, mas uma precisou de um Patrimônio Líquido bem maior ' +
      'que a outra pra chegar nesse resultado. As duas lucraram igual, mas usaram o capital dos sócios com a ' +
      'mesma eficiência?',
    microDecisionPrompt:
      'Se a Mineradora Vale do Rio (VALR3, {{ref:2.1}}) e o Banco Nordeste Digital (BNDD4, {{ref:2.3}}) tivessem o mesmo Lucro ' +
      'Líquido, mas a VALR3 precisasse de um Patrimônio Líquido menor pra chegar lá, qual das duas estaria ' +
      'usando melhor o capital dos seus sócios?',
    microDecisionType: 'live_indicator',
    microDecisionAssetTicker: 'VALR3',
    microDecisionOptions: ['VALR3 (Mineradora)', 'BNDD4 (Banco)'],
    microDecisionCorrectOption: 0,
    revelationText:
      'A VALR3 estaria usando melhor: ROE = Lucro Líquido / Patrimônio Líquido mede quanto lucro a empresa ' +
      'gera pra cada real de capital que os sócios colocaram nela.' +
      '\n\n' +
      'Então, pra um mesmo lucro, menos patrimônio empregado significa ROE mais alto e capital mais bem ' +
      'aproveitado. É por isso que ROE alto é lido como sinal de boa gestão do capital próprio, não só de ' +
      'lucro alto em valor absoluto.' +
      '\n\n' +
      'Veja abaixo o ROE calculado ao vivo pra VALR3.',
    unlocksDescription: null,
    unlocksKeys: [],
    unlocksAssetTicker: null,
  },
  {
    stableKey: '2.6.4',
    code: '2.6.4',
    trackNumber: 2,
    trackName: 'Trilha 2: Renda Variável',
    sortOrder: 25,
    title: 'Indicadores de preço (P/L e P/VP)',
    centralConcept: 'Ação "cara" ou "barata" frente ao que a empresa entrega',
    scenarioText:
      'O preço de VALR3 sozinho não diz se a ação está cara ou barata: R$20 pode ser caro pra uma empresa ' +
      'que lucra pouco por ação e barato pra uma que lucra muito.' +
      '\n\n' +
      'Pra comparar preço com o que a empresa de fato entrega, primeiro é preciso trazer Lucro Líquido e ' +
      'Patrimônio Líquido pra base "por ação".',
    microDecisionPrompt:
      'Se o preço de VALR3 triplicar de um dia pro outro, mas o Lucro Líquido por ação dela continuar o ' +
      'mesmo, o P/L (Preço / Lucro por ação) sobe, desce ou fica igual?',
    microDecisionType: 'live_indicator',
    microDecisionAssetTicker: 'VALR3',
    microDecisionOptions: ['Sobe', 'Desce', 'Fica igual'],
    microDecisionCorrectOption: 0,
    revelationText:
      'LPA (lucro por ação) = Lucro Líquido / número de ações; P/L = Preço / LPA.' +
      '\n\n' +
      'Com o LPA parado e o preço triplicando, o P/L também triplica: o mercado passa a pagar três vezes ' +
      'mais por cada real de lucro que a empresa gera, ou seja, a ação fica mais "cara" nesse critério.' +
      '\n\n' +
      'O mesmo raciocínio vale pro par VPA (Patrimônio Líquido / número de ações) e P/VP (Preço / VPA), só ' +
      'que comparando preço ao patrimônio da empresa em vez de ao lucro. Veja abaixo os quatro calculados ao ' +
      'vivo pra VALR3.',
    unlocksDescription: null,
    unlocksKeys: [],
    unlocksAssetTicker: null,
  },
  {
    stableKey: '2.6.5',
    code: '2.6.5',
    trackNumber: 2,
    trackName: 'Trilha 2: Renda Variável',
    sortOrder: 26,
    title: 'Endividamento',
    centralConcept: 'Risco de alavancagem',
    scenarioText:
      'Dívida Bruta alta assusta à primeira vista, mas sozinha não conta a história inteira: uma empresa com ' +
      'muita dívida e ainda mais Caixa parado pode estar bem mais segura que uma com pouca dívida e nenhum ' +
      'Caixa de reserva.',
    microDecisionPrompt:
      'Se a Dívida Bruta de uma empresa é alta, mas o Caixa dela é ainda mais alto, a Dívida Líquida ' +
      '(Dívida Bruta menos Caixa) dessa empresa é alta ou baixa?',
    microDecisionType: 'live_indicator',
    microDecisionAssetTicker: 'VALR3',
    microDecisionOptions: ['Alta', 'Baixa'],
    microDecisionCorrectOption: 1,
    revelationText:
      'Baixa, podendo até ser negativa: Dívida Líquida = Dívida Bruta − Caixa, então quando o Caixa supera a ' +
      'Dívida Bruta, a empresa tem, na prática, mais dinheiro guardado do que deve.' +
      '\n\n' +
      'O indicador Dívida Líquida/EBIT vai além, comparando essa dívida líquida com a capacidade de geração ' +
      'de caixa operacional da empresa. O resultado é, em anos de {{EBIT}}, quanto tempo levaria pra quitar a ' +
      'dívida líquida se todo o resultado operacional fosse usado só pra isso.' +
      '\n\n' +
      'Esse indicador pesa ainda mais numa empresa de perfil sofisticado como o Banco Nordeste Digital ' +
      '(BNDD4), mais sensível a mudanças na Selic (spec 3.2.2), já que juros mais altos encarecem ' +
      'justamente a dívida que entra nessa conta.' +
      '\n\n' +
      'Veja abaixo a Dívida Líquida/EBIT calculada ao vivo pra VALR3.',
    unlocksDescription: null,
    unlocksKeys: [],
    unlocksAssetTicker: null,
  },
  {
    stableKey: '2.6.6',
    code: '2.6.6',
    trackNumber: 2,
    trackName: 'Trilha 2: Renda Variável',
    sortOrder: 27,
    title: 'Dividend Yield',
    centralConcept: 'Quanto a ação "paga" em relação ao preço',
    scenarioText:
      'Além de poder valorizar de preço, VALR3 pode distribuir parte do lucro da Mineradora Vale do Rio ' +
      'direto pros seus acionistas, em dinheiro, os dividendos (ou proventos).' +
      '\n\n' +
      'O Dividend Yield resume, num só número, quanto isso representa frente ao preço atual da ação.',
    microDecisionPrompt:
      'Se o preço de VALR3 dobrar de um dia pro outro, mas os dividendos pagos por ação nos últimos 12 ' +
      'meses continuarem os mesmos, o Dividend Yield sobe, desce ou fica igual?',
    microDecisionType: 'live_indicator',
    microDecisionAssetTicker: 'VALR3',
    microDecisionOptions: ['Sobe', 'Desce', 'Fica igual'],
    microDecisionCorrectOption: 1,
    revelationText:
      'Desce: Dividend Yield = soma dos dividendos pagos por ação nos últimos 12 meses / Preço atual, então, ' +
      'com o numerador parado, dobrar o preço corta o Dividend Yield pela metade.' +
      '\n\n' +
      'É por isso que um Dividend Yield alto pode significar tanto uma empresa boa pagadora de dividendos ' +
      'quanto uma ação com o preço em queda, sem que os dividendos tenham mudado.' +
      '\n\n' +
      'Nunca leia esse número sozinho, sem olhar o preço e o histórico de pagamentos por trás dele. Você ' +
      'encontra esse histórico completo, com cada valor e cada data de pagamento, na tela de Detalhe do ' +
      'Ativo de qualquer ação.' +
      '\n\n' +
      'Veja abaixo o Dividend Yield calculado ao vivo pra VALR3, o último dos 9 indicadores ' +
      'fundamentalistas do currículo; a próxima lição explica como e quando esse pagamento chega até você.',
    unlocksDescription: null,
    unlocksKeys: [],
    unlocksAssetTicker: null,
  },
  {
    stableKey: '2.7',
    code: '2.7',
    trackNumber: 2,
    trackName: 'Trilha 2: Renda Variável',
    sortOrder: 28,
    title: 'Dividendos e data ex',
    centralConcept: 'Como e quando o acionista recebe',
    scenarioText:
      'Você tem VALR3 na carteira no dia em que a Mineradora Vale do Rio fecha seu ciclo de relatório (a ' +
      'cada 14 dias simulados) e a empresa distribui parte do lucro como dividendo.' +
      '\n\n' +
      'Nesse exato dia, a plataforma registra quem tem direito a receber esse provento: é a data ex.',
    microDecisionPrompt:
      'Se você vender toda a sua posição em VALR3 um dia depois da data ex, mas antes do dia de pagamento, ' +
      'ainda recebe o dividendo dessa distribuição?',
    microDecisionType: 'reflection',
    microDecisionAssetTicker: null,
    microDecisionOptions: ['Sim', 'Não'],
    microDecisionCorrectOption: 0,
    revelationText:
      'Sim. O direito ao provento é definido pela posição que você tinha exatamente na data ex, o dia de ' +
      'relatório em que o dividendo é gerado, não pela posição no dia do pagamento.' +
      '\n\n' +
      'A plataforma registra quem tem posição nesse momento e paga esse mesmo grupo depois, com uma ' +
      'defasagem fixa de 5 dias simulados entre a data ex e o pagamento, sempre antes do próximo ciclo de ' +
      'relatório distribuir um novo provento sobre o mesmo ativo.' +
      '\n\n' +
      'Vender depois da data ex não tira o seu direito ao provento já gerado; comprar depois da data ex não ' +
      'dá direito a ele, só ao provento do próximo ciclo.' +
      '\n\n' +
      'O valor por ação, o mesmo que forma o {{Dividend Yield}} da lição anterior, é creditado direto no seu ' +
      'saldo, e vale tanto para ações quanto para FIIs, o produto da lição 2.10.',
    unlocksDescription: null,
    unlocksKeys: [],
    unlocksAssetTicker: null,
  },
  {
    stableKey: '2.8',
    code: '2.8',
    trackNumber: 2,
    trackName: 'Trilha 2: Renda Variável',
    sortOrder: 29,
    title: 'Setores e ciclicidade',
    centralConcept: 'Conecta com Selic afetando fundamentos (3.2.2), defensivo vs cíclico',
    scenarioText:
      'A Selic não afeta só renda fixa: ela também entra na simulação dos fundamentos de toda empresa ' +
      'listada, e não afeta todas do mesmo jeito.' +
      '\n\n' +
      'A Mineradora Vale do Rio (VALR3, setor Mineração, perfil Conservador, {{ref:2.1}}) e o Banco Nordeste ' +
      'Digital (BNDD4, setor Bancário/Financeiro, perfil Sofisticado, {{ref:2.3}}) reagem de forma diferente ' +
      'quando a Selic simulada sobe.',
    microDecisionPrompt:
      'Perfil Sofisticado (setores mais cíclicos e alavancados) é mais sensível a juros altos do que perfil ' +
      'Conservador (fluxo de caixa mais estável).' +
      '\n\n' +
      'Numa alta de Selic, qual das duas você espera que sinta um efeito maior nos fundamentos: VALR3 ' +
      '(Conservador) ou BNDD4 (Sofisticado)?',
    microDecisionType: 'reflection',
    microDecisionAssetTicker: null,
    microDecisionOptions: ['VALR3 (Conservador)', 'BNDD4 (Sofisticado)'],
    microDecisionCorrectOption: 1,
    revelationText:
      'BNDD4 sente um efeito maior. É o mesmo perfil de risco (Conservador/Sofisticado) que você já viu na ' +
      'Trilha 1 para renda fixa, aqui aplicado ao efeito da Selic sobre os fundamentos de cada empresa.' +
      '\n\n' +
      'Perfil Sofisticado, como o do Banco Nordeste Digital, concentra setores mais cíclicos e alavancados, ' +
      'mais sensíveis a juros altos; perfil Conservador, como o da Mineradora Vale do Rio, tem fluxo de ' +
      'caixa mais estável e sente menos esse efeito.' +
      '\n\n' +
      'É essa mesma lógica que explica por que diversificar entre setores e perfis diferentes reduz o risco ' +
      'da carteira. Numa alta de juros, nem todas as empresas pioram do mesmo jeito, e um portfólio ' +
      'concentrado só em setores cíclicos sofre mais do que um distribuído entre defensivo e cíclico.',
    unlocksDescription: null,
    unlocksKeys: [],
    unlocksAssetTicker: null,
  },
  {
    stableKey: '2.9',
    code: '2.9',
    trackNumber: 2,
    trackName: 'Trilha 2: Renda Variável',
    sortOrder: 30,
    title: 'ETFs',
    centralConcept: 'Diversificação automática via índice',
    scenarioText:
      'Comprar uma única cota do ETF Índice Sintético (SINT11) dá exposição, de uma vez, a uma cesta ' +
      'inteira de empresas que compõem o índice de referência dele.' +
      '\n\n' +
      'Hoje replicado por amostragem representativa com a Mineradora Vale do Rio (40% do peso), o Banco ' +
      'Nordeste Digital (35%) e outras posições agregadas (25%).' +
      '\n\n' +
      'Em vez de escolher ação por ação, você compra o índice inteiro.',
    microDecisionPrompt:
      'Se só a Mineradora Vale do Rio (40% do peso do SINT11) sofrer uma queda forte de preço, o preço do ' +
      'SINT11 inteiro deveria cair na mesma proporção, ou menos?',
    microDecisionType: 'reflection',
    microDecisionAssetTicker: null,
    microDecisionOptions: ['Na mesma proporção', 'Menos'],
    microDecisionCorrectOption: 1,
    revelationText:
      'Menos. O preço do ETF acompanha o índice de referência que ele replica, formado pela média ponderada ' +
      'de todos os constituintes, não só de um.' +
      '\n\n' +
      'Com a Mineradora Vale do Rio pesando 40% da composição, uma queda forte só nela puxa o índice pra ' +
      'baixo proporcionalmente a esse peso, mas o resto da cesta (Banco Nordeste Digital e outras posições) ' +
      'amortece o efeito.' +
      '\n\n' +
      'É essa diversificação automática, numa única compra, que torna o ETF diferente de comprar uma ação ' +
      'isolada: você nunca fica 100% exposto ao resultado de uma empresa só. Completar esta lição libera a ' +
      'compra real do SINT11 no Mercado.',
    unlocksDescription: 'Compra real de ETF (SINT11) no Mercado',
    unlocksKeys: ['asset:etf'],
    unlocksAssetTicker: 'SINT11',
  },
  {
    stableKey: '2.10',
    code: '2.10',
    trackNumber: 2,
    trackName: 'Trilha 2: Renda Variável',
    sortOrder: 31,
    title: 'FIIs',
    centralConcept: 'Fundos imobiliários, tickers final 11',
    scenarioText:
      'FII (Fundo de Investimento Imobiliário) também tem ticker terminado em 11, igual ETF (lição 2.3), ' +
      'mas o produto por trás é bem diferente.' +
      '\n\n' +
      'Em vez de replicar um índice de ações, um FII investe em imóveis ou em recebíveis ligados ao setor ' +
      'imobiliário, e distribui o resultado como dividendo aos cotistas.' +
      '\n\n' +
      'O FII Tijolo Corporativo (TJLO11) é dono direto de imóveis (segmento Lajes Corporativas, com 5,2% de ' +
      'vacância); o FII Papel Recebíveis (PAPL11) não tem imóvel nenhum, ele é dono de uma carteira de ' +
      'recebíveis (dívidas ligadas ao setor imobiliário) indexada ao CDI.',
    microDecisionPrompt:
      'TJLO11 tem 5,2% de vacância (fração dos imóveis dele sem inquilino no momento). Esse indicador de ' +
      'vacância faz sentido calcular também pro PAPL11, que não tem imóvel próprio?',
    microDecisionType: 'reflection',
    microDecisionAssetTicker: null,
    microDecisionOptions: ['Sim, faz sentido', 'Não faz sentido'],
    microDecisionCorrectOption: 1,
    revelationText:
      'Não faz sentido: vacância é um indicador exclusivo do perfil tijolo, porque só existe imóvel físico ' +
      'pra ficar vago.' +
      '\n\n' +
      'O perfil papel, como o PAPL11, é avaliado por indicadores diferentes, principalmente o indexador da ' +
      'carteira de recebíveis (CDI, no caso do PAPL11) e o valor total dessa carteira.' +
      '\n\n' +
      'Já que o resultado dele vem do que os devedores pagam, não do aluguel de um imóvel. Os dois perfis, ' +
      'porém, compartilham o mesmo {{Dividend Yield}} (lição 2.6.6) como indicador comum de quanto o FII ' +
      'distribui frente ao preço da cota.' +
      '\n\n' +
      'Completar esta lição libera a compra real de FIIs no Mercado e conclui a Trilha 2 (Renda Variável): ' +
      'a Trilha 3 (Estratégia e Tributação) abre na sequência.',
    unlocksDescription:
      'O resto do patrimônio com onde crescer (ações, ETFs, FIIs), compra real de FIIs (TJLO11/PAPL11) no ' +
      'Mercado, acesso à Trilha 3 (Estratégia e Tributação)',
    unlocksKeys: ['asset:fii'],
    unlocksAssetTicker: 'TJLO11',
  },
  {
    stableKey: '3.1',
    code: '3.1',
    trackNumber: 3,
    trackName: 'Trilha 3: Estratégia e Tributação',
    sortOrder: 32,
    title: 'Diversificação',
    centralConcept: 'Por que não concentrar tudo num ativo',
    scenarioText:
      'Você tem R$10.000 e dois planos: colocar tudo em VALR3, uma única ação, ou dividir esse valor entre ' +
      'VALR3, BNDD4 e um pouco de Tesouro Selic.' +
      '\n\n' +
      'Nos dois planos você está investindo o mesmo valor total, mas o resultado de um evento ruim ' +
      'específico da Mineradora Vale do Rio (uma quebra de safra, um escândalo contábil, qualquer choque ' +
      'isolado) afeta cada plano de um jeito bem diferente.' +
      '\n\n' +
      'Esta trilha fecha o arco das duas anteriores: juntar a reserva segura (Trilha 1) e a parte de risco ' +
      '(Trilha 2) numa única estratégia, e testar essa estratégia contra um evento de mercado real na ' +
      'última lição.',
    microDecisionPrompt:
      'Se um evento negativo atinge só a Mineradora Vale do Rio, qual dos dois planos sofre a perda maior no ' +
      'patrimônio total: o concentrado 100% em VALR3, ou o dividido entre VALR3, BNDD4 e Tesouro Selic?',
    microDecisionType: 'reflection',
    microDecisionAssetTicker: null,
    microDecisionOptions: [
      'O plano concentrado 100% em VALR3',
      'O plano dividido entre VALR3, BNDD4 e Tesouro Selic',
    ],
    microDecisionCorrectOption: 0,
    revelationText:
      'O plano concentrado. Todo o patrimônio está exposto ao mesmo risco específico daquela empresa, então ' +
      'um choque nela vira um choque no portfólio inteiro.' +
      '\n\n' +
      'No plano diversificado, o mesmo evento só afeta a fatia aplicada em VALR3; o resto (BNDD4, com ' +
      'fundamentos e setor diferentes, e o Tesouro Selic, sem nenhuma ligação com o desempenho de uma ' +
      'empresa) segue intacto.' +
      '\n\n' +
      'É a mesma lógica por trás do ETF da lição 2.9 (uma cesta de ações amortecendo o choque de uma só), ' +
      'aplicada agora entre classes inteiras: renda fixa, ações de setores diferentes e perfis de risco ' +
      'diferentes (lição 2.8).' +
      '\n\n' +
      'Diversificar não aumenta o retorno esperado de cada ativo isolado, mas reduz o risco específico de ' +
      'cada um pesar sozinho no resultado final.',
    unlocksDescription: null,
    unlocksKeys: [],
    unlocksAssetTicker: null,
  },
  {
    stableKey: '3.2',
    code: '3.2',
    trackNumber: 3,
    trackName: 'Trilha 3: Estratégia e Tributação',
    sortOrder: 33,
    title: 'Perfil de risco',
    centralConcept: 'Conservador vs Sofisticado, risco x retorno',
    scenarioText:
      'Você já viu o rótulo de risco em vários produtos ao longo da trilha: VALR3 e o Tesouro Selic com ' +
      'perfil Conservador; BNDD4 com perfil Sofisticado; CRI2028 (AA) e CRA2028 (A) com classificação de ' +
      'crédito.' +
      '\n\n' +
      'Cada um mede uma coisa diferente, mas todos apontam pra uma mesma pergunta: quanta oscilação e ' +
      'quanto risco de perda você está disposto a aceitar em troca de um retorno maior?',
    microDecisionPrompt:
      'Um portfólio 100% perfil Sofisticado tende a oscilar mais, pra cima e pra baixo, do que um portfólio ' +
      '100% perfil Conservador. Pra alguém que pode precisar resgatar o dinheiro em poucos meses, qual dos ' +
      'dois perfis é mais adequado?',
    microDecisionType: 'reflection',
    microDecisionAssetTicker: null,
    microDecisionOptions: ['Conservador', 'Sofisticado'],
    microDecisionCorrectOption: 0,
    revelationText:
      'O perfil Conservador. Risco e retorno não são opostos que se escolhe livremente: são uma troca.' +
      '\n\n' +
      'Perfil Sofisticado, como o do Banco Nordeste Digital (lição 2.8), tende a entregar retorno maior no ' +
      'longo prazo justamente por aceitar mais oscilação no caminho, o que é perigoso pra quem precisa do ' +
      'valor num prazo curto e pode ser forçado a vender numa hora ruim.' +
      '\n\n' +
      'Perfil Conservador entrega menos oscilação em troca de um retorno esperado mais modesto. Não existe ' +
      'perfil certo ou errado, existe perfil adequado ao seu horizonte de tempo e à sua necessidade real ' +
      'daquele dinheiro.' +
      '\n\n' +
      'É por isso que a mesma pergunta vale tanto pra escolher entre ações de perfis diferentes quanto ' +
      'entre CRI2028 (AA, mais seguro) e CRA2028 (A, mais arriscado e mais rentável).',
    unlocksDescription: null,
    unlocksKeys: [],
    unlocksAssetTicker: null,
  },
  {
    stableKey: '3.3',
    code: '3.3',
    trackNumber: 3,
    trackName: 'Trilha 3: Estratégia e Tributação',
    sortOrder: 34,
    title: 'Comparando produtos na prática',
    centralConcept: 'CDB 110% CDI líquido vs LCI 90% CDI isento, qual rende mais?',
    scenarioText:
      'Você já viu, na lição 1.6, que CDB é tributado pela tabela regressiva de IR e LCI é isento.' +
      '\n\n' +
      'Mas taxa bruta maior e isenção de imposto são coisas diferentes, e comparar os dois de verdade exige ' +
      'olhar o valor líquido no bolso, não só o percentual anunciado.',
    microDecisionPrompt:
      'Use a calculadora abaixo, mantendo os valores padrão (CDB 110% CDI vs LCI 90% CDI, R$10.000, 365 ' +
      'dias) e compare o valor líquido dos dois. Depois mude o prazo pra 180 dias e compare de novo: o ' +
      'vencedor muda?',
    microDecisionType: 'fixed_income_comparison',
    microDecisionAssetTicker: null,
    microDecisionOptions: null,
    microDecisionCorrectOption: null,
    revelationText:
      'Com os valores padrão (365 dias, alíquota regressiva de 17,5% nessa faixa), o CDB a 11,00% a.a. ' +
      'bruto rende R$10.907,50 líquidos contra R$10.900,00 do LCI a 9,00% a.a. isento: o CDB vence, mas por ' +
      'pouco.' +
      '\n\n' +
      'Em 180 dias, a alíquota sobe pra 22,5% (a faixa mais alta da tabela regressiva, mesma da lição 1.5), ' +
      'e o resultado se inverte: o CDB rende R$10.409,30 líquidos contra R$10.434,15 do LCI, que agora ' +
      'vence.' +
      '\n\n' +
      'A taxa bruta maior do CDB não garante o resultado líquido maior: quanto mais cedo você resgata, ' +
      'maior a alíquota que corrói o rendimento tributado, e mais a isenção do LCI pesa a favor dele.' +
      '\n\n' +
      'Quanto mais tempo o dinheiro fica aplicado, menor a alíquota, e mais o CDB tem chance de recuperar a ' +
      'vantagem. Não existe produto que "rende mais" de forma absoluta: existe o produto que rende mais ' +
      'líquido pro prazo que você de fato pretende manter o dinheiro aplicado.',
    unlocksDescription: null,
    unlocksKeys: [],
    unlocksAssetTicker: null,
  },
  {
    stableKey: '3.4',
    code: '3.4',
    trackNumber: 3,
    trackName: 'Trilha 3: Estratégia e Tributação',
    sortOrder: 35,
    title: 'Desafio final da trilha',
    centralConcept: 'Cenário combinando renda fixa + variável + um evento macro',
    scenarioText:
      'Você tem um portfólio com Tesouro Selic (LFT2029) e ações da Mineradora Vale do Rio (VALR3) e do ' +
      'Banco Nordeste Digital (BNDD4).' +
      '\n\n' +
      'Um evento macro de alta da Selic é disparado (lição 2.4): o Tesouro Selic passa a render mais no ' +
      'mesmo instante em que os fundamentos das duas empresas sentem o efeito sistêmico da Selic (lição ' +
      '2.8) e o preço de ambas reage ao choque especulativo do evento (lição 2.5).',
    microDecisionPrompt:
      'Juntando o que você já viu nas lições 2.8 e 3.2.' +
      '\n\n' +
      'Nesse cenário de alta de Selic, qual das duas ações tende a sentir o efeito maior nos fundamentos, ' +
      'VALR3 (Conservador) ou BNDD4 (Sofisticado), e o que acontece com o Tesouro Selic ao mesmo tempo?',
    microDecisionType: 'reflection',
    microDecisionAssetTicker: null,
    microDecisionOptions: [
      'VALR3 sente mais o efeito, e o Tesouro Selic passa a render menos',
      'VALR3 sente mais o efeito, e o Tesouro Selic passa a render mais',
      'BNDD4 sente mais o efeito, e o Tesouro Selic passa a render menos',
      'BNDD4 sente mais o efeito, e o Tesouro Selic passa a render mais',
    ],
    microDecisionCorrectOption: 3,
    revelationText:
      'BNDD4 (Sofisticado) sente o efeito maior nos fundamentos, o mesmo padrão da lição 2.8, enquanto o ' +
      'Tesouro Selic passa a render mais, acompanhando a taxa que agora subiu (lição 1.2).' +
      '\n\n' +
      'É por isso que um portfólio dividido entre renda fixa e ações de perfis diferentes (lição 3.1) reage ' +
      'de um jeito que nenhum ativo isolado reproduz sozinho.' +
      '\n\n' +
      'A parte em Tesouro Selic ganha justamente no momento em que a parte mais sofisticada da carteira ' +
      'sofre mais, amortecendo o resultado total.' +
      '\n\n' +
      'Entender isso, e não uma fórmula nova, é a diferença entre reagir a um evento macro no susto e já ' +
      'ter, desde a composição do portfólio (perfil de risco, lição 3.2, e produto certo pro prazo certo, ' +
      'lição 3.3), uma resposta pronta pra ele.' +
      '\n\n' +
      'Você concluiu a trilha guiada. A partir de agora, todo o Mercado (renda fixa e renda variável, ' +
      'sandbox e ao vivo) está disponível sem nenhuma restrição de lição.',
    unlocksDescription:
      'Estratégia completa e testada contra um evento real, trilha guiada concluída, mundo aberto liberado ' +
      'por completo',
    unlocksKeys: [],
    unlocksAssetTicker: null,
  },
]

// `onConflictDoUpdate` (não só `onConflictDoNothing`): a autoria de conteúdo
// por bloco (7.1.1–7.1.6) precisa *atualizar* lições já seedadas em sessões
// anteriores com o conteúdo pedagógico novo, não só inserir as que ainda não
// existem — decisão da introdução da 7.1. `target: lessons.stableKey` (não
// `code`, desde a M.6/achado 010): `stableKey` é a única coluna garantida
// imutável por lição, então é a única que casa a linha física certa numa
// renumeração de `code`. `id`/`stableKey` nunca mudam num conflito — `code`
// agora entra no `set` de propósito, já que ele passou a ser mutável.
export async function upsertLessonSeed(db: Database, seed: LessonSeed) {
  const [row] = await db
    .insert(lessons)
    .values({ id: randomUUID(), ...seed })
    .onConflictDoUpdate({
      target: lessons.stableKey,
      set: {
        code: seed.code,
        trackNumber: seed.trackNumber,
        trackName: seed.trackName,
        sortOrder: seed.sortOrder,
        title: seed.title,
        centralConcept: seed.centralConcept,
        scenarioText: seed.scenarioText,
        microDecisionPrompt: seed.microDecisionPrompt,
        microDecisionType: seed.microDecisionType,
        microDecisionAssetTicker: seed.microDecisionAssetTicker,
        microDecisionOptions: seed.microDecisionOptions,
        microDecisionCorrectOption: seed.microDecisionCorrectOption,
        revelationText: seed.revelationText,
        unlocksDescription: seed.unlocksDescription,
        unlocksKeys: seed.unlocksKeys,
        unlocksAssetTicker: seed.unlocksAssetTicker,
      },
    })
    .returning()
  return row
}

// Idempotente: DATABASE_URL=... npm run db:seed:lessons
async function main() {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    console.error('defina DATABASE_URL antes de rodar o seed')
    process.exit(1)
  }

  const db = createDb(databaseUrl)
  for (const seed of LESSON_SEEDS) {
    const row = await upsertLessonSeed(db, seed)
    console.log(row ? `lição ${seed.code} criada/atualizada` : `lição ${seed.code} sem alteração`)
  }
  process.exit(0)
}

if (process.env.VITEST === undefined) {
  main().catch((err) => {
    console.error('erro ao rodar seed de lições:', err)
    process.exit(1)
  })
}
