// Dados do autor que a política de privacidade pública (tarefa 4.2 do
// backlog de app mobile) precisa mostrar mas que o código não tem como
// saber. Cada valor abaixo que começa com "[PREENCHER" é um placeholder:
// troque pelo valor real antes de colar a URL `/privacidade` no formulário
// da Google Play / App Store. Lista completa e instruções em
// `.claude/politica-privacidade-placeholders.md`.
//
// `PENDING_PLACEHOLDER_PREFIX` existe pro teste (index.test.tsx) e pra um
// `grep` rápido: se `grep -rn "PREENCHER" frontend/src` não retornar nada, a
// política está pronta pra publicar.
export const PENDING_PLACEHOLDER_PREFIX = '[PREENCHER'

export const policyConfig = {
    // Nome do controlador dos dados (LGPD art. 5º, VI): pessoa física ou jurídica.
    controllerName: 'Alexandre Beilner',
    // CPF/CNPJ não é exigido na política; deixado de fora de propósito.
    // E-mail do encarregado (DPO, LGPD art. 41) e canal dos titulares.
    contactEmail: 'privacidade@selucra.com.br',
    // Nome do encarregado. Pode ser o próprio controlador.
    dpoName: 'Alexandre Beilner',
    // Onde o backend/banco rodam em produção (operador, LGPD art. 5º, VII).
    // Decisão do autor (2026-10-12): Vultr, datacenter em São Paulo.
    hostingProvider: 'Vultr',
    // País/região do datacenter; define se há transferência internacional (art. 33).
    hostingCountry: 'Brasil',
    // Idade mínima de uso. Menores de 18 anos precisam de consentimento de
    // responsável (LGPD art. 14); confirme a regra que você quer adotar.
    minimumAge: '18',
    // Data de vigência exibida no topo. Atualize a cada mudança de conteúdo.
    lastUpdated: '12 de outubro de 2026',
    // Prazo de resposta a pedidos de titulares (LGPD art. 19: até 15 dias pra
    // declaração completa). Valor já é o legal; só altere se for responder antes.
    responseDeadline: '15 dias',
}

export type PolicyConfig = typeof policyConfig
