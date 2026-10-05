import { describe, expect, it } from 'vitest'
import { sampleDetail } from '../../test/fakes/fakeMacroEventAdmin'
import { createNewsUserViewProjector } from './newsUserViewProjector'

describe('newsUserViewProjector', () => {
  it('evento pendente: o usuário não vê veredito, magnitude, efeitos nem alvos', () => {
    const view = createNewsUserViewProjector().project(sampleDetail)
    expect(view).toMatchObject({ title: 'título', direction: '', magnitude_band: '', targets: [] })
    expect(view.price_effect_pct).toBeUndefined()
  })

  it('evento aplicado: o usuário vê tudo', () => {
    const applied = { ...sampleDetail, status: 'aplicado' }
    expect(createNewsUserViewProjector().project(applied)).toEqual(applied)
  })
})
