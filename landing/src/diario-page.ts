// Entrada da página /diario/: monta o módulo do jogo em modo `publico` e liga o convite para o app.
// Bundle próprio, sem a cena 3D da home. Estado só no navegador; a CORS da landing não aceita credenciais, então nunca vai token.
import { createDailyApi, createLocalKeeper, mountDiario } from './diario/index.ts'

const root = document.getElementById('diario')
if (root) {
    const { api: baseUrl = '', site = '', guides = '' } = root.dataset
    const guideSlugs = new Set(guides.split(',').filter(Boolean))
    const invite = document.getElementById('diario-convite')
    const showInvite = () => {
        if (invite) invite.hidden = false
    }

    // Jogo já terminado, aberto de novo: o módulo redesenha o resultado sem avisar `onComplete`.
    new MutationObserver(() => {
        if (root.querySelector('.dg-result')?.childElementCount) showInvite()
    }).observe(root, { childList: true, subtree: true })

    mountDiario(root, {
        api: createDailyApi({ baseUrl }),
        mode: 'publico',
        keeper: createLocalKeeper(),
        shareUrl: `${site.replace(/^https?:\/\//, '')}/diario`,
        learnMoreHref: (l) => (l.kind === 'guide' && guideSlugs.has(l.ref) ? `/aprender/${l.ref}/` : null),
        onComplete: showInvite,
        onUnauthorized: () => undefined,
    })
}
