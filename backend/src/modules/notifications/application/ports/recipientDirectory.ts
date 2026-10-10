import type { RecipientInfo } from '../../domain/emailPreferences'

// Leitura mínima do destinatário (status, verificação, endereço) sem importar o módulo `auth`.
export interface RecipientDirectory {
  find(userId: string): Promise<RecipientInfo | null>
}
