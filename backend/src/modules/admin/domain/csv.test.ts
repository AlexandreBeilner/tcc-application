import { describe, expect, it } from 'vitest'
import { csvCell, toCsv } from './csv'

describe('csvCell', () => {
  it.each([
    [null, ''],
    [undefined, ''],
    [42, '42'],
    [-3.5, '-3.5'],
    [true, 'true'],
    [new Date('2026-10-06T12:00:00Z'), '2026-10-06T12:00:00.000Z'],
    ['texto simples', 'texto simples'],
  ])('%s vira %s', (input, expected) => {
    expect(csvCell(input)).toBe(expected)
  })

  it('aspa o que tem vírgula, aspas ou quebra de linha, dobrando as aspas', () => {
    expect(csvCell('a,b')).toBe('"a,b"')
    expect(csvCell('diz "oi"')).toBe('"diz ""oi"""')
    expect(csvCell('linha1\nlinha2')).toBe('"linha1\nlinha2"')
  })

  it.each(['=SOMA(A1)', '+1+1', '-2+3', '@cmd', '\tcmd', '=HYPERLINK("http://x","clique")'])(
    'neutraliza fórmula (CSV injection): %s',
    (input) => {
      expect(csvCell(input).replace(/^"/, '')).toMatch(/^'/)
    },
  )

  it('número em texto, mesmo negativo, não leva a guarda (é dado, não fórmula)', () => {
    expect(csvCell('-12.50')).toBe('-12.50')
    expect(csvCell('10.00')).toBe('10.00')
  })

  it('a guarda vale também quando a célula precisa de aspas', () => {
    expect(csvCell('=a,b')).toBe(`"'=a,b"`)
  })
})

describe('toCsv', () => {
  it('cabeçalho e linhas em CRLF, com BOM de UTF-8', () => {
    const csv = toCsv(
      ['id', 'nome'],
      [
        [1, 'Ana'],
        [2, 'João, o Grande'],
      ],
    )
    expect(csv).toBe('﻿id,nome\r\n1,Ana\r\n2,"João, o Grande"\r\n')
  })

  it('sem linhas devolve só o cabeçalho', () => {
    expect(toCsv(['a'], [])).toBe('﻿a\r\n')
  })
})
