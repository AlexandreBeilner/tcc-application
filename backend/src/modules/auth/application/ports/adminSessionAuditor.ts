// Registro de login e reautenticação de administrador (N.22). Os casos de uso
// do `auth` só chamam quando a conta é `role = admin`; quem grava (log de
// auditoria do módulo `admin`) fica atrás desta porta pra o `auth` não
// depender do `admin`. Falha ao gravar nunca pode derrubar o login.
// `password_reset_denied`: alguém pediu redefinição por e-mail para uma conta admin (D7).
export type AdminSessionEventKind =
  'login' | 'login_failed' | 'reauth' | 'reauth_failed' | 'password_reset_denied'

export interface AdminSessionAuditor {
  record(event: { adminId: string; kind: AdminSessionEventKind }): Promise<void>
}
