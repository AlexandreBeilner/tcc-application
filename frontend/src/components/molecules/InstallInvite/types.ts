export interface InstallInviteProps {
    // `settings`: sempre visível enquanto instalável (sem dispensar). `lesson`: depois da primeira
    // lição concluída, dispensável por 30 dias.
    placement: 'settings' | 'lesson'
}
