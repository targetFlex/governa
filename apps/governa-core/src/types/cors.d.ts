// Shim de tipos para o pacote `cors` — substitui @types/cors (não instalado).
// Cobre apenas o uso em app.ts: `cors()` sem opções retorna um RequestHandler.
declare module 'cors' {
  import type { RequestHandler } from 'express'
  function cors(options?: Record<string, unknown>): RequestHandler
  export = cors
}
