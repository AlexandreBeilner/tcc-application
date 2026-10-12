-- Tarefa MO.6.12 (backlog-monetizacao.md, Fase F2): política de dividendo e prêmio da PN como
-- efeito da assembleia.
--
-- A política (trimestral, semestral ou anual) é um efeito DISCRETO: troca um valor, não soma um
-- degrau, então não tem sentido nem intensidade; guarda o valor-alvo. O prêmio da PN é um degrau
-- como o payout. Um efeito que não muda nada na empresa (a política já é a escolhida, ou a
-- empresa não tem ação PN) fica registrado como 'skipped_not_applicable'.
ALTER TABLE governance_decision_effects ADD COLUMN target_value text;
ALTER TABLE governance_decision_effects ALTER COLUMN direction DROP NOT NULL;
ALTER TABLE governance_decision_effects ALTER COLUMN intensity DROP NOT NULL;

ALTER TABLE governance_decision_effects DROP CONSTRAINT governance_decision_effects_metric_check;
ALTER TABLE governance_decision_effects ADD CONSTRAINT governance_decision_effects_metric_check
  CHECK (metric IN ('base_growth_pct', 'quality_multiplier', 'payout_ratio_pct', 'dividend_policy', 'pn_dividend_premium_pct'));

ALTER TABLE governance_decision_effects DROP CONSTRAINT governance_decision_effects_status_check;
ALTER TABLE governance_decision_effects ADD CONSTRAINT governance_decision_effects_status_check
  CHECK (status IN ('scheduled', 'completed', 'skipped_cooldown', 'skipped_out_of_range', 'skipped_not_applicable'));

-- Degrau (direção e intensidade) para as métricas somadas; valor-alvo para a política.
ALTER TABLE governance_decision_effects ADD CONSTRAINT governance_decision_effects_shape_check CHECK (
  (metric = 'dividend_policy' AND target_value IN ('quarterly', 'semiannual', 'annual') AND direction IS NULL AND intensity IS NULL)
  OR (metric <> 'dividend_policy' AND target_value IS NULL AND direction IN (-1, 1) AND intensity > 0 AND intensity <= 1)
);
