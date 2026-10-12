import { BadgeCheck, CalendarDays, Swords, Users, Vote } from 'lucide-react'
import type { ReactNode } from 'react'
import { ProSeal } from '../../atoms/ProSeal'
import styles from './index.module.css'

interface Benefit {
    key: string
    Icon: typeof Users
    title: string
    text: string
    example: ReactNode
}

// Exemplos ilustrativos com gente e números inventados, só para mostrar como a vantagem aparece.
// O rótulo "Exemplo" fica visível e o desenho é escondido de leitor de tela (o texto ao lado já diz
// tudo). Valores escritos em pt-BR à mão, sem a variação colorida de dado real (não é dado).
const BENEFITS: Benefit[] = [
    {
        key: 'liga',
        Icon: Users,
        title: 'Ligas privadas com amigos',
        text: 'Crie até 3 ligas de até 20 pessoas e dispute a rentabilidade da semana ou do mês.',
        example: (
            <ol className={styles.board}>
                <li>
                    <span>1</span> Bia <strong>+4,2%</strong>
                </li>
                <li className={styles.me}>
                    <span>2</span> Você <strong>+3,8%</strong>
                </li>
                <li>
                    <span>3</span> Caio <strong>+1,1%</strong>
                </li>
            </ol>
        ),
    },
    {
        key: 'duelo',
        Icon: Swords,
        title: 'Duelos 1 contra 1',
        text: 'Desafie um amigo por 7 dias. Vence quem tiver a maior rentabilidade no período.',
        example: (
            <div className={styles.duel}>
                <span>
                    Você <strong>+2,6%</strong>
                </span>
                <span className={styles.versus}>contra</span>
                <span>
                    Ana <strong>+1,9%</strong>
                </span>
            </div>
        ),
    },
    {
        key: 'identidade',
        Icon: BadgeCheck,
        title: 'Selo, moldura e título',
        text: 'Selo PRO, 6 molduras e 8 títulos para mostrar seu estilo no perfil e no ranking.',
        example: (
            <div className={styles.identity}>
                <span className={styles.avatar}>V</span>
                <span className={styles.identityText}>
                    <span className={styles.name}>
                        Você <ProSeal />
                    </span>
                    <span className={styles.titleTag}>Leitor de Balanços</span>
                </span>
            </div>
        ),
    },
    {
        key: 'retrospectiva',
        Icon: CalendarDays,
        title: 'Retrospectiva completa do mês',
        text: 'Calendário dos dias ativos, maior sequência, duelos jogados e as ligas em que você participa.',
        example: (
            <div className={styles.calendar}>
                {Array.from({ length: 14 }, (_, day) => (
                    <span key={day} className={[0, 1, 2, 4, 5, 7, 8, 9, 11, 12].includes(day) ? styles.on : styles.off} />
                ))}
            </div>
        ),
    },
    {
        key: 'assembleia',
        Icon: Vote,
        title: 'Voz nas assembleias',
        text: 'Vote em toda assembleia das empresas que você tem e proponha pautas do catálogo.',
        example: (
            <div className={styles.bars}>
                <div className={styles.barRow}>
                    <span>Distribuir</span>
                    <span className={styles.track}>
                        <span className={styles.fill} style={{ width: '62%' }} />
                    </span>
                    <strong>62%</strong>
                </div>
                <div className={styles.barRow}>
                    <span>Reinvestir</span>
                    <span className={styles.track}>
                        <span className={styles.fill} style={{ width: '38%' }} />
                    </span>
                    <strong>38%</strong>
                </div>
            </div>
        ),
    },
]

// Benefícios do PRO com ícone e um exemplo visual de cada (MO.9.9). Só informa: sem preço, sem
// prazo, sem texto que pressione.
export function ProBenefitsShowcase() {
    return (
        <section className={styles.section} aria-labelledby="pro-showcase-title">
            <h2 id="pro-showcase-title" className={styles.title}>
                O que o PRO inclui
            </h2>
            <ul className={styles.grid}>
                {BENEFITS.map(({ key, Icon, title, text, example }) => (
                    <li key={key} className={styles.card}>
                        <div className={styles.head}>
                            <span className={styles.icon} aria-hidden="true">
                                <Icon size={18} strokeWidth={2} />
                            </span>
                            <h3 className={styles.cardTitle}>{title}</h3>
                        </div>
                        <p className={styles.text}>{text}</p>
                        <div className={styles.example} aria-hidden="true">
                            <span className={styles.exampleLabel}>Exemplo</span>
                            {example}
                        </div>
                    </li>
                ))}
            </ul>
        </section>
    )
}
