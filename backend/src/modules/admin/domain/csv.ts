// CSV das exportações do painel (N.21). Puro: sem I/O, só a regra de escape.
export type CsvCell = string | number | boolean | Date | null | undefined

// Número em texto (valor monetário vindo do motor, "-12.50"): não é fórmula, não leva guarda.
const NUMERIC_TEXT = /^-?\d+(\.\d+)?$/

// Planilhas (Excel, Sheets) tratam célula que começa com = + - @ (ou tab/CR) como FÓRMULA. Um
// nome de usuário ou um texto de auditoria como `=HYPERLINK(...)` viraria execução ao abrir o
// arquivo (CSV injection). O apóstrofo na frente força texto; o dado original continua legível.
const FORMULA_START = /^[=+\-@\t\r]/

export function csvCell(value: CsvCell): string {
  if (value === null || value === undefined) return ''
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)

  let text = value
  if (FORMULA_START.test(text) && !NUMERIC_TEXT.test(text)) text = `'${text}`
  if (/[",\r\n]/.test(text)) text = `"${text.replace(/"/g, '""')}"`
  return text
}

// Linhas separadas por CRLF (RFC 4180) e BOM de UTF-8 na frente, pra o Excel abrir os acentos
// certos sem o usuário escolher a codificação.
const UTF8_BOM = String.fromCharCode(0xfeff)

export function toCsv(columns: string[], rows: CsvCell[][]): string {
  const lines = [columns, ...rows].map((row) => row.map(csvCell).join(','))
  return `${UTF8_BOM}${lines.join('\r\n')}\r\n`
}
