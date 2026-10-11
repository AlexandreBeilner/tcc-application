/**
 * Ponte de download entre o SPA (rodando dentro do WebView) e o
 * compartilhamento nativo — tarefa 2.3 do backlog de app mobile,
 * arquitetura-app-mobile-react-native-webview.md §9. A tela de Privacidade/
 * LGPD (`PrivacidadeLgpd/index.tsx`) gera o arquivo de exportação via
 * `Blob` + `URL.createObjectURL` + `<a download>` clicado por script — um
 * `<a download>` com `href` `blob:` não dispara download nenhum dentro de um
 * WebView, nem Android nem iOS. Funções puras/testáveis aqui; efeitos
 * colaterais (fetch do blob, postMessage, Share nativo) ficam em App.tsx e no
 * próprio script injetado.
 *
 * @format
 */

export const FILE_DOWNLOAD_MESSAGE_TYPE = 'selucra:file-download';

export interface FileDownloadMessage {
  type: typeof FILE_DOWNLOAD_MESSAGE_TYPE;
  filename: string;
  mimeType: string;
  base64: string;
}

/**
 * injectedJavaScript: instala um listener de `click` em fase de captura no
 * `document` (roda antes de qualquer handler do próprio SPA, incluindo o
 * `link.click()` disparado por `PrivacidadeLgpd.handleExport`). Detecta
 * cliques em `<a download>` cujo `href` seja uma blob: URL, bloqueia o
 * comportamento padrão do WebView (que não faz nada com blob: mesmo) e busca
 * o próprio blob via `fetch` (mesma origem, mesmo documento, já teria o
 * objeto em memória) pra converter em base64 e mandar pro lado nativo.
 * Fase de captura + `stopImmediatePropagation` é o que evita qualquer efeito
 * colateral de um handler de clique do SPA rodando em cima do mesmo evento.
 */
export function buildDownloadInterceptorScript(): string {
  return `
(function () {
  if (window.__selucraDownloadInterceptorInstalled) { return; }
  window.__selucraDownloadInterceptorInstalled = true;
  var MESSAGE_TYPE = ${JSON.stringify(FILE_DOWNLOAD_MESSAGE_TYPE)};

  document.addEventListener('click', function (event) {
    var target = event.target;
    var anchor = target && target.closest ? target.closest('a[download]') : null;
    if (!anchor) { return; }

    var href = anchor.getAttribute('href') || '';
    if (href.indexOf('blob:') !== 0) { return; }

    event.preventDefault();
    event.stopImmediatePropagation();

    var filename = anchor.getAttribute('download') || 'download';

    fetch(href)
      .then(function (response) { return response.blob(); })
      .then(function (blob) {
        var reader = new FileReader();
        reader.onloadend = function () {
          var dataUrl = String(reader.result || '');
          var commaIndex = dataUrl.indexOf(',');
          var base64 = commaIndex >= 0 ? dataUrl.slice(commaIndex + 1) : '';
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: MESSAGE_TYPE,
            filename: filename,
            mimeType: blob.type || 'application/octet-stream',
            base64: base64,
          }));
        };
        reader.readAsDataURL(blob);
      })
      .catch(function () {
        // Falha ao buscar/ler o próprio blob (raro — já está em memória no
        // mesmo documento): sem mensagem nenhuma pro lado nativo, o usuário
        // só não vê o share sheet abrir. Sem retry automático, fora de
        // escopo desta tarefa.
      });
  }, true);
})();
true;
`;
}

/**
 * Parseia o payload de onMessage do WebView. Retorna null pra qualquer coisa
 * que não seja uma mensagem de download reconhecida — mesma disciplina de
 * `sessionBridge.parseAuthTokenChangedMessage`, uma mensagem malformada ou de
 * outra origem não pode derrubar o app nativo.
 */
export function parseFileDownloadMessage(
  data: string,
): FileDownloadMessage | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(data);
  } catch {
    return null;
  }

  if (typeof parsed !== 'object' || parsed === null) {
    return null;
  }

  const candidate = parsed as {
    type?: unknown;
    filename?: unknown;
    mimeType?: unknown;
    base64?: unknown;
  };

  if (candidate.type !== FILE_DOWNLOAD_MESSAGE_TYPE) {
    return null;
  }
  if (
    typeof candidate.filename !== 'string' ||
    typeof candidate.mimeType !== 'string' ||
    typeof candidate.base64 !== 'string'
  ) {
    return null;
  }

  return {
    type: FILE_DOWNLOAD_MESSAGE_TYPE,
    filename: candidate.filename,
    mimeType: candidate.mimeType,
    base64: candidate.base64,
  };
}
