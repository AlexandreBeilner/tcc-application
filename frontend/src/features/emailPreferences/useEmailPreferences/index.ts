import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { UseMutationResult, UseQueryResult } from '@tanstack/react-query'
import { useAuth } from '../../auth/AuthContext'
import { getEmailPreferences, updateEmailPreferences } from '../../../services/emailPreferences'
import type { EmailPreferences, EmailPreferencesResult } from '../../../services/emailPreferences'

const QUERY_KEY = ['email-preferences', 'me'] as const

// Preferências de e-mail da conta (EM.6.1): seção "E-mails" de Configurações.
export function useEmailPreferencesQuery(): UseQueryResult<EmailPreferencesResult> {
    const { token } = useAuth()

    return useQuery({
        queryKey: QUERY_KEY,
        queryFn: () => getEmailPreferences(token as string),
        enabled: token !== null,
    })
}

// Grava só a(s) categoria(s) alterada(s) e já reflete o estado final no cache, sem refetch.
export function useUpdateEmailPreferences(): UseMutationResult<{ preferences: EmailPreferences }, Error, Partial<EmailPreferences>> {
    const { token } = useAuth()
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: (changes: Partial<EmailPreferences>) => updateEmailPreferences(token as string, changes),
        onSuccess: ({ preferences }) => {
            queryClient.setQueryData<EmailPreferencesResult>(QUERY_KEY, (current) => ({
                suppression: current?.suppression ?? null,
                preferences,
            }))
        },
    })
}
