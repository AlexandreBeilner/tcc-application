import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// Lê o arquivo gerado pelo script `daily:generate-words`: uma palavra por linha, linhas de
// cabeçalho começam com `#`.
export const VERO_WORDS_FILE = join(__dirname, 'acceptedWords.vero.txt')

export function readAcceptedWordsFile(path: string = VERO_WORDS_FILE): string[] {
  return readFileSync(path, 'utf8')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('#'))
}
