// Dado que a regra de domínio recusa (tamanho, markup, janela inválida). Vira 422 no router.
export class InvalidAnnouncementError extends Error {}

export class AnnouncementNotFoundError extends Error {}

// Ação que o estado atual não permite: editar aviso de manutenção, encerrar o que já
// terminou, abrir uma segunda manutenção. Vira 409 no router.
export class AnnouncementConflictError extends Error {}
