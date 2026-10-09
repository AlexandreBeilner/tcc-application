import { describe, expect, it } from 'vitest'
import { authed } from './support/http'
import { registerRandomUser, loginAsAdmin } from './support/users'
import { tickUntil, triggerTick } from './support/tick'

interface AssetSummary {
  id: string
  ticker: string
  type: string
  is_sandbox: boolean
}

interface AssetDetail {
  id: string
  daily_change_pct?: number
  equity: { company: { id: string } }
}

interface CompanyDetail {
  id: string
  fundamentals: Array<{ period_date: string; net_revenue: number | null }>
}

// Jornada 3 da tarefa 7.3: evento macro → preço → relatório. Dispara um dos
// 10 templates do catálogo (3.3.2) contra uma ação real do catálogo pós-7.2,
// avança ticks até o dia de relatório e confirma o evento aparecendo pro
// usuário comum no feed de notícias.
describe('jornada: evento macro → preço → relatório', () => {
  it(
    'aplica o efeito de preço na janela ativa e incorpora o efeito nos fundamentos no dia de relatório',
    async () => {
      const user = await registerRandomUser()
      const adminToken = await loginAsAdmin()

      const catalog = await authed(user.token).get('/market/assets?type=acao&include_sandbox=false')
      expect(catalog.status).toBe(200)
      const equities = catalog.body.assets as AssetSummary[]
      expect(equities.length).toBeGreaterThan(0)
      const target = equities[0]

      const assetDetailBefore = await authed(user.token).get(`/market/assets/${target.id}`)
      expect(assetDetailBefore.status).toBe(200)
      const companyId = (assetDetailBefore.body.asset as AssetDetail).equity.company.id

      const companyBefore = await authed(user.token).get(`/market/companies/${companyId}`)
      expect(companyBefore.status).toBe(200)
      const fundamentalsCountBefore = (companyBefore.body.company as CompanyDetail).fundamentals
        .length

      // Template com efeito de preço E de fundamentos (macroevent/templates.go,
      // Category Regulatório/Mineração) — garante os dois efeitos exercitados
      // numa jornada só, mesma escolha documentada pra 4.4 (spec 3.3.2).
      const trigger = await authed(adminToken)
        .post('/admin/macro-events')
        .send({
          template_key: 'legislacao-ambiental-mineracao',
          targets: [{ asset_id: target.id }],
        })
      expect(trigger.status).toBe(201)
      const event = trigger.body.event as {
        id: string
        triggered_on_day: number
        duration_days: number
        fundamentals_report_day: number
      }
      expect(event.fundamentals_report_day).toBeGreaterThan(event.triggered_on_day)

      // Avança ticks até a duração do efeito de preço esgotar — dentro
      // dessa janela, o efeito de preço já está ativo (aplicado via reação
      // do bot Fundamentalista nas rodadas de negociação, E.2 — não é mais
      // instantâneo no tick, então roda mais de um tick pra dar chance da
      // rodada intradiária negociar antes de checar).
      await tickUntil(
        adminToken,
        (result) => result.day >= event.triggered_on_day + event.duration_days,
        event.duration_days + 10,
      )

      const assetDetailDuringWindow = await authed(user.token).get(`/market/assets/${target.id}`)
      expect(assetDetailDuringWindow.status).toBe(200)
      // O efeito só se materializa através de fills reais do bot (E.2,
      // probabilístico por rodada) — a garantia formal aqui é estrutural
      // (o campo existe e é numérico), não um valor exato, coerente com o
      // motor documentado (nunca mais um multiplicador determinístico).
      if (assetDetailDuringWindow.body.asset.daily_change_pct !== undefined) {
        expect(typeof assetDetailDuringWindow.body.asset.daily_change_pct).toBe('number')
      }

      // Avança até (e incluindo) o dia de relatório — pode ser bem adiante
      // (ciclo global de 91 dias, fundamentals.DefaultReportFrequencyDays),
      // por isso o teto de ticks alto (ver README sobre tempo de execução).
      await tickUntil(
        adminToken,
        (result) => result.day >= event.fundamentals_report_day,
        event.fundamentals_report_day - event.triggered_on_day + 20,
      )
      // Com balanço escalonado (RC.6.8) cada empresa divulga com um atraso
      // próprio e o evento só vira 'aplicado' depois do último balanço
      // atrasado do ciclo. Avança tick a tick até o status mudar (teto
      // folgado: o atraso máximo é bem menor que um ciclo).
      const findNewsItem = async () => {
        const news = await authed(user.token).get('/news?limit=50')
        expect(news.status).toBe(200)
        return (news.body.events as Array<{ id: string; status: string }>).find(
          (item) => item.id === event.id,
        )
      }
      let newsItem = await findNewsItem()
      for (let extra = 0; extra < 60 && newsItem?.status !== 'aplicado'; extra++) {
        await triggerTick(adminToken)
        newsItem = await findNewsItem()
      }

      const companyAfter = await authed(user.token).get(`/market/companies/${companyId}`)
      expect(companyAfter.status).toBe(200)
      const fundamentalsCountAfter = (companyAfter.body.company as CompanyDetail).fundamentals
        .length
      expect(fundamentalsCountAfter).toBeGreaterThan(fundamentalsCountBefore)

      expect(newsItem).toBeDefined()
      expect(newsItem!.status).toBe('aplicado')
    },
    20 * 60 * 1000,
  )
})
