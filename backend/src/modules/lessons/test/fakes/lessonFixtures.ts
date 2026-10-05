import type { CatalogLesson } from '../../domain/lessonCatalog'

export const LESSON_IDS = {
  a: '6f9619ff-8b86-d011-b42d-00c04fc96411',
  b: '6f9619ff-8b86-d011-b42d-00c04fc96422',
  c: '6f9619ff-8b86-d011-b42d-00c04fc96433',
  unknown: '6f9619ff-8b86-d011-b42d-00c04fc964ff',
}

export function buildCatalogLesson(overrides: Partial<CatalogLesson> = {}): CatalogLesson {
  return {
    id: LESSON_IDS.a,
    code: '0.1',
    title: 'O que é investir',
    trackNumber: 0,
    trackName: 'Trilha 0: Fundamentos',
    sortOrder: 1,
    centralConcept: 'Investir é abrir mão de consumo hoje',
    scenarioText: 'Cenário',
    microDecisionPrompt: 'Pense',
    microDecisionType: 'reflection',
    microDecisionAssetTicker: null,
    revelationText: 'Revelação',
    unlocksDescription: null,
    unlocksKeys: [],
    unlocksAssetTicker: null,
    microDecisionOptions: null,
    microDecisionCorrectOption: null,
    published: true,
    ...overrides,
  }
}
