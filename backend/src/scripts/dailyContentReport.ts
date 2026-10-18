import { readAcceptedWordsFile } from '../modules/daily/content/acceptedWordsFile'
import { buildContentReport, type ContentReport } from '../modules/daily/content/contentReport'
import { INITIAL_CONTENT } from '../modules/daily/content/dailyContent'
import { EXTRA_ACCEPTED_WORDS } from '../modules/daily/content/extraAcceptedWords'

// Uso: npm run daily:report
// Mostra o estoque de conteúdo do Diário e roda a validação do seed. Sai com código 1 se houver erro.

function histogram(values: Record<string, number>): string {
  const entries = Object.entries(values).sort((a, b) => b[1] - a[1])
  return entries.length === 0 ? '(vazio)' : entries.map(([name, n]) => `${name} ${n}`).join(' · ')
}

function print(report: ContentReport): void {
  const pct = (share: number) => `${Math.round(share * 100)}% Brasil`
  console.log('== Estoque ==')
  console.log(
    `palavras ${report.counts.words} · perguntas ${report.counts.questions} · eventos ${report.counts.events}`,
  )
  console.log(
    `dias sem repetir: palavras ${report.runwayDays.words} · perguntas ${report.runwayDays.questions} · eventos ${report.runwayDays.events}`,
  )
  if (report.belowFloor.length > 0) console.log(`ABAIXO DO MÍNIMO: ${report.belowFloor.join('; ')}`)

  console.log('\n== Palavras ==')
  console.log(pct(report.words.brasilShare), '|', histogram(report.words.byCategory))
  console.log('\n== Perguntas ==')
  console.log(pct(report.questions.brasilShare), '|', histogram(report.questions.byCategory))
  console.log('posição do gabarito:', histogram(report.questions.correctIndex))
  console.log('\n== Eventos ==')
  console.log(pct(report.events.brasilShare), '|', histogram(report.events.byCategory))
  console.log(
    `anos distintos ${report.events.distinctYears} | décadas:`,
    histogram(report.events.byDecade),
  )

  const gaps = [
    ['palavras', report.words.emptyCategories],
    ['perguntas', report.questions.emptyCategories],
    ['eventos', report.events.emptyCategories],
  ] as const
  console.log('\n== Categorias sem nenhum item ==')
  for (const [bank, empty] of gaps)
    console.log(`${bank}: ${empty.length === 0 ? 'nenhuma' : empty.join(', ')}`)

  if (report.nearLimit.length > 0)
    console.log(`\nExplicação perto do teto: ${report.nearLimit.join(', ')}`)
  if (report.possibleDuplicates.length > 0) {
    console.log('\n== Possíveis duplicatas (conferir à mão) ==')
    for (const line of report.possibleDuplicates) console.log(`- ${line}`)
  }
  console.log('\n== Validação ==')
  if (report.errors.length === 0) console.log('OK, sem erros.')
  for (const error of report.errors) console.log(`ERRO: ${error}`)
}

const report = buildContentReport(
  INITIAL_CONTENT,
  new Set([...readAcceptedWordsFile(), ...EXTRA_ACCEPTED_WORDS]),
)
print(report)
process.exit(report.errors.length === 0 ? 0 : 1)
