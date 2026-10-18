export interface TermCollectionProps {
    // Códigos das lições concluídas (`PublicProfile.completedLessonCodes`).
    completedLessonCodes: string[]
    // Só no próprio perfil (LJ-D6): as cartas por ganhar e o atalho "Rever a lição". No perfil de outra pessoa
    // aparecem só a contagem e as cartas já ganhas.
    isOwn: boolean
}
