export class InvalidXpAmountError extends Error {}
// Ajuste manual de XP/streak pelo painel (N.17): valor que não é inteiro, que tira
// mais XP do que o usuário tem ou que não representa uma sequência possível.
export class InvalidProgressionAdjustmentError extends Error {}
