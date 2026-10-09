import type { CreatedCatalogAsset, NewCatalogAsset, NewCatalogAssetPreview } from '../../../services/admin'

export interface NewAssetFormProps {
    // Valida e mostra o que seria criado, sem gravar. Rejeita com o erro do motor (422/409).
    onPreview: (asset: NewCatalogAsset) => Promise<NewCatalogAssetPreview>
    // Cadastra de verdade. Rejeita com o erro do motor, inclusive o 500 com asset_id.
    onCreate: (asset: NewCatalogAsset) => Promise<CreatedCatalogAsset>
    // Avisa a tela que o ativo foi criado (ela mostra o aviso e fecha o formulário).
    onCreated: (created: CreatedCatalogAsset) => void
    onCancel: () => void
}
