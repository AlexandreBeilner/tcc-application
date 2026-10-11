import { shareholderDedupeKey, pickTemplate, planSchedule } from '../../domain/lifecycle'
import type { LifecycleParams } from '../../domain/lifecycle'
import { pickProposedTemplate, rankProposals, type ProposalParams } from '../../domain/proposals'
import { SHAREHOLDER_KIND } from '../../domain/shareholderPolicies'
import type { AgendaCatalog } from '../ports/agendaCatalog'
import type { AssemblyRepository } from '../ports/assemblyRepository'
import type { CompanyReportSource } from '../ports/companyReportSource'
import type { HoldingsSnapshotProvider } from '../ports/holdingsSnapshotProvider'
import type { ProposalRepository } from '../ports/proposalRepository'
import type { CreateAssemblyUseCase } from './createAssembly'

export interface OpenDueResult {
  opened: number
  failed: number
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
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute(): Promise<OpenDueResult> {
    const params = this.params()
    const now = this.now()
    // Limpar a fila vencida nunca trava a abertura: o listActive já ignora o que passou do prazo.
    await this.proposals
      .expireDue(now)
      .catch((err) => console.error('assembleias: falha ao expirar propostas', err))
    const [reports, templates] = await Promise.all([
      this.reports.listRecentReports(
        params.openDelayDays,
        params.openDelayDays + params.catchUpDays,
      ),
      this.catalog.listActive(SHAREHOLDER_KIND),
    ])
    const result: OpenDueResult = { opened: 0, failed: 0 }
    for (const report of reports) {
      try {
        const queue = rankProposals(
          await this.proposals.listActive(SHAREHOLDER_KIND, report.companyId, now),
          now,
          this.proposalParams(),
        )
        const template =
          pickProposedTemplate(queue, templates, SHAREHOLDER_KIND, report.sector)?.template ??
          pickTemplate(templates, report.companyId, report.sector, report.reportDay)
        if (!template) continue
        const { assembly } = await this.create.execute({
          kind: SHAREHOLDER_KIND,
          subjectRef: report.companyId,
          dedupeKey: shareholderDedupeKey(report.companyId, report.reportDay),
          ...planSchedule(now, params),
          title: template.title,
          subjectLabel: report.name,
          templateKey: template.key,
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
}
