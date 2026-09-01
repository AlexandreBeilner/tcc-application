import { ChevronRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import styles from './index.module.css'

// Tarefa 6.9.5 — painel de apoio da composição de página do Perfil Público
// (8.4), retrofit da 6.9.2 (que só resolveu os motivos visuais *dentro* do
// `PublicProfileCard`, não a composição da tela em volta dele). Conteúdo
// 100% estático — a nota de privacidade espelha a mesma regra estrutural
// (RNF09/spec 8.2) já usada no texto informativo de 9.3 Privacidade e LGPD
// (tarefa 6.10, ainda não implementada) — sem prop nenhuma. Fica no
// `.sidebar` sticky em desktop (`identidade-visual-padroes.md` §7) e
// empilhado, sem estilo de sidebar, em mobile — decisão de layout de quem
// posiciona (`pages/PerfilPublico`), não deste componente.
export function ProfileAboutPanel() {
    return (
        <div className={styles.panel}>
            <h2 className={styles.title}>Sobre este perfil</h2>
            <p className={styles.note}>
                Rentabilidade, nível e conquistas são sempre visíveis. Patrimônio nunca é exposto a outros usuários.
            </p>
            <div className={styles.divider} />
            <Link to="/classificacao" className={styles.link}>
                Ver na Classificação
                <ChevronRight size={16} strokeWidth={2} aria-hidden="true" />
            </Link>
        </div>
    )
}
