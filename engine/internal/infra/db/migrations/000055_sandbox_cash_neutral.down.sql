-- Sem esquema a desfazer: a migration só corrigiu valores de `accounts`. Voltar ao comportamento
-- antigo é decisão de código (o Sandbox passaria a debitar o caixa de novo), não de banco.
SELECT 1;
