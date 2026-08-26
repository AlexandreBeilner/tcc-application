import { describe, expect, it } from 'vitest'
import { createFakeCatalogReader } from '../../test/fakes/fakeCatalogReader'
import { GetCompanyUseCase } from './getCompany'

describe('GetCompanyUseCase', () => {
  it('busca a empresa pelo id no CatalogReader', async () => {
    const company = {
      id: 'company-1',
      name: 'Petrobras',
      cnpj: '12345678000199',
      sector: 'Energia',
      assets: [],
      fundamentals: [],
    }
    const catalogReader = createFakeCatalogReader({ company })
    const useCase = new GetCompanyUseCase(catalogReader)

    const result = await useCase.execute({ id: 'company-1' })

    expect(result).toEqual(company)
    expect(catalogReader.getCompanyCalls).toEqual(['company-1'])
  })
})
