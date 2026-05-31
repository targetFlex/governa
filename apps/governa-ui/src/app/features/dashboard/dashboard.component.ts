// ============================================================
// dashboard.component.ts
//
// Rota protegida — placeholder para o dashboard de governança.
// Sessões futuras expandirão com widgets de pedidos/clientes.
// ============================================================

import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../core/auth/auth.service';

@Component({
  selector: 'gov-dashboard',
  standalone: true,
  imports: [CommonModule],
  template: `
    <main class="dashboard" role="main">
      <header class="dashboard-header">
        <h1 class="dashboard-title">Dashboard</h1>
        <button class="btn-logout" (click)="logout()" type="button">
          Sair
        </button>
      </header>

      <section class="dashboard-content">
        <p class="dashboard-placeholder">
          Governa UI — conectado ao gateway em <code>http://localhost:3100</code>.
          Módulos de pedidos e clientes serão adicionados nas próximas sessões.
        </p>
      </section>
    </main>
  `,
  styles: [`
    .dashboard {
      padding: var(--gov-space-8);
      max-width: 1200px;
      margin: 0 auto;
    }

    .dashboard-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: var(--gov-space-8);
      padding-bottom: var(--gov-space-4);
      border-bottom: 1px solid var(--gov-color-border);
    }

    .dashboard-title {
      font-size: var(--gov-font-size-2xl);
      font-weight: var(--gov-font-weight-bold);
      color: var(--gov-color-text-primary);
    }

    .btn-logout {
      padding: var(--gov-space-2) var(--gov-space-4);
      background: transparent;
      color: var(--gov-color-text-secondary);
      border: 1px solid var(--gov-color-border);
      border-radius: var(--gov-radius-md);
      font-size: var(--gov-font-size-sm);
      transition: all var(--gov-transition-fast);

      &:hover {
        background: var(--gov-color-error-100);
        border-color: var(--gov-color-error-500);
        color: var(--gov-color-error-700);
      }
    }

    .dashboard-placeholder {
      color: var(--gov-color-text-secondary);
      font-size: var(--gov-font-size-base);
      line-height: var(--gov-line-height-relaxed);

      code {
        font-family: var(--gov-font-family-mono);
        font-size: var(--gov-font-size-sm);
        background: var(--gov-color-neutral-100);
        padding: 2px 6px;
        border-radius: var(--gov-radius-sm);
      }
    }
  `],
})
export class DashboardComponent {
  private readonly auth = inject(AuthService);

  logout(): void {
    this.auth.logout();
  }
}
