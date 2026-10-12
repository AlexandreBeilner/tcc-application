import { Link } from 'react-router-dom'
import { AssemblyCard } from '../../components/molecules/AssemblyCard'
import { AssemblyProBlock } from '../../components/molecules/AssemblyProBlock'
import { isFeatureOff, useAssembliesQuery } from '../../features/assemblies/useAssemblies'
import styles from './index.module.css'

// Lista de assembleias de acionistas (MO.6.6): abertas agora e histórico recente. Pauta, placar e
// resultado são públicos; quem pode votar é decidido na própria assembleia. No desktop a lista
// fica à esquerda e a explicação de como funciona fixa à direita (identidade-visual-padroes.md §7).
export function Assembleias() {
    const query = useAssembliesQuery({ limit: 20 })

    if (isFeatureOff(query.error)) {
        return (
            <main className={styles.page}>
                <h1 className={styles.title}>Assembleias indisponíveis no momento</h1>
                <p className={styles.muted}>
                    As votações estão pausadas por enquanto. Seu progresso e suas ações continuam como estão. Volte em breve.
                </p>
                <Link to="/mercado" className={styles.backLink}>
                    Voltar ao Mercado
                </Link>
            </main>
        )
    }

    const open = query.data?.open ?? []
    const closed = query.data?.closed ?? []

    return (
        <main className={styles.page}>
            <h1 className={styles.title}>Assembleias de acionistas</h1>
            <p className={styles.lead}>
                Depois de cada balanço, quem tinha ações da empresa decide uma pauta. O que for aprovado muda o ritmo da empresa aos poucos,
                e o preço continua vindo da negociação.
            </p>

            <div className={styles.layout}>
                <div className={styles.main}>
                    {query.isError && (
                        <p className={styles.error} role="alert">
                            Não foi possível carregar as assembleias agora. Tente novamente em instantes.
                        </p>
                    )}
                    {query.isLoading && <p className={styles.muted}>Carregando assembleias…</p>}

                    {query.data && (
                        <>
                            <section aria-labelledby="assemblies-open-title" className={styles.block}>
                                <h2 id="assemblies-open-title" className={styles.sectionTitle}>
                                    Abertas agora
                                </h2>
                                {open.length === 0 ? (
                                    <p className={styles.muted}>
                                        Nenhuma votação aberta. Uma nova abre depois do próximo balanço de uma empresa.
                                    </p>
                                ) : (
                                    <ul className={styles.list}>
                                        {open.map((assembly) => (
                                            <li key={assembly.id}>
                                                <AssemblyCard assembly={assembly} />
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </section>

                            {closed.length > 0 && (
                                <section aria-labelledby="assemblies-closed-title" className={styles.block}>
                                    <h2 id="assemblies-closed-title" className={styles.sectionTitle}>
                                        Encerradas
                                    </h2>
                                    <ul className={styles.list}>
                                        {closed.map((assembly) => (
                                            <li key={assembly.id}>
                                                <AssemblyCard assembly={assembly} />
                                            </li>
                                        ))}
                                    </ul>
                                </section>
                            )}
                        </>
                    )}
                </div>

                <aside className={styles.side} aria-label="Como funciona">
                    <h2 className={styles.sectionTitle}>Como funciona</h2>
                    <ul className={styles.rules}>
                        <li>Vota quem tinha ações da empresa na abertura. O peso do voto é a quantidade de ações.</li>
                        <li>Dá para trocar o voto até a votação fechar.</li>
                        <li>Com poucos votantes ou empate, nada muda.</li>
                    </ul>
                    <AssemblyProBlock />
                </aside>
            </div>
        </main>
    )
}
