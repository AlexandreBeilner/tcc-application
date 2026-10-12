import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { UseMutationResult, UseQueryResult } from '@tanstack/react-query'
import { useAuth } from '../../auth/AuthContext'
import { createAgendaTemplate, listAgendaTemplates, setAgendaTemplateActive, updateAgendaTemplate } from '../../../services/admin'
import type { AgendaTemplate, AgendaTemplateContent } from '../../../services/admin'
import { AUDIT_LOG_QUERY_KEY } from '../useAuditLogQuery'

export const AGENDA_TEMPLATES_QUERY_KEY = ['admin', 'agenda-templates'] as const

export function useAgendaTemplatesQuery(): UseQueryResult<AgendaTemplate[]> {
    const { token } = useAuth()

    return useQuery({
        queryKey: AGENDA_TEMPLATES_QUERY_KEY,
        queryFn: () => listAgendaTemplates(token as string),
        enabled: token !== null,
    })
}

function useInvalidateTemplateQueries() {
    const queryClient = useQueryClient()
    return () => {
        queryClient.invalidateQueries({ queryKey: AGENDA_TEMPLATES_QUERY_KEY })
        queryClient.invalidateQueries({ queryKey: AUDIT_LOG_QUERY_KEY })
    }
}

export function useCreateAgendaTemplateMutation(): UseMutationResult<
    AgendaTemplate,
    unknown,
    { key: string; content: AgendaTemplateContent }
> {
    const { token } = useAuth()
    const invalidate = useInvalidateTemplateQueries()

    return useMutation({
        mutationFn: ({ key, content }) => createAgendaTemplate(token as string, key, content),
        onSettled: invalidate,
    })
}

export function useUpdateAgendaTemplateMutation(): UseMutationResult<
    AgendaTemplate,
    unknown,
    { key: string; content: AgendaTemplateContent }
> {
    const { token } = useAuth()
    const invalidate = useInvalidateTemplateQueries()

    return useMutation({
        mutationFn: ({ key, content }) => updateAgendaTemplate(token as string, key, content),
        onSettled: invalidate,
    })
}

export function useSetAgendaTemplateActiveMutation(): UseMutationResult<AgendaTemplate, unknown, { key: string; active: boolean }> {
    const { token } = useAuth()
    const invalidate = useInvalidateTemplateQueries()

    return useMutation({
        mutationFn: ({ key, active }) => setAgendaTemplateActive(token as string, key, active),
        onSettled: invalidate,
    })
}
