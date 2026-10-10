// O pedido ou o aceite de amizade já aconteceu: falha ao enfileirar o aviso por e-mail só é
// logada e nunca desfaz nem derruba a operação.
export async function notifySafely(label: string, send: () => Promise<void>): Promise<void> {
  try {
    await send()
  } catch (err) {
    console.error(`[email] falha ao enfileirar ${label}`, err)
  }
}
