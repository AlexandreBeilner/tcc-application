// Sonda de um componente: resolve se ele respondeu, rejeita (com o motivo) se não.
// A latência e o prazo máximo ficam no caso de uso, não em cada adapter.
export interface HealthProbe {
  check(): Promise<void>
}
