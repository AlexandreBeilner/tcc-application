export interface DuelChallengePanelProps {
    // Amigos com quem já existe um duelo aberto: não aparecem como opção.
    busyUserIds: string[]
    onCreated?: (duelId: string) => void
}
