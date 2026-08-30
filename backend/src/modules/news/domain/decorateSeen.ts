// RF16 (tela 5.1, tarefa 6.6.2) — decide, por evento, se já foi visto pelo
// usuário. Função pura e genérica (não amarrada ao DTO de macro-evento do
// motor) pra ficar testável isolada das portas de leitura/persistência.
export function decorateWithSeen<T extends { id: string }>(
  events: T[],
  seenEventIds: ReadonlySet<string>,
): (T & { seen: boolean })[] {
  return events.map((event) => ({ ...event, seen: seenEventIds.has(event.id) }))
}
