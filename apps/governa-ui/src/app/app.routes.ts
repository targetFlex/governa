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
        data: { title: 'Dashboard' },
        loadComponent: () =>
          import('./features/dashboard/dashboard.component').then(m => m.DashboardComponent),
      },
      {
        path: 'agentes',
        data: { title: 'Agentes' },
        loadComponent: () =>
          import('./features/agentes/agentes-list/agentes-list.component').then(m => m.AgentesListComponent),
      },
      {
        path: 'agentes/novo',
        data: { title: 'Novo Agente' },
        loadComponent: () =>
          import('./features/agentes/agente-form/agente-form.component').then(m => m.AgenteFormComponent),
      },
      {
        path: 'agentes/:id',
        data: { title: 'Detalhe do Agente' },
        loadComponent: () =>
          import('./features/agentes/agente-detail/agente-detail.component').then(m => m.AgenteDetailComponent),
      },
      {
        path: 'alertas',
        data: { title: 'Alertas' },
        loadComponent: () =>
          import('./features/alertas/alertas-list/alertas-list.component').then(m => m.AlertasListComponent),
      },
      {
        path: 'auditoria',
        data: { title: 'Auditoria' },
        loadComponent: () =>
          import('./features/auditoria/auditoria-list/auditoria-list.component').then(m => m.AuditoriaListComponent),
      },
      {
        path: 'clientes',
        data: { title: 'Clientes' },
        loadComponent: () =>
          import('./features/clientes/clientes-list/clientes-list.component').then(m => m.ClientesListComponent),
      },
      {
        path: 'pedidos',
        data: { title: 'Pedidos' },
        loadComponent: () =>
          import('./features/pedidos/pedidos-list/pedidos-list.component').then(m => m.PedidosListComponent),
      },
      {
        path: 'politicas/:id',
        data: { title: 'Políticas' },
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
