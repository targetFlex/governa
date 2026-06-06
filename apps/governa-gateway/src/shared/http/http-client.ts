// ============================================================
// http-client.ts — AxiosInstance com interceptors de auth
//
// Request interceptor: injeta Authorization em toda request.
// Response interceptor: em 401, invalida cache e retenta 1x.
//   - Segunda falha com 401 → erro propagado (sem loop infinito).
// ============================================================
import axios, { AxiosInstance, InternalAxiosRequestConfig } from 'axios'
import { ProtheusAuthClient } from '../../auth/protheus-auth.client'

interface RetryableRequest extends InternalAxiosRequestConfig {
  _retry?: boolean
}

export function createHttpClient(
  authClient: ProtheusAuthClient,
  baseURL:    string,
  timeoutMs:  number,
): AxiosInstance {
  const instance = axios.create({ baseURL, timeout: timeoutMs })

  // ---- Request: injetar Authorization ----
  instance.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
    const token = await authClient.getToken()
    config.headers = config.headers ?? {}
    config.headers['Authorization'] = formatAuthHeader(token)
    return config
  })

  // ---- Response: 401 → invalidar + retry único ----
  instance.interceptors.response.use(
    (res: import('axios').AxiosResponse) => res,
    async (error: unknown) => {
      const originalRequest = (error as any)?.config as RetryableRequest | undefined

      if (
        (error as any)?.response?.status === 401 &&
        originalRequest &&
        !originalRequest._retry
      ) {
        originalRequest._retry = true
        authClient.invalidate()

        const newToken = await authClient.getToken()
        originalRequest.headers = originalRequest.headers ?? {}
        originalRequest.headers['Authorization'] = formatAuthHeader(newToken)

        return instance.request(originalRequest)
      }

      return Promise.reject(error)
    },
  )

  return instance
}

function formatAuthHeader(token: string): string {
  // Basic Auth já vem com o prefixo "Basic "
  return token.startsWith('Basic ') ? token : `Bearer ${token}`
}
