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
      'técnica, mas muda tudo — o dinheiro rende sempre sobre o capital original (juros simples) ou sobre o ' +
      'saldo já com os juros anteriores embutidos (juros compostos)?',
    microDecisionPrompt:
      'Use a calculadora abaixo com o mesmo capital e o mesmo aporte mensal, alternando entre os modos ' +
      'Simples e Composto, e compare o total ao final do período antes de continuar.',
    microDecisionType: 'growth_calculator',
    microDecisionAssetTicker: null,
    revelationText:
      'No regime simples, o montante cresce de forma linear: M = C × (1 + i × n). No composto, cada período ' +
      'rende sobre o saldo já capitalizado: M = C × (1 + i)ⁿ. No curto prazo a diferença é pequena; em ' +
      'horizontes longos ela explode — é a mesma taxa produzindo curvas completamente diferentes. É por isso ' +
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
      'esse mesmo cesto custa mais — e os mesmos R$100 já não compram tudo o que compravam antes.',
    microDecisionPrompt: 'Se a inflação de um ano for 5%, quanto vai custar, no ano que vem, algo que custa R$100 hoje?',
    microDecisionType: 'reflection',
    microDecisionAssetTicker: null,
    revelationText:
      'R$105 — o valor nominal do seu dinheiro continua sendo R$100, mas o poder de compra desse dinheiro ' +
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
      'Um CDB rendeu 8% em um ano — parece um bom retorno. Mas nesse mesmo ano a inflação (IPCA) foi de 6%. ' +
      'Quanto sobrou de fato desse 8%, depois de descontar a inflação?',
    microDecisionPrompt:
      'Rendimento real é, aproximadamente, rendimento nominal menos inflação. Nesse exemplo (8% nominal, 6% ' +
      'de inflação), o rendimento real fica perto de quanto?',
    microDecisionType: 'reflection',
    microDecisionAssetTicker: null,
    revelationText:
      'Perto de 2%. A aproximação nominal − inflação já dá uma boa noção, mas a conta exata (equação de ' +
      'Fisher) é (1 + nominal) / (1 + inflação) − 1 = (1,08 / 1,06) − 1 ≈ 1,89%, sempre um pouco menor que a ' +
      'aproximação simples — quanto maior a inflação do período, maior essa diferença. Todo indicador de ' +
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
      'Com a Selic simulada nesta plataforma rodando acima de 8,5% ao ano, a poupança rende 0,5% ao mês — ' +
      'cerca de 6,17% ao ano em juros compostos. Isso é maior, menor ou igual ao que rende um Tesouro Selic, ' +
      'que acompanha ~100% da Selic?',
    microDecisionType: 'reflection',
    microDecisionAssetTicker: null,
    revelationText:
      'Menor — sempre que a Selic está acima de 8,5% a.a. (o cenário mais comum), a poupança rende uma ' +
      'fração fixa (0,5% a.m.) que fica abaixo dos 100% da Selic que o Tesouro Selic paga. É por isso que a ' +
      'poupança "geralmente perde": ela não acompanha a taxa básica de juros, só uma regra fixa desenhada ' +
      'pra ficar sempre um pouco atrás dela. A partir de agora, a Trilha 1 (Renda Fixa) está liberada — é lá ' +
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
    scenarioText: '',
    microDecisionPrompt: '',
    microDecisionType: 'reflection',
    microDecisionAssetTicker: null,
    revelationText: '',
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
