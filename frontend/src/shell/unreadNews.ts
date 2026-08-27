import type { NewsEvent } from '../api/news'

// Sem timestamp exposto por `GET /news` — só a ordem da lista garante
// "mais recente primeiro" (`.docs/engine/macroevent.md`, `created_at DESC`).
// Por isso "mais recente que a última visita" é resolvido por posição: tudo
// que aparece antes de `lastSeenId` na lista é mais novo que a última
// visita. `lastSeenId === null` (nunca visitou) trata a lista inteira como
// candidata — critério de aceite da tarefa 6.1.
export function hasUnreadPendingEvent(events: NewsEvent[], lastSeenId: string | null): boolean {
  for (const event of events) {
    if (event.id === lastSeenId) {
      return false
    }
    if (event.status === 'pendente') {
      return true
    }
  }
  return false
}

const LAST_SEEN_NEWS_ID_KEY = 'tcc.news.lastSeenId'

export function getLastSeenNewsId(): string | null {
  return localStorage.getItem(LAST_SEEN_NEWS_ID_KEY)
}

// `storage` (evento nativo do browser) só dispara em *outras* abas, nunca
// na aba que fez a escrita — sem este pub/sub, o NewsBell (montado o tempo
// todo no <TopBar>) não teria motivo pra re-renderizar depois de uma visita
// a `/noticias` na mesma aba, e o badge ficaria aceso até algum re-render
// não relacionado acontecer.
type Listener = () => void
const listeners = new Set<Listener>()

export function subscribeToLastSeenNewsId(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

// Chamado ao visitar o Feed de Notícias (5.1, ainda não implementada —
// aqui só marca a visita) — grava o evento mais recente da lista inteira,
// não só dos pendentes, senão uma visita logo após só eventos `aplicado`
// nunca atualizaria o marcador.
export function markNewsAsSeen(events: NewsEvent[]): void {
  const mostRecent = events[0]
  if (!mostRecent) {
    return
  }
  localStorage.setItem(LAST_SEEN_NEWS_ID_KEY, mostRecent.id)
  listeners.forEach((listener) => listener())
}
