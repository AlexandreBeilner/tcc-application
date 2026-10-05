// Registro de login e reautenticação de administrador (N.22). Os casos de uso
// do `auth` só chamam quando a conta é `role = admin`; quem grava (log de
// auditoria do módulo `admin`) fica atrás desta porta pra o `auth` não
// depender do `admin`. Falha ao gravar nunca pode derrubar o login.
export type AdminSessionEventKind = 'login' | 'login_failed' | 'reauth' | 'reauth_failed'

export interface AdminSessionAuditor {
  record(event: { adminId: string; kind: AdminSessionEventKind }): Promise<void>
}
