// Consulta ao catálogo de ativos do motor (N.23): a lição referencia tickers reais (indicador ao
// vivo, produto desbloqueado), então a validação precisa saber se o ticker existe e de que tipo é.
export interface AssetTypeLookup {
  // Tipo (`AssetType` do motor, ex: 'acao', 'cdb') do ativo com esse ticker, ou `undefined` se não
  // existir no catálogo. Falha de rede propaga: validar sem catálogo seria aceitar qualquer ticker.
  typeOfTicker(ticker: string): Promise<string | undefined>
}
