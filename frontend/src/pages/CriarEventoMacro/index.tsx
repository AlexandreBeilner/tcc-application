import { ArrowLeft } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { MacroEventTriggerForm } from '../../components/organisms/MacroEventTriggerForm'
import styles from './index.module.css'

// Tela 10.2 (RF13) — acessada a partir de 10.1 (`PainelAdmin`), nunca
// direto pelo menu. "Disparar agora" → confirma e volta pra 10.1
// (inventário) — `onTriggered` navega de volta assim que o disparo é
// confirmado com sucesso (o formulário já invalidou o cache do histórico).
export function CriarEventoMacro() {
    const navigate = useNavigate()

    return (
        <main className={styles.page}>
            <Link to="/admin" className={styles.back}>
                <ArrowLeft size={16} aria-hidden="true" />
                Painel Administrativo
            </Link>

            <h1 className={styles.title}>Criar/Disparar Evento Macro</h1>

            <MacroEventTriggerForm onTriggered={() => navigate('/admin', { replace: true })} />
        </main>
    )
}
