import type { LessonBlocks, PollBlock } from './widgets/lessonBlocks'
import { allBlocks } from './widgets/lessonBlocks'

// Enquete da comunidade (LJ.2.6). Resultado só com votos suficientes (LJ-D5): com poucos votos a
// distribuição identifica a opinião de quem votou, e a frase "você está entre os primeiros" é mais
// honesta que uma porcentagem de meia dúzia de pessoas.
export const POLL_MIN_VOTES = 20

export interface PollResults {
  total: number
  // Percentual inteiro por opção, na ordem de autoria; soma sempre 100.
  percentages: number[]
}

// O que o cliente sabe de uma enquete: o voto da própria pessoa e, quando há votos suficientes, o
// resultado agregado. Nunca nome, nunca lista de quem votou.
export interface PollState {
  pollId: string
  vote: number
  results?: PollResults
}

export interface OptionCount {
  option: number
  count: number
}

// Distribui os percentuais pelo maior resto, pra a soma fechar em 100 sem uma opção "perder" 1%.
export function buildPollResults(
  optionsCount: number,
  counts: readonly OptionCount[],
): PollResults | undefined {
  const perOption = Array.from({ length: optionsCount }, () => 0)
  for (const { option, count } of counts) {
    if (option >= 0 && option < optionsCount) perOption[option] = (perOption[option] ?? 0) + count
  }
  const total = perOption.reduce((sum, n) => sum + n, 0)
  if (total < POLL_MIN_VOTES) return undefined

  const exact = perOption.map((n) => (n * 100) / total)
  const percentages = exact.map(Math.floor)
  let missing = 100 - percentages.reduce((sum, n) => sum + n, 0)
  const byRemainder = exact
    .map((value, index) => ({ index, remainder: value - Math.floor(value) }))
    .sort((a, b) => b.remainder - a.remainder || a.index - b.index)
  for (const { index } of byRemainder) {
    if (missing <= 0) break
    percentages[index] = (percentages[index] ?? 0) + 1
    missing -= 1
  }
  return { total, percentages }
}

export function pollBlocks(blocks: LessonBlocks | null | undefined): PollBlock[] {
  return allBlocks(blocks).filter((b): b is PollBlock => b.type === 'poll')
}

export function isValidPollOption(block: PollBlock, option: unknown): option is number {
  return (
    Number.isInteger(option) && (option as number) >= 0 && (option as number) < block.options.length
  )
}

export function buildPollState(
  block: PollBlock,
  vote: number,
  counts: readonly OptionCount[],
): PollState {
  const results = buildPollResults(block.options.length, counts)
  return { pollId: block.id, vote, ...(results ? { results } : {}) }
}
