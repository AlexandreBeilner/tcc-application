// Exclusão de conta (LGPD): apaga o que o módulo de e-mail guarda da pessoa (preferências e
// linhas do outbox, que têm endereço e payload). A confirmação de exclusão, que ainda precisa
// sair, é preservada pelo próprio módulo de e-mail.
export interface EmailDataEraser {
  eraseForUser(userId: string): Promise<void>
}
