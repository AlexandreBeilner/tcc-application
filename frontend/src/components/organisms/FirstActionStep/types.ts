export type FirstActionOutcome = 'bought' | 'failed'

export interface FirstActionStepProps {
    // Chamado quando a compra termina (certa ou errada). O onboarding segue nos dois casos.
    onSettled: (outcome: FirstActionOutcome) => void
}
