import { SUPPORT_EMAIL } from '../../utils/supportContact'
import { policyConfig } from '../PoliticaPrivacidade/policyConfig'

// Dados dos Termos de Uso que o código não tem como saber. Valor que começa com "[PREENCHER" é
// placeholder (mesma convenção de `policyConfig.ts`): `grep -rn "PREENCHER" frontend/src` vazio =
// pronto para publicar.
export const termsConfig = {
    lastUpdated: '24 de outubro de 2026',
    // Identificação do fornecedor (Decreto 7.962/2013, art. 2º: nome, CPF ou CNPJ e endereço).
    // Decisão do autor (2026-10-11): começa como pessoa física, sem publicar CPF nem endereço
    // residencial (privacidade); aparecem nome, cidade e e-mail. Ao abrir o MEI, trocar por
    // `providerDocument` (CNPJ) e endereço comercial, e rever o item 1 dos termos.
    providerName: policyConfig.controllerName,
    providerLegalForm: 'pessoa física',
    providerCity: 'Chapecó, SC',
    supportEmail: SUPPORT_EMAIL,
    privacyEmail: policyConfig.contactEmail,
    minimumAge: policyConfig.minimumAge,
}

export type TermsConfig = typeof termsConfig
