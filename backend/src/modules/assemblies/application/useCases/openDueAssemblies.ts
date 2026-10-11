import { shareholderDedupeKey, pickTemplate, planSchedule } from '../../domain/lifecycle'
import type { LifecycleParams } from '../../domain/lifecycle'
import { SHAREHOLDER_KIND } from '../../domain/shareholderPolicies'
import type { AgendaCatalog } from '../ports/agendaCatalog'
import type { AssemblyRepository } from '../ports/assemblyRepository'
import type { CompanyReportSource } from '../ports/companyReportSource'
import type { HoldingsSnapshotProvider } from '../ports/holdingsSnapshotProvider'
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
export class OpenDueAssembliesUseCase {
  constructor(
    private readonly create: CreateAssemblyUseCase,
    private readonly repository: AssemblyRepository,
    private readonly reports: CompanyReportSource,
    private readonly catalog: AgendaCatalog,
    private readonly snapshots: HoldingsSnapshotProvider,
    private readonly params: () => LifecycleParams,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute(): Promise<OpenDueResult> {
    const params = this.params()
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
        const template = pickTemplate(templates, report.companyId, report.sector, report.reportDay)
        if (!template) continue
        const { assembly } = await this.create.execute({
          kind: SHAREHOLDER_KIND,
          subjectRef: report.companyId,
          dedupeKey: shareholderDedupeKey(report.companyId, report.reportDay),
          ...planSchedule(this.now(), params),
          title: template.title,
          subjectLabel: report.name,
          templateKey: template.key,
          options: template.options,
        })
        if (assembly.status !== 'scheduled') continue
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
