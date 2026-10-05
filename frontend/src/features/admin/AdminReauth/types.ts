export interface AdminReauthContextValue {
    // Roda `run` com o token atual; se o backend devolver `401 reauth_required`,
    // pede a senha, troca o token da sessão e repete `run` uma vez com o novo.
    withReauth<T>(run: (token: string) => Promise<T>): Promise<T>
}
