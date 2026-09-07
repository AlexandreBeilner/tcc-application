// Catálogo estático (tarefa C.1 do backlog de engajamento) — mesmo espírito
// de `engine/internal/domain/macroevent/templates.go`: dado fixo em código,
// não tabela de banco. Cobre termos hoje reexplicados por extenso em mais de
// uma lição de `backend/src/db/seedLessons.ts`; a chave é o texto exato
// usado entre chaves duplas no conteúdo, ex. `{{FGC}}`.
export const glossary: Record<string, string> = {
    FGC: 'Fundo Garantidor de Créditos: cobre CDB, LCI e LCA em até R$250.000,00 por CPF e por instituição financeira, mesmo que o emissor quebre.',
    'marcação a mercado':
        'Recálculo diário do preço de um título prefixado pela taxa de mercado vigente, que pode ficar acima ou abaixo do que a taxa contratada renderia até aquele dia.',
    deságio:
        'Diferença entre o valor de face de um título prefixado e o preço menor que você paga por ele hoje; é essa diferença que forma a rentabilidade contratada.',
    'taxa bruta equivalente':
        'Taxa que um produto tributado precisaria pagar pra empatar, líquido de IR, com um produto isento: taxa isenta dividida por (1 menos a alíquota).',
    EBIT: 'Lucro operacional da empresa, antes de descontar juros e impostos.',
    'Dividend Yield': 'Soma dos dividendos pagos por ação ou cota nos últimos 12 meses, dividida pelo preço atual.',
}
