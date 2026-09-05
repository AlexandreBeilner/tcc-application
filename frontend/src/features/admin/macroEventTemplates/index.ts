import type { MacroEventTemplate } from './types'

export type { MacroEventTemplate } from './types'

// Espelho client-side do catálogo estático do motor (`engine/internal/
// domain/macroevent/templates.go`, spec 3.3.2) — só pra exibir título/
// narrativa/direção/banda no seletor de template da tela 10.2 antes do
// disparo (não existe endpoint que liste o catálogo, `.docs/backend/
// admin.md`: `POST /admin/macro-events` só recebe `template_key`, o
// motor resolve o resto sozinho). Só `template_key` e `targets` são
// enviados ao disparar por template — os demais campos aqui são somente
// pra pré-visualização, nunca reenviados (o motor ignora qualquer um deles
// no payload quando `template_key` está presente).
export const MACRO_EVENT_TEMPLATES: MacroEventTemplate[] = [
    {
        key: 'legislacao-ambiental-mineracao',
        title: 'Nova legislação ambiental restringe atividade de mineração',
        narrative:
            'Um novo marco regulatório ambiental impõe restrições operacionais às mineradoras, elevando custos de conformidade e reduzindo a capacidade produtiva do setor no curto prazo.',
        category: 'Regulatório',
        direction: 'negativo',
        band: 'moderado',
        affectsPrice: true,
        affectsFundamentals: true,
    },
    {
        key: 'alta-minerio-ferro',
        title: 'Minério de ferro dispara no mercado internacional',
        narrative:
            'O preço do minério de ferro sobe de forma acentuada no mercado internacional após sinais de aumento na demanda global, com mineradoras exportadoras negociando o mesmo volume por um valor mais alto em moeda forte.',
        category: 'Commodities',
        direction: 'positivo',
        band: 'moderado',
        affectsPrice: true,
        affectsFundamentals: true,
    },
    {
        key: 'queda-petroleo',
        title: 'Queda do petróleo no mercado internacional',
        narrative:
            'O preço do petróleo recua no mercado internacional, pressionando a receita de empresas do setor de energia ligadas à exploração e produção.',
        category: 'Commodities',
        direction: 'negativo',
        band: 'leve',
        affectsPrice: true,
        affectsFundamentals: true,
    },
    {
        key: 'regulacao-dados-tecnologia',
        title: 'Nova regulamentação de dados eleva custos do setor de tecnologia',
        narrative:
            'Uma nova lei de proteção de dados exige investimentos em conformidade e segurança da informação, elevando os custos operacionais das empresas de tecnologia.',
        category: 'Setorial (Tecnologia)',
        direction: 'negativo',
        band: 'leve',
        affectsPrice: false,
        affectsFundamentals: true,
    },
    {
        key: 'inadimplencia-bancos',
        title: 'Aumento da inadimplência pressiona resultado dos bancos',
        narrative:
            'A inadimplência de crédito sobe acima do esperado, obrigando os bancos a provisionar mais recursos pra cobrir perdas — pressão direta sobre o resultado do próximo trimestre.',
        category: 'Setorial (Bancário)',
        direction: 'negativo',
        band: 'moderado',
        affectsPrice: false,
        affectsFundamentals: true,
    },
    {
        key: 'escandalo-contabil-varejo',
        title: 'Escândalo contábil identificado em empresa do varejo',
        narrative:
            'Uma investigação revela irregularidades contábeis numa grande empresa do varejo, abalando a confiança do mercado e exigindo reformulação de balanços anteriores.',
        category: 'Corporativo',
        direction: 'negativo',
        band: 'severo',
        affectsPrice: true,
        affectsFundamentals: true,
    },
    {
        key: 'expansao-parceria-corporativa',
        title: 'Empresa anuncia expansão/parceria estratégica',
        narrative:
            'A empresa anuncia uma parceria estratégica ou plano de expansão, com expectativa de resultado concentrada nos próximos ciclos — antes de qualquer número novo aparecer no balanço.',
        category: 'Corporativo',
        direction: 'positivo',
        band: 'moderado',
        affectsPrice: true,
        affectsFundamentals: false,
    },
    {
        key: 'desvalorizacao-real',
        title: 'Forte desvalorização do real frente ao dólar',
        narrative:
            'O real se desvaloriza fortemente frente ao dólar: exportadoras ganham competitividade e receita em moeda forte, enquanto importadoras enfrentam custos mais altos — o mesmo evento move setores em direções opostas.',
        category: 'Cambial',
        direction: 'misto',
        band: 'moderado',
        affectsPrice: true,
        affectsFundamentals: true,
    },
    {
        key: 'tensao-comercial-internacional',
        title: 'Tensão comercial internacional afeta cadeias de suprimento',
        narrative:
            'O agravamento de uma disputa comercial entre grandes economias interrompe cadeias de suprimento globais, gerando incerteza que se reflete de imediato na precificação de ativos expostos ao comércio internacional.',
        category: 'Geopolítico',
        direction: 'negativo',
        band: 'leve',
        affectsPrice: true,
        affectsFundamentals: false,
    },
    {
        key: 'quebra-safra-agronegocio',
        title: 'Quebra de safra por evento climático reduz oferta agrícola',
        narrative:
            'Um evento climático severo reduz a safra agrícola: quem já tinha estoque formado se beneficia do preço mais alto, enquanto quem depende da nova colheita sofre com a oferta menor — efeito misto dentro do próprio setor.',
        category: 'Agronegócio',
        direction: 'misto',
        band: 'moderado',
        affectsPrice: true,
        affectsFundamentals: true,
    },
]

export function findMacroEventTemplate(key: string): MacroEventTemplate | undefined {
    return MACRO_EVENT_TEMPLATES.find((template) => template.key === key)
}
