import type { RetentionCohort } from '../../../services/admin'

export interface RetentionCohortTableProps {
    // Mais recente primeiro, como a API devolve.
    cohorts: RetentionCohort[]
}
