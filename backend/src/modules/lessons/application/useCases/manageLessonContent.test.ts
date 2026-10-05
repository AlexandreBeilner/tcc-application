import { describe, expect, it } from 'vitest'
import {
  InvalidLessonContentError,
  LessonNotFoundError,
  LessonRevisionNotFoundError,
  LessonUnchangedError,
} from '../../domain/errors'
import { contentOf, type LessonContent } from '../../domain/lessonContent'
import { createFakeLessonCatalogRepository } from '../../test/fakes/fakeLessonCatalogRepository'
import { buildCatalogLesson, LESSON_IDS } from '../../test/fakes/lessonFixtures'
import type { AssetTypeLookup } from '../ports/assetTypeLookup'
import {
  CreateLessonUseCase,
  GetLessonForEditUseCase,
  GetLessonRevisionUseCase,
  LessonContentValidator,
  RestoreLessonRevisionUseCase,
  UpdateLessonContentUseCase,
} from './manageLessonContent'

const ADMIN = 'admin-1'

function setup() {
  const catalog = createFakeLessonCatalogRepository([
    buildCatalogLesson({ id: LESSON_IDS.a, code: '0.1', sortOrder: 1 }),
    buildCatalogLesson({ id: LESSON_IDS.b, code: '0.2', sortOrder: 2 }),
  ])
  const types: Record<string, string> = { VALR3: 'acao', LFT2029: 'tesouro_selic' }
  const lookups: string[] = []
  const assets: AssetTypeLookup = {
    async typeOfTicker(ticker) {
      lookups.push(ticker)
      return types[ticker]
    },
  }
  const validator = new LessonContentValidator(assets)
  return { catalog, validator, lookups }
}

const edited = (base: LessonContent, overrides: Partial<LessonContent>): LessonContent => ({
  ...base,
  ...overrides,
})

describe('LessonContentValidator', () => {
  it('recusa com todas as mensagens juntas', async () => {
    const { validator } = setup()
    const content = { ...contentOf(buildCatalogLesson()), title: '', unlocksKeys: ['x'] }

    await expect(validator.validate(content)).rejects.toThrow(
      'o título é obrigatório; chave de desbloqueio desconhecida: x',
    )
  })

  it('live_indicator com ticker que não existe no catálogo é recusado', async () => {
    const { validator } = setup()
    const content = {
      ...contentOf(buildCatalogLesson()),
      microDecisionType: 'live_indicator' as const,
      microDecisionAssetTicker: 'NADA3',
    }

    await expect(validator.validate(content)).rejects.toThrow(
      'o ticker NADA3 não existe no catálogo',
    )
  })

  it('o ticker do produto desbloqueado precisa ser do tipo de uma das chaves asset:*', async () => {
    const { validator } = setup()
    const base = contentOf(buildCatalogLesson())

    await expect(
      validator.validate({ ...base, unlocksKeys: ['asset:cdb'], unlocksAssetTicker: 'VALR3' }),
    ).rejects.toThrow(
      'o ticker VALR3 é do tipo acao, que não está entre as chaves de produto da lição',
    )
    await expect(
      validator.validate({ ...base, unlocksKeys: ['asset:acao'], unlocksAssetTicker: 'VALR3' }),
    ).resolves.toEqual([])
  })

  it('não consulta o motor quando o conteúdo já é recusado por regra local', async () => {
    const { validator, lookups } = setup()
    const base = contentOf(buildCatalogLesson())

    await expect(
      validator.validate({
        ...base,
        title: '',
        microDecisionType: 'live_indicator',
        microDecisionAssetTicker: 'VALR3',
      }),
    ).rejects.toThrow(InvalidLessonContentError)
    expect(lookups).toEqual([])
  })
})

describe('UpdateLessonContentUseCase', () => {
  it('grava o conteúdo, devolve os campos alterados e os avisos, e guarda baseline + revisão', async () => {
    const { catalog, validator } = setup()
    const base = contentOf(catalog.lessons[0])

    const result = await new UpdateLessonContentUseCase(catalog, validator).execute(
      ADMIN,
      LESSON_IDS.a,
      edited(base, { title: 'Novo título', scenarioText: 'a — b' }),
    )

    expect(result.changedFields).toEqual(['title', 'scenarioText'])
    expect(result.warnings).toHaveLength(1)
    expect(result.lesson.title).toBe('Novo título')
    const history = await catalog.listRevisions(LESSON_IDS.a)
    expect(history.map((r) => r.action)).toEqual(['update', 'baseline'])
    expect(catalog.revisions.find((r) => r.action === 'baseline')?.content.title).toBe(
      'O que é investir',
    )
  })

  it('edição inválida é recusada com a mensagem do domínio e não grava nada', async () => {
    const { catalog, validator } = setup()
    const base = contentOf(catalog.lessons[0])

    await expect(
      new UpdateLessonContentUseCase(catalog, validator).execute(
        ADMIN,
        LESSON_IDS.a,
        edited(base, { microDecisionOptions: ['só uma'], microDecisionCorrectOption: 0 }),
      ),
    ).rejects.toThrow('a aposta tem de 2 a 6 opções')
    expect(catalog.lessons[0].title).toBe('O que é investir')
    expect(catalog.revisions).toEqual([])
  })

  it('edição sem mudança é recusada (sem revisão vazia) e lição inexistente é 404', async () => {
    const { catalog, validator } = setup()
    const useCase = new UpdateLessonContentUseCase(catalog, validator)

    await expect(
      useCase.execute(ADMIN, LESSON_IDS.a, contentOf(catalog.lessons[0])),
    ).rejects.toThrow(LessonUnchangedError)
    await expect(
      useCase.execute(ADMIN, LESSON_IDS.unknown, contentOf(catalog.lessons[0])),
    ).rejects.toThrow(LessonNotFoundError)
    expect(catalog.revisions).toEqual([])
  })
})

describe('CreateLessonUseCase', () => {
  it('cria depois da lição de referência, na trilha dela, com revisão create e a contagem de dispensados', async () => {
    const { catalog, validator } = setup()
    catalog.waivedUsers = 7
    const content = edited(contentOf(catalog.lessons[0]), { title: 'Lição nova' })

    const result = await new CreateLessonUseCase(catalog, validator).execute(ADMIN, {
      content,
      afterLessonId: LESSON_IDS.a,
    })

    expect(result.waivedUsers).toBe(7)
    expect(result.lesson).toMatchObject({
      title: 'Lição nova',
      sortOrder: 2,
      trackNumber: 0,
      published: true,
    })
    // A que ocupava a posição 2 foi empurrada pra 3.
    expect(catalog.lessons.find((l) => l.id === LESSON_IDS.b)?.sortOrder).toBe(3)
    expect(catalog.revisions.map((r) => r.action)).toEqual(['create'])
  })

  it('conteúdo inválido não cria nada; referência inexistente é 404', async () => {
    const { catalog, validator } = setup()
    const useCase = new CreateLessonUseCase(catalog, validator)
    const content = contentOf(catalog.lessons[0])

    await expect(
      useCase.execute(ADMIN, {
        content: edited(content, { title: '' }),
        afterLessonId: LESSON_IDS.a,
      }),
    ).rejects.toThrow(InvalidLessonContentError)
    await expect(
      useCase.execute(ADMIN, { content, afterLessonId: LESSON_IDS.unknown }),
    ).rejects.toThrow(LessonNotFoundError)
    expect(catalog.lessons).toHaveLength(2)
  })
})

describe('GetLessonForEditUseCase e GetLessonRevisionUseCase', () => {
  it('devolve a lição com o histórico, e a revisão com o retrato', async () => {
    const { catalog, validator } = setup()
    await new UpdateLessonContentUseCase(catalog, validator).execute(
      ADMIN,
      LESSON_IDS.a,
      edited(contentOf(catalog.lessons[0]), { title: 'v2' }),
    )

    const view = await new GetLessonForEditUseCase(catalog).execute(LESSON_IDS.a)
    expect(view.revisions).toHaveLength(2)
    const revision = await new GetLessonRevisionUseCase(catalog).execute(
      LESSON_IDS.a,
      view.revisions[0].id,
    )
    expect(revision.content.title).toBe('v2')
    await expect(
      new GetLessonRevisionUseCase(catalog).execute(LESSON_IDS.b, view.revisions[0].id),
    ).rejects.toThrow(LessonRevisionNotFoundError)
    await expect(new GetLessonForEditUseCase(catalog).execute(LESSON_IDS.unknown)).rejects.toThrow(
      LessonNotFoundError,
    )
  })
})

describe('RestoreLessonRevisionUseCase', () => {
  it('volta ao baseline gerando uma revisão restore (o histórico só cresce)', async () => {
    const { catalog, validator } = setup()
    await new UpdateLessonContentUseCase(catalog, validator).execute(
      ADMIN,
      LESSON_IDS.a,
      edited(contentOf(catalog.lessons[0]), { title: 'v2' }),
    )
    const baseline = catalog.revisions.find((r) => r.action === 'baseline')!

    const result = await new RestoreLessonRevisionUseCase(catalog, validator).execute(
      ADMIN,
      LESSON_IDS.a,
      baseline.id,
    )

    expect(result.lesson.title).toBe('O que é investir')
    expect(result.changedFields).toEqual(['title'])
    expect((await catalog.listRevisions(LESSON_IDS.a)).map((r) => r.action)).toEqual([
      'restore',
      'update',
      'baseline',
    ])
  })

  it('restaurar o que já está igual é recusado, revisão de outra lição é 404, e conteúdo que deixou de valer é recusado', async () => {
    const { catalog, validator } = setup()
    const useCase = new RestoreLessonRevisionUseCase(catalog, validator)
    await new UpdateLessonContentUseCase(catalog, validator).execute(
      ADMIN,
      LESSON_IDS.a,
      edited(contentOf(catalog.lessons[0]), { title: 'v2' }),
    )
    const latest = catalog.revisions.at(-1)!

    await expect(useCase.execute(ADMIN, LESSON_IDS.a, latest.id)).rejects.toThrow(
      LessonUnchangedError,
    )
    await expect(useCase.execute(ADMIN, LESSON_IDS.b, latest.id)).rejects.toThrow(
      LessonRevisionNotFoundError,
    )

    // Um retrato antigo com um ticker que o catálogo não tem mais não é restaurável.
    catalog.revisions.push({
      ...latest,
      id: '00000000-0000-4000-8000-0000000000aa',
      content: {
        ...latest.content,
        title: 'v0',
        microDecisionType: 'live_indicator',
        microDecisionAssetTicker: 'SUMIU3',
      },
    })
    await expect(
      useCase.execute(ADMIN, LESSON_IDS.a, '00000000-0000-4000-8000-0000000000aa'),
    ).rejects.toThrow('o ticker SUMIU3 não existe no catálogo')
  })
})
