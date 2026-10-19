import { describe, expect, it } from 'vitest'
import { ADMIN, buildAdminWorld, eventFixture } from '../../../test/adminWorld'

const TODAY = '2026-10-20T12:00:00Z'
const START = '2026-11-10'

const newWord = {
  display: 'Selic',
  definition: 'A taxa básica de juros da economia.',
  category: 'juros-e-inflacao',
  scope: 'brasil' as const,
  learnMore: null,
}

describe('palavras', () => {
  it('cria palavra da lista aceita, normalizando a resposta', async () => {
    const w = buildAdminWorld({ startDate: null, now: TODAY })
    const word = await w.createWord.execute(newWord)
    expect(word).toMatchObject({ answer: 'SELIC', stableKey: 'w:selic', active: true })
  })

  it('recusa palavra-resposta fora da lista aceita', async () => {
    const w = buildAdminWorld({ startDate: null, now: TODAY })
    await expect(w.createWord.execute({ ...newWord, display: 'Zzyzx' })).rejects.toMatchObject({
      problems: ['palavra Zzyzx: fora da lista aceita'],
    })
  })

  it('recusa palavra repetida, categoria desconhecida e travessão', async () => {
    const w = buildAdminWorld({ startDate: null, now: TODAY })
    await w.createWord.execute(newWord)
    await expect(w.createWord.execute(newWord)).rejects.toMatchObject({ code: 'duplicate' })
    await expect(
      w.createWord.execute({ ...newWord, display: 'Copom', category: 'xyz' }),
    ).rejects.toMatchObject({
      problems: expect.arrayContaining(['palavra Copom: categoria xyz desconhecida']),
    })
    await expect(
      w.createWord.execute({ ...newWord, definition: 'Juros — básicos' }),
    ).rejects.toBeDefined()
  })

  it('o texto mostrado não pode virar outra palavra', async () => {
    const w = buildAdminWorld({ startDate: null, now: TODAY })
    const word = await w.createWord.execute(newWord)
    await expect(
      w.updateWord.execute(ADMIN, word.id, { display: 'Copom' }, false),
    ).rejects.toMatchObject({
      problems: ['o texto mostrado precisa continuar sendo a mesma palavra'],
    })
  })

  it('editar a definição de palavra em jogo publicado pede confirmação', async () => {
    const w = buildAdminWorld({ startDate: null, now: TODAY })
    await w.prepareDraft.execute(START)
    await w.publishPuzzles.execute()
    const used = w.puzzles.items.find((p) => p.number === 1)!.wordId
    await expect(
      w.updateWord.execute(ADMIN, used, { definition: 'Nova definição.' }, false),
    ).rejects.toMatchObject({ code: 'confirmation_required' })
    const result = await w.updateWord.execute(ADMIN, used, { definition: 'Nova definição.' }, true)
    expect(result.changedFields).toEqual(['definition'])
    expect(result.affectedPuzzles).toContain(1)
  })

  it('desativar uma palavra já agendada avisa os jogos afetados, sem tirá-la do jogo', async () => {
    const w = buildAdminWorld({ startDate: null, now: TODAY })
    await w.prepareDraft.execute(START)
    const used = w.puzzles.items.find((p) => p.number === 4)!.wordId
    const result = await w.updateWord.execute(ADMIN, used, { active: false }, false)
    expect(result.affectedPuzzles).toEqual([4])
    expect(w.puzzles.items.find((p) => p.number === 4)!.wordId).toBe(used)
  })
})

describe('lista extra de palavras aceitas', () => {
  it('adiciona normalizada, recusa repetida e malformada', async () => {
    const w = buildAdminWorld({ startDate: null, now: TODAY })
    expect(await w.addAcceptedWord.execute('  copóm ')).toEqual({ word: 'COPOM' })
    await expect(w.addAcceptedWord.execute('copom')).rejects.toMatchObject({ code: 'duplicate' })
    await expect(w.addAcceptedWord.execute('ab')).rejects.toBeDefined()
    await expect(w.addAcceptedWord.execute('ab1cd')).rejects.toBeDefined()
    expect(await w.listAcceptedExtra.execute()).toEqual(['COPOM', 'SELIC'])
  })

  it('remove só da lista extra e nunca uma palavra-resposta', async () => {
    const w = buildAdminWorld({ startDate: null, now: TODAY })
    await w.createWord.execute(newWord)
    await expect(w.removeAcceptedWord.execute('selic')).rejects.toMatchObject({
      code: 'word_in_use',
    })
    await w.addAcceptedWord.execute('copom')
    expect(await w.removeAcceptedWord.execute('COPOM')).toEqual({ word: 'COPOM' })
    // Palavra do dicionário não está na lista extra: não há o que remover.
    await expect(w.removeAcceptedWord.execute(w.words.items[0].answer)).rejects.toMatchObject({
      code: 'word_in_use',
    })
    await expect(w.removeAcceptedWord.execute('carro')).rejects.toBeDefined()
  })
})

const newQuestion = {
  question: 'Quem fixa a meta de inflação?',
  options: ['Copom', 'CMN', 'CVM', 'IBGE'],
  correctIndex: 1,
  explanation: 'O Conselho Monetário Nacional fixa a meta.',
  sourceRef: 'Decreto 3.088/1999',
  learnMore: null,
  category: 'juros-e-inflacao',
  scope: 'brasil' as const,
}

describe('perguntas', () => {
  it('cria sem revisão, com chave estável própria', async () => {
    const w = buildAdminWorld({ startDate: null, now: TODAY })
    const q = await w.createQuestion.execute(newQuestion)
    expect(q.stableKey).toMatch(/^q:m-/)
    expect(q.reviewedAt).toBeNull()
  })

  it('recusa pergunta sem fonte, com gabarito fora das alternativas ou alternativas repetidas', async () => {
    const w = buildAdminWorld({ startDate: null, now: TODAY })
    await expect(
      w.createQuestion.execute({ ...newQuestion, sourceRef: '  ' }),
    ).rejects.toMatchObject({
      problems: expect.arrayContaining([expect.stringContaining('sem fonte primária')]),
    })
    await expect(
      w.createQuestion.execute({ ...newQuestion, correctIndex: 4 }),
    ).rejects.toBeDefined()
    await expect(
      w.createQuestion.execute({ ...newQuestion, options: ['a', 'a', 'b'] }),
    ).rejects.toBeDefined()
    await expect(
      w.createQuestion.execute({ ...newQuestion, options: ['só uma'] }),
    ).rejects.toBeDefined()
  })

  it('editar o texto mostrado atualiza a pergunta e avisa os jogos afetados', async () => {
    const w = buildAdminWorld({ startDate: null, now: TODAY })
    await w.prepareDraft.execute(START)
    const used = w.puzzles.items.find((p) => p.number === 2)!.questionId
    const result = await w.updateQuestion.execute(
      ADMIN,
      used,
      { question: 'Outra pergunta?' },
      false,
    )
    expect(result.item.question).toBe('Outra pergunta?')
    expect(result.affectedPuzzles).toEqual([2])
  })

  it('o patch com campo ausente (undefined) não apaga o valor atual', async () => {
    const w = buildAdminWorld({ startDate: null, now: TODAY })
    const q = w.questions.items[0]
    const result = await w.updateQuestion.execute(
      ADMIN,
      q.id,
      { explanation: 'Texto novo.', question: undefined },
      false,
    )
    expect(result.item.question).toBe(q.question)
    expect(result.changedFields).toEqual(['explanation'])
  })
})

const newEvent = {
  year: 1994,
  label: 'Lançamento da nova moeda',
  explanation: 'O real entrou em circulação em julho.',
  sourceRef: 'Lei 8.880/1994',
  learnMore: null,
  category: 'planos-e-moeda',
  scope: 'brasil' as const,
}

describe('eventos', () => {
  it('cria evento válido', async () => {
    const w = buildAdminWorld({ startDate: null, now: TODAY })
    const e = await w.createEvent.execute(newEvent)
    expect(e).toMatchObject({ year: 1994, active: true, reviewedAt: null })
  })

  it('recusa sem fonte, nome que entrega o ano e ano fora do intervalo', async () => {
    const w = buildAdminWorld({ startDate: null, now: TODAY })
    await expect(w.createEvent.execute({ ...newEvent, sourceRef: '' })).rejects.toBeDefined()
    await expect(
      w.createEvent.execute({ ...newEvent, label: 'Real de 1994' }),
    ).rejects.toMatchObject({
      problems: expect.arrayContaining([expect.stringContaining('entrega o ano')]),
    })
    await expect(w.createEvent.execute({ ...newEvent, year: 1200 })).rejects.toBeDefined()
    await expect(w.createEvent.execute({ ...newEvent, year: 3000 })).rejects.toBeDefined()
  })

  it('editar o ano de evento em jogo publicado pede confirmação', async () => {
    const w = buildAdminWorld({ startDate: null, now: TODAY })
    await w.prepareDraft.execute(START)
    await w.publishPuzzles.execute()
    const id = w.puzzles.items.find((p) => p.number === 1)!.timelineEventIds[0]
    await expect(w.updateEvent.execute(ADMIN, id, { year: 1801 }, false)).rejects.toMatchObject({
      code: 'confirmation_required',
    })
    expect(eventFixture(0).year).toBe(1800)
  })
})
