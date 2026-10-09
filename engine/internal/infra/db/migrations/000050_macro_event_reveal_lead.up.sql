-- Tarefa N.25 (backlog-motor-mercado-realista.md, achado 045): o admin escolhe com quantos
-- dias de antecedência do primeiro dia de efeito o jogador passa a ver um evento macro no
-- feed e no calendário. O padrão 1 é a regra de sempre (a véspera), então todo evento que já
-- existe se comporta exatamente como antes. Sem CHECK de teto: o domínio valida contra os
-- dias que faltam até o efeito (macroevent.ValidateRevealLead); o banco só barra o negativo.
ALTER TABLE macro_events
    ADD COLUMN IF NOT EXISTS reveal_lead_days INTEGER NOT NULL DEFAULT 1 CHECK (reveal_lead_days >= 0);
