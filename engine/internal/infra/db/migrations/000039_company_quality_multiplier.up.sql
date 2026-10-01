-- Achado 025 (pontos-em-aberto-decisao-produto.md): fundamentals.DeriveFinancials
-- derivava margem/ROE/alavancagem só do setor, então toda empresa do mesmo
-- setor tinha exatamente o mesmo ROE pra sempre (só base_growth_pct variava).
-- quality_multiplier escala margem líquida/EBIT e o inverso da razão
-- dívida/patrimônio por empresa (1.00 = média do setor, valor central da K.1).
-- Default 1.00 preserva toda empresa já cadastrada.
ALTER TABLE companies ADD COLUMN quality_multiplier numeric(4, 2) NOT NULL DEFAULT 1.00
    CONSTRAINT companies_quality_multiplier_range CHECK (quality_multiplier > 0 AND quality_multiplier <= 2.00);
