// Dados e contas do widget `behavior-bias-quiz` (RC.4.9). Os vieses e as recomendações vêm do
// volume "Vieses do Investidor" da Série CVM Comportamental (fato `cvm-vieses-comportamentais`).
// Os cenários são exemplos didáticos: nenhum número aqui é dado de mercado.

export type BiasKey = 'loss-aversion' | 'anchoring' | 'overconfidence'

export const BIAS_LABEL: Record<BiasKey, string> = {
    'loss-aversion': 'Aversão à perda',
    anchoring: 'Ancoragem',
    overconfidence: 'Autoconfiança excessiva',
}

export interface BiasReaction {
    label: string
    // `null` é a reação que segue um plano, sem viés.
    bias: BiasKey | null
    feedback: string
}

export interface BiasScenario {
    id: string
    prompt: string
    reactions: BiasReaction[]
}

export const BIAS_SCENARIOS: BiasScenario[] = [
    {
        id: 'queda-de-20',
        prompt: 'Sua carteira cai 20% num dia de notícias ruins. O que você faz?',
        reactions: [
            {
                label: 'Vendo tudo para não perder mais',
                bias: 'loss-aversion',
                feedback:
                    'O medo da perda pesa mais que o ganho e leva a decidir no pânico, travando o prejuízo no pior momento.',
            },
            {
                label: 'Confiro se o motivo da compra mudou e sigo o plano',
                bias: null,
                feedback: 'Decidir pelo plano, e não pela emoção do dia, é o que protege você de decisões precipitadas.',
            },
            {
                label: 'Compro mais, só para baixar meu preço médio',
                bias: 'loss-aversion',
                feedback:
                    'Reforçar uma posição que cai pelo desejo de recuperar o prejuízo é um sinal clássico de aversão à perda.',
            },
        ],
    },
    {
        id: 'preco-de-compra',
        prompt: 'Você comprou uma ação a R$ 30 e ela vale R$ 20, sem sinal de melhora. O que você faz?',
        reactions: [
            {
                label: 'Espero voltar a R$ 30 para vender',
                bias: 'anchoring',
                feedback:
                    'O preço de compra virou uma âncora. O mercado não sabe quanto você pagou, e a volta ao valor antigo pode não vir.',
            },
            {
                label: 'Pergunto: com o dinheiro em caixa, eu compraria hoje?',
                bias: null,
                feedback: 'Reavaliar como se fosse uma decisão nova tira o preço antigo da conta e foca no futuro do ativo.',
            },
            {
                label: 'Compro mais para recuperar o que perdi',
                bias: 'loss-aversion',
                feedback: 'Querer recuperar a perda é a emoção falando. O ativo precisa fazer sentido por si só.',
            },
        ],
    },
    {
        id: 'tres-acertos',
        prompt: 'Você acertou três operações seguidas. O que você faz?',
        reactions: [
            {
                label: 'Dobro o valor e passo a operar todo dia',
                bias: 'overconfidence',
                feedback:
                    'Quem acredita ser melhor que a média negocia mais, paga mais custos e tende a ter retorno menor.',
            },
            {
                label: 'Lembro que sorte e mercado em alta contam, e mantenho o plano',
                bias: null,
                feedback: 'Reconhecer o papel do acaso evita a falsa certeza de que o sucesso veio só da sua habilidade.',
            },
            {
                label: 'Escolho ações só pelo meu palpite, sem pesquisar',
                bias: 'overconfidence',
                feedback: 'Confiar na própria opinião mais do que nos dados é o centro da autoconfiança excessiva.',
            },
        ],
    },
    {
        id: 'pressa',
        prompt: 'Alguém diz: "Se não decidir agora, perde uma oportunidade única". O que você faz?',
        reactions: [
            {
                label: 'Compro na hora, para não perder a chance',
                bias: 'loss-aversion',
                feedback: 'O medo de perder a oportunidade expõe você a armadilhas disfarçadas de "oportunidade imperdível".',
            },
            {
                label: 'Desconfio da pressa e só decido com calma',
                bias: null,
                feedback: 'Desconfiar de discursos de urgência e evitar decidir sob pressão é uma proteção simples.',
            },
            {
                label: 'Pego a sugestão e confio no meu faro para o resto',
                bias: 'overconfidence',
                feedback: 'Decidir sem checar a fonte nem os dados é deixar a confiança no lugar da informação.',
            },
        ],
    },
]

export function countPlanChoices(choices: Record<string, number>): number {
    return BIAS_SCENARIOS.filter((s) => {
        const index = choices[s.id]
        return index !== undefined && s.reactions[index]?.bias === null
    }).length
}
