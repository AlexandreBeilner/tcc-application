export interface DeltaProps {
    /** Variação já em pontos percentuais (ex: `2` = +2,0%), como o motor devolve. `null`/`undefined` vira `—`. */
    percent?: number | null
    /** Variação em reais; aparece sozinha ou ao lado do percentual. */
    amount?: number | null
    /** `chip` (fundo suave, padrão corretora) ou `text` (só texto colorido, para linhas densas). */
    variant?: 'chip' | 'text'
    /** `flow` é dinheiro entrando/saindo (extrato): o leitor de tela fala "entrada de"/"saída de" em vez de alta/queda. */
    kind?: 'change' | 'flow'
    className?: string
}
