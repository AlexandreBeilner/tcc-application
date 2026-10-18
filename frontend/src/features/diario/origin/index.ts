import { reportMetric } from '..'
import { API_BASE_URL } from '../../../services/client'

// Quem chega com `?origem=diario` (o convite da landing ao terminar o jogo) é medido quando se
// cadastra ou entra (DI.7.1). A origem fica só neste separador (`sessionStorage`, como o código de
// indicação) e nunca vai para o servidor junto de dados da pessoa: o aviso é só o nome do evento,
// e é dado uma vez por origem capturada.
const STORAGE_KEY = 'selucra:origem-diario'
const ORIGIN = 'diario'

// Guarda a origem se a URL a traz. Chamada uma vez, na abertura do app (a URL com a query some no
// primeiro redirecionamento, ex.: `/diario` deslogado vai para `/login`).
export function captureDiarioOrigin(search: string): void {
    if (new URLSearchParams(search).get('origem') !== ORIGIN) return
    try {
        sessionStorage.setItem(STORAGE_KEY, ORIGIN)
    } catch {
        // sem armazenamento (janela privada): sem medição, o app funciona igual
    }
}

function consumeDiarioOrigin(): boolean {
    try {
        if (sessionStorage.getItem(STORAGE_KEY) !== ORIGIN) return false
        sessionStorage.removeItem(STORAGE_KEY)
        return true
    } catch {
        return false
    }
}

// Cadastro e login que vieram do Diário. Dispara e esquece; sem origem guardada, não faz nada.
// Consome a origem: um cadastro e o login seguinte da mesma pessoa não contam duas vezes.
export function reportDiarioOrigin(event: 'signup' | 'login'): void {
    if (!consumeDiarioOrigin()) return
    reportMetric(API_BASE_URL, event)
}
