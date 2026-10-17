import { spawn, spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { createInterface } from 'node:readline'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { collectAcceptedForms } from '../modules/daily/content/veroFilter'
import { OFFENSIVE_WORDS } from '../modules/daily/content/offensiveWords'

// Gera `acceptedWords.vero.txt`, a lista de palavras aceitas como palpite do Termo (seção 3.1 do
// backlog do Diário), a partir do dicionário VERO (pt-BR) do repositório `dictionaries` do
// LibreOffice. Reproduzível: o commit do VERO é fixo e os arquivos baixados têm o SHA-256 conferido;
// rodar de novo para o mesmo commit gera o mesmo arquivo, byte a byte.
//
//   npm run daily:generate-words [-- --cache <pasta>]
//
// Precisa do `unmunch` (pacote `hunspell-tools`). Sem ele no PATH, roda dentro de uma imagem
// Debian fixa por digest no Docker.

const VERO_REPOSITORY = 'https://github.com/LibreOffice/dictionaries'
const VERO_COMMIT = '67032ee957631908098a72edf48dc81cac27e369'
const VERO_FILES: Record<string, string> = {
  'pt_BR.dic': 'a38bfb26b68ece2834e79fe83e48d5792652970ace12db89d1b9674bf9933183',
  'pt_BR.aff': '21d8ad2a769a60e17e2b5ea4ef11d4d593a58b9e2a82d642ef82d6a4c5523865',
  'README_pt_BR.txt': '9974ce691fdc1fe731717d7a2dc668244405fdc2bf9bf3367eb9b29e85177c88',
}
const DOCKER_IMAGE =
  'debian:12-slim@sha256:7c7b2c966bc9ee8cedfeef67e0e279108992c77681fa595db4a9d65c06ccc587'

const OUTPUT = resolve(__dirname, '../modules/daily/content/acceptedWords.vero.txt')
const SCRIPT_PATH = 'backend/src/scripts/generateDailyAcceptedWords.ts'

function sha256(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex')
}

async function download(cacheDir: string): Promise<void> {
  mkdirSync(cacheDir, { recursive: true })
  for (const [name, expected] of Object.entries(VERO_FILES)) {
    const path = join(cacheDir, name)
    if (existsSync(path) && sha256(readFileSync(path)) === expected) continue
    const url = `https://raw.githubusercontent.com/LibreOffice/dictionaries/${VERO_COMMIT}/pt_BR/${name}`
    const response = await fetch(url)
    if (!response.ok) throw new Error(`falha ao baixar ${url}: ${response.status}`)
    const buffer = Buffer.from(await response.arrayBuffer())
    const actual = sha256(buffer)
    if (actual !== expected) {
      throw new Error(
        `${name}: SHA-256 ${actual} difere do esperado ${expected} (commit ${VERO_COMMIT})`,
      )
    }
    writeFileSync(path, buffer)
  }
}

function hasLocalUnmunch(): boolean {
  return spawnSync('unmunch', ['--help'], { stdio: 'ignore' }).error === undefined
}

// `unmunch` imprime uma forma por linha (dezenas de milhões); lê-se em fluxo, sem guardar tudo.
async function* expandedForms(cacheDir: string): AsyncGenerator<string> {
  const dic = join(cacheDir, 'pt_BR.dic')
  const aff = join(cacheDir, 'pt_BR.aff')
  const child = hasLocalUnmunch()
    ? spawn('unmunch', [dic, aff], { stdio: ['ignore', 'pipe', 'ignore'] })
    : spawn(
        'docker',
        [
          'run',
          '--rm',
          '-v',
          `${cacheDir}:/vero:ro`,
          DOCKER_IMAGE,
          'sh',
          '-c',
          'apt-get update -qq >/dev/null && apt-get install -y -qq hunspell-tools >/dev/null 2>&1 && unmunch /vero/pt_BR.dic /vero/pt_BR.aff 2>/dev/null',
        ],
        { stdio: ['ignore', 'pipe', 'inherit'] },
      )
  const exit = new Promise<number>((done) => child.on('close', (code) => done(code ?? 1)))
  for await (const line of createInterface({ input: child.stdout!, crlfDelay: Infinity })) {
    yield line
  }
  const code = await exit
  if (code !== 0) throw new Error(`unmunch terminou com código ${code}`)
}

function header(count: number): string {
  return [
    '# Palavras aceitas como palpite do Termo (Diário Selucra). ARQUIVO GERADO, não edite à mão.',
    `# Origem: dicionário VERO (pt-BR), ${VERO_REPOSITORY}/tree/${VERO_COMMIT}/pt_BR`,
    '# Licença do VERO: LGPL 3 e MPL (dupla), copyright Raimundo Santos Moura e equipe. Ver NOTICE.',
    `# Gerado por ${SCRIPT_PATH} (unmunch do hunspell, depois filtro de veroFilter.ts).`,
    '# Filtro: só letras minúsculas, 4 a 9 letras sem acento, fora nomes próprios e a lista de ofensivas.',
    `# Formas: ${count}. Uma por linha, em maiúsculas sem acento, em ordem alfabética.`,
    '',
  ].join('\n')
}

async function main() {
  const flag = process.argv.indexOf('--cache')
  const cacheDir = resolve(
    flag >= 0 ? process.argv[flag + 1] : join(tmpdir(), `vero-${VERO_COMMIT.slice(0, 12)}`),
  )
  await download(cacheDir)
  const forms = await collectAcceptedForms(expandedForms(cacheDir), new Set(OFFENSIVE_WORDS))
  writeFileSync(OUTPUT, header(forms.length) + forms.join('\n') + '\n')
  console.log(`${forms.length} formas gravadas em ${OUTPUT}`)
}

main().catch((err) => {
  console.error('erro ao gerar a lista de palavras aceitas:', err)
  process.exit(1)
})
