// ============================================================
// auth.guard.ts
//
// Functional guard (Angular 15+): protege rotas que exigem
// autenticação. Redireciona para /login se não autenticado.
//
// Uso nas rotas:
//   canActivate: [authGuard]
// ============================================================

import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

export const authGuard: CanActivateFn = () => {
  const auth   = inject(AuthService);
  const router = inject(Router);

  if (auth.isAuthenticated()) {
    return true;
  }

  return router.createUrlTree(['/login']);
};
