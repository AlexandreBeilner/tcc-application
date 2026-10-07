-- RC.1.4: texto visível ao usuário não cita número de lição, nome de coluna nem
-- ticker interno. O seed pula ativos que já existem, então bancos já semeados
-- recebem a correção aqui (idempotente: o WHERE só casa o texto antigo).
UPDATE assets SET name = 'Ação de Treino' WHERE ticker = 'SAND3' AND name LIKE 'Ação Sandbox%';
UPDATE assets SET name = 'Tesouro Prefixado de Treino' WHERE ticker = 'SANDPRE' AND name LIKE 'Tesouro Prefixado Sandbox%';

UPDATE etf_details ed
SET methodology_summary = 'Réplica por amostragem das empresas de maior crescimento esperado entre os 6 setores, uma por setor.'
FROM assets a
WHERE a.id = ed.asset_id AND a.ticker = 'SMLC11' AND ed.methodology_summary LIKE '%base_growth_pct%';

UPDATE etf_details ed
SET methodology_summary = 'Réplica por amostragem de ativos historicamente pagadores de proventos consistentes: FIIs e ações de setores de fluxo de caixa estável.'
FROM assets a
WHERE a.id = ed.asset_id AND a.ticker = 'DIVI11' AND ed.methodology_summary LIKE '%— FIIs%';

UPDATE etf_details ed
SET methodology_summary = 'Réplica setorial concentrada nas ações do setor Bancário/Financeiro.'
FROM assets a
WHERE a.id = ed.asset_id AND a.ticker = 'FINX11' AND ed.methodology_summary LIKE '%do catálogo%';

UPDATE etf_details ed
SET methodology_summary = 'Réplica total (full replication): mais constituintes e pesos mais pulverizados entre os 6 setores, em contraste com a amostragem representativa do ETF Índice Sintético.'
FROM assets a
WHERE a.id = ed.asset_id AND a.ticker = 'AMPL11' AND ed.methodology_summary LIKE '%SINT11%';
