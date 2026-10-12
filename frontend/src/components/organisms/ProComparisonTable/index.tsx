import styles from './index.module.css'

interface Row {
    feature: string
    free: string
    pro: string
}

// Quadro Gratuito x PRO (MO.9.9). Cada linha confere com a regra real do módulo (ligas, duelos,
// cosméticos, retrospectiva, assembleias); mudou uma regra, muda aqui. Quem cancela mantém tudo que
// conquistou: só as capacidades da coluna PRO ficam em pausa.
const ROWS: Row[] = [
    {
        feature: 'Trilha, mercado, XP, missões e ranking',
        free: 'Tudo, sem limite',
        pro: 'Tudo, sem limite',
    },
    {
        feature: 'Ligas',
        free: 'Participa das ligas a que os amigos convidam',
        pro: 'Cria até 3 ligas de até 20 pessoas',
    },
    {
        feature: 'Duelos',
        free: 'Aceita desafios dos amigos',
        pro: 'Desafia amigos, até 3 ao mesmo tempo',
    },
    {
        feature: 'Identidade',
        free: 'Perfil padrão',
        pro: 'Selo PRO, 6 molduras e 8 títulos',
    },
    {
        feature: 'Retrospectiva do mês',
        free: 'Resumo com lições, conquistas e nível',
        pro: 'Completa, com calendário, maior sequência, duelos e ligas',
    },
    {
        feature: 'Assembleias',
        free: '1 voto por mês, a partir do nível 3 e com e-mail verificado',
        pro: 'Vota em todas as das empresas que você tem e propõe pautas',
    },
]

export function ProComparisonTable() {
    return (
        <section className={styles.section} aria-labelledby="pro-compare-title">
            <h2 id="pro-compare-title" className={styles.title}>
                Gratuito e PRO, lado a lado
            </h2>
            <table className={styles.table}>
                <thead>
                    <tr>
                        <th scope="col">O que</th>
                        <th scope="col">Gratuito</th>
                        <th scope="col">PRO</th>
                    </tr>
                </thead>
                <tbody>
                    {ROWS.map((row) => (
                        <tr key={row.feature}>
                            <th scope="row">{row.feature}</th>
                            <td data-label="Gratuito">{row.free}</td>
                            <td data-label="PRO">{row.pro}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
            <p className={styles.note}>
                Se você cancelar, nada do que você conquistou é apagado: as vantagens da coluna PRO ficam em pausa.
            </p>
        </section>
    )
}
