// Gera o token aleatório do link e calcula o hash que vai pro banco (SHA-256). Atrás de uma port
// pra o caso de uso não depender de `crypto` e o teste usar tokens previsíveis.
export interface EmailTokenGenerator {
  generate(): { token: string; tokenHash: string }
  hash(token: string): string
}
