import { SUPPORT_EMAIL } from '../../utils/supportContact'
import { policyConfig } from '../PoliticaPrivacidade/policyConfig'

// Dados dos Termos de Uso e da Assinatura PRO e da Política de Reembolso que o código não tem como
// saber. Valor que começa com "[PREENCHER" é placeholder (mesma convenção de `policyConfig.ts`):
// `grep -rn "PREENCHER" frontend/src` vazio = pronto para publicar. Os preços aqui são só texto
// jurídico: o valor cobrado de verdade vive no Stripe/RevenueCat e precisa ficar igual a estes.
export const termsConfig = {
    lastUpdated: '11 de outubro de 2026',
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
    monthlyPrice: 'R$ 9,90',
    annualPrice: 'R$ 89,90',
    // Antecedência do aviso de reajuste, e prazos de resposta e de devolução.
    priceChangeNoticeDays: '30 dias',
    refundWindowDays: '7 dias corridos',
    refundResponseTime: '3 dias úteis',
    refundCardTime: '5 a 10 dias úteis',
}

export type TermsConfig = typeof termsConfig
