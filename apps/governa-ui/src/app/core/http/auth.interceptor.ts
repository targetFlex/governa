// ============================================================
// auth.interceptor.ts
//
// Interceptor funcional (Angular 15+): injeta o Bearer token
// em todas as requisições ao governa-gateway.
// Requisições para outros domínios não são alteradas.
// ============================================================

import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '../auth/auth.service';
import { environment } from '@env/environment';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth  = inject(AuthService);
  const token = auth.getToken();

  const isGatewayRequest = req.url.startsWith(environment.gatewayBaseUrl);

  if (!token || !isGatewayRequest) {
    return next(req);
  }

  const authReq = req.clone({
    setHeaders: { Authorization: `Bearer ${token}` },
  });

  return next(authReq);
};
