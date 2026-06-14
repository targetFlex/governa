// ============================================================
// protheus-errors.ts — Dicionário de erros upstream Protheus
// Todos os conectores mapeiam para UpstreamError tipado.
// ============================================================

export class UpstreamError extends Error {
  constructor(
    public readonly code:       string,
    message:                    string,
    public readonly httpStatus: number,
    public readonly source:     string,
  ) {
    super(message)
    this.name = 'UpstreamError'
    // Manter stack trace correto em ambientes V8
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, UpstreamError)
    }
  }
}

interface ErrorEntry {
  code:    string
  message: string
}

const HTTP_ERROR_MAP: Record<number, ErrorEntry> = {
  400: { code: 'PROTHEUS_BAD_REQUEST',    message: 'Parâmetros inválidos enviados ao Protheus' },
  401: { code: 'PROTHEUS_UNAUTHORIZED',   message: 'Credenciais rejeitadas pelo Protheus' },
  403: { code: 'PROTHEUS_FORBIDDEN',      message: 'Acesso não autorizado ao recurso Protheus' },
  404: { code: 'PROTHEUS_NOT_FOUND',      message: 'Recurso não encontrado no Protheus' },
  408: { code: 'PROTHEUS_TIMEOUT',        message: 'Timeout na comunicação com o Protheus' },
  429: { code: 'PROTHEUS_RATE_LIMITED',   message: 'Rate limit atingido no Protheus' },
  500: { code: 'PROTHEUS_INTERNAL_ERROR', message: 'Erro interno do Protheus' },
  502: { code: 'PROTHEUS_BAD_GATEWAY',    message: 'Bad gateway — Protheus retornou resposta inválida' },
  503: { code: 'PROTHEUS_UNAVAILABLE',    message: 'Protheus temporariamente indisponível' },
  504: { code: 'PROTHEUS_GATEWAY_TIMEOUT',message: 'Gateway timeout — Protheus não respondeu a tempo' },
}

const AUTH_ERROR_CODE = 'PROTHEUS_AUTH_UNAVAILABLE'

export function handleUpstreamError(error: unknown, connector: string): UpstreamError {
  // Timeout Axios (sem response HTTP)
  if (isAxiosTimeout(error)) {
    return new UpstreamError('PROTHEUS_TIMEOUT', 'Timeout na comunicação com o Protheus', 408, connector)
  }

  const status: number = (error as any)?.response?.status ?? 0

  const mapped: ErrorEntry = HTTP_ERROR_MAP[status] ?? {
    code:    'PROTHEUS_UNKNOWN_ERROR',
    message: 'Erro desconhecido ao comunicar com o Protheus',
  }

  return new UpstreamError(mapped.code, mapped.message, status, connector)
}

export function handleAuthError(error: unknown, connector: string): UpstreamError {
  if (isAxiosTimeout(error)) {
    return new UpstreamError(AUTH_ERROR_CODE, 'Timeout ao autenticar no Protheus', 408, connector)
  }

  const status: number = (error as any)?.response?.status ?? 500
  return new UpstreamError(
    AUTH_ERROR_CODE,
    `Falha de autenticação no Protheus — HTTP ${status}`,
    status,
    connector,
  )
}

function isAxiosTimeout(error: unknown): boolean {
  return (error as any)?.code === 'ECONNABORTED' || (error as any)?.code === 'ERR_NETWORK'
}
