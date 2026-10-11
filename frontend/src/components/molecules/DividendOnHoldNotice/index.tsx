import { Link } from 'react-router-dom'
import { useAssembliesQuery } from '../../../features/assemblies/useAssemblies'
import styles from './index.module.css'

// Aviso na tela do ativo e na da empresa: o dividendo do último balanço ainda não foi definido
// porque a assembleia de acionistas está decidindo o destino do lucro. Some sozinho quando o
// dividendo é liberado, e some inteiro com o recurso desligado no servidor (a consulta devolve 404).
export function DividendOnHoldNotice({ companyId }: { companyId: string }) {
    const query = useAssembliesQuery({ companyId, status: 'open' })
    const holding = query.data?.open.find((assembly) => assembly.dividendOnHold)
    if (!holding) return null

    return (
        <aside className={styles.notice} aria-label="Dividendo aguardando a assembleia">
            <p className={styles.text}>
                O dividendo deste balanço depende da assembleia em andamento. Os acionistas estão decidindo o que fazer com o lucro, e o
                provento só é definido quando a votação terminar. Nenhum pagamento deixa de sair: ele só é calculado depois.
            </p>
            <Link className={styles.link} to={`/assembleias/${holding.id}`}>
                Ver a assembleia
            </Link>
        </aside>
    )
}
