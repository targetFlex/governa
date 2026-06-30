import { Routes } from '@angular/router';
import { authGuard } from './core/auth/auth.guard';
import { AppShellComponent } from './shared/layout/app-shell/app-shell.component';

export const APP_ROUTES: Routes = [
  {
    path: 'login',
    loadComponent: () =>
      import('./features/auth/login/login.component').then(m => m.LoginComponent),
  },
  {
    path: '',
    component: AppShellComponent,
    canActivate: [authGuard],
    children: [
      {
        path: '',
        redirectTo: 'dashboard',
        pathMatch: 'full',
      },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./features/dashboard/dashboard.component').then(m => m.DashboardComponent),
      },
      {
        path: 'agentes',
        loadComponent: () =>
          import('./features/agentes/agentes-list/agentes-list.component').then(m => m.AgentesListComponent),
      },
      {
        path: 'alertas',
        loadComponent: () =>
          import('./features/alertas/alertas-list/alertas-list.component').then(m => m.AlertasListComponent),
      },
      {
        path: 'auditoria',
        loadComponent: () =>
          import('./features/auditoria/auditoria-list/auditoria-list.component').then(m => m.AuditoriaListComponent),
      },
      {
        path: 'clientes',
        loadComponent: () =>
          import('./features/clientes/clientes-list/clientes-list.component').then(m => m.ClientesListComponent),
      },
      {
        path: 'pedidos',
        loadComponent: () =>
          import('./features/pedidos/pedidos-list/pedidos-list.component').then(m => m.PedidosListComponent),
      },
      {
        path: 'politicas/:id',
        loadComponent: () =>
          import('./features/politicas/politica-form/politica-form.component').then(m => m.PoliticaFormComponent),
      },
    ],
  },
  {
    path: '**',
    redirectTo: '/login',
  },
];
