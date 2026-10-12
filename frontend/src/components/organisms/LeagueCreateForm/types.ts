export interface LeagueCreateFormProps {
    // Chamado com o id da liga recém-criada (a página leva para o detalhe).
    onCreated?: (leagueId: string) => void
}
