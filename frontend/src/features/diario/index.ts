// Porta de entrada do módulo do Diário (DI.3.1). O jogo é escrito uma vez, sem framework, em `landing/src/diario/`
// (a landing monta em modo `publico`, o app em modo `app` dentro de um organismo fino, DI.4.1). Importar por aqui
// mantém o caminho relativo num lugar só. O CSS do módulo (`landing/src/diario/diario.css`) é importado pelo organismo.
export * from '../../../../landing/src/diario/index.ts'
