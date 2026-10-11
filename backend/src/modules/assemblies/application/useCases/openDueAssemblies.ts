import {
  shareholderDedupeKey,
  pickTemplate,
  planSchedule,
  purposeOf,
  type AgendaTemplate,
} from '../../domain/lifecycle'
import type { LifecycleParams } from '../../domain/lifecycle'
import { isPaused } from '../../domain/pause'
import { pickProposedTemplate, rankProposals, type ProposalParams } from '../../domain/proposals'
import { SHAREHOLDER_KIND } from '../../domain/shareholderPolicies'
import type { AgendaCatalog } from '../ports/agendaCatalog'
import type { AssemblyPauseReader } from '../ports/assemblyPauseRepository'
import type { AssemblyRepository } from '../ports/assemblyRepository'
import type { CompanyCooldownReader } from '../ports/companyCooldownReader'
import type { CompanyReportSource } from '../ports/companyReportSource'
import type { DeclarationSource, PendingDeclaration } from '../ports/declarationSource'
import type { HoldingsSnapshotProvider } from '../ports/holdingsSnapshotProvider'
import type { ProposalRepository } from '../ports/proposalRepository'
import type { CreateAssemblyUseCase } from './createAssembly'

export interface OpenDueResult {
  opened: number
  failed: number
  // Declarações de dividendo liberadas porque a assembleia não vai decidir nada (pausa, sem pauta
  // ou balanço fora da janela de abertura).
  released?: number
}

// Abre a Assembleia de Acionistas das empresas cujo balanço saiu há `openDelayDays` dias (até a
// janela de recuperação). Reexecutar não duplica: a assembleia é criada por `dedupeKey` (empresa
// e dia do balanço), o snapshot é idempotente no motor e `markOpen` só vale a partir de
// `scheduled`. Uma assembleia que ficou `scheduled` por uma falha no meio é retomada na rodada
// seguinte.
//
// A pauta é a proposta mais apoiada da empresa (MO.6.5: fila vinda de PRO, com o mínimo de
// apoios, desempate pela mais antiga); sem proposta que sirva, vale o sorteio determinístico do
// catálogo. A proposta escolhida é consumida na criação; as demais continuam na fila até expirar.
//
// Empresa em período de espera (cooldown do motor, ponto 050) não abre assembleia: o voto
// gastaria crédito à toa, porque o motor registraria `skipped_cooldown`. O balanço fica de lado e
// a abertura tenta de novo a cada rodada; se o cooldown acabar dentro da janela de recuperação a
// assembleia abre, senão aquele balanço passa sem assembleia.
//
// Pausa do painel (MO.6.8): empresa pausada (ou pausa global) não abre assembleia nesta rodada e
// nada é perdido; ao retomar, o balanço ainda dentro da janela de recuperação abre normalmente.
//
// Assembleia de destinação do lucro (MO.6.13): o motor retém a declaração de dividendo do balanço
// da empresa elegível (declaração pendente). Para esse balanço abre a assembleia de finalidade
// `profit` (pautas que decidem payout, política de dividendo e prêmio da PN, e podem somar
// crescimento ou qualidade), com a mesma chave de idempotência (empresa e dia do balanço), então
// nunca sai uma assembleia comum além dela. A decisão (ou o fechamento sem decisão) libera a
// declaração. Para nada ficar preso: pausa (da empresa ou global), catálogo sem pauta de
// destinação ou balanço que passou da janela de recuperação sem assembleia liberam a declaração
// com o payout vigente. Não consulta o período de espera de fundamentos (o motor só retém quando o
// payout está livre, e cada efeito da decisão respeita o próprio período de espera).
export class OpenDueAssembliesUseCase {
  constructor(
    private readonly create: CreateAssemblyUseCase,
    private readonly repository: AssemblyRepository,
    private readonly reports: CompanyReportSource,
    private readonly catalog: AgendaCatalog,
    private readonly snapshots: HoldingsSnapshotProvider,
    private readonly proposals: ProposalRepository,
    private readonly proposalParams: () => ProposalParams,
    private readonly params: () => LifecycleParams,
    private readonly pauses: AssemblyPauseReader,
    private readonly cooldowns: CompanyCooldownReader,
    private readonly declarations: DeclarationSource,
    // Quórum de agora: fica congelado na assembleia que abre (editar depois não a muda).
    private readonly minVoters: () => number,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute(): Promise<OpenDueResult> {
    const params = this.params()
    const now = this.now()
    // Limpar a fila vencida nunca trava a abertura: o listActive já ignora o que passou do prazo.
    await this.proposals
      .expireDue(now)
      .catch((err) => console.error('assembleias: falha ao expirar propostas', err))
    const paused = await this.pauses.listActive()
    const result: OpenDueResult = { opened: 0, failed: 0 }
    // Sem saber o que o motor reteve não dá para abrir nada: uma assembleia comum tomaria o lugar
    // da de destinação (mesma chave de idempotência). A rodada seguinte tenta de novo.
    let pending: PendingDeclaration[]
    try {
      pending = await this.declarations.listPending()
    } catch (err) {
      result.failed += 1
      console.error('assembleias: falha ao ler as declarações retidas no motor', err)
      return result
    }
    const globalPause = paused.some((p) => p.scope === 'global')
    const [allReports, templates] = await Promise.all([
      globalPause
        ? Promise.resolve([])
        : this.reports.listRecentReports(
            params.openDelayDays,
            params.openDelayDays + params.catchUpDays,
          ),
      this.catalog.listActive(SHAREHOLDER_KIND),
    ])

    // Declaração retida: abre a de destinação do lucro, ou libera o dividendo se não vai haver.
    const held = new Set<string>()
    for (const declaration of pending) {
      held.add(`${declaration.companyId}:${declaration.reportDay}`)
      try {
        const outcome = await this.handleDeclaration(declaration, {
          paused: globalPause || isPaused(paused, SHAREHOLDER_KIND, declaration.companyId),
          templates: templates.filter((t) => purposeOf(t) === 'profit'),
          params,
          now,
        })
        if (outcome === 'opened') result.opened += 1
        if (outcome === 'released') result.released = (result.released ?? 0) + 1
      } catch (err) {
        result.failed += 1
        console.error(
          `assembleias: falha na assembleia de destinação do lucro da empresa ${declaration.companyId}`,
          err,
        )
      }
    }

    // Pausa global: nada de assembleia comum, nem consulta ao motor.
    if (globalPause) return result
    const generalTemplates = templates.filter((t) => purposeOf(t) === 'general')
    const reports = allReports
      .filter((r) => !isPaused(paused, SHAREHOLDER_KIND, r.companyId))
      // O balanço com declaração retida já tem (ou terá) a assembleia de destinação do lucro.
      .filter((r) => !held.has(`${r.companyId}:${r.reportDay}`))
    for (const report of reports) {
      try {
        if ((await this.cooldowns.daysLeft(report.companyId)) > 0) continue
        const queue = rankProposals(
          await this.proposals.listActive(SHAREHOLDER_KIND, report.companyId, now),
          now,
          this.proposalParams(),
        )
        const template =
          pickProposedTemplate(queue, generalTemplates, SHAREHOLDER_KIND, report.sector)
            ?.template ??
          pickTemplate(generalTemplates, report.companyId, report.sector, report.reportDay)
        if (!template) continue
        const { assembly } = await this.create.execute({
          kind: SHAREHOLDER_KIND,
          subjectRef: report.companyId,
          dedupeKey: shareholderDedupeKey(report.companyId, report.reportDay),
          ...planSchedule(now, params),
          title: template.title,
          subjectLabel: report.name,
          templateKey: template.key,
          minVoters: this.minVoters(),
          options: template.options,
        })
        if (assembly.status !== 'scheduled') continue
        // Consome pela pauta que a assembleia de fato guarda (numa retomada ela pode diferir da
        // escolha de agora); sem proposta ativa dessa pauta não há nada a consumir.
        if (assembly.templateKey) {
          await this.proposals.consumeActive(
            SHAREHOLDER_KIND,
            report.companyId,
            assembly.templateKey,
            assembly.id,
            now,
          )
        }
        await this.snapshots.take(assembly)
        if (await this.repository.markOpen(assembly.id)) result.opened += 1
      } catch (err) {
        result.failed += 1
        console.error(`assembleias: falha ao abrir a da empresa ${report.companyId}`, err)
      }
    }
    return result
  }

  // Uma declaração retida: espera, abre a assembleia de destinação do lucro ou libera o dividendo.
  private async handleDeclaration(
    declaration: PendingDeclaration,
    ctx: { paused: boolean; templates: AgendaTemplate[]; params: LifecycleParams; now: Date },
  ): Promise<'waiting' | 'opened' | 'released' | 'none'> {
    // Já resolvida por quem a pediu (decisão ligada ou liberação pedida): o motor cuida do resto.
    if (declaration.releaseRequested || declaration.decisionAssemblyId) return 'none'
    const release = async () => {
      await this.declarations.release(declaration.id, 'no_decision')
      return 'released' as const
    }
    // Pausa: nada novo abre e o dividendo não fica preso esperando a retomada.
    if (ctx.paused) return release()
    const dedupeKey = shareholderDedupeKey(declaration.companyId, declaration.reportDay)
    const existing = await this.repository.findByDedupeKey(dedupeKey)
    // Uma assembleia comum já ocupa a chave deste balanço (aberta antes de a retenção ligar): ela
    // não libera a declaração, então o dividendo sai agora com o payout vigente.
    if (existing && existing.assembly.declarationId !== declaration.id) return release()
    const { openDelayDays, catchUpDays } = ctx.params
    if (!existing) {
      if (declaration.daysHeld < openDelayDays) return 'waiting'
      // Passou da janela de recuperação sem abrir (o job ficou parado): ninguém vai votar.
      if (declaration.daysHeld > openDelayDays + catchUpDays) return release()
    }
    const template = pickTemplate(
      ctx.templates,
      declaration.companyId,
      declaration.sector,
      declaration.reportDay,
    )
    if (!existing && !template) return release()
    const created = await this.create.execute({
      kind: SHAREHOLDER_KIND,
      subjectRef: declaration.companyId,
      dedupeKey,
      ...planSchedule(ctx.now, ctx.params),
      title: (existing?.assembly.title ?? template?.title) as string,
      subjectLabel: declaration.name,
      templateKey: existing?.assembly.templateKey ?? template?.key,
      minVoters: this.minVoters(),
      declarationId: declaration.id,
      options: (existing?.options ?? template?.options) as AgendaTemplate['options'],
    })
    const { assembly } = created
    if (assembly.status !== 'scheduled') return 'none'
    await this.snapshots.take(assembly)
    return (await this.repository.markOpen(assembly.id)) ? 'opened' : 'none'
  }
}
