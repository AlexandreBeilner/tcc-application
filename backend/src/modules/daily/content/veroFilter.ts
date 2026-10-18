import { MAX_WORD_LENGTH, MIN_WORD_LENGTH, normalizeWord } from '../domain/wordGuess'

// Filtro das formas expandidas do VERO (seção 3.1 do backlog do Diário). Recebe uma forma por linha,
// como sai do `unmunch`, e devolve a forma normalizada que entra na lista aceita, ou `null`.
//
// Regras: só letras minúsculas (maiúscula = nome próprio ou sigla; hífen, dígito e apóstrofo saem),
// de 4 a 9 letras depois de normalizar (maiúsculas, sem acento) e fora da lista de ofensivas.
const LOWERCASE_LETTERS = /^\p{Ll}+$/u
const ACCEPTED_SHAPE = new RegExp(`^[A-Z]{${MIN_WORD_LENGTH},${MAX_WORD_LENGTH}}$`)

export function toAcceptedForm(raw: string, offensive: ReadonlySet<string>): string | null {
  const form = raw.replace(/^\uFEFF/, '').trim()
  if (!LOWERCASE_LETTERS.test(form)) return null
  const normalized = normalizeWord(form)
  if (!ACCEPTED_SHAPE.test(normalized)) return null
  if (offensive.has(normalized)) return null
  return normalized
}

// Resultado ordenado e sem repetição: o mesmo conjunto de entrada gera sempre o mesmo arquivo.
export async function collectAcceptedForms(
  lines: Iterable<string> | AsyncIterable<string>,
  offensive: ReadonlySet<string>,
): Promise<string[]> {
  const forms = new Set<string>()
  for await (const line of lines) {
    const form = toAcceptedForm(line, offensive)
    if (form !== null) forms.add(form)
  }
  return [...forms].sort()
}
