-- Persistência poliglota (spec seção 3): dois bancos lógicos no mesmo
-- servidor Postgres — um para usuário/gamificação, outro para mercado
-- (Event Sourcing). Mantidos como bancos distintos, não schemas dentro do
-- mesmo banco, para reforçar o isolamento entre os dois domínios.
CREATE DATABASE gamification;
CREATE DATABASE market;
