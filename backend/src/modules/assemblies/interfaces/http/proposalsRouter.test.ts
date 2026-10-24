import express from 'express'
import request from 'supertest'
import { beforeEach, describe, expect, it } from 'vitest'
import { createAuthMiddleware } from '../../../../shared/http/authMiddleware'
import { jsonErrorHandler } from '../../../../shared/http/errorHandler'
import { createFakeTokenIssuer } from '../../../auth/test/fakes/fakeTokenIssuer'
import { ListCompanyProposalsUseCase } from '../../application/useCases/listCompanyProposals'
import { ProposeAgendaUseCase } from '../../application/useCases/proposeAgenda'
import { SupportProposalUseCase } from '../../application/useCases/supportProposal'
import { WithdrawProposalSupportUseCase } from '../../application/useCases/withdrawProposalSupport'
import { DEFAULT_PROPOSAL_PARAMS } from '../../domain/proposals'
import { SHAREHOLDER_KIND } from '../../domain/shareholderPolicies'
import { createFakeProposalRepository } from '../../test/fakes/fakeProposalRepository'
import { createProposalsRouter } from './proposalsRouter'

const ANA = '11111111-1111-4111-8111-111111111111'
const BIA = '22222222-2222-4222-8222-222222222222'
const ZECA = '33333333-3333-4333-8333-333333333333'
const COMPANY = '44444444-4444-4444-8444-444444444444'

function buildApp(cooldownDaysLeft = 0) {
  const repository = createFakeProposalRepository()
  const standings = {
    get: async (companyId: string, userId: string) =>
      companyId === COMPANY
        ? {
            companyId,
            name: 'Acme',
            sector: 'Varejo',
            holdsShares: userId !== ZECA,
            cooldownDaysLeft,
          }
        : null,
  }
  const catalog = {
    listActive: async () => [
      {
        key: 'geral',
        kind: SHAREHOLDER_KIND,
        sector: null,
        title: 'Pauta geral',
        description: 'd',
        options: [
          { key: 'a', label: 'A', gain: 'g', loss: 'l', effect: {} },
          { key: 'b', label: 'B', gain: 'g', loss: 'l', effect: {} },
        ],
      },
    ],
  }
  const params = () => DEFAULT_PROPOSAL_PARAMS
  const tokenIssuer = createFakeTokenIssuer()
  const app = express()
  app.use(express.json())
  app.use(
    createProposalsRouter({
      listCompanyProposals: new ListCompanyProposalsUseCase(standings, catalog, repository, params),
      proposeAgenda: new ProposeAgendaUseCase(standings, catalog, repository, params),
      supportProposal: new SupportProposalUseCase(standings, repository, params),
      withdrawSupport: new WithdrawProposalSupportUseCase(repository),
      authMiddleware: createAuthMiddleware(tokenIssuer),
    }),
  )
  app.use(jsonErrorHandler)
  const as = (id: string) => `Bearer ${tokenIssuer.issue({ sub: id, role: 'user' })}`
  return { app, as }
}

describe('rotas de propostas de pauta', () => {
  beforeEach(() => {
    process.env.JWT_SECRET = 'segredo-de-teste'
  })
  const url = `/assemblies/companies/${COMPANY}/proposals`

  it('401 sem token e 400 para id que não é UUID ou corpo inválido', async () => {
    const { app, as } = buildApp()
    expect((await request(app).get(url)).status).toBe(401)
    expect(
      (await request(app).get('/assemblies/companies/x/proposals').set('Authorization', as(ANA)))
        .status,
    ).toBe(400)
    expect(
      (await request(app).put('/assemblies/proposals/x/support').set('Authorization', as(ANA)))
        .status,
    ).toBe(400)
    const bad = await request(app).post(url).set('Authorization', as(ANA)).send({ templateKey: '' })
    expect(bad.status).toBe(400)
    expect(bad.body.error).toBe('corpo inválido')
  })

  it('acionista propõe (201), outro propõe a mesma pauta e vira apoio (200), sem revelar quem', async () => {
    const { app, as } = buildApp()
    const first = await request(app)
      .post(url)
      .set('Authorization', as(ANA))
      .send({ templateKey: 'geral' })
    expect(first.status).toBe(201)
    expect(first.body).toMatchObject({
      joinedExisting: false,
      proposal: { templateKey: 'geral', supportCount: 1, supportedByMe: true, proposedByMe: true },
    })
    expect(first.body.proposal).not.toHaveProperty('proposedBy')
    const second = await request(app)
      .post(url)
      .set('Authorization', as(BIA))
      .send({ templateKey: 'geral' })
    expect(second.status).toBe(200)
    expect(second.body).toMatchObject({
      joinedExisting: true,
      proposal: { supportCount: 2, proposedByMe: false },
    })
  })

  it('403 com o motivo para propor e apoiar sem ações (mas ler é livre)', async () => {
    const { app, as } = buildApp()
    const made = await request(app)
      .post(url)
      .set('Authorization', as(ANA))
      .send({ templateKey: 'geral' })
    const denied = await request(app)
      .post(url)
      .set('Authorization', as(ZECA))
      .send({ templateKey: 'geral' })
    expect(denied.status).toBe(403)
    expect(denied.body.reason).toBe('not_shareholder')
    const support = await request(app)
      .put(`/assemblies/proposals/${made.body.proposal.id}/support`)
      .set('Authorization', as(ZECA))
    expect(support.status).toBe(403)
    expect((await request(app).get(url).set('Authorization', as(ZECA))).status).toBe(200)
  })

  it('apoia (201), repete (200), retira (200) e a proposta continua na fila', async () => {
    const { app, as } = buildApp()
    const made = await request(app)
      .post(url)
      .set('Authorization', as(ANA))
      .send({ templateKey: 'geral' })
    const id = made.body.proposal.id
    const sup = await request(app)
      .put(`/assemblies/proposals/${id}/support`)
      .set('Authorization', as(BIA))
    expect(sup.status).toBe(201)
    expect(sup.body).toMatchObject({ alreadySupported: false, proposal: { supportCount: 2 } })
    const again = await request(app)
      .put(`/assemblies/proposals/${id}/support`)
      .set('Authorization', as(BIA))
    expect(again.status).toBe(200)
    expect(again.body.alreadySupported).toBe(true)
    const out = await request(app)
      .delete(`/assemblies/proposals/${id}/support`)
      .set('Authorization', as(BIA))
    expect(out.status).toBe(200)
    expect(out.body).toMatchObject({
      withdrawn: true,
      proposal: { supportCount: 1, supportedByMe: false },
    })
    const list = await request(app).get(url).set('Authorization', as(BIA))
    expect(list.body.proposals).toHaveLength(1)
    expect(list.body.limits).toMatchObject({ monthlyCap: 3, minSupport: 2 })
  })

  it('403 com motivo para empresa em período de espera, com os dias que faltam', async () => {
    const cooling = buildApp(9)
    const res = await request(cooling.app)
      .post(url)
      .set('Authorization', cooling.as(ANA))
      .send({ templateKey: 'geral' })
    expect(res.status).toBe(403)
    expect(res.body.reason).toBe('company_in_cooldown')
    expect(res.body.error).toContain('9 dias')
  })

  it('404 para empresa e proposta inexistentes, 400 para pauta fora do catálogo', async () => {
    const { app, as } = buildApp()
    const other = '55555555-5555-4555-8555-555555555555'
    expect(
      (
        await request(app)
          .get(`/assemblies/companies/${other}/proposals`)
          .set('Authorization', as(ANA))
      ).status,
    ).toBe(404)
    expect(
      (
        await request(app)
          .put(`/assemblies/proposals/${other}/support`)
          .set('Authorization', as(ANA))
      ).status,
    ).toBe(404)
    expect(
      (
        await request(app)
          .delete(`/assemblies/proposals/${other}/support`)
          .set('Authorization', as(ANA))
      ).status,
    ).toBe(404)
    const bad = await request(app)
      .post(url)
      .set('Authorization', as(ANA))
      .send({ templateKey: 'nao-existe' })
    expect(bad.status).toBe(400)
    expect(bad.body.reason).toBe('template_unavailable')
  })
})
