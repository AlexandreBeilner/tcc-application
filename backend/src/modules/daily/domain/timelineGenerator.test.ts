import { describe, expect, it } from 'vitest'
import { generateTimeline, TIMELINE_SIZE } from './timelineGenerator'

// 40 fatos, com anos repetidos de propósito (dois por ano).
const bank = Array.from({ length: 40 }, (_, i) => ({
  id: `f${String(i).padStart(2, '0')}`,
  year: 1970 + Math.floor(i / 2),
}))

describe('generateTimeline', () => {
  it('mesma data => mesmo jogo, mesmo na ordem inversa do banco', () => {
    const a = generateTimeline('2026-11-03', bank)
    expect(generateTimeline('2026-11-03', bank)).toEqual(a)
    expect(generateTimeline('2026-11-03', [...bank].reverse())).toEqual(a)
  })

  it('datas diferentes => jogos diferentes', () => {
    const games = new Set<string>()
    for (let day = 1; day <= 30; day++) {
      const game = generateTimeline(`2026-11-${String(day).padStart(2, '0')}`, bank)
      games.add(game!.map((e) => e.id).join(','))
    }
    expect(games.size).toBeGreaterThan(25)
  })

  it('sempre 4 fatos, nunca dois do mesmo ano, nunca já em ordem', () => {
    for (let day = 0; day < 200; day++) {
      const date = new Date(Date.UTC(2026, 10, 3 + day)).toISOString().slice(0, 10)
      const game = generateTimeline(date, bank)!
      expect(game).toHaveLength(TIMELINE_SIZE)
      expect(new Set(game.map((e) => e.year)).size).toBe(TIMELINE_SIZE)
      const years = game.map((e) => e.year)
      expect(years).not.toEqual([...years].sort((x, y) => x - y))
    }
  })

  it('banco sem 4 anos distintos => null', () => {
    const poor = [
      { id: 'a', year: 1994 },
      { id: 'b', year: 1994 },
      { id: 'c', year: 2008 },
      { id: 'd', year: 2008 },
      { id: 'e', year: 2017 },
    ]
    expect(generateTimeline('2026-11-03', poor)).toBeNull()
    expect(generateTimeline('2026-11-03', [])).toBeNull()
  })

  it('banco com exatamente 4 anos distintos usa todos', () => {
    const exact = [1990, 1994, 2008, 2017].map((year) => ({ id: `y${year}`, year }))
    expect(
      generateTimeline('2026-11-03', exact)!
        .map((e) => e.year)
        .sort(),
    ).toEqual([1990, 1994, 2008, 2017])
  })
})
