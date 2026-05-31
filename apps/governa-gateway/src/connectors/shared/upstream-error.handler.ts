// ============================================================
// upstream-error.handler.ts — Re-export do dicionário de erros
//
// Ponto de entrada para conectores consumirem UpstreamError e
// handleUpstreamError sem depender diretamente do caminho de
// shared/errors (isolamento de domínio de conector).
//
// A implementação canônica vive em:
//   src/shared/errors/protheus-errors.ts
// ============================================================

export {
  UpstreamError,
  handleUpstreamError,
  handleAuthError,
} from '../../shared/errors/protheus-errors'
