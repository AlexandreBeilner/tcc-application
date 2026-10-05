-- Postgres não remove valor de enum. Mantém o valor 'cancelado' (inofensivo sem uso);
-- reverter de verdade exigiria recriar o tipo, o que não compensa.
SELECT 1;
