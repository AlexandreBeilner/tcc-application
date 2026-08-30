export interface ResolvedNewsTarget {
    key: string
    label: string
    // Presente só pra targets com asset_id — único caso navegável (4.5
    // Detalhe de Ativo). A página consumidora decide como navegar
    // (useNavigate, mesmo padrão de AssetTable/CompanyAssetList — o
    // organism não embute react-router aqui).
    assetId?: string
}
