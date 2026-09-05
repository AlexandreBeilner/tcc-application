export interface MacroEventTriggerFormProps {
    // Chamado depois do disparo confirmado com sucesso — a tela (10.2)
    // decide o que fazer (inventário: "confirma e retorna a 10.1").
    onTriggered: () => void
}
