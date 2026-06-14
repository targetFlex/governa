import { Routes } from '@angular/router';
import { authGuard } from './core/auth/auth.guard';

export const APP_ROUTES: Routes = [
  {
    path: '',
    redirectTo: 'dashboard',
    pathMatch: 'full',
  },
  {
    path: 'login',
    loadComponent: () =>
      import('./features/auth/login/login.component').then(
        (m) => m.LoginComponent,
      ),
  },
  {
    path: 'dashboard',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/dashboard/dashboard.component').then(
        (m) => m.DashboardComponent,
      ),
  },
  {
    path: 'clientes',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/clientes/clientes-list/clientes-list.component').then(
        (m) => m.ClientesListComponent,
      ),
  },
  {
    path: 'pedidos',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/pedidos/pedidos-list/pedidos-list.component').then(
        (m) => m.PedidosListComponent,
      ),
  },
  {
    path: 'agentes',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/agentes/agentes-list/agentes-list.component').then(
        (m) => m.AgentesListComponent,
      ),
  },
  {
    path: 'politicas/:id',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/politicas/politica-form/politica-form.component').then(
        (m) => m.PoliticaFormComponent,
      ),
  },
  {
    path: 'auditoria',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/auditoria/auditoria-list/auditoria-list.component').then(
        (m) => m.AuditoriaListComponent,
      ),
  },
  {
    path: 'alertas',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/alertas/alertas-list/alertas-list.component').then(
        (m) => m.AlertasListComponent,
      ),
  },
  {
    path: '**',
    redirectTo: 'dashboard',
  },
];
