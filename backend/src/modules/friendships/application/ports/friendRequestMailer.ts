// Avisos por e-mail do fluxo de amizade (EM.6.2, E8). Port própria do módulo, implementada na
// composição por um adapter sobre `modules/notifications`: quem faz amizade nunca conhece o
// outbox. Opt-in do destinatário, teto de 1 e-mail social por dia e conteúdo (só username, nível
// e rentabilidade percentual, RNF09) são decisão do adapter e do módulo de e-mail, não do caso de uso.
export interface FriendRequestMailer {
  // `addresseeId` recebeu um pedido de `requesterId`.
  sendRequestReceived(input: { requesterId: string; addresseeId: string }): Promise<void>
  // `accepterId` aceitou o pedido de `requesterId`: quem recebe o aviso é `requesterId`.
  sendRequestAccepted(input: { requesterId: string; accepterId: string }): Promise<void>
}
